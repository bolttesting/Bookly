import { Prisma } from '@prisma/client';
import { addDays, format, parseISO, set, startOfDay } from 'date-fns';
import { Router } from 'express';
import { z } from 'zod';

import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { ACTIVE_APPOINTMENT_STATUSES } from '../../constants/enums.js';
import { sendBookingNotifications } from '../../services/notificationService.js';
import { issuePortalToken } from '../../services/portalTokenService.js';
import { getTenantStripe, isTenantStripeConfigured } from '../../services/stripeService.js';
import { queueCampaignEvents } from '../../services/marketingService.js';
import { ensureTestDriveLimit } from '../../services/testDriveService.js';
import { ConflictError, ensureNoConflicts } from '../../utils/conflicts.js';
import type { ServiceWithCapacity } from '../../utils/scheduling.js';
import {
  ensureServiceCapacityAvailable,
  listEligibleStaffForService,
  loadServiceWithStaff,
  resolveStaffAssignment,
  SchedulingError,
} from '../../utils/scheduling.js';

const publicBookingRouter = Router();

type BookingPageWithServices = Prisma.BookingPageGetPayload<{
  include: { business: { include: { services: true } } };
}>;

type BookingPageWithBusiness = Prisma.BookingPageGetPayload<{
  include: { business: true };
}>;

const customerInfoSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  marketingConsent: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
});

const paymentIntentSchema = z.object({
  serviceId: z.string().cuid(),
  staffId: z.string().cuid().optional(),
  startTime: z.string().datetime(),
  customer: customerInfoSchema.pick({
    firstName: true,
    lastName: true,
    email: true,
  }),
});

const bookingPayloadSchema = z.object({
  serviceId: z.string().cuid(),
  staffId: z.string().cuid().optional(),
  startTime: z.string().datetime(),
  paymentIntentId: z.string().optional(),
  customer: customerInfoSchema,
});

const getServicePrice = (service: ServiceWithCapacity) => Number(service.price ?? 0);
const toMinorUnits = (service: ServiceWithCapacity) => Math.round(getServicePrice(service) * 100);
const shouldRequirePayment = (
  service: ServiceWithCapacity,
  business: { stripeAccountId?: string | null; stripeChargesEnabled?: boolean | null },
) => getServicePrice(service) > 0 && Boolean(business.stripeAccountId && business.stripeChargesEnabled);

publicBookingRouter.get('/:slug/embed.js', async (req, res, next) => {
  try {
    const { slug } = req.params;

    const bookingPage = await prisma.bookingPage.findUnique({
      where: { slug },
      select: { id: true, isActive: true },
    });

    if (!bookingPage || !bookingPage.isActive) {
      return res
        .status(404)
        .type('application/javascript')
        .send(`console.warn('Bookly embed: booking page not found');`);
    }

    const baseAppUrl = env.APP_BASE_URL.replace(/\/$/, '');
    const script = `
(function(){
  var script = document.currentScript;
  var targetSelector = script && script.getAttribute('data-bookly-target');
  var heightAttr = script && script.getAttribute('data-bookly-height');
  var themeAttr = script && script.getAttribute('data-bookly-theme');
  var mount = targetSelector ? document.querySelector(targetSelector) : null;
  if (!mount && script && script.parentNode) {
    mount = document.createElement('div');
    script.parentNode.insertBefore(mount, script);
  }
  if (!mount) {
    console.warn('Bookly embed: mount element not found');
    return;
  }
  var iframe = document.createElement('iframe');
  var params = '';
  if (themeAttr) {
    params = '?theme=' + encodeURIComponent(themeAttr);
  }
  iframe.src = '${baseAppUrl}/embed/${slug}' + params;
  iframe.style.border = '0';
  iframe.style.width = '100%';
  iframe.style.minHeight = heightAttr || '760px';
  iframe.style.background = 'transparent';
  iframe.setAttribute('allowtransparency', 'true');
  iframe.loading = 'lazy';
  mount.innerHTML = '';
  mount.appendChild(iframe);

  function emitPortalEvent(payload) {
    if (typeof window === 'undefined') return;
    if (typeof window.CustomEvent === 'function') {
      try {
        var event = new CustomEvent('bookly:portal-sso', { detail: payload });
        window.dispatchEvent(event);
      } catch (err) {
        console.warn('Bookly embed: unable to dispatch portal event', err);
      }
    } else if (typeof document !== 'undefined' && document.createEvent) {
      var legacyEvent = document.createEvent('Event');
      legacyEvent.initEvent('bookly:portal-sso', true, true);
      legacyEvent.detail = payload;
      window.dispatchEvent(legacyEvent);
    }
  }

  function handleMessage(event) {
    if (event.source !== iframe.contentWindow) return;
    if (event.data && event.data.type === 'bookly:resize' && event.data.height) {
      iframe.style.height = event.data.height + 'px';
    }
    if (event.data && event.data.type === 'bookly:portal-sso') {
      emitPortalEvent(event.data);
    }
  }
  window.addEventListener('message', handleMessage);
})();`;

    res.setHeader('Content-Type', 'application/javascript');
    res.send(script);
  } catch (error) {
    next(error);
  }
});

