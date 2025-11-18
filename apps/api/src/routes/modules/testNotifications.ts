import { Router } from 'express';
import { z } from 'zod';

import { env } from '../../config/env.js';
import { authenticate } from '../../middleware/authenticate.js';
import twilio from 'twilio';

const testNotificationsRouter = Router();

const twilioClient =
  env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN
    ? twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)
    : null;

const testSmsSchema = z.object({
  to: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Phone number must be in E.164 format (e.g., +1234567890)'),
  message: z.string().min(1).max(1600).optional().default('Test message from Bookly'),
});

// Test SMS endpoint - requires authentication
testNotificationsRouter.post('/sms/test', authenticate(), async (req, res, next) => {
  try {
    if (!twilioClient) {
      return res.status(503).json({
        message: 'Twilio is not configured. Please check your environment variables.',
      });
    }

    const payload = testSmsSchema.parse(req.body);

    const messageConfig: {
      to: string;
      body: string;
      messagingServiceSid?: string;
      from?: string;
    } = {
      to: payload.to,
      body: payload.message,
    };

    if (env.TWILIO_MESSAGING_SERVICE_SID) {
      messageConfig.messagingServiceSid = env.TWILIO_MESSAGING_SERVICE_SID;
    } else if (env.TWILIO_PHONE_NUMBER) {
      messageConfig.from = env.TWILIO_PHONE_NUMBER;
    } else {
      return res.status(400).json({
        message: 'No Twilio sender configured. Please set TWILIO_MESSAGING_SERVICE_SID or TWILIO_PHONE_NUMBER.',
      });
    }

    const message = await twilioClient.messages.create(messageConfig);

    res.json({
      success: true,
      message: 'SMS sent successfully',
      sid: message.sid,
      status: message.status,
      to: message.to,
      from: message.from,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Invalid request',
        errors: error.errors,
      });
    }

    if (error instanceof Error && 'code' in error) {
      return res.status(400).json({
        message: 'Twilio error',
        error: error.message,
        code: (error as { code?: number }).code,
      });
    }

    next(error);
  }
});

// Get Twilio configuration status (for debugging)
testNotificationsRouter.get('/sms/status', authenticate(), (_req, res) => {
  res.json({
    configured: Boolean(twilioClient),
    hasAccountSid: Boolean(env.TWILIO_ACCOUNT_SID),
    hasAuthToken: Boolean(env.TWILIO_AUTH_TOKEN),
    hasMessagingService: Boolean(env.TWILIO_MESSAGING_SERVICE_SID),
    hasPhoneNumber: Boolean(env.TWILIO_PHONE_NUMBER),
    phoneNumber: env.TWILIO_PHONE_NUMBER ?? null,
    messagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID ?? null,
  });
});

export { testNotificationsRouter };

