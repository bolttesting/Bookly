import { Router } from 'express';

import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  PAYMENT_CONNECTION_STATUS,
  type PaymentConnectionStatus,
} from '../../constants/prismaEnums.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { getTenantStripe, isTenantStripeConfigured } from '../../services/stripeService.js';

const paymentsRouter = Router();
const db = prisma as any;

paymentsRouter.use(requirePermission(PERMISSIONS.MANAGE_FINANCIALS));

const getDashboardBaseUrl = () => env.APP_BASE_URL.replace(/\/$/, '');

paymentsRouter.get('/connect', async (req, res, next) => {
  try {
    if (!isTenantStripeConfigured()) {
      return res.status(503).json({ message: 'Stripe is not configured for this environment.' });
    }

    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const businessId = req.user.businessId;

    const business = await db.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        stripeAccountId: true,
        paymentConnectionStatus: true,
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
        stripeOnboardingCompletedAt: true,
      },
    });

    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    if (!business.stripeAccountId) {
      return res.json({
        status: PAYMENT_CONNECTION_STATUS.NOT_CONNECTED,
        accountId: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        requirementsDue: [],
      });
    }

    const stripe = getTenantStripe();
    const account = await stripe.accounts.retrieve(business.stripeAccountId);

    const connectionStatus: PaymentConnectionStatus =
      account.charges_enabled && account.payouts_enabled
        ? PAYMENT_CONNECTION_STATUS.ACTIVE
        : PAYMENT_CONNECTION_STATUS.PENDING;

    await db.business.update({
      where: { id: businessId },
      data: {
        paymentConnectionStatus: connectionStatus,
        stripeChargesEnabled: account.charges_enabled,
        stripePayoutsEnabled: account.payouts_enabled,
        stripeOnboardingCompletedAt:
          connectionStatus === PAYMENT_CONNECTION_STATUS.ACTIVE && !business.stripeOnboardingCompletedAt
            ? new Date()
            : business.stripeOnboardingCompletedAt,
      },
    });

    res.json({
      status: connectionStatus,
      accountId: account.id,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      requirementsDue: account.requirements?.currently_due ?? [],
    });
  } catch (error) {
    next(error);
  }
});

