import type { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { Router } from 'express';
import { addMinutes } from 'date-fns';
import { z } from 'zod';

import { prisma } from '../../config/prisma.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  publishAppointmentEvent,
  subscribeToAppointmentEvents,
} from '../../lib/appointmentEvents.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { ensureNoConflicts, ConflictError } from '../../utils/conflicts.js';
import {
  APPOINTMENT_SOURCE_VALUES,
  APPOINTMENT_STATUS_VALUES,
} from '../../constants/enums.js';
import {
  loadServiceWithStaff,
  resolveStaffAssignment,
  ensureServiceCapacityAvailable,
  SchedulingError,
  type ServiceWithCapacity,
} from '../../utils/scheduling.js';
import { createNotification } from '../../services/notificationService.js';
import {
  syncAppointmentToGoogle,
  deleteAppointmentFromGoogle,
  syncAppointmentToOutlook,
  deleteAppointmentFromOutlook,
} from '../../services/calendarSyncService.js';

const appointmentsRouter = Router();
const db = prisma as any;

const baseSchema = z.object({
  serviceId: z.string().cuid(),
  staffId: z.string().cuid().optional(),
  customerId: z.string().cuid().optional(),
  bookingPageId: z.string().cuid().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
  customerNotes: z.string().max(2000).optional(),
  source: z.enum(APPOINTMENT_SOURCE_VALUES).optional(),
});

const updateSchema = baseSchema.partial().extend({
  status: z.enum(APPOINTMENT_STATUS_VALUES).optional(),
});

const statusSchema = z.object({
  status: z.enum(APPOINTMENT_STATUS_VALUES),
});

appointmentsRouter.use(requirePermission(PERMISSIONS.MANAGE_APPOINTMENTS));

appointmentsRouter.get('/', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const { rangeStart, rangeEnd } = req.query;

    const where: any = {
      businessId: req.user.businessId,
    };

    if (rangeStart || rangeEnd) {
      where.startTime = {
        gte: rangeStart ? new Date(rangeStart as string) : undefined,
      };
      where.endTime = {
        lte: rangeEnd ? new Date(rangeEnd as string) : undefined,
      };
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        service: true,
        customer: true,
        staff: true,
      },
      orderBy: { startTime: 'asc' },
    });

    res.json({ appointments });
  } catch (error) {
    next(error);
  }
});

appointmentsRouter.get('/stream', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const unsubscribe = publishToClient(req.user.businessId, res);

    req.on('close', () => {
      unsubscribe();
      res.end();
    });
  } catch (error) {
    next(error);
  }
});

