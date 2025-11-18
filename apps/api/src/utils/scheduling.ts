import type { Prisma } from '@prisma/client';
import { addDays, startOfDay } from 'date-fns';

import { prisma } from '../config/prisma.js';
import { ACTIVE_APPOINTMENT_STATUSES } from '../constants/enums.js';
import { ConflictError } from './conflicts.js';

export class SchedulingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchedulingError';
  }
}

const serviceWithStaffInclude = {
  serviceStaff: {
    orderBy: { displayOrder: 'asc' },
    include: {
      staff: {
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          businessId: true,
        },
      },
    },
  },
} as any;

export type ServiceWithMeta = any;

export type ServiceWithCapacity = ServiceWithMeta & {
  capacityType: 'SINGLE' | 'MULTI';
  maxClientsPerSlot: number;
  allowAnyStaff: boolean;
};

const toMinutes = (value: Date) => value.getHours() * 60 + value.getMinutes();
const parseTimeString = (value: string) => {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
};

const getAvailabilityBlocks = async ({
  businessId,
  staffId,
  start,
}: {
  businessId: string;
  staffId: string;
  start: Date;
}) => {
  const dayStart = startOfDay(start);
  const dayEnd = addDays(dayStart, 1);

  return prisma.availabilityBlock.findMany({
    where: {
      businessId,
      staffId,
      OR: [
        { isOverride: true, date: { gte: dayStart, lt: dayEnd } },
        { isOverride: false, dayOfWeek: start.getDay() },
      ],
    },
  });
};

export const isStaffAvailableDuringInterval = async ({
  businessId,
  staffId,
  start,
  end,
}: {
  businessId: string;
  staffId: string;
  start: Date;
  end: Date;
}) => {
  const blocks = await getAvailabilityBlocks({ businessId, staffId, start });

  const overrides = blocks.filter((block: any) => block.isOverride);
  const relevantBlocks = overrides.length ? overrides : blocks.filter((block: any) => !block.isOverride);

  if (!relevantBlocks.length) return true;

  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);

  return relevantBlocks.some((block: any) => {
    const blockStart = parseTimeString(block.startTime);
    const blockEnd = parseTimeString(block.endTime);
    return startMinutes >= blockStart && endMinutes <= blockEnd;
  });
};

export const ensureServiceCapacityAvailable = async ({
  businessId,
  serviceId,
  start,
  end,
  maxClientsPerSlot,
  excludeAppointmentId,
}: {
  businessId: string;
  serviceId: string;
  start: Date;
  end: Date;
  maxClientsPerSlot: number;
  excludeAppointmentId?: string;
}) => {
  if (maxClientsPerSlot <= 0) {
    throw new SchedulingError('Service capacity must be at least 1 seat.');
  }

  const overlapCount = await prisma.appointment.count({
    where: {
      businessId,
      serviceId,
      id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
      status: { in: ACTIVE_APPOINTMENT_STATUSES },
      startTime: { lt: end },
      endTime: { gt: start },
    },
  });

  if (overlapCount >= maxClientsPerSlot) {
    throw new ConflictError('All seats are taken for this slot.');
  }
};

type StaffCandidate = {
  id: string;
  name: string | null;
  email: string | null;
  isActive: boolean;
  businessId: string;
};

const fetchStaffCandidates = async ({
  service,
  businessId,
  restrictToStaffId,
}: {
  service: ServiceWithMeta;
  businessId: string;
  restrictToStaffId?: string;
}): Promise<StaffCandidate[]> => {
  const assigned: StaffCandidate[] = service.serviceStaff
    .filter((assignment: any) => (restrictToStaffId ? assignment.staffId === restrictToStaffId : true))
    .map((assignment: any) => assignment.staff)
    .filter((staff: any): staff is NonNullable<typeof staff> => Boolean(staff))
    .map((staff: any) => ({
      id: staff.id,
      name: staff.name ?? '',
      email: staff.email ?? null,
      isActive: staff.isActive,
      businessId: staff.businessId,
    }));

  const filtered = assigned.filter((staff) => staff.businessId === businessId && staff.isActive);

  if (filtered.length || restrictToStaffId) {
    return filtered;
  }

  const fallback = await prisma.staffMember.findMany({
    where: { businessId, isActive: true },
    select: { id: true, name: true, email: true, isActive: true, businessId: true },
  });

  return fallback;
};

export const resolveStaffAssignment = async ({
  service,
  preferredStaffId,
  businessId,
  start,
  end,
}: {
  service: ServiceWithCapacity;
  preferredStaffId?: string;
  businessId: string;
  start: Date;
  end: Date;
}): Promise<string | null> => {
  const candidates = await fetchStaffCandidates({
    service,
    businessId,
    restrictToStaffId: preferredStaffId,
  });

  if (preferredStaffId && !candidates.some((candidate) => candidate.id === preferredStaffId)) {
    throw new SchedulingError('Selected staff is not available for this service.');
  }

  if (!candidates.length) {
    if (service.allowAnyStaff) {
      return null;
    }
    throw new SchedulingError('No staff members are assigned to this service.');
  }

  for (const candidate of candidates) {
    const available = await isStaffAvailableDuringInterval({
      businessId,
      staffId: candidate.id,
      start,
      end,
    });
    if (!available) continue;
    return candidate.id;
  }

  throw new SchedulingError('No staff members are available at the selected time.');
};

export const loadServiceWithStaff = (serviceId: string) =>
  prisma.service.findUnique({
    where: { id: serviceId },
    include: serviceWithStaffInclude,
  });

export const listEligibleStaffForService = async ({
  service,
  businessId,
}: {
  service: ServiceWithCapacity;
  businessId: string;
}) => {
  return fetchStaffCandidates({ service, businessId });
};

