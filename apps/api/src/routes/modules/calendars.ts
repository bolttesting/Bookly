import { Router } from 'express';
import { z } from 'zod';
import { google } from 'googleapis';

import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import {
  getGoogleAuthClient,
  syncAppointmentToGoogle,
  deleteAppointmentFromGoogle,
  syncAppointmentToOutlook,
  deleteAppointmentFromOutlook,
  startGoogleWatchChannel,
  stopGoogleWatchChannel,
  startOutlookSubscription,
  stopOutlookSubscription,
} from '../../services/calendarSyncService.js';
import { logger } from '../../utils/logger.js';

const calendarsRouter = Router();
const db = prisma as any;

// Get all calendar connections for current business/staff
calendarsRouter.get('/', async (req, res, next) => {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) {
      return res.status(400).json({ message: 'Business ID required' });
    }

    const staffId = req.query.staffId as string | undefined;

    const where: {
      businessId: string;
      staffId?: string;
    } = {
      businessId,
    };

    if (staffId) {
      where.staffId = staffId;
    }

    const connections = await db.calendarConnection.findMany({
      where,
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ connections });
  } catch (error) {
    next(error);
  }
});

// Initiate Google Calendar OAuth
calendarsRouter.get('/google/connect', async (req, res, next) => {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) {
      return res.status(400).json({ message: 'Business ID required' });
    }

    const staffId = req.query.staffId as string | undefined;

    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      return res.status(503).json({ message: 'Google Calendar is not configured' });
    }

    const auth = getGoogleAuthClient();
    const scopes = ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events'];

    // Generate state token to verify callback
    const state = Buffer.from(JSON.stringify({ businessId, staffId, userId: req.user?.id })).toString('base64');

    const authUrl = auth.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state,
      prompt: 'consent', // Force consent to get refresh token
    });

    res.json({ authUrl, state });
  } catch (error) {
    next(error);
  }
});

// Google Calendar OAuth callback
calendarsRouter.get('/google/callback', async (req, res, next) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.redirect(`${env.APP_BASE_URL}/settings/calendars?error=missing_params`);
    }

    let stateData: { businessId: string; staffId?: string; userId?: string };
    try {
      stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
    } catch {
      return res.redirect(`${env.APP_BASE_URL}/settings/calendars?error=invalid_state`);
    }

    const auth = getGoogleAuthClient();
    const { tokens } = await auth.getToken(code as string);

    if (!tokens.access_token) {
      return res.redirect(`${env.APP_BASE_URL}/settings/calendars?error=no_token`);
    }

    // Get calendar info
    const calendar = google.calendar({ version: 'v3', auth });
    const calendarList = await calendar.calendarList.list();
    const primaryCalendar = calendarList.data.items?.find((cal) => cal.primary) || calendarList.data.items?.[0];

    // Create or update connection
    const existing = await db.calendarConnection.findFirst({
      where: {
        businessId: stateData.businessId,
        staffId: stateData.staffId || null,
        provider: 'GOOGLE',
      },
    });

    const connectionData = {
      businessId: stateData.businessId,
      staffId: stateData.staffId || null,
      provider: 'GOOGLE',
      status: 'ACTIVE',
      calendarId: primaryCalendar?.id || 'primary',
      calendarName: primaryCalendar?.summary || 'Primary Calendar',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      syncEnabled: true,
    };

    let savedConnection;
    if (existing) {
      savedConnection = await db.calendarConnection.update({
        where: { id: existing.id },
        data: connectionData,
      });
    } else {
      savedConnection = await db.calendarConnection.create({
        data: connectionData,
      });
    }

    try {
      await startGoogleWatchChannel(savedConnection.id);
    } catch (error) {
      logger.warn('Failed to start Google Calendar watch channel', { error });
    }

    res.redirect(`${env.APP_BASE_URL}/settings/calendars?success=connected`);
  } catch (error) {
    console.error('Google Calendar OAuth error:', error);
    res.redirect(`${env.APP_BASE_URL}/settings/calendars?error=oauth_failed`);
  }
});

