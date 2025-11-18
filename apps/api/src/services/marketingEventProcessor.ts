import { Resend } from 'resend';
import twilio from 'twilio';

import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';

const resendClient = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
const twilioClient =
  env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN
    ? twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)
    : null;

const db = prisma as typeof prisma & {
  marketingEvent: any;
  customer: any;
};

/**
 * Process and send queued marketing events that are ready to be sent
 */
export const processMarketingEvents = async () => {
  try {
    const now = new Date();
    
    // Find all QUEUED events that are ready to send
    const readyEvents = await db.marketingEvent.findMany({
      where: {
        status: 'QUEUED',
        scheduledAt: {
          lte: now,
        },
      },
      include: {
        customer: true,
        campaign: {
          include: {
            business: true,
          },
        },
      },
      take: 50, // Process in batches
    });

    if (!readyEvents.length) {
      return { processed: 0, sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    for (const event of readyEvents) {
      try {
        const customer = event.customer;
        if (!customer) {
          await db.marketingEvent.update({
            where: { id: event.id },
            data: { status: 'FAILED', metadata: { error: 'Customer not found' } },
          });
          failed++;
          continue;
        }

        // Check marketing consent
        if (customer.marketingConsent !== true) {
          await db.marketingEvent.update({
            where: { id: event.id },
            data: { status: 'FAILED', metadata: { error: 'Customer has not consented to marketing' } },
          });
          failed++;
          continue;
        }

        const business = event.campaign?.business;
        const businessName = business?.name ?? 'Bookly';

        if (event.channel === 'EMAIL' && customer.email) {
          if (!resendClient) {
            logger.warn('Resend not configured, skipping email marketing event', { eventId: event.id });
            await db.marketingEvent.update({
              where: { id: event.id },
              data: { status: 'FAILED', metadata: { error: 'Email service not configured' } },
            });
            failed++;
            continue;
          }

          await resendClient.emails.send({
            from: env.EMAIL_FROM ?? 'Bookly <no-reply@bookly.app>',
            to: customer.email,
            subject: event.subject ?? businessName,
            html: event.body,
            text: event.body.replace(/<[^>]*>/g, ''), // Strip HTML for text version
          });

          await db.marketingEvent.update({
            where: { id: event.id },
            data: { status: 'SENT', processedAt: new Date() },
          });
          sent++;
        } else if (event.channel === 'SMS' && customer.phone) {
          if (!twilioClient) {
            logger.warn('Twilio not configured, skipping SMS marketing event', { eventId: event.id });
            await db.marketingEvent.update({
              where: { id: event.id },
              data: { status: 'FAILED', metadata: { error: 'SMS service not configured' } },
            });
            failed++;
            continue;
          }

          const messageConfig: {
            to: string;
            body: string;
            messagingServiceSid?: string;
            from?: string;
          } = {
            to: customer.phone,
            body: event.body,
          };

          if (env.TWILIO_MESSAGING_SERVICE_SID) {
            messageConfig.messagingServiceSid = env.TWILIO_MESSAGING_SERVICE_SID;
          } else if (env.TWILIO_PHONE_NUMBER) {
            messageConfig.from = env.TWILIO_PHONE_NUMBER;
          } else {
            throw new Error('No Twilio sender configured');
          }

          await twilioClient.messages.create(messageConfig);

          await db.marketingEvent.update({
            where: { id: event.id },
            data: { status: 'SENT', processedAt: new Date() },
          });
          sent++;
        } else {
          // No contact method available
          await db.marketingEvent.update({
            where: { id: event.id },
            data: { status: 'FAILED', metadata: { error: 'No contact method available' } },
          });
          failed++;
        }
      } catch (error: any) {
        logger.error('Failed to process marketing event', { eventId: event.id, error: error.message });
        await db.marketingEvent.update({
          where: { id: event.id },
          data: {
            status: 'FAILED',
            metadata: { error: error.message || 'Unknown error' },
          },
        });
        failed++;
      }
    }

    logger.info('Marketing events processed', { processed: readyEvents.length, sent, failed });
    return { processed: readyEvents.length, sent, failed };
  } catch (error: any) {
    logger.error('Error processing marketing events', { error: error.message });
    throw error;
  }
};

/**
 * Start the marketing event processor interval
 * Runs every minute to check for ready events
 */
export const startMarketingEventProcessor = () => {
  // Process immediately on start
  void processMarketingEvents().catch((error) => {
    logger.error('Initial marketing event processing failed', { error: error.message });
  });

  // Then run every minute
  const interval = setInterval(() => {
    void processMarketingEvents().catch((error) => {
      logger.error('Marketing event processing failed', { error: error.message });
    });
  }, 60 * 1000); // 1 minute

  logger.info('Marketing event processor started', { interval: '60s' });

  return () => {
    clearInterval(interval);
    logger.info('Marketing event processor stopped');
  };
};

