import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../../config/prisma.js';
import {
  createNotification,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../../services/notificationService.js';

const notificationsRouter = Router();

// Get notifications for current user/staff
notificationsRouter.get('/', async (req, res, next) => {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) {
      return res.status(400).json({ message: 'Business ID required' });
    }

    const status = (req.query.status as string) || 'UNREAD';
    const limit = parseInt((req.query.limit as string) || '50', 10);
    const db = prisma as any;

    const where: {
      businessId: string;
      status?: string;
      userId?: string;
      staffId?: string;
    } = {
      businessId,
    };

    if (status !== 'ALL') {
      where.status = status;
    }

    // If user has a staff profile, show notifications for both user and staff
    if (req.user?.id) {
      const staffMember = await db.staffMember.findFirst({
        where: {
          businessId,
          userId: req.user.id,
        },
      });

      if (staffMember) {
        where.staffId = staffMember.id;
      } else {
        where.userId = req.user.id;
      }
    }

    const notifications = await db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const unreadCount = await db.notification.count({
      where: {
        ...where,
        status: 'UNREAD',
      },
    });

    res.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
});

// Mark notification as read
notificationsRouter.put('/:id/read', async (req, res, next) => {
  try {
    const { id } = req.params;
    await markNotificationAsRead(id, req.user?.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Mark all notifications as read
notificationsRouter.put('/read-all', async (req, res, next) => {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) {
      return res.status(400).json({ message: 'Business ID required' });
    }

    const db = prisma as any;
    const staffMember = req.user?.id
      ? await db.staffMember.findFirst({
          where: {
            businessId,
            userId: req.user.id,
          },
        })
      : null;

    await markAllNotificationsAsRead(businessId, req.user?.id, staffMember?.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Create notification (for testing or internal use)
notificationsRouter.post('/', async (req, res, next) => {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) {
      return res.status(400).json({ message: 'Business ID required' });
    }

    const schema = z.object({
      type: z.enum([
        'APPOINTMENT_CREATED',
        'APPOINTMENT_CANCELLED',
        'APPOINTMENT_RESCHEDULED',
        'APPOINTMENT_REMINDER',
        'WAITLIST_PROMOTED',
        'PAYMENT_RECEIVED',
        'CUSTOMER_MESSAGE',
        'SYSTEM_ALERT',
      ]),
      title: z.string().min(1),
      message: z.string().min(1),
      link: z.string().optional(),
      userId: z.string().optional(),
      staffId: z.string().optional(),
      metadata: z.record(z.unknown()).optional(),
    });

    const payload = schema.parse(req.body);
    const notification = await createNotification({
      businessId,
      ...payload,
    });

    res.status(201).json(notification);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid request', errors: error.errors });
    }
    next(error);
  }
});

export { notificationsRouter };

