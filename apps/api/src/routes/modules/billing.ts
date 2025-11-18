import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { prisma } from '../../config/prisma.js';
import {
  createSubscription,
  updateSubscription,
  cancelSubscription,
  reactivateSubscription,
  getBusinessUsage,
  syncBusinessUsage,
  checkPlanLimits,
  PLAN_LIMITS,
  type SubscriptionPlan,
} from '../../services/billingService.js';
import { isBusinessSuspended, reactivateAccount } from '../../services/dunningService.js';
import { logger } from '../../utils/logger.js';

export const billingRouter = Router();

const createSubscriptionSchema = z.object({
  plan: z.enum(['STARTER', 'GROWTH', 'BUSINESS']),
  paymentMethodId: z.string().optional(),
});

const updateSubscriptionSchema = z.object({
  plan: z.enum(['STARTER', 'GROWTH', 'BUSINESS']),
});

// Get current subscription and usage
billingRouter.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const db = prisma as any;
    const businessId = req.user!.businessId!;

    const business = await db.business.findUnique({
      where: { id: businessId },
      select: {
        subscriptionPlan: true,
        subscriptionStatus: true,
        stripeSubscriptionId: true,
        subscriptionCurrentPeriodStart: true,
        subscriptionCurrentPeriodEnd: true,
        subscriptionCancelAtPeriodEnd: true,
        subscriptionCanceledAt: true,
        usageStaffCount: true,
        usageServiceCount: true,
        usageBookingPageCount: true,
        usageAppointmentCount: true,
      },
    });

    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const usage = await getBusinessUsage(businessId);
    const limits = business.subscriptionPlan
      ? PLAN_LIMITS[business.subscriptionPlan as SubscriptionPlan]
      : null;

    const limitCheck = business.subscriptionPlan
      ? await checkPlanLimits(businessId, business.subscriptionPlan as SubscriptionPlan)
      : { withinLimits: true, violations: [] };

    const suspended = await isBusinessSuspended(businessId);
    const businessWithSuspension = await db.business.findUnique({
      where: { id: businessId },
      select: {
        suspendedAt: true,
        suspensionReason: true,
        dunningAttempts: true,
      },
    });

    res.json({
      subscription: {
        plan: business.subscriptionPlan,
        status: business.subscriptionStatus,
        currentPeriodStart: business.subscriptionCurrentPeriodStart,
        currentPeriodEnd: business.subscriptionCurrentPeriodEnd,
        cancelAtPeriodEnd: business.subscriptionCancelAtPeriodEnd,
        canceledAt: business.subscriptionCanceledAt,
      },
      usage,
      limits,
      limitCheck,
      suspension: suspended
        ? {
            suspendedAt: businessWithSuspension?.suspendedAt,
            reason: businessWithSuspension?.suspensionReason,
            dunningAttempts: businessWithSuspension?.dunningAttempts || 0,
          }
        : null,
    });
  } catch (error) {
    logger.error('Error fetching subscription', { error, businessId: req.user!.businessId });
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// Create subscription
billingRouter.post('/subscribe', authenticate, async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.businessId!;
    const { plan, paymentMethodId } = createSubscriptionSchema.parse(req.body);

    const result = await createSubscription(businessId, plan, paymentMethodId);

    res.json({
      subscriptionId: result.subscriptionId,
      clientSecret: result.clientSecret,
      message: 'Subscription created successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error creating subscription', { error, businessId: req.user!.businessId });
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// Update subscription plan
billingRouter.put('/subscription', authenticate, async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.businessId!;
    const { plan } = updateSubscriptionSchema.parse(req.body);

    await updateSubscription(businessId, plan);

    res.json({ message: 'Subscription updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error updating subscription', { error, businessId: req.user!.businessId });
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

// Cancel subscription
billingRouter.post('/subscription/cancel', authenticate, async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.businessId!;
    const { immediately } = req.body;

    await cancelSubscription(businessId, immediately === true);

    res.json({ message: 'Subscription canceled successfully' });
  } catch (error) {
    logger.error('Error canceling subscription', { error, businessId: req.user!.businessId });
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Reactivate subscription
billingRouter.post('/subscription/reactivate', authenticate, async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.businessId!;

    await reactivateSubscription(businessId);

    // If account was suspended, reactivate it
    const suspended = await isBusinessSuspended(businessId);
    if (suspended) {
      await reactivateAccount(businessId);
    }

    res.json({ message: 'Subscription reactivated successfully' });
  } catch (error) {
    logger.error('Error reactivating subscription', { error, businessId: req.user!.businessId });
    res.status(500).json({ error: 'Failed to reactivate subscription' });
  }
});

// Sync usage metrics
billingRouter.post('/usage/sync', authenticate, async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.businessId!;

    await syncBusinessUsage(businessId);

    const usage = await getBusinessUsage(businessId);

    res.json({ usage, message: 'Usage synced successfully' });
  } catch (error) {
    logger.error('Error syncing usage', { error, businessId: req.user!.businessId });
    res.status(500).json({ error: 'Failed to sync usage' });
  }
});

// Super-admin: Get all subscriptions
billingRouter.get('/admin/subscriptions', authenticate, requirePermission('MANAGE_TENANTS' as any), async (req: Request, res: Response) => {
  try {
    const db = prisma as any;

    const businesses = await db.business.findMany({
      select: {
        id: true,
        name: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        subscriptionCurrentPeriodStart: true,
        subscriptionCurrentPeriodEnd: true,
        subscriptionCancelAtPeriodEnd: true,
        usageStaffCount: true,
        usageServiceCount: true,
        usageBookingPageCount: true,
        stripeSubscriptionId: true,
        owner: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ subscriptions: businesses });
  } catch (error) {
    logger.error('Error fetching subscriptions', { error });
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// Super-admin: Update subscription for a business
billingRouter.put('/admin/subscriptions/:businessId', authenticate, requirePermission('MANAGE_TENANTS' as any), async (req: Request, res: Response) => {
  try {
    const { businessId } = req.params;
    const { plan, status } = req.body;

    const db = prisma as any;

    const updateData: any = {};
    if (plan) {
      updateData.subscriptionPlan = plan;
    }
    if (status) {
      updateData.subscriptionStatus = status;
    }

    await db.business.update({
      where: { id: businessId },
      data: updateData,
    });

    if (plan) {
      await syncBusinessUsage(businessId);
    }

    res.json({ message: 'Subscription updated successfully' });
  } catch (error) {
    logger.error('Error updating subscription', { error, businessId: req.params.businessId });
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