appointmentsRouter.post('/', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const payload = baseSchema.parse(req.body);

    const serviceData = await loadServiceWithStaff(payload.serviceId);

    if (!serviceData || serviceData.businessId !== req.user.businessId) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // Cast to ServiceWithCapacity since these fields exist in the DB
    const service = serviceData as ServiceWithCapacity;

    const start = new Date(payload.startTime);
    const end =
      payload.endTime !== undefined
        ? new Date(payload.endTime)
        : addMinutes(start, service.durationMinutes);

    let staffId = payload.staffId ?? null;

    try {
      const resolvedStaffId = await resolveStaffAssignment({
        service,
        preferredStaffId: payload.staffId ?? undefined,
        businessId: req.user.businessId,
        start,
        end,
      });
      staffId = resolvedStaffId ?? staffId;
    } catch (error) {
      if (error instanceof SchedulingError) {
        return res.status(400).json({ message: error.message });
      }
      throw error;
    }

    if (!staffId && !service.allowAnyStaff) {
      return res.status(400).json({ message: 'This service requires a staff member.' });
    }

    if (staffId) {
      await ensureNoConflicts({
        businessId: req.user.businessId,
        staffId,
        service,
        start,
        end,
        serviceId: service.id,
        allowSharedSlots: service.capacityType === 'MULTI',
      });
    }

    await ensureServiceCapacityAvailable({
      businessId: req.user.businessId,
      serviceId: service.id,
      start,
      end,
      maxClientsPerSlot: service.maxClientsPerSlot,
    });

    const appointment = await prisma.appointment.create({
      data: {
        businessId: req.user.businessId,
        serviceId: payload.serviceId,
        staffId,
        customerId: payload.customerId,
        bookingPageId: payload.bookingPageId,
        startTime: start,
        endTime: end,
        status: 'PENDING',
        source: payload.source ?? 'INTERNAL',
        notes: payload.notes,
        customerNotes: payload.customerNotes,
      },
      include: {
        service: true,
        customer: true,
        staff: true,
      },
    });

    publishAppointmentEvent({
      id: appointment.id,
      businessId: req.user.businessId,
      type: 'appointment.created',
      data: appointment,
    });

    // Create notification for staff member if assigned
    if (appointment.staffId && appointment.staff) {
      const staffMember = await db.staffMember.findUnique({
        where: { id: appointment.staffId },
        include: { user: true },
      });

      if (staffMember?.user) {
        await createNotification({
          businessId: req.user.businessId,
          userId: staffMember.user.id,
          staffId: appointment.staffId,
          type: 'APPOINTMENT_CREATED',
          title: 'New appointment scheduled',
          message: `${appointment.customer ? `${appointment.customer.firstName} ${appointment.customer.lastName}` : 'Customer'} booked ${appointment.service.name} on ${new Date(appointment.startTime).toLocaleDateString()} at ${new Date(appointment.startTime).toLocaleTimeString()}`,
          link: `/calendar?date=${new Date(appointment.startTime).toISOString().split('T')[0]}`,
          metadata: {
            appointmentId: appointment.id,
            serviceId: appointment.serviceId,
            customerId: appointment.customerId,
          },
        });

        // Sync to calendar if staff has active connection
        if (appointment.staffId) {
          const calendarConnections = await db.calendarConnection.findMany({
            where: {
              businessId: req.user.businessId,
              staffId: appointment.staffId,
              status: 'ACTIVE',
              syncEnabled: true,
            },
          });

          for (const connection of calendarConnections) {
            try {
              if (connection.provider === 'GOOGLE') {
                await syncAppointmentToGoogle(connection.id, appointment);
              } else if (connection.provider === 'OUTLOOK') {
                await syncAppointmentToOutlook(connection.id, appointment);
              }
            } catch (error) {
              console.error(`Failed to sync appointment to ${connection.provider} Calendar:`, error);
              // Don't fail the request if calendar sync fails
            }
          }
        }
      }
    }

    res.status(201).json({ appointment });
  } catch (error) {
    if (error instanceof ConflictError) {
      return res.status(409).json({ message: error.message });
    }
    next(error);
  }
});

