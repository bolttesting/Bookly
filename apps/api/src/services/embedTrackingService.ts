import { prisma } from '../config/prisma.js';

const db = prisma as any;

export type EmbedEventType =
  | 'VIEW'
  | 'SERVICE_SELECTED'
  | 'STAFF_SELECTED'
  | 'TIME_SELECTED'
  | 'CUSTOMER_FORM_STARTED'
  | 'CUSTOMER_FORM_COMPLETED'
  | 'PAYMENT_STARTED'
  | 'PAYMENT_COMPLETED'
  | 'BOOKING_COMPLETED'
  | 'DROPOFF';

export type EmbedEventMetadata = {
  serviceId?: string;
  staffId?: string;
  step?: string;
  dropoffReason?: string;
  [key: string]: unknown;
};

/**
 * Track an embed event
 */
export const trackEmbedEvent = async (
  businessId: string,
  bookingPageId: string | null,
  eventType: EmbedEventType,
  sessionId: string,
  metadata?: EmbedEventMetadata,
  referrer?: string,
  userAgent?: string,
  ipAddress?: string,
) => {
  await db.embedEvent.create({
    data: {
      businessId,
      bookingPageId: bookingPageId || null,
      eventType,
      sessionId,
      referrer: referrer || null,
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
      metadata: metadata || {},
    },
  });
};

/**
 * Get embed analytics for a business
 */
export const getEmbedAnalytics = async (
  businessId: string,
  bookingPageId: string | null,
  startDate: Date,
  endDate: Date,
) => {
  const where: any = {
    businessId,
    createdAt: {
      gte: startDate,
      lte: endDate,
    },
  };

  if (bookingPageId) {
    where.bookingPageId = bookingPageId;
  }

  // Get all events
  const events = await db.embedEvent.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  });

  // Calculate funnel metrics
  const views = events.filter((e: any) => e.eventType === 'VIEW').length;
  const serviceSelected = events.filter((e: any) => e.eventType === 'SERVICE_SELECTED').length;
  const staffSelected = events.filter((e: any) => e.eventType === 'STAFF_SELECTED').length;
  const timeSelected = events.filter((e: any) => e.eventType === 'TIME_SELECTED').length;
  const formStarted = events.filter((e: any) => e.eventType === 'CUSTOMER_FORM_STARTED').length;
  const formCompleted = events.filter((e: any) => e.eventType === 'CUSTOMER_FORM_COMPLETED').length;
  const paymentStarted = events.filter((e: any) => e.eventType === 'PAYMENT_STARTED').length;
  const paymentCompleted = events.filter((e: any) => e.eventType === 'PAYMENT_COMPLETED').length;
  const bookingsCompleted = events.filter((e: any) => e.eventType === 'BOOKING_COMPLETED').length;
  const dropoffs = events.filter((e: any) => e.eventType === 'DROPOFF').length;

  // Calculate conversion rates
  const conversionRates = {
    viewToService: views > 0 ? (serviceSelected / views) * 100 : 0,
    serviceToStaff: serviceSelected > 0 ? (staffSelected / serviceSelected) * 100 : 0,
    staffToTime: staffSelected > 0 ? (timeSelected / staffSelected) * 100 : 0,
    timeToForm: timeSelected > 0 ? (formStarted / timeSelected) * 100 : 0,
    formToCompletion: formStarted > 0 ? (formCompleted / formStarted) * 100 : 0,
    formToPayment: formCompleted > 0 ? (paymentStarted / formCompleted) * 100 : 0,
    paymentToBooking: paymentStarted > 0 ? (paymentCompleted / paymentStarted) * 100 : 0,
    overallConversion: views > 0 ? (bookingsCompleted / views) * 100 : 0,
  };

  // Get unique sessions
  const uniqueSessions = new Set(events.map((e: any) => e.sessionId)).size;

  // Get dropoff reasons
  const dropoffReasons = events
    .filter((e: any) => e.eventType === 'DROPOFF')
    .map((e: any) => (e.metadata as any)?.dropoffReason || 'Unknown')
    .reduce((acc: Record<string, number>, reason: string) => {
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {});

  // Get top referrers
  const referrers = events
    .filter((e: any) => e.referrer)
    .map((e: any) => {
      try {
        const url = new URL(e.referrer);
        return url.hostname;
      } catch {
        return e.referrer;
      }
    })
    .reduce((acc: Record<string, number>, hostname: string) => {
      acc[hostname] = (acc[hostname] || 0) + 1;
      return acc;
    }, {});

  return {
    summary: {
      totalViews: views,
      uniqueSessions,
      bookingsCompleted,
      dropoffs,
    },
    funnel: {
      views,
      serviceSelected,
      staffSelected,
      timeSelected,
      formStarted,
      formCompleted,
      paymentStarted,
      paymentCompleted,
      bookingsCompleted,
    },
    conversionRates,
    dropoffReasons,
    topReferrers: Object.entries(referrers)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 10)
      .map(([hostname, count]) => ({ hostname, count: count as number })),
  };
};

