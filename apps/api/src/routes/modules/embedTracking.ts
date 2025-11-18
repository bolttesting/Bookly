import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { trackEmbedEvent, getEmbedAnalytics, type EmbedEventType } from '../../services/embedTrackingService.js';

const embedTrackingRouter = Router();

// Public endpoint for tracking embed events (no auth required)
const trackEventSchema = z.object({
  bookingPageId: z.string().cuid().nullable(),
  eventType: z.enum([
    'VIEW',
    'SERVICE_SELECTED',
    'STAFF_SELECTED',
    'TIME_SELECTED',
    'CUSTOMER_FORM_STARTED',
    'CUSTOMER_FORM_COMPLETED',
    'PAYMENT_STARTED',
    'PAYMENT_COMPLETED',
    'BOOKING_COMPLETED',
    'DROPOFF',
  ]),
  sessionId: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

embedTrackingRouter.post('/track', async (req, res, next) => {
  try {
    const { bookingPageId, eventType, sessionId, metadata } = trackEventSchema.parse(req.body);

    // Get business ID from booking page
    const { prisma } = await import('../../config/prisma.js');
    const db = prisma as any;
    let businessId: string | null = null;

    if (bookingPageId) {
      const bookingPage = await db.bookingPage.findUnique({
        where: { id: bookingPageId },
        select: { businessId: true },
      });
      if (bookingPage) {
        businessId = bookingPage.businessId;
      }
    }

    if (!businessId) {
      return res.status(400).json({ message: 'Invalid booking page' });
    }

    const referrer = req.get('Referer') || req.get('Referrer');
    const userAgent = req.get('User-Agent');
    const ipAddress = req.ip || req.socket.remoteAddress || undefined;

    await trackEmbedEvent(
      businessId,
      bookingPageId,
      eventType as EmbedEventType,
      sessionId,
      metadata,
      referrer,
      userAgent,
      ipAddress,
    );

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Authenticated endpoint for viewing analytics
const analyticsQuerySchema = z.object({
  bookingPageId: z.string().cuid().nullable().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

embedTrackingRouter.get('/analytics', authenticate(), async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Business context required' });
    }

    const { bookingPageId, startDate, endDate } = analyticsQuerySchema.parse(req.query);

    const analytics = await getEmbedAnalytics(
      req.user.businessId,
      bookingPageId || null,
      new Date(startDate),
      new Date(endDate),
    );

    res.json(analytics);
  } catch (error) {
    next(error);
  }
});

export { embedTrackingRouter };