publicBookingRouter.get('/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;

    const bookingPage = (await prisma.bookingPage.findUnique({
      where: { slug },
      include: {
        business: {
          include: {
            services: true,
          },
        },
      },
    })) as BookingPageWithServices | null;

    if (!bookingPage || !bookingPage.isActive) {
      return res.status(404).json({ message: 'Booking page not found' });
    }

    const staff = await prisma.staffMember.findMany({
      where: { businessId: bookingPage.businessId, isActive: true },
      select: { id: true, name: true, role: true },
    });

    const businessMeta = bookingPage.business as Record<string, any>;
    const paymentsEnabled =
      (businessMeta?.paymentConnectionStatus === 'ACTIVE' && businessMeta?.stripeChargesEnabled === true) || false;

    res.json({
      bookingPage: {
        id: bookingPage.id,
        name: bookingPage.name,
        slug: bookingPage.slug,
        settings: bookingPage.settings,
      },
      business: {
        name: businessMeta?.name ?? bookingPage.business.name,
        timezone: bookingPage.business.timezone,
        currency: businessMeta?.currency ?? bookingPage.business.currency,
        paymentConnectionStatus: businessMeta?.paymentConnectionStatus ?? 'NOT_CONNECTED',
        paymentsEnabled,
      },
      services: bookingPage.business.services,
      staff,
    });
  } catch (error) {
    next(error);
  }
});

publicBookingRouter.get('/:slug/availability', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { serviceId, staffId, date } = req.query;

    if (typeof serviceId !== 'string' || typeof date !== 'string') {
      return res.status(400).json({ message: 'serviceId and date are required' });
    }

    const bookingPage = await prisma.bookingPage.findUnique({
      where: { slug },
      select: { businessId: true },
    });

    if (!bookingPage) {
      return res.status(404).json({ message: 'Booking page not found' });
    }

    const service = (await loadServiceWithStaff(serviceId)) as ServiceWithCapacity | null;

    if (!service || service.businessId !== bookingPage.businessId) {
      return res.status(404).json({ message: 'Service not found' });
    }

    const resolvedService = service as ServiceWithCapacity;

    const eligibleStaff = await listEligibleStaffForService({
      service: resolvedService,
      businessId: bookingPage.businessId,
    });

    const staffList =
      typeof staffId === 'string'
        ? eligibleStaff.filter((staff) => staff.id === staffId)
        : eligibleStaff;

    const slots = await computeSlots({
      businessId: bookingPage.businessId,
      service: resolvedService,
      staff: staffList,
      date: date,
    });

    res.json({ availability: slots });
  } catch (error) {
    next(error);
  }
});

