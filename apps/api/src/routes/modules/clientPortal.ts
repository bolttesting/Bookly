import { createHash } from 'node:crypto';

import { Router } from 'express';
import type { Request } from 'express';
import { z } from 'zod';

import { prisma } from '../../config/prisma.js';
import { clearRefreshCookie, setRefreshCookie } from '../../utils/cookies.js';
import { createAccessToken } from '../../utils/tokens.js';
import { issuePortalToken } from '../../services/portalTokenService.js';
import { sendEmail } from '../../services/emailService.js';
import { portalMagicLinkHtml, portalMagicLinkText } from '../../templates/email/portalMagicLink.js';

class PortalAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PortalAuthError';
  }
}

const portalRouter = Router();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

const resolveSessionFromRequest = async (req: Request) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new PortalAuthError('Unauthorized');
  }

  const token = authHeader.slice(7);
  const tokenHash = createHash('sha256').update(token).digest('hex');

  const record = await db.customerPortalToken.findFirst({
    where: {
      tokenHash,
      used: true,
      expiresAt: { gt: new Date(Date.now() - 12 * 60 * 60 * 1000) },
    },
    include: {
      customer: true,
      business: true,
    },
  });

  if (!record) {
    throw new PortalAuthError('Invalid session');
  }

  return { token, record };
};

const requestSchema = z.object({
  email: z.string().email(),
});

const verifySchema = z.object({
  token: z.string().min(1),
});

const updateProfileSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
});

portalRouter.post('/auth/request-link', async (req, res, next) => {
  try {
    const payload = requestSchema.parse(req.body);

    const customer = await prisma.customer.findFirst({
      where: { email: payload.email },
      include: { business: true },
    });

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const { expiresAt, portalUrl } = await issuePortalToken({
      businessId: customer.businessId,
      customerId: customer.id,
      userAgent: req.headers['user-agent'],
    });

    try {
      if (customer.email) {
        await sendEmail({
          to: customer.email,
          subject: `${customer.business?.name ?? 'Bookly'} · Secure client portal link`,
          text: portalMagicLinkText({
            portalUrl,
            businessName: customer.business?.name ?? 'Bookly',
          }),
          html: portalMagicLinkHtml({
            portalUrl,
            businessName: customer.business?.name ?? 'Bookly',
          }),
        });
      }
    } catch (error) {
      console.error('Failed to send portal magic link', error);
    }

    res.json({
      message: 'Magic link generated',
      expiresAt,
    });
  } catch (error) {
    next(error);
  }
});

portalRouter.post('/auth/verify', async (req, res, next) => {
  try {
    const payload = verifySchema.parse(req.body);

    const tokenHash = createHash('sha256').update(payload.token).digest('hex');
    const record = await db.customerPortalToken.findFirst({
      where: {
        tokenHash,
        used: false,
        expiresAt: { gt: new Date() },
      },
      include: {
        customer: true,
      },
    });

    if (!record) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    await db.customerPortalToken.update({
      where: { id: record.id },
      data: { used: true },
    });

    const accessToken = createAccessToken({
      sub: record.customer.id,
      role: 'customer',
    });

    setRefreshCookie(res, payload.token);

    res.json({
      accessToken,
      portalToken: payload.token,
      customer: {
        id: record.customer.id,
        firstName: record.customer.firstName,
        lastName: record.customer.lastName,
        email: record.customer.email,
      },
      businessId: record.businessId,
    });
  } catch (error) {
    next(error);
  }
});

portalRouter.post('/auth/logout', async (_req, res) => {
  clearRefreshCookie(res);
  res.status(204).send();
});

portalRouter.get('/me', async (req, res, next) => {
  try {
    const { record } = await resolveSessionFromRequest(req);

    res.json({
      customer: {
        id: record.customer.id,
        firstName: record.customer.firstName,
        lastName: record.customer.lastName,
        email: record.customer.email,
        phone: record.customer.phone,
      },
      business: {
        id: record.businessId,
        name: record.business?.name,
      },
    });
  } catch (error) {
    if (error instanceof PortalAuthError) {
      return res.status(401).json({ message: error.message });
    }
    next(error);
  }
});

