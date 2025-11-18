import { Resend } from 'resend';
import twilio from 'twilio';

import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { bookingConfirmationHtml } from '../templates/email/bookingConfirmation.js';
import { bookingConfirmationText } from '../templates/email/bookingReceivedText.js';
import { passwordResetHtml, passwordResetText } from '../templates/email/passwordReset.js';
import { emailVerificationHtml, emailVerificationText } from '../templates/email/emailVerification.js';
import { welcomeEmailHtml, welcomeEmailText } from '../templates/email/welcome.js';

const resendClient = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
const twilioClient =
  env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN
    ? twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)
    : null;

type BookingNotificationPayload = {
  businessName: string;
  serviceName: string;
  date: string;
  time: string;
  location?: string | null;
  email?: string | null;
  phone?: string | null;
};

export const sendBookingNotifications = async ({
  businessName,
  serviceName,
  date,
  time,
  location,
  email,
  phone,
}: BookingNotificationPayload) => {
  const tasks: Promise<unknown>[] = [];

  if (email && resendClient) {
    tasks.push(
      resendClient.emails.send({
        from: env.EMAIL_FROM ?? 'Bookly <no-reply@bookly.app>',
        to: email,
        subject: `Booking confirmed · ${businessName}`,
        html: bookingConfirmationHtml({ businessName, serviceName, date, time, location }),
        text: bookingConfirmationText({ businessName, serviceName, date, time, location }),
      }),
    );
  }

  if (phone && twilioClient) {
    // Use Messaging Service SID if available, otherwise use phone number
    if (env.TWILIO_MESSAGING_SERVICE_SID || env.TWILIO_PHONE_NUMBER) {
      const messageConfig: {
        to: string;
        body: string;
        messagingServiceSid?: string;
        from?: string;
      } = {
        to: phone,
        body: `Booking confirmed for ${serviceName} on ${date} ${time}. See you soon!`,
      };

      if (env.TWILIO_MESSAGING_SERVICE_SID) {
        messageConfig.messagingServiceSid = env.TWILIO_MESSAGING_SERVICE_SID;
      } else {
        messageConfig.from = env.TWILIO_PHONE_NUMBER!;
      }

      tasks.push(twilioClient.messages.create(messageConfig));
    }
    // Skip SMS if neither messaging service nor phone number is configured
  }

  await Promise.all(tasks);
};

/**
 * Send a test SMS message (for testing Twilio configuration)
 */
export const sendTestSms = async (to: string, message: string = 'Test message from Bookly') => {
  if (!twilioClient) {
    throw new Error('Twilio is not configured');
  }

  const messageConfig: {
    to: string;
    body: string;
    messagingServiceSid?: string;
    from?: string;
  } = {
    to,
    body: message,
  };

  if (env.TWILIO_MESSAGING_SERVICE_SID) {
    messageConfig.messagingServiceSid = env.TWILIO_MESSAGING_SERVICE_SID;
  } else if (env.TWILIO_PHONE_NUMBER) {
    messageConfig.from = env.TWILIO_PHONE_NUMBER;
  } else {
    throw new Error('No Twilio sender configured. Please set TWILIO_MESSAGING_SERVICE_SID or TWILIO_PHONE_NUMBER.');
  }

  return twilioClient.messages.create(messageConfig);
};

/**
 * Create an in-app notification
 */
type CreateNotificationInput = {
  businessId: string;
  userId?: string;
  staffId?: string;
  type: 'APPOINTMENT_CREATED' | 'APPOINTMENT_CANCELLED' | 'APPOINTMENT_RESCHEDULED' | 'APPOINTMENT_REMINDER' | 'WAITLIST_PROMOTED' | 'PAYMENT_RECEIVED' | 'CUSTOMER_MESSAGE' | 'SYSTEM_ALERT';
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
};

export const createNotification = async (input: CreateNotificationInput) => {
  const db = prisma as any;
  return db.notification.create({
    data: {
      businessId: input.businessId,
      userId: input.userId,
      staffId: input.staffId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link,
      metadata: input.metadata,
      status: 'UNREAD',
    },
  });
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (notificationId: string, userId?: string) => {
  const db = prisma as any;
  return db.notification.update({
    where: { id: notificationId },
    data: {
      status: 'READ',
      readAt: new Date(),
    },
  });
};

/**
 * Mark all notifications as read for a user
 */
export const markAllNotificationsAsRead = async (businessId: string, userId?: string, staffId?: string) => {
  const db = prisma as any;
  return db.notification.updateMany({
    where: {
      businessId,
      userId: userId || undefined,
      staffId: staffId || undefined,
      status: 'UNREAD',
    },
    data: {
      status: 'READ',
      readAt: new Date(),
    },
  });
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (email: string, resetLink: string) => {
  if (!resendClient) {
    throw new Error('Resend is not configured');
  }

  return resendClient.emails.send({
    from: env.EMAIL_FROM ?? 'Bookly <no-reply@bookly.app>',
    to: email,
    subject: 'Reset Your Password · Bookly',
    html: passwordResetHtml(resetLink),
    text: passwordResetText(resetLink),
  });
};

/**
 * Send email verification email
 */
export const sendEmailVerification = async (email: string, verificationLink: string) => {
  if (!resendClient) {
    throw new Error('Resend is not configured');
  }

  return resendClient.emails.send({
    from: env.EMAIL_FROM ?? 'Bookly <no-reply@bookly.app>',
    to: email,
    subject: 'Verify Your Email · Bookly',
    html: emailVerificationHtml(verificationLink),
    text: emailVerificationText(verificationLink),
  });
};

/**
 * Send welcome email to new users
 */
export const sendWelcomeEmail = async (
  email: string,
  firstName: string | null,
  businessName: string,
  dashboardLink: string,
) => {
  if (!resendClient) {
    const error = new Error('Resend is not configured. Please set RESEND_API_KEY in environment variables.');
    console.error('❌ Failed to send welcome email:', error.message);
    throw error;
  }

  try {
    const result = await resendClient.emails.send({
      from: env.EMAIL_FROM ?? 'Bookly <no-reply@bookly.app>',
      to: email,
      subject: `Welcome to Bookly, ${firstName || businessName}! 🎉`,
      html: welcomeEmailHtml(firstName, businessName, dashboardLink),
      text: welcomeEmailText(firstName, businessName, dashboardLink),
    });
    console.log('✅ Welcome email sent successfully:', result);
    return result;
  } catch (error) {
    console.error('❌ Failed to send welcome email:', error);
    throw error;
  }
};