publicBookingRouter.post('/:slug/payment-intent', async (req, res, next) => {
  try {
    if (!isTenantStripeConfigured()) {
      return res.status(503).json({ message: 'Payments are not configured.' });
    }

    const payload = paymentIntentSchema.parse(req.body);
    const { slug } = req.params;

    const bookingPage = (await prisma.bookingPage.findUnique({
      where: { slug },
      include: {
        business: true,
      },
    })) as BookingPageWithBusiness | null;

    if (!bookingPage) {
      return res.status(404).json({ message: 'Booking page not found' });
    }

    const service = (await loadServiceWithStaff(payload.serviceId)) as ServiceWithCapacity | null;

    if (!service || service.businessId !== bookingPage.businessId) {
      return res.status(404).json({ message: 'Service not found' });
    }

    const resolvedService = service as ServiceWithCapacity;
    const businessMeta = bookingPage.business as Record<string, any>;

    if (!shouldRequirePayment(resolvedService, businessMeta ?? {})) {
      return res.status(400).json({ message: 'Payment is not required for this booking.' });
    }

    if (!businessMeta?.stripeAccountId) {
      return res.status(400).json({ message: 'Business has not connected Stripe yet.' });
    }

    const start = new Date(payload.startTime);
    const end = new Date(start.getTime() + resolvedService.durationMinutes * 60000);

    let staffId = payload.staffId ?? null;

    try {
      const resolvedStaffId = await resolveStaffAssignment({
        service: resolvedService,
        preferredStaffId: payload.staffId ?? undefined,
        businessId: bookingPage.businessId,
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

    if (!staffId && !resolvedService.allowAnyStaff) {
      return res.status(400).json({ message: 'This service requires a staff member.' });
    }

    if (staffId) {
      await ensureNoConflicts({
        businessId: bookingPage.businessId,
        staffId,
        service: resolvedService,
        start,
        end,
        serviceId: resolvedService.id,
        allowSharedSlots: resolvedService.capacityType === 'MULTI',
      });
    }

    await ensureServiceCapacityAvailable({
      businessId: bookingPage.businessId,
      serviceId: resolvedService.id,
      start,
      end,
      maxClientsPerSlot: resolvedService.maxClientsPerSlot,
    });

    await ensureTestDriveLimit(bookingPage.businessId);

    const amount = toMinorUnits(resolvedService);

    if (amount <= 0) {
      return res.status(400).json({ message: 'Service price must be greater than zero for payments.' });
    }

    const stripe = getTenantStripe();
    const currency = (businessMeta?.currency ?? 'AED').toLowerCase();

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount,
        currency,
        description: `${businessMeta?.name ?? 'Bookly'} · ${resolvedService.name}`,
        receipt_email: payload.customer.email,
        automatic_payment_methods: { enabled: true },
        metadata: {
          businessId: bookingPage.businessId,
          serviceId: resolvedService.id,
          bookingPageId: bookingPage.id,
        },
      },
      {
        stripeAccount: businessMeta?.stripeAccountId,
      },
    );

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount,
      currency,
    });
  } catch (error) {
    next(error);
  }
});