portalRouter.put('/profile', async (req, res, next) => {
  try {
    const payload = updateProfileSchema.parse(req.body);
    const { record } = await resolveSessionFromRequest(req);

    const customer = await prisma.customer.update({
      where: { id: record.customerId },
      data: {
        firstName: payload.firstName,
        lastName: payload.lastName,
        phone: payload.phone,
      },
    });

    res.json({ customer });
  } catch (error) {
    if (error instanceof PortalAuthError) {
      return res.status(401).json({ message: error.message });
    }
    next(error);
  }
});

portalRouter.get('/appointments', async (req, res, next) => {
  try {
    const { record } = await resolveSessionFromRequest(req);

    const appointments = await prisma.appointment.findMany({
      where: {
        businessId: record.businessId,
        customerId: record.customerId,
        startTime: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      include: {
        service: true,
        staff: {
          select: { id: true, name: true },
        },
      },
      orderBy: { startTime: 'asc' },
      take: 20,
    });

    res.json({ appointments });
  } catch (error) {
    if (error instanceof PortalAuthError) {
      return res.status(401).json({ message: error.message });
    }
    next(error);
  }
});

const rescheduleSchema = z.object({
  newStartTime: z.string().datetime(),
  newEndTime: z.string().datetime().optional(),
});

// Get availability for rescheduling
portalRouter.get('/appointments/:appointmentId/availability', async (req, res, next) => {
  try {
    const { record } = await resolveSessionFromRequest(req);
    const { appointmentId } = req.params;
    const { date } = req.query;

    if (typeof date !== 'string') {
      return res.status(400).json({ message: 'Date is required' });
    }

    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        businessId: record.businessId,
        customerId: record.customerId,
        status: { not: 'CANCELLED' },
      },
      include: {
        service: true,
        staff: true,
      },
    });

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Use the same availability logic as public booking
    const { loadServiceWithStaff, listEligibleStaffForService } = await import('../../utils/scheduling.js');
    const { computeSlots } = await import('../modules/publicBooking.js');

    const service = (await loadServiceWithStaff(appointment.serviceId)) as any;

    if (!service || service.businessId !== record.businessId) {
      return res.status(404).json({ message: 'Service not found' });
    }

    const eligibleStaff = await listEligibleStaffForService({
      service,
      businessId: record.businessId,
    });

    const staffList = appointment.staffId
      ? eligibleStaff.filter((staff: any) => staff.id === appointment.staffId)
      : eligibleStaff;

    const slots = await computeSlots({
      businessId: record.businessId,
      service,
      staff: staffList,
      date: date,
    });

    res.json({ availability: slots });
  } catch (error) {
    if (error instanceof PortalAuthError) {
      return res.status(401).json({ message: error.message });
    }
    next(error);
  }
});