appointmentsRouter.put('/:appointmentId', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const payload = updateSchema.parse(req.body);
    const { appointmentId } = req.params;

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { service: true },
    });

    if (!appointment || appointment.businessId !== req.user.businessId) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    const serviceData =
      payload.serviceId && payload.serviceId !== appointment.serviceId
        ? await loadServiceWithStaff(payload.serviceId)
        : await loadServiceWithStaff(appointment.serviceId);

    if (!serviceData || serviceData.businessId !== req.user.businessId) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // Cast to ServiceWithCapacity since these fields exist in the DB
    const service = serviceData as ServiceWithCapacity;

    const start = payload.startTime ? new Date(payload.startTime) : appointment.startTime;
    const end = payload.endTime
      ? new Date(payload.endTime)
      : addMinutes(start, service.durationMinutes);

    const preferredStaffId = payload.staffId ?? appointment.staffId ?? undefined;
    let staffId = preferredStaffId ?? null;

    try {
      const resolvedStaffId = await resolveStaffAssignment({
        service,
        preferredStaffId,
        businessId: req.user.businessId,
        start,
        end,
      });
      staffId = resolvedStaffId ?? staffId;
    } catch (error) {
      if (error instanceof SchedulingError) {
        return res.status(400).json({ message: error.message });
      }
      throw error;
    }

    if (!staffId && !service.allowAnyStaff) {
      return res.status(400).json({ message: 'This service requires a staff member.' });
    }

    if (staffId) {
      await ensureNoConflicts({
        businessId: req.user.businessId,
        staffId,
        service,
        start,
        end,
        excludeAppointmentId: appointment.id,
        serviceId: service.id,
        allowSharedSlots: service.capacityType === 'MULTI',
      });
    }

    await ensureServiceCapacityAvailable({
      businessId: req.user.businessId,
      serviceId: service.id,
      start,
      end,
      maxClientsPerSlot: service.maxClientsPerSlot,
      excludeAppointmentId: appointment.id,
    });

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        serviceId: payload.serviceId ?? appointment.serviceId,
        staffId,
        customerId: payload.customerId ?? appointment.customerId,
        bookingPageId: payload.bookingPageId ?? appointment.bookingPageId,
        startTime: start,
        endTime: end,
        notes: payload.notes ?? appointment.notes,
        customerNotes: payload.customerNotes ?? appointment.customerNotes,
        status: payload.status ?? appointment.status,
      },
      include: {
        service: true,
        customer: true,
        staff: true,
      },
    });

    publishAppointmentEvent({
      id: updated.id,
      businessId: req.user.businessId,
      type: 'appointment.updated',
      data: updated,
    });

    // Sync to calendar if staff has active connection
    if (updated.staffId) {
      const calendarConnections = await db.calendarConnection.findMany({
        where: {
          businessId: req.user.businessId,
          staffId: updated.staffId,
          status: 'ACTIVE',
          syncEnabled: true,
        },
      });

      for (const connection of calendarConnections) {
        try {
          if (connection.provider === 'GOOGLE') {
            await syncAppointmentToGoogle(connection.id, updated);
          } else if (connection.provider === 'OUTLOOK') {
            await syncAppointmentToOutlook(connection.id, updated);
          }
        } catch (error) {
          console.error(`Failed to sync updated appointment to ${connection.provider} Calendar:`, error);
          // Don't fail the request if calendar sync fails
        }
      }
    }

    res.json({ appointment: updated });
  } catch (error) {
    if (error instanceof ConflictError) {
      return res.status(409).json({ message: error.message });
    }
    next(error);
  }
});

appointmentsRouter.put('/:appointmentId/status', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const payload = statusSchema.parse(req.body);
    const { appointmentId } = req.params;

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment || appointment.businessId !== req.user.businessId) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: payload.status,
        activities: {
          create: {
            status: payload.status,
            message: `Status changed to ${payload.status}`,
            createdByUser: req.user.id,
          },
        },
      },
      include: {
        service: true,
        customer: true,
        staff: true,
      },
    });

    publishAppointmentEvent({
      id: updated.id,
      businessId: req.user.businessId,
      type: 'appointment.updated',
      data: updated,
    });

    // Sync to calendar if staff has active connection
    if (updated.staffId) {
      const calendarConnections = await db.calendarConnection.findMany({
        where: {
          businessId: req.user.businessId,
          staffId: updated.staffId,
          status: 'ACTIVE',
          syncEnabled: true,
        },
      });

      for (const connection of calendarConnections) {
        try {
          if (connection.provider === 'GOOGLE') {
            await syncAppointmentToGoogle(connection.id, updated);
          } else if (connection.provider === 'OUTLOOK') {
            await syncAppointmentToOutlook(connection.id, updated);
          }
        } catch (error) {
          console.error(`Failed to sync status update to ${connection.provider} Calendar:`, error);
          // Don't fail the request if calendar sync fails
        }
      }
    }

    res.json({ appointment: updated });
  } catch (error) {
    next(error);
  }
});

