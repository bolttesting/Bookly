import Stripe from 'stripe';
import { prisma } from '../config/prisma.js';
import { getBooklyStripe } from './stripeService.js';
import { logger } from '../utils/logger.js';

export type SubscriptionPlan = 'STARTER' | 'GROWTH' | 'BUSINESS';

export const PLAN_LIMITS: Record<SubscriptionPlan, {
  staff: number;
  services: number;
  bookingPages: number;
  price: number; // in cents (AED)
  features: string[];
}> = {
  STARTER: {
    staff: 1,
    services: 10,
    bookingPages: 1,
    price: 2000, // 20 AED = 2000 fils
    features: ['Email reminders', 'Basic calendar sync', 'Stripe payments'],
  },
  GROWTH: {
    staff: 5,
    services: 50,
    bookingPages: 5,
    price: 5000, // 50 AED
    features: [
      'SMS reminders',
      'Advanced calendar sync',
      'Custom branding',
      'Analytics',
    ],
  },
  BUSINESS: {
    staff: 999999, // unlimited
    services: 999999,
    bookingPages: 999999,
    price: 15000, // 150 AED
    features: [
      'White-label solution',
      'API access',
      'Phone support',
      'Custom workflows',
      'Advanced analytics',
    ],
  },
};

export interface UsageMetrics {
  staffCount: number;
  serviceCount: number;
  bookingPageCount: number;
  appointmentCount: number; // last 30 days
}

/**
 * Get current usage metrics for a business
 */