portalRouter.post('/appointments/:appointmentId/reschedule', async (req, res, next) => {
  try {
    const { record } = await resolveSessionFromRequest(req);
    const { appointmentId } = req.params;
    const payload = rescheduleSchema.parse(req.body);

    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        businessId: record.businessId,
        customerId: record.customerId,
        status: { not: 'CANCELLED' },
      },
      include: {
        service: true,
        staff: true,
      },
    });

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found or cannot be rescheduled' });
    }

    // Check if rescheduling is allowed (basic policy: at least 2 hours before appointment)
    const appointmentStart = new Date(appointment.startTime);
    const now = new Date();
    const hoursUntilAppointment = (appointmentStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilAppointment < 2) {
      return res.status(400).json({
        message: 'Appointments can only be rescheduled at least 2 hours in advance. Please contact the business directly.',
      });
    }

    const newStartTime = new Date(payload.newStartTime);
    const newEndTime = payload.newEndTime ? new Date(payload.newEndTime) : new Date(newStartTime.getTime() + appointment.service.durationMinutes * 60 * 1000);

    // Check for conflicts (basic check - in production, use proper conflict detection)
    const conflictingAppointment = await prisma.appointment.findFirst({
      where: {
        businessId: record.businessId,
        staffId: appointment.staffId,
        id: { not: appointmentId },
        status: { not: 'CANCELLED' },
        OR: [
          {
            startTime: { lt: newEndTime },
            endTime: { gt: newStartTime },
          },
        ],
      },
    });

    if (conflictingAppointment) {
      return res.status(409).json({ message: 'The selected time slot is not available. Please choose another time.' });
    }

    // Update appointment
    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        startTime: newStartTime,
        endTime: newEndTime,
      },
      include: {
        service: true,
        customer: true,
        staff: true,
      },
    });

    // Sync to calendar if connected
    if (appointment.staffId) {
      const calendarConnections = await db.calendarConnection.findMany({
        where: {
          businessId: record.businessId,
          staffId: appointment.staffId,
          status: 'ACTIVE',
          syncEnabled: true,
        },
      });

      for (const connection of calendarConnections) {
        try {
          if (connection.provider === 'GOOGLE') {
            const { syncAppointmentToGoogle } = await import('../../services/calendarSyncService.js');
            await syncAppointmentToGoogle(connection.id, updated);
          } else if (connection.provider === 'OUTLOOK') {
            const { syncAppointmentToOutlook } = await import('../../services/calendarSyncService.js');
            await syncAppointmentToOutlook(connection.id, updated);
          }
        } catch (error) {
          console.error(`Failed to sync rescheduled appointment to ${connection.provider} Calendar:`, error);
        }
      }
    }

    res.json({ appointment: updated, message: 'Appointment rescheduled successfully' });
  } catch (error) {
    if (error instanceof PortalAuthError) {
      return res.status(401).json({ message: error.message });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid request', errors: error.errors });
    }
    next(error);
  }
});

portalRouter.delete('/appointments/:appointmentId', async (req, res, next) => {
  try {
    const { record } = await resolveSessionFromRequest(req);
    const { appointmentId } = req.params;

    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        businessId: record.businessId,
        customerId: record.customerId,
      },
    });

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    if (appointment.status === 'CANCELLED') {
      return res.status(400).json({ message: 'Appointment already cancelled' });
    }

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'CANCELLED' },
    });

    res.status(204).send();
  } catch (error) {
    if (error instanceof PortalAuthError) {
      return res.status(401).json({ message: error.message });
    }
    next(error);
  }
});

portalRouter.get('/packages', async (req, res, next) => {
  try {
    const { record } = await resolveSessionFromRequest(req);

    const packages = await db.customerPackage.findMany({
      where: {
        businessId: record.businessId,
        customerId: record.customerId,
      },
      include: {
        package: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ packages });
  } catch (error) {
    if (error instanceof PortalAuthError) {
      return res.status(401).json({ message: error.message });
    }
    next(error);
  }
});

portalRouter.get('/receipts', async (req, res, next) => {
  try {
    const { record } = await resolveSessionFromRequest(req);

    // Get payment intents/invoices for this customer
    const receipts = await db.paymentIntent.findMany({
      where: {
        businessId: record.businessId,
        customerId: record.customerId,
        status: { in: ['succeeded', 'paid'] },
      },
      include: {
        appointment: {
          include: {
            service: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const formattedReceipts = receipts.map((receipt: any) => ({
      id: receipt.id,
      amount: receipt.amount,
      currency: receipt.currency || 'AED',
      status: receipt.status,
      createdAt: receipt.createdAt,
      serviceName: receipt.appointment?.service?.name || 'Service',
      appointmentDate: receipt.appointment?.startTime,
      paymentMethod: receipt.paymentMethod || 'Card',
    }));

    res.json({ receipts: formattedReceipts });
  } catch (error) {
    if (error instanceof PortalAuthError) {
      return res.status(401).json({ message: error.message });
    }
    next(error);
  }
});

export { portalRouter };