appointmentsRouter.delete('/:appointmentId', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const { appointmentId } = req.params;

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment || appointment.businessId !== req.user.businessId) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Get appointment details before deletion for notification
    const appointmentWithDetails = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        staff: { include: { user: true } },
        service: true,
        customer: true,
      },
    });

    await prisma.appointment.delete({ where: { id: appointmentId } });

    publishAppointmentEvent({
      id: appointment.id,
      businessId: appointment.businessId,
      type: 'appointment.deleted',
    });

    // Check for waitlist promotions (for class occurrences)
    // This runs asynchronously to not block the deletion
    setImmediate(async () => {
      try {
        // If this was a class appointment, check for waitlist entries
        const classOccurrence = await db.classOccurrence.findFirst({
          where: {
            businessId: appointment.businessId,
            startTime: { lte: appointment.endTime, gte: appointment.startTime },
          },
        });

        if (classOccurrence) {
          const { promoteNextWaitlistEntry } = await import('../../services/waitlistService.js');
          try {
            await promoteNextWaitlistEntry({
              businessId: appointment.businessId,
              occurrenceId: classOccurrence.id,
            });
            console.log(`✅ Auto-promoted waitlist entry for class occurrence ${classOccurrence.id}`);
          } catch (error: any) {
            // Silently fail if no waitlist entries or class is still full
            if (error.name !== 'WaitlistPromotionError') {
              console.error('Failed to auto-promote waitlist:', error);
            }
          }
        }
      } catch (error) {
        console.error('Error checking waitlist promotion:', error);
      }
    });

    // Create notification for staff if appointment was assigned
    if (appointmentWithDetails?.staff?.user) {
      await createNotification({
        businessId: appointment.businessId,
        userId: appointmentWithDetails.staff.user.id,
        staffId: appointmentWithDetails.staffId || undefined,
        type: 'APPOINTMENT_CANCELLED',
        title: 'Appointment cancelled',
        message: `${appointmentWithDetails.customer ? `${appointmentWithDetails.customer.firstName} ${appointmentWithDetails.customer.lastName}` : 'Appointment'} for ${appointmentWithDetails.service.name} has been cancelled`,
        link: '/calendar',
        metadata: {
          appointmentId: appointment.id,
          serviceId: appointmentWithDetails.serviceId,
        },
      });

      // Delete from calendar if synced
      if (appointmentWithDetails.staffId) {
        const metadata = (appointmentWithDetails.metadata as Record<string, unknown>) || {};
        const googleEventId = metadata.googleEventId as string | undefined;
        const outlookEventId = metadata.outlookEventId as string | undefined;

        const calendarConnections = await db.calendarConnection.findMany({
          where: {
            businessId: appointment.businessId,
            staffId: appointmentWithDetails.staffId,
            status: 'ACTIVE',
          },
        });

        for (const connection of calendarConnections) {
          try {
            if (connection.provider === 'GOOGLE' && googleEventId) {
              await deleteAppointmentFromGoogle(connection.id, googleEventId);
            } else if (connection.provider === 'OUTLOOK' && outlookEventId) {
              await deleteAppointmentFromOutlook(connection.id, outlookEventId);
            }
          } catch (error) {
            console.error(`Failed to delete appointment from ${connection.provider} Calendar:`, error);
          }
        }
      }
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

function publishToClient(businessId: string, res: Response) {
  const listener = (event: Parameters<typeof publishAppointmentEvent>[0]) => {
    if (event.businessId !== businessId) return;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  const unsubscribe = subscribe(listener);
  res.write(': connected\n\n');
  return unsubscribe;
}

const subscribe = (listener: (event: Parameters<typeof publishAppointmentEvent>[0]) => void) => {
  return subscribeToAppointmentEvents(listener);
};

export { appointmentsRouter };