paymentsRouter.post('/connect/link', async (req, res, next) => {
  try {
    if (!isTenantStripeConfigured()) {
      return res.status(503).json({ message: 'Stripe is not configured for this environment.' });
    }

    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const businessId = req.user.businessId;

    const business = await db.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        contactEmail: true,
        stripeAccountId: true,
      },
    });

    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    const stripe = getTenantStripe();
    let accountId = business.stripeAccountId;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'AE',
        email: business.contactEmail ?? undefined,
        business_type: 'company',
        metadata: {
          businessId: business.id,
          businessName: business.name,
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });

      accountId = account.id;

      await db.business.update({
        where: { id: businessId },
        data: {
          stripeAccountId: account.id,
          paymentConnectionStatus: PAYMENT_CONNECTION_STATUS.PENDING,
          stripeChargesEnabled: account.charges_enabled,
          stripePayoutsEnabled: account.payouts_enabled,
        },
      });
    }

    const baseDashboardUrl = getDashboardBaseUrl();

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseDashboardUrl}/dashboard/settings/payments?refresh=1`,
      return_url: `${baseDashboardUrl}/dashboard/settings/payments?completed=1`,
      type: 'account_onboarding',
    });

    res.json({
      onboardingUrl: link.url,
      expiresAt: new Date(link.expires_at * 1000).toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

paymentsRouter.post('/connect/login-link', async (req, res, next) => {
  try {
    if (!isTenantStripeConfigured()) {
      return res.status(503).json({ message: 'Stripe is not configured for this environment.' });
    }

    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const businessId = req.user.businessId;

    const business = await db.business.findUnique({
      where: { id: businessId },
      select: {
        stripeAccountId: true,
      },
    });

    if (!business?.stripeAccountId) {
      return res.status(400).json({ message: 'Stripe account not connected yet' });
    }

    const stripe = getTenantStripe();
    const loginLink = await stripe.accounts.createLoginLink(business.stripeAccountId);
    const redirectUrl = `${getDashboardBaseUrl()}/dashboard/settings/payments`;

    res.json({
      url: loginLink.url ?? redirectUrl,
      expiresAt:
        (loginLink as any).expires_at != null
          ? new Date((loginLink as any).expires_at * 1000).toISOString()
          : null,
    });
  } catch (error) {
    next(error);
  }
});

// Refund a payment
paymentsRouter.post('/refund', async (req, res, next) => {
  try {
    if (!isTenantStripeConfigured()) {
      return res.status(503).json({ message: 'Stripe is not configured for this environment.' });
    }

    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const { appointmentId, amount, reason } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ message: 'Appointment ID is required' });
    }

    const appointment = await db.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        service: {
          select: {
            price: true,
            name: true,
          },
        },
        business: {
          select: {
            stripeAccountId: true,
          },
        },
      },
    });

    if (!appointment || appointment.businessId !== req.user.businessId) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    if (!appointment.stripePaymentIntentId) {
      return res.status(400).json({ message: 'This appointment does not have a payment to refund' });
    }

    if (appointment.paymentStatus === 'REFUNDED') {
      return res.status(400).json({ message: 'This appointment has already been refunded' });
    }

    const stripe = getTenantStripe();
    const businessMeta = appointment.business as Record<string, any>;
    const stripeAccountId = businessMeta?.stripeAccountId;

    if (!stripeAccountId) {
      return res.status(400).json({ message: 'Business has not connected Stripe yet' });
    }

    // Retrieve the payment intent to get the charge ID
    const paymentIntent = await stripe.paymentIntents.retrieve(appointment.stripePaymentIntentId, {
      stripeAccount: stripeAccountId,
    });

    if (!paymentIntent.latest_charge) {
      return res.status(400).json({ message: 'No charge found for this payment' });
    }

    const chargeId = typeof paymentIntent.latest_charge === 'string' 
      ? paymentIntent.latest_charge 
      : paymentIntent.latest_charge.id;

    // Calculate refund amount (full or partial)
    const servicePrice = appointment.service?.price ? Number(appointment.service.price) : 0;
    const refundAmount = amount ? Math.min(Number(amount), servicePrice) : servicePrice;
    const refundAmountCents = Math.round(refundAmount * 100);

    // Create refund
    const refund = await stripe.refunds.create(
      {
        charge: chargeId,
        amount: refundAmountCents,
        reason: reason || 'requested_by_customer',
        metadata: {
          appointmentId: appointment.id,
          businessId: appointment.businessId,
        },
      },
      {
        stripeAccount: stripeAccountId,
      },
    );

    // Update appointment payment status
    const isFullRefund = refundAmount >= servicePrice;
    await db.appointment.update({
      where: { id: appointmentId },
      data: {
        paymentStatus: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        metadata: {
          ...((appointment.metadata as Record<string, unknown>) || {}),
          refundId: refund.id,
          refundAmount: refundAmount,
          refundedAt: new Date().toISOString(),
        },
      },
    });

    res.json({
      refundId: refund.id,
      amount: refundAmount,
      status: refund.status,
      appointmentId: appointment.id,
    });
  } catch (error) {
    next(error);
  }
});

// Get invoices for a business
paymentsRouter.get('/invoices', async (req, res, next) => {
  try {
    if (!isTenantStripeConfigured()) {
      return res.status(503).json({ message: 'Stripe is not configured for this environment.' });
    }

    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const business = await db.business.findUnique({
      where: { id: req.user.businessId },
      select: {
        stripeAccountId: true,
      },
    });

    if (!business?.stripeAccountId) {
      return res.status(400).json({ message: 'Stripe account not connected yet' });
    }

    // Get appointments with payments
    const appointments = await db.appointment.findMany({
      where: {
        businessId: req.user.businessId,
        paymentStatus: { in: ['PAID', 'PARTIALLY_REFUNDED'] },
        stripePaymentIntentId: { not: null },
      },
      include: {
        service: {
          select: {
            name: true,
            price: true,
          },
        },
        customer: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        startTime: 'desc',
      },
      take: 100,
    });

    // Format as invoices
    type AppointmentWithRelations = (typeof appointments)[number];
    const invoices = appointments.map((apt: AppointmentWithRelations) => {
      const metadata = (apt.metadata as Record<string, unknown>) || {};
      const refundAmount = metadata.refundAmount as number | undefined;
      const servicePrice = apt.service?.price ? Number(apt.service.price) : 0;
      const netAmount = refundAmount ? servicePrice - refundAmount : servicePrice;

      return {
        id: apt.id,
        invoiceNumber: `INV-${apt.id.slice(0, 8).toUpperCase()}`,
        appointmentId: apt.id,
        customerName: apt.customer
          ? `${apt.customer.firstName} ${apt.customer.lastName}`.trim()
          : 'Guest',
        customerEmail: apt.customer?.email || null,
        serviceName: apt.service?.name || 'Service',
        amount: servicePrice,
        refundAmount: refundAmount || 0,
        netAmount,
        status: apt.paymentStatus,
        date: apt.startTime,
        paymentIntentId: apt.stripePaymentIntentId,
      };
    });

    res.json({ invoices });
  } catch (error) {
    next(error);
  }
});

export { paymentsRouter };

