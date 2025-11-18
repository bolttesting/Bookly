import { prisma } from '../config/prisma.js';
import { getBooklyStripe } from './stripeService.js';
import { logger } from '../utils/logger.js';
import { Resend } from 'resend';
import { env } from '../config/env.js';

const resendClient = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

const MAX_DUNNING_ATTEMPTS = 3;
const DUNNING_INTERVAL_DAYS = 2; // Send reminder every 2 days

/**
 * Send payment reminder email to business owner
 */
async function sendPaymentReminderEmail(
  businessId: string,
  attemptNumber: number
): Promise<void> {
  const db = prisma as any;

  const business = await db.business.findUnique({
    where: { id: businessId },
    include: { owner: true },
  });

  if (!business || !business.owner?.email) {
    logger.warn(`Cannot send payment reminder: business ${businessId} or owner email not found`);
    return;
  }

  if (!resendClient) {
    logger.warn('Resend not configured, skipping payment reminder email');
    return;
  }

  const subject =
    attemptNumber === MAX_DUNNING_ATTEMPTS
      ? `⚠️ Action Required: Update Payment Method - ${business.name}`
      : `Payment Reminder - ${business.name}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Bookly</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <h2 style="color: #1f2937; margin-top: 0;">${subject}</h2>
          <p>Hi ${business.owner.firstName || 'there'},</p>
          <p>
            We were unable to process your subscription payment for <strong>${business.name}</strong>.
            ${attemptNumber === MAX_DUNNING_ATTEMPTS ? 'This is your final reminder.' : `This is reminder ${attemptNumber} of ${MAX_DUNNING_ATTEMPTS}.`}
          </p>
          <p>
            To avoid service interruption, please update your payment method as soon as possible.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${env.APP_BASE_URL}/settings/billing" style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
              Update Payment Method
            </a>
          </div>
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            If you've already updated your payment method, you can ignore this email.
          </p>
          <p style="color: #6b7280; font-size: 14px;">
            Need help? Reply to this email or contact our support team.
          </p>
        </div>
        <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
          <p>© ${new Date().getFullYear()} Bookly. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  const text = `
Payment Reminder - ${business.name}

Hi ${business.owner.firstName || 'there'},

We were unable to process your subscription payment for ${business.name}.
${attemptNumber === MAX_DUNNING_ATTEMPTS ? 'This is your final reminder.' : `This is reminder ${attemptNumber} of ${MAX_DUNNING_ATTEMPTS}.`}

To avoid service interruption, please update your payment method:
${env.APP_BASE_URL}/settings/billing

If you've already updated your payment method, you can ignore this email.

Need help? Contact our support team.

© ${new Date().getFullYear()} Bookly. All rights reserved.
  `;

  try {
    await resendClient.emails.send({
      from: env.EMAIL_FROM ?? 'Bookly <no-reply@bookly.app>',
      to: business.owner.email,
      subject,
      html,
      text,
    });

    logger.info(`Payment reminder email sent to business ${businessId} (attempt ${attemptNumber})`);
  } catch (error) {
    logger.error(`Failed to send payment reminder email to business ${businessId}`, { error });
  }
}

/**
 * Handle failed payment - send reminder or suspend account
 */
export async function handleFailedPayment(
  businessId: string,
  invoiceId?: string
): Promise<void> {
  const db = prisma as any;

  const business = await db.business.findUnique({
    where: { id: businessId },
    select: {
      dunningAttempts: true,
      lastDunningSentAt: true,
      suspendedAt: true,
      subscriptionStatus: true,
    },
  });

  if (!business) {
    logger.warn(`Business ${businessId} not found for failed payment handling`);
    return;
  }

  // Don't send reminders if already suspended
  if (business.suspendedAt) {
    logger.info(`Business ${businessId} is already suspended, skipping dunning`);
    return;
  }

  const now = new Date();
  const lastSent = business.lastDunningSentAt;
  const daysSinceLastSent = lastSent
    ? Math.floor((now.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24))
    : Infinity;

  // Only send reminder if enough time has passed since last reminder
  if (lastSent && daysSinceLastSent < DUNNING_INTERVAL_DAYS) {
    logger.info(
      `Skipping dunning for business ${businessId}: only ${daysSinceLastSent} days since last reminder`
    );
    return;
  }

  const newAttempts = (business.dunningAttempts || 0) + 1;

  // Update dunning attempts
  await db.business.update({
    where: { id: businessId },
    data: {
      dunningAttempts: newAttempts,
      lastDunningSentAt: now,
      subscriptionStatus: 'PAST_DUE',
    },
  });

  // Send reminder email
  await sendPaymentReminderEmail(businessId, newAttempts);

  // Suspend account if max attempts reached
  if (newAttempts >= MAX_DUNNING_ATTEMPTS) {
    await suspendAccount(businessId, 'Payment failed after multiple attempts');
  }
}

/**
 * Suspend a business account
 */
export async function suspendAccount(
  businessId: string,
  reason: string
): Promise<void> {
  const db = prisma as any;

  const business = await db.business.findUnique({
    where: { id: businessId },
    include: { owner: true },
  });

  if (!business) {
    logger.warn(`Business ${businessId} not found for suspension`);
    return;
  }

  if (business.suspendedAt) {
    logger.info(`Business ${businessId} is already suspended`);
    return;
  }

  await db.business.update({
    where: { id: businessId },
    data: {
      suspendedAt: new Date(),
      suspensionReason: reason,
      subscriptionStatus: 'SUSPENDED',
    },
  });

  // Send suspension notification
  if (business.owner?.email && resendClient) {
    try {
      await resendClient.emails.send({
        from: env.EMAIL_FROM ?? 'Bookly <no-reply@bookly.app>',
        to: business.owner.email,
        subject: `Account Suspended - ${business.name}`,
        html: `
          <!DOCTYPE html>
          <html>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #fee2e2; border: 1px solid #fecaca; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="color: #dc2626; margin-top: 0;">Account Suspended</h2>
                <p>Hi ${business.owner.firstName || 'there'},</p>
                <p>Your Bookly account for <strong>${business.name}</strong> has been suspended due to payment issues.</p>
                <p><strong>Reason:</strong> ${reason}</p>
                <p>To restore access, please update your payment method:</p>
                <div style="text-align: center; margin: 20px 0;">
                  <a href="${env.APP_BASE_URL}/settings/billing" style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                    Update Payment Method
                  </a>
                </div>
                <p style="color: #6b7280; font-size: 14px;">Once payment is updated, your account will be automatically reactivated.</p>
              </div>
            </body>
          </html>
        `,
        text: `Account Suspended\n\nYour Bookly account for ${business.name} has been suspended due to payment issues.\nReason: ${reason}\n\nUpdate payment method: ${env.APP_BASE_URL}/settings/billing`,
      });

      logger.info(`Suspension notification sent to business ${businessId}`);
    } catch (error) {
      logger.error(`Failed to send suspension notification to business ${businessId}`, { error });
    }
  }

  logger.warn(`Business ${businessId} suspended: ${reason}`);
}

/**
 * Reactivate a suspended account
 */
export async function reactivateAccount(businessId: string): Promise<void> {
  const db = prisma as any;

  const business = await db.business.findUnique({
    where: { id: businessId },
  });

  if (!business) {
    logger.warn(`Business ${businessId} not found for reactivation`);
    return;
  }

  if (!business.suspendedAt) {
    logger.info(`Business ${businessId} is not suspended`);
    return;
  }

  await db.business.update({
    where: { id: businessId },
    data: {
      suspendedAt: null,
      suspensionReason: null,
      subscriptionStatus: 'ACTIVE',
      dunningAttempts: 0,
      lastDunningSentAt: null,
    },
  });

  logger.info(`Business ${businessId} reactivated`);
}

/**
 * Check if business is suspended
 */
export async function isBusinessSuspended(businessId: string): Promise<boolean> {
  const db = prisma as any;

  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { suspendedAt: true },
  });

  return Boolean(business?.suspendedAt);
}

