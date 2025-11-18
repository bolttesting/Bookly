import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { getBooklyStripe } from '../../services/stripeService.js';
import { syncSubscriptionFromStripe } from '../../services/billingService.js';
import { handleFailedPayment, reactivateAccount } from '../../services/dunningService.js';
import { logger } from '../../utils/logger.js';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import {
  processGoogleCalendarNotification,
  processOutlookCalendarNotification,
} from '../../services/calendarSyncService.js';

export const webhooksRouter = Router();
const db = prisma as any;

// Stripe webhook endpoint (must be before body parsing middleware)
webhooksRouter.post(
  '/stripe',
  async (req: Request, res: Response) => {
    const stripe = getBooklyStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripe) {
      logger.error('Stripe not configured for webhook handling');
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    if (!webhookSecret) {
      logger.warn('STRIPE_WEBHOOK_SECRET not set, webhook signature verification skipped');
      // In development, allow webhooks without signature verification
      if (env.SENTRY_ENVIRONMENT === 'production') {
        return res.status(400).json({ error: 'Webhook secret not configured' });
      }
    }

    const sig = req.headers['stripe-signature'] as string;
    let event: Stripe.Event;

    try {
      const rawBody = (req as any).rawBody || req.body;
      if (webhookSecret) {
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
      } else {
        // In development, parse event without verification
        event = JSON.parse(rawBody.toString()) as Stripe.Event;
      }
    } catch (err: any) {
      logger.error('Webhook signature verification failed', { error: err.message });
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    // Handle the event
    try {
      switch (event.type) {
        case 'invoice.payment_failed':
          await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_succeeded':
          await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;

        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
          break;

        default:
          logger.debug(`Unhandled webhook event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      logger.error('Error processing webhook', { error, eventType: event.type });
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
);

// Google Calendar webhook endpoint (receives notifications from watch channels)
webhooksRouter.post('/google-calendar', async (req, res) => {
  const channelId = req.header('x-goog-channel-id');
  const resourceId = req.header('x-goog-resource-id');
  const channelToken = req.header('x-goog-channel-token');

  if (!channelId || !resourceId) {
    logger.warn('Google webhook missing channel or resource header');
    return res.status(400).json({ error: 'Missing webhook headers' });
  }

  const connection = await db.calendarConnection.findFirst({
    where: {
      provider: 'GOOGLE',
      watchChannelId: channelId,
      watchResourceId: resourceId,
    },
  });

  if (!connection) {
    logger.warn('Google webhook received for unknown channel', { channelId, resourceId });
    return res.status(200).json({ ignored: true });
  }

  if (connection.watchChannelToken && channelToken && channelToken !== connection.watchChannelToken) {
    logger.warn('Google webhook channel token mismatch', { channelId });
    return res.status(401).json({ error: 'Invalid channel token' });
  }

  await db.calendarConnection.update({
    where: { id: connection.id },
    data: {
      lastWebhookAt: new Date(),
    },
  });

  await processGoogleCalendarNotification(connection.id, {
    'x-goog-resource-state': req.header('x-goog-resource-state') ?? undefined,
    'x-goog-message-number': req.header('x-goog-message-number') ?? undefined,
  });

  res.json({ received: true });
});

// Outlook Calendar webhook validation (Graph sends GET with validationToken)
webhooksRouter.get('/outlook-calendar', (req, res) => {
  const validationToken = req.query.validationToken as string | undefined;
  if (validationToken) {
    res.status(200).set('Content-Type', 'text/plain').send(validationToken);
  } else {
    res.status(400).send('Missing validationToken');
  }
});

// Outlook Calendar webhook notifications
webhooksRouter.post('/outlook-calendar', async (req, res) => {
  const notifications = Array.isArray(req.body?.value) ? (req.body.value as any[]) : [];

  if (!notifications.length) {
    return res.status(202).json({ received: true });
  }

  await Promise.all(
    notifications.map(async (notification) => {
      const subscriptionId = notification.subscriptionId as string | undefined;
      const clientState = notification.clientState as string | undefined;

      if (!subscriptionId) {
        logger.warn('Outlook webhook missing subscriptionId');
        return;
      }

      const connection = await db.calendarConnection.findFirst({
        where: {
          provider: 'OUTLOOK',
          watchChannelId: subscriptionId,
        },
      });

      if (!connection) {
        logger.warn('Outlook webhook received for unknown subscription', { subscriptionId });
        return;
      }

      if (connection.watchChannelToken && clientState && clientState !== connection.watchChannelToken) {
        logger.warn('Outlook webhook clientState mismatch', { subscriptionId });
        return;
      }

      await processOutlookCalendarNotification(connection.id);
    }),
  );

  res.status(202).json({ received: true });
});

/**
 * Handle failed invoice payment
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const db = require('../../db/prisma.js').prisma as any;

  if (!invoice.subscription || typeof invoice.subscription !== 'string') {
    logger.warn('Invoice payment failed but no subscription ID found');
    return;
  }

  const business = await db.business.findFirst({
    where: { stripeSubscriptionId: invoice.subscription },
  });

  if (!business) {
    logger.warn(`Business not found for subscription ${invoice.subscription}`);
    return;
  }

  logger.info(`Payment failed for business ${business.id}, invoice ${invoice.id}`);

  await handleFailedPayment(business.id, invoice.id);
}

/**
 * Handle successful invoice payment
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  const db = require('../../db/prisma.js').prisma as any;

  if (!invoice.subscription || typeof invoice.subscription !== 'string') {
    return;
  }

  const business = await db.business.findFirst({
    where: { stripeSubscriptionId: invoice.subscription },
  });

  if (!business) {
    logger.warn(`Business not found for subscription ${invoice.subscription}`);
    return;
  }

  // If account was suspended, reactivate it
  if (business.suspendedAt) {
    logger.info(`Payment succeeded for suspended business ${business.id}, reactivating`);
    await reactivateAccount(business.id);
  }

  // Reset dunning attempts on successful payment
  await db.business.update({
    where: { id: business.id },
    data: {
      dunningAttempts: 0,
      lastDunningSentAt: null,
      subscriptionStatus: 'ACTIVE',
    },
  });

  logger.info(`Payment succeeded for business ${business.id}, invoice ${invoice.id}`);
}

/**
 * Handle subscription updates
 */
async function handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
  await syncSubscriptionFromStripe(subscription.id);
}

