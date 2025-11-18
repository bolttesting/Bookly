import type { Prisma } from '@prisma/client';
import { addMinutes, subMinutes } from 'date-fns';

import { prisma } from '../config/prisma.js';
import { ACTIVE_APPOINTMENT_STATUSES } from '../constants/enums.js';

type ConflictInput = {
  businessId: string;
  staffId?: string | null;
  service: Pick<
    Prisma.ServiceUncheckedCreateInput,
    'bufferBeforeMinutes' | 'bufferAfterMinutes' | 'durationMinutes'
  >;
  start: Date;
  end?: Date;
  excludeAppointmentId?: string;
  serviceId?: string;
  allowSharedSlots?: boolean;
};

export const ensureNoConflicts = async ({
  businessId,
  staffId,
  service,
  start,
  end,
  excludeAppointmentId,
  serviceId,
  allowSharedSlots,
}: ConflictInput) => {
  if (!staffId) return;

  const computedEnd = end ?? addMinutes(start, service.durationMinutes);
  const bufferedStart = subMinutes(start, service.bufferBeforeMinutes);
  const bufferedEnd = addMinutes(computedEnd, service.bufferAfterMinutes);

  const conflict = await prisma.appointment.findFirst({
    where: {
      businessId,
      staffId,
      id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
      status: { in: ACTIVE_APPOINTMENT_STATUSES },
      startTime: { lt: bufferedEnd },
      endTime: { gt: bufferedStart },
      ...(allowSharedSlots && serviceId ? { serviceId: { not: serviceId } } : {}),
    },
  });

  if (conflict) {
    throw new ConflictError('Appointment conflict detected');
  }
};

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