publicBookingRouter.post('/:slug/book', async (req, res, next) => {
  try {
    const payload = bookingPayloadSchema.parse(req.body);
    const { slug } = req.params;

    const bookingPage = (await prisma.bookingPage.findUnique({
      where: { slug },
      include: {
        business: true,
      },
    })) as BookingPageWithBusiness | null;

    const isEmbedRequest = req.get('x-bookly-embed') === '1';

    if (!bookingPage) {
      return res.status(404).json({ message: 'Booking page not found' });
    }

    const service = (await loadServiceWithStaff(payload.serviceId)) as ServiceWithCapacity | null;

    if (!service || service.businessId !== bookingPage.businessId) {
      return res.status(404).json({ message: 'Service not found' });
    }

    const resolvedService = service as ServiceWithCapacity;
    const businessMeta = bookingPage.business as Record<string, any>;

    const start = new Date(payload.startTime);
    const end = new Date(start.getTime() + resolvedService.durationMinutes * 60000);

    let staffId = payload.staffId ?? null;

    try {
      const resolvedStaffId = await resolveStaffAssignment({
        service: resolvedService,
        preferredStaffId: payload.staffId ?? undefined,
        businessId: bookingPage.businessId,
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

    if (!staffId && !resolvedService.allowAnyStaff) {
      return res.status(400).json({ message: 'This service requires a staff member.' });
    }

    if (staffId) {
      await ensureNoConflicts({
        businessId: bookingPage.businessId,
        staffId,
        service: resolvedService,
        start,
        end,
        serviceId: resolvedService.id,
        allowSharedSlots: resolvedService.capacityType === 'MULTI',
      });
    }

    await ensureServiceCapacityAvailable({
      businessId: bookingPage.businessId,
      serviceId: resolvedService.id,
      start,
      end,
      maxClientsPerSlot: resolvedService.maxClientsPerSlot,
    });
    await ensureTestDriveLimit(bookingPage.businessId);

    const customer = await prisma.customer.upsert({
      where: {
        businessId_email: {
          businessId: bookingPage.businessId,
          email: payload.customer.email,
        },
      },
      create: {
        businessId: bookingPage.businessId,
        firstName: payload.customer.firstName,
        lastName: payload.customer.lastName,
        email: payload.customer.email,
        phone: payload.customer.phone,
        marketingConsent: payload.customer.marketingConsent ?? false,
        notes: payload.customer.notes,
      },
      update: {
        firstName: payload.customer.firstName,
        lastName: payload.customer.lastName,
        phone: payload.customer.phone,
        marketingConsent: payload.customer.marketingConsent ?? false,
      },
    });
    const marketingOptIn = payload.customer.marketingConsent ?? false;
    const isNewCustomer = marketingOptIn && customer.createdAt.getTime() === customer.updatedAt.getTime();

    const summary = {
      date: format(start, 'EEEE, MMM d'),
      time: format(start, 'p'),
    };

    const requiresPayment = shouldRequirePayment(resolvedService, businessMeta ?? {});
    const amount = toMinorUnits(resolvedService);
    let paymentStatus: 'PAID' | 'UNPAID' = 'UNPAID';
    let stripePaymentIntentId: string | null = null;

    if (requiresPayment) {
      if (!isTenantStripeConfigured()) {
        return res.status(503).json({ message: 'Payments are temporarily unavailable.' });
      }
      if (!payload.paymentIntentId) {
        return res.status(400).json({ message: 'Payment is required to confirm this booking.' });
      }
      if (!businessMeta?.stripeAccountId) {
        return res.status(400).json({ message: 'Business has not connected Stripe yet.' });
      }

      try {
        const stripe = getTenantStripe();
        const intent = await stripe.paymentIntents.retrieve(payload.paymentIntentId, {
          stripeAccount: businessMeta?.stripeAccountId,
        });

        if (intent.status !== 'succeeded') {
          return res.status(400).json({ message: 'Payment has not been completed yet.' });
        }

        if ((intent.amount_received ?? 0) < amount) {
          return res.status(400).json({ message: 'Payment amount is incomplete.' });
        }

        paymentStatus = 'PAID';
        stripePaymentIntentId = intent.id;
      } catch (error) {
        return res.status(400).json({ message: 'Unable to verify payment.' });
      }
    }

    const appointmentData = {
      businessId: bookingPage.businessId,
      bookingPageId: bookingPage.id,
      serviceId: resolvedService.id,
      staffId,
      customerId: customer.id,
      startTime: start,
      endTime: end,
      status: 'PENDING',
      source: 'PUBLIC',
      customerNotes: payload.customer.notes,
      paymentStatus,
      stripePaymentIntentId: stripePaymentIntentId ?? undefined,
    } as Prisma.AppointmentUncheckedCreateInput;

    const appointment = await prisma.appointment.create({
      data: appointmentData,
    });

    if (isNewCustomer) {
      await queueCampaignEvents({
        businessId: bookingPage.businessId,
        triggerType: 'NEW_CUSTOMER',
        customerId: customer.id,
        subjectContext: `Welcome to ${bookingPage.business.name}`,
        messageContext: 'Thanks for joining our community!',
      });
    }

    let portalSso: { token: string; expiresAt: Date; portalUrl: string } | undefined;

    if (isEmbedRequest) {
      try {
        portalSso = await issuePortalToken({
          businessId: bookingPage.businessId,
          customerId: customer.id,
          userAgent: req.headers['user-agent'],
        });
      } catch (err) {
        console.error('Failed to issue portal token for embed booking', err);
      }
    }

    try {
      const businessName = businessMeta?.name ?? 'Bookly';
      await sendBookingNotifications({
        businessName,
        serviceName: resolvedService.name,
        date: summary.date,
        time: summary.time,
        location: businessMeta?.contactEmail ?? null,
        email: payload.customer.email,
        phone: payload.customer.phone ?? undefined,
      });
    } catch (err) {
      console.error('Failed to send booking notifications', err);
    }

    if (marketingOptIn) {
      await queueCampaignEvents({
        businessId: bookingPage.businessId,
        triggerType: 'CLASS_BOOKED',
        customerId: customer.id,
        subjectContext: `${resolvedService.name} booked`,
        messageContext: `${summary.date} at ${summary.time}`,
      });
    }

    res.status(201).json({
      appointment,
      customer,
      summary,
      paymentStatus,
      portalSso: portalSso
        ? {
            token: portalSso.token,
            expiresAt: portalSso.expiresAt,
            portalUrl: portalSso.portalUrl,
          }
        : undefined,
    });
  } catch (error) {
    if (error instanceof ConflictError) {
      return res.status(409).json({ message: error.message });
    }
    next(error);
  }
});

type SlotInput = {
  businessId: string;
  service: Pick<ServiceWithCapacity, 'id' | 'durationMinutes' | 'capacityType' | 'maxClientsPerSlot'>;
  staff: { id: string }[];
  date: string;
};

const computeSlots = async ({ businessId, service, staff, date }: SlotInput) => {
  if (!staff.length) return [];

  const target = parseISO(date);
  const dayOfWeek = target.getDay();
  const dayStart = startOfDay(target);
  const dayEnd = addDays(dayStart, 1);

  const availability = await prisma.availabilityBlock.findMany({
    where: {
      businessId,
      staffId: { in: staff.map((s) => s.id) },
      OR: [
        { isOverride: true, date: set(target, { hours: 0, minutes: 0, seconds: 0, milliseconds: 0 }) },
        { dayOfWeek },
      ],
    },
  });

  const appointments = await prisma.appointment.findMany({
    where: {
      businessId,
      startTime: { lt: dayEnd },
      endTime: { gt: dayStart },
      status: { in: ACTIVE_APPOINTMENT_STATUSES },
      OR: [
        { staffId: { in: staff.map((s) => s.id) } },
        { serviceId: service.id },
      ],
    },
    select: {
      id: true,
      staffId: true,
      serviceId: true,
      startTime: true,
      endTime: true,
    },
  });

  type BlockShape = { startTime: string; endTime: string };
  const slots: Array<{ staffId: string; startTime: string; endTime: string }> = [];

  for (const member of staff) {
    const blocks = availability.filter((block) => block.staffId === member.id);
    const hasOverride = blocks.some((block) => block.isOverride);
    const blockList: BlockShape[] = blocks.length
      ? blocks
          .filter((block) => (hasOverride ? block.isOverride : !block.isOverride))
          .map((block) => ({ startTime: block.startTime, endTime: block.endTime }))
      : [{ startTime: '09:00', endTime: '17:00' }];

    blockList.forEach((block) => {
      const startParts = block.startTime.split(':').map(Number);
      const endParts = block.endTime.split(':').map(Number);
      const blockStart = set(target, {
        hours: startParts[0],
        minutes: startParts[1],
        seconds: 0,
        milliseconds: 0,
      });
      const blockEnd = set(target, {
        hours: endParts[0],
        minutes: endParts[1],
        seconds: 0,
        milliseconds: 0,
      });

      let slotStart = new Date(blockStart);
      while (slotStart.getTime() + service.durationMinutes * 60000 <= blockEnd.getTime()) {
        const slotEnd = new Date(slotStart.getTime() + service.durationMinutes * 60000);

        const staffOverlap = appointments.some(
          (appt) =>
            appt.staffId === member.id &&
            appt.startTime < slotEnd &&
            appt.endTime > slotStart &&
            (service.capacityType === 'MULTI' ? appt.serviceId !== service.id : true),
        );
        if (staffOverlap) {
          slotStart = new Date(slotStart.getTime() + 15 * 60000);
          continue;
        }

        const serviceOverlap = appointments.filter(
          (appt) => appt.serviceId === service.id && appt.startTime < slotEnd && appt.endTime > slotStart,
        ).length;

        if (serviceOverlap < service.maxClientsPerSlot) {
          slots.push({
            staffId: member.id,
            startTime: slotStart.toISOString(),
            endTime: slotEnd.toISOString(),
          });
        }

        slotStart = new Date(slotStart.getTime() + 15 * 60000);
      }
    });
  }

  return slots;
};

export { publicBookingRouter, computeSlots };