export async function getBusinessUsage(businessId: string): Promise<UsageMetrics> {
  const db = prisma as any;

  const [staffCount, serviceCount, bookingPageCount, appointmentCount] = await Promise.all([
    db.staffMember.count({
      where: { businessId },
    }),
    db.service.count({
      where: { businessId },
    }),
    db.bookingPage.count({
      where: { businessId },
    }),
    db.appointment.count({
      where: {
        businessId,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  return {
    staffCount,
    serviceCount,
    bookingPageCount,
    appointmentCount,
  };
}

/**
 * Update usage metrics in the database
 */
export async function syncBusinessUsage(businessId: string): Promise<void> {
  const usage = await getBusinessUsage(businessId);
  const db = prisma as any;

  await db.business.update({
    where: { id: businessId },
    data: {
      usageStaffCount: usage.staffCount,
      usageServiceCount: usage.serviceCount,
      usageBookingPageCount: usage.bookingPageCount,
      usageAppointmentCount: usage.appointmentCount,
      lastBillingSyncAt: new Date(),
    },
  });
}

/**
 * Check if business is within plan limits
 */
export async function checkPlanLimits(
  businessId: string,
  plan: SubscriptionPlan | null
): Promise<{ withinLimits: boolean; violations: string[] }> {
  if (!plan) {
    // Test Drive or no plan - allow everything for now
    return { withinLimits: true, violations: [] };
  }

  const limits = PLAN_LIMITS[plan];
  const usage = await getBusinessUsage(businessId);
  const violations: string[] = [];

  if (usage.staffCount > limits.staff) {
    violations.push(`Staff limit exceeded: ${usage.staffCount}/${limits.staff}`);
  }
  if (usage.serviceCount > limits.services) {
    violations.push(`Service limit exceeded: ${usage.serviceCount}/${limits.services}`);
  }
  if (usage.bookingPageCount > limits.bookingPages) {
    violations.push(`Booking page limit exceeded: ${usage.bookingPageCount}/${limits.bookingPages}`);
  }

  return {
    withinLimits: violations.length === 0,
    violations,
  };
}

/**
 * Create or update Stripe customer for a business
 */
export async function ensureStripeCustomer(
  businessId: string,
  ownerEmail: string,
  businessName: string
): Promise<string> {
  const db = prisma as any;
  const stripe = getBooklyStripe();

  if (!stripe) {
    throw new Error('Bookly Stripe not configured');
  }

  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { stripeCustomerId: true },
  });

  if (business?.stripeCustomerId) {
    // Update existing customer
    await stripe.customers.update(business.stripeCustomerId, {
      email: ownerEmail,
      name: businessName,
      metadata: {
        businessId,
      },
    });
    return business.stripeCustomerId;
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email: ownerEmail,
    name: businessName,
    metadata: {
      businessId,
    },
  });

  await db.business.update({
    where: { id: businessId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

/**
 * Create a subscription for a business
 */
export async function createSubscription(
  businessId: string,
  plan: SubscriptionPlan,
  paymentMethodId?: string
): Promise<{ subscriptionId: string; clientSecret?: string }> {
  const db = prisma as any;
  const stripe = getBooklyStripe();

  if (!stripe) {
    throw new Error('Bookly Stripe not configured');
  }

  const business = await db.business.findUnique({
    where: { id: businessId },
    include: { owner: true },
  });

  if (!business) {
    throw new Error('Business not found');
  }

  const customerId = await ensureStripeCustomer(
    businessId,
    business.owner.email!,
    business.name
  );

  const limits = PLAN_LIMITS[plan];
  const priceId = await getOrCreatePriceId(plan, stripe);

  const subscriptionData: Stripe.SubscriptionCreateParams = {
    customer: customerId,
    items: [{ price: priceId }],
    metadata: {
      businessId,
      plan,
    },
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.payment_intent'],
  };

  if (paymentMethodId) {
    subscriptionData.default_payment_method = paymentMethodId;
  }

  const subscription = await stripe.subscriptions.create(subscriptionData);

  // Update business record
  await db.business.update({
    where: { id: businessId },
    data: {
      subscriptionPlan: plan,
      subscriptionStatus: 'TRIAL',
      stripeSubscriptionId: subscription.id,
      subscriptionCurrentPeriodStart: new Date(subscription.current_period_start * 1000),
      subscriptionCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  });

  await syncBusinessUsage(businessId);

  const invoice = subscription.latest_invoice as Stripe.Invoice;
  const paymentIntent = invoice?.payment_intent as Stripe.PaymentIntent;

  return {
    subscriptionId: subscription.id,
    clientSecret: paymentIntent?.client_secret,
  };
}

/**
 * Update subscription plan
 */
export async function updateSubscription(
  businessId: string,
  newPlan: SubscriptionPlan
): Promise<void> {
  const db = prisma as any;
  const stripe = getBooklyStripe();

  if (!stripe) {
    throw new Error('Bookly Stripe not configured');
  }

  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { stripeSubscriptionId: true },
  });

  if (!business?.stripeSubscriptionId) {
    throw new Error('No active subscription found');
  }

  const subscription = await stripe.subscriptions.retrieve(business.stripeSubscriptionId);
  const priceId = await getOrCreatePriceId(newPlan, stripe);

  // Update subscription item
  await stripe.subscriptions.update(business.stripeSubscriptionId, {
    items: [
      {
        id: subscription.items.data[0].id,
        price: priceId,
      },
    ],
    proration_behavior: 'always_invoice',
    metadata: {
      ...subscription.metadata,
      plan: newPlan,
    },
  });

  await db.business.update({
    where: { id: businessId },
    data: {
      subscriptionPlan: newPlan,
    },
  });

  await syncBusinessUsage(businessId);
}

/**
 * Cancel subscription (at period end)
 */
export async function cancelSubscription(
  businessId: string,
  cancelImmediately = false
): Promise<void> {
  const db = prisma as any;
  const stripe = getBooklyStripe();

  if (!stripe) {
    throw new Error('Bookly Stripe not configured');
  }

  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { stripeSubscriptionId: true },
  });

  if (!business?.stripeSubscriptionId) {
    throw new Error('No active subscription found');
  }

  if (cancelImmediately) {
    await stripe.subscriptions.cancel(business.stripeSubscriptionId);
  } else {
    await stripe.subscriptions.update(business.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
  }

  await db.business.update({
    where: { id: businessId },
    data: {
      subscriptionCancelAtPeriodEnd: !cancelImmediately,
      subscriptionCanceledAt: cancelImmediately ? new Date() : undefined,
      subscriptionStatus: cancelImmediately ? 'CANCELED' : undefined,
    },
  });
}

/**
 * Reactivate a canceled subscription
 */
export async function reactivateSubscription(businessId: string): Promise<void> {
  const db = prisma as any;
  const stripe = getBooklyStripe();

  if (!stripe) {
    throw new Error('Bookly Stripe not configured');
  }

  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { stripeSubscriptionId: true },
  });

  if (!business?.stripeSubscriptionId) {
    throw new Error('No subscription found');
  }

  await stripe.subscriptions.update(business.stripeSubscriptionId, {
    cancel_at_period_end: false,
  });

  await db.business.update({
    where: { id: businessId },
    data: {
      subscriptionCancelAtPeriodEnd: false,
      subscriptionCanceledAt: null,
      subscriptionStatus: 'ACTIVE',
    },
  });
}

/**
 * Sync subscription status from Stripe webhook
 */
export async function syncSubscriptionFromStripe(
  subscriptionId: string
): Promise<void> {
  const db = prisma as any;
  const stripe = getBooklyStripe();

  if (!stripe) {
    throw new Error('Bookly Stripe not configured');
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['customer'],
  });

  const business = await db.business.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
  });

  if (!business) {
    logger.warn(`Business not found for subscription ${subscriptionId}`);
    return;
  }

  const statusMap: Record<string, 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIAL'> = {
    active: 'ACTIVE',
    past_due: 'PAST_DUE',
    canceled: 'CANCELED',
    trialing: 'TRIAL',
    unpaid: 'PAST_DUE',
  };

  await db.business.update({
    where: { id: business.id },
    data: {
      subscriptionStatus: statusMap[subscription.status] || 'ACTIVE',
      subscriptionCurrentPeriodStart: new Date(subscription.current_period_start * 1000),
      subscriptionCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
      subscriptionCancelAtPeriodEnd: subscription.cancel_at_period_end || false,
      subscriptionCanceledAt: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : null,
    },
  });

  await syncBusinessUsage(business.id);
}

/**
 * Get or create Stripe price ID for a plan
 * In production, these should be created in Stripe dashboard and stored in env vars
 */
async function getOrCreatePriceId(
  plan: SubscriptionPlan,
  stripe: Stripe
): Promise<string> {
  // For now, return a placeholder. In production, use env vars or Stripe API to fetch/create prices
  const priceIds: Record<SubscriptionPlan, string> = {
    STARTER: process.env.STRIPE_PRICE_STARTER || 'price_starter',
    GROWTH: process.env.STRIPE_PRICE_GROWTH || 'price_growth',
    BUSINESS: process.env.STRIPE_PRICE_BUSINESS || 'price_business',
  };

  return priceIds[plan];
}