// Disconnect calendar
calendarsRouter.delete('/:connectionId', async (req, res, next) => {
  try {
    const { connectionId } = req.params;
    const businessId = req.user?.businessId;

    if (!businessId) {
      return res.status(400).json({ message: 'Business ID required' });
    }

    const connection = await db.calendarConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection || connection.businessId !== businessId) {
      return res.status(404).json({ message: 'Calendar connection not found' });
    }

    await db.calendarConnection.update({
      where: { id: connectionId },
      data: { status: 'DISCONNECTED' },
    });

    if (connection.provider === 'GOOGLE') {
      await stopGoogleWatchChannel(connection.id).catch((error) =>
        logger.warn('Failed to stop Google watch channel on disconnect', { error }),
      );
    } else if (connection.provider === 'OUTLOOK') {
      await stopOutlookSubscription(connection.id).catch((error) =>
        logger.warn('Failed to stop Outlook subscription on disconnect', { error }),
      );
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Toggle sync
calendarsRouter.put('/:connectionId/sync', async (req, res, next) => {
  try {
    const { connectionId } = req.params;
    const businessId = req.user?.businessId;

    if (!businessId) {
      return res.status(400).json({ message: 'Business ID required' });
    }

    const schema = z.object({
      syncEnabled: z.boolean(),
    });

    const payload = schema.parse(req.body);

    const connection = await db.calendarConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection || connection.businessId !== businessId) {
      return res.status(404).json({ message: 'Calendar connection not found' });
    }

    const updated = await db.calendarConnection.update({
      where: { id: connectionId },
      data: { syncEnabled: payload.syncEnabled },
    });

    res.json({ connection: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid request', errors: error.errors });
    }
    next(error);
  }
});

// Initiate Outlook Calendar OAuth
calendarsRouter.get('/outlook/connect', async (req, res, next) => {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) {
      return res.status(400).json({ message: 'Business ID required' });
    }

    const staffId = req.query.staffId as string | undefined;

    if (!env.OUTLOOK_CLIENT_ID || !env.OUTLOOK_CLIENT_SECRET) {
      return res.status(503).json({ message: 'Outlook Calendar is not configured' });
    }

    // Generate state token
    const state = Buffer.from(JSON.stringify({ businessId, staffId, userId: req.user?.id })).toString('base64');

    const scopes = ['https://graph.microsoft.com/Calendars.ReadWrite', 'offline_access'];
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${new URLSearchParams({
      client_id: env.OUTLOOK_CLIENT_ID,
      response_type: 'code',
      redirect_uri: env.OUTLOOK_REDIRECT_URI || `${env.APP_BASE_URL}/api/calendars/outlook/callback`,
      response_mode: 'query',
      scope: scopes.join(' '),
      state,
      prompt: 'consent', // Force consent to get refresh token
    }).toString()}`;

    res.json({ authUrl, state });
  } catch (error) {
    next(error);
  }
});

// Outlook Calendar OAuth callback
calendarsRouter.get('/outlook/callback', async (req, res, next) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.redirect(`${env.APP_BASE_URL}/settings/calendars?error=missing_params`);
    }

    let stateData: { businessId: string; staffId?: string; userId?: string };
    try {
      stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
    } catch {
      return res.redirect(`${env.APP_BASE_URL}/settings/calendars?error=invalid_state`);
    }

    if (!env.OUTLOOK_CLIENT_ID || !env.OUTLOOK_CLIENT_SECRET) {
      return res.redirect(`${env.APP_BASE_URL}/settings/calendars?error=not_configured`);
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: env.OUTLOOK_CLIENT_ID,
        client_secret: env.OUTLOOK_CLIENT_SECRET,
        code: code as string,
        redirect_uri: env.OUTLOOK_REDIRECT_URI || `${env.APP_BASE_URL}/api/calendars/outlook/callback`,
        grant_type: 'authorization_code',
        scope: 'https://graph.microsoft.com/Calendars.ReadWrite offline_access',
      }),
    });

    if (!tokenResponse.ok) {
      return res.redirect(`${env.APP_BASE_URL}/settings/calendars?error=token_exchange_failed`);
    }

    const tokens = await tokenResponse.json();

    if (!tokens.access_token) {
      return res.redirect(`${env.APP_BASE_URL}/settings/calendars?error=no_token`);
    }

    // Get calendar info
    const calendarResponse = await fetch('https://graph.microsoft.com/v1.0/me/calendars', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    let calendarId = 'calendar'; // Default calendar
    let calendarName = 'Calendar';

    if (calendarResponse.ok) {
      const calendarData = await calendarResponse.json();
      const primaryCalendar = calendarData.value?.find((cal: { isDefaultCalendar: boolean }) => cal.isDefaultCalendar) || calendarData.value?.[0];
      if (primaryCalendar) {
        calendarId = primaryCalendar.id;
        calendarName = primaryCalendar.name || 'Calendar';
      }
    }

    // Create or update connection
    const existing = await db.calendarConnection.findFirst({
      where: {
        businessId: stateData.businessId,
        staffId: stateData.staffId || null,
        provider: 'OUTLOOK',
      },
    });

    const expiresIn = tokens.expires_in || 3600; // Default 1 hour
    const connectionData = {
      businessId: stateData.businessId,
      staffId: stateData.staffId || null,
      provider: 'OUTLOOK',
      status: 'ACTIVE',
      calendarId,
      calendarName,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
      syncEnabled: true,
    };

    let savedConnection;
    if (existing) {
      savedConnection = await db.calendarConnection.update({
        where: { id: existing.id },
        data: connectionData,
      });
    } else {
      savedConnection = await db.calendarConnection.create({
        data: connectionData,
      });
    }

    try {
      await startOutlookSubscription(savedConnection.id);
    } catch (error) {
      logger.warn('Failed to start Outlook subscription', { error });
    }

    res.redirect(`${env.APP_BASE_URL}/settings/calendars?success=connected`);
  } catch (error) {
    console.error('Outlook Calendar OAuth error:', error);
    res.redirect(`${env.APP_BASE_URL}/settings/calendars?error=oauth_failed`);
  }
});

// Manual sync trigger (for testing)
calendarsRouter.post('/:connectionId/sync-now', async (req, res, next) => {
  try {
    const { connectionId } = req.params;
    const businessId = req.user?.businessId;

    if (!businessId) {
      return res.status(400).json({ message: 'Business ID required' });
    }

    const connection = await db.calendarConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection || connection.businessId !== businessId || connection.status !== 'ACTIVE') {
      return res.status(404).json({ message: 'Active calendar connection not found' });
    }

    // Update last sync time
    await db.calendarConnection.update({
      where: { id: connectionId },
      data: { lastSyncAt: new Date(), lastSyncError: null },
    });

    res.json({ success: true, message: 'Sync initiated' });
  } catch (error) {
    next(error);
  }
});

// Manually recreate Google watch channel (useful if webhook expired)
calendarsRouter.post('/:connectionId/watch', async (req, res, next) => {
  try {
    const { connectionId } = req.params;
    const businessId = req.user?.businessId;

    if (!businessId) {
      return res.status(400).json({ message: 'Business ID required' });
    }

    const connection = await db.calendarConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection || connection.businessId !== businessId) {
      return res.status(404).json({ message: 'Calendar connection not found' });
    }

    if (connection.provider === 'GOOGLE') {
      const result = await startGoogleWatchChannel(connection.id);

      return res.json({
        success: Boolean(result),
        watch: result,
      });
    }

    if (connection.provider === 'OUTLOOK') {
      const result = await startOutlookSubscription(connection.id);

      return res.json({
        success: Boolean(result),
        watch: result,
      });
    }

    return res.status(400).json({ message: 'Unsupported provider for manual watch refresh' });
  } catch (error) {
    next(error);
  }
});

export { calendarsRouter };

