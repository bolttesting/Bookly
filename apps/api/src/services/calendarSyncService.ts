import { google, calendar_v3 } from 'googleapis';
import { randomBytes, randomUUID } from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import type { Prisma } from '@prisma/client';
type Appointment = Prisma.AppointmentGetPayload<{}>;
import { logger } from '../utils/logger.js';
import { publishAppointmentEvent } from '../lib/appointmentEvents.js';

const db = prisma as any;
const GOOGLE_SYNC_LOOKBACK_DAYS = 30;
const GOOGLE_EVENT_COMPARE_THRESHOLD_MS = 1000;
const OUTLOOK_SYNC_LOOKBACK_DAYS = 30;
const OUTLOOK_EVENT_COMPARE_THRESHOLD_MS = 1000;
const OUTLOOK_SUBSCRIPTION_TTL_MINUTES = 60 * 24 * 2; // 2 days (Graph max is ~3 days)

type ExternalEventPayload = {
  id: string;
  summary?: string | null;
  description?: string | null;
  status?: string | null;
  startTime?: Date | null;
  endTime?: Date | null;
  rawPayload?: unknown;
};

/**
 * Get Google Calendar OAuth2 client
 */
export const getGoogleAuthClient = () => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error('Google Calendar credentials not configured');
  }

  const redirectUri = env.GOOGLE_REDIRECT_URI || `${env.APP_BASE_URL}/api/calendars/google/callback`;
  return new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, redirectUri);
};

/**
 * Get Google Calendar API client with credentials
 */
export const getGoogleCalendarClient = async (accessToken: string, refreshToken?: string, tokenExpiresAt?: Date | null) => {
  const auth = getGoogleAuthClient();
  
  // Check if token is expired or will expire soon (within 5 minutes)
  const needsRefresh = tokenExpiresAt && new Date(tokenExpiresAt.getTime() - 5 * 60 * 1000) <= new Date();
  
  auth.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  // Refresh token if needed or if refreshToken is available
  if (refreshToken && (needsRefresh || !tokenExpiresAt)) {
    try {
      const { credentials } = await auth.refreshAccessToken();
      auth.setCredentials(credentials);
      
      // Update stored token if connection ID is available (would need to pass it)
      // For now, just log that refresh happened
      if (credentials.access_token && credentials.expiry_date) {
        console.log('✅ Google Calendar token refreshed successfully');
      }
    } catch (error) {
      console.error('❌ Failed to refresh Google token:', error);
      throw new Error('Failed to refresh Google Calendar token. Please reconnect your calendar.');
    }
  }

  return google.calendar({ version: 'v3', auth });
};

/**
 * Sync Bookly appointment to Google Calendar
 */
export const syncAppointmentToGoogle = async (
  connectionId: string,
  appointment: Appointment & { service?: { name: string } | null; customer?: { firstName: string; lastName: string } | null },
) => {
  const connection = await db.calendarConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection || connection.provider !== 'GOOGLE' || connection.status !== 'ACTIVE') {
    throw new Error('Invalid or inactive calendar connection');
  }

  const calendar = await getGoogleCalendarClient(
    connection.accessToken,
    connection.refreshToken || undefined,
    connection.tokenExpiresAt,
  );
  
  // Update connection with refreshed token if it was refreshed
  // (This would require returning the new token from getGoogleCalendarClient, but for now we'll handle it on next sync)

  const event = {
    summary: appointment.service?.name || 'Appointment',
    description: appointment.customer
      ? `Customer: ${appointment.customer.firstName} ${appointment.customer.lastName}`
      : undefined,
    start: {
      dateTime: appointment.startTime.toISOString(),
      timeZone: 'UTC',
    },
    end: {
      dateTime: appointment.endTime.toISOString(),
      timeZone: 'UTC',
    },
    extendedProperties: {
      private: {
        booklyAppointmentId: appointment.id,
        booklyBusinessId: appointment.businessId,
      },
    },
  };

  // Check if appointment already has a calendar event ID
  const metadata = (appointment.metadata as Record<string, unknown>) || {};
  const existingEventId = metadata.googleEventId as string | undefined;

  if (existingEventId && connection.calendarId) {
    const updatedEvent = await calendar.events.update({
      calendarId: connection.calendarId,
      eventId: existingEventId,
      requestBody: event,
    });
    await upsertExternalEventRecord(
      connection.id,
      connection.provider,
      mapGoogleEventToPayload(updatedEvent.data ?? {}, existingEventId),
      appointment.id,
    );
    return existingEventId;
  } else {
    // Create new event
    const calendarId = connection.calendarId || 'primary';
    const created = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });

    // Store event ID in appointment metadata
    await db.appointment.update({
      where: { id: appointment.id },
      data: {
        metadata: {
          ...metadata,
          googleEventId: created.data.id,
        },
      },
    });

    await upsertExternalEventRecord(
      connection.id,
      connection.provider,
      mapGoogleEventToPayload(created.data ?? {}, created.data?.id ?? undefined),
      appointment.id,
    );

    return created.data.id;
  }
};

/**
 * Delete appointment from Google Calendar
 */
export const deleteAppointmentFromGoogle = async (connectionId: string, eventId: string) => {
  const connection = await db.calendarConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection || connection.provider !== 'GOOGLE' || connection.status !== 'ACTIVE') {
    return; // Silently fail if connection is invalid
  }

  const calendar = await getGoogleCalendarClient(
    connection.accessToken,
    connection.refreshToken || undefined,
    connection.tokenExpiresAt,
  );
  const calendarId = connection.calendarId || 'primary';

  try {
    await calendar.events.delete({
      calendarId,
      eventId,
    });
  } catch (error) {
    console.error('Failed to delete Google Calendar event:', error);
    // Don't throw - event might already be deleted
  }

  await db.externalCalendarEvent.deleteMany({
    where: {
      connectionId: connection.id,
      externalEventId: eventId,
    },
  });
};

/**
 * Fetch events from Google Calendar and detect conflicts
 */
export const fetchGoogleCalendarEvents = async (
  connectionId: string,
  timeMin: Date,
  timeMax: Date,
): Promise<Array<{ id: string; start: Date; end: Date; summary: string }>> => {
  const connection = await db.calendarConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection || connection.provider !== 'GOOGLE' || connection.status !== 'ACTIVE') {
    return [];
  }

  const calendar = await getGoogleCalendarClient(
    connection.accessToken,
    connection.refreshToken || undefined,
    connection.tokenExpiresAt,
  );
  const calendarId = connection.calendarId || 'primary';

  const response = await calendar.events.list({
    calendarId,
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  return (
    response.data.items?.map((event) => ({
      id: event.id || '',
      start: new Date(event.start?.dateTime || event.start?.date || ''),
      end: new Date(event.end?.dateTime || event.end?.date || ''),
      summary: event.summary || 'Busy',
    })) || []
  );
};

/**
 * Start a Google Calendar watch channel so we receive webhook updates.
 */
export const startGoogleWatchChannel = async (connectionId: string) => {
  if (!env.GOOGLE_CALENDAR_WEBHOOK_URL) {
    logger.warn('GOOGLE_CALENDAR_WEBHOOK_URL not configured; skipping Google Calendar webhook subscription.');
    return null;
  }

  const connection = await db.calendarConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection || connection.provider !== 'GOOGLE') {
    throw new Error('Calendar connection not found or not a Google connection');
  }

  // Stop existing channel if present
  if (connection.watchChannelId && connection.watchResourceId) {
    try {
      await stopGoogleWatchChannel(connectionId);
    } catch (error) {
      logger.warn('Failed to stop previous Google watch channel', { error });
    }
  }

  const calendar = await getGoogleCalendarClient(
    connection.accessToken,
    connection.refreshToken || undefined,
    connection.tokenExpiresAt,
  );

  const channelId = randomUUID();
  const channelToken = randomBytes(24).toString('hex');
  const calendarId = connection.calendarId || 'primary';

  const response = await calendar.events.watch({
    calendarId,
    requestBody: {
      id: channelId,
      type: 'web_hook',
      address: env.GOOGLE_CALENDAR_WEBHOOK_URL,
      token: channelToken,
    },
  });

  await db.calendarConnection.update({
    where: { id: connectionId },
    data: {
      watchChannelId: channelId,
      watchChannelToken: channelToken,
      watchResourceId: response.data.resourceId ?? null,
      webhookExpiresAt: response.data.expiration ? new Date(Number(response.data.expiration)) : null,
      lastWebhookAt: null,
    },
  });

  logger.info('Google Calendar watch channel started', {
    connectionId,
    channelId,
    resourceId: response.data.resourceId,
    expiration: response.data.expiration,
  });

  return response.data;
};

/**
 * Stop an existing Google Calendar watch channel.
 */
export const stopGoogleWatchChannel = async (connectionId: string) => {
  const connection = await db.calendarConnection.findUnique({
    where: { id: connectionId },
  });

  if (
    !connection ||
    connection.provider !== 'GOOGLE' ||
    !connection.watchChannelId ||
    !connection.watchResourceId
  ) {
    return;
  }

  const calendar = await getGoogleCalendarClient(
    connection.accessToken,
    connection.refreshToken || undefined,
    connection.tokenExpiresAt,
  );

  try {
    await calendar.channels.stop({
      requestBody: {
        id: connection.watchChannelId,
        resourceId: connection.watchResourceId,
      },
    });
  } catch (error) {
    logger.warn('Failed to stop Google Calendar watch channel', {
      error,
      connectionId,
    });
  }

  await db.calendarConnection.update({
    where: { id: connectionId },
    data: {
      watchChannelId: null,
      watchResourceId: null,
      watchChannelToken: null,
      webhookExpiresAt: null,
    },
  });
};

const parseGoogleDate = (value?: calendar_v3.Schema$EventDateTime | null): Date | null => {
  if (!value) return null;
  if (value.dateTime) return new Date(value.dateTime);
  if (value.date) return new Date(`${value.date}T00:00:00Z`);
  return null;
};

const mapGoogleEventToPayload = (
  event: calendar_v3.Schema$Event,
  fallbackId?: string,
): ExternalEventPayload => ({
  id: event.id ?? fallbackId ?? '',
  summary: event.summary ?? null,
  description: event.description ?? null,
  status: event.status ?? null,
  startTime: parseGoogleDate(event.start),
  endTime: parseGoogleDate(event.end),
  rawPayload: event,
});

type OutlookDateTime = {
  dateTime?: string | null;
  timeZone?: string | null;
};

const parseOutlookDate = (value?: OutlookDateTime | null): Date | null => {
  if (!value?.dateTime) return null;
  const iso = value.dateTime.endsWith('Z') ? value.dateTime : `${value.dateTime}Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
};

const mapOutlookEventToPayload = (event: any): ExternalEventPayload => ({
  id: event.id ?? '',
  summary: event.subject ?? event.bodyPreview ?? null,
  description: event.body?.content ?? null,
  status: event.showAs ?? (event.isCancelled ? 'cancelled' : event.type),
  startTime: parseOutlookDate(event.start),
  endTime: parseOutlookDate(event.end),
  rawPayload: event,
});

const upsertExternalEventRecord = async (
  connectionId: string,
  provider: string,
  data: ExternalEventPayload,
  appointmentId?: string | null,
) => {
  if (!data.id) return;

  await db.externalCalendarEvent.upsert({
    where: {
      connectionId_externalEventId: {
        connectionId,
        externalEventId: data.id,
      },
    },
    update: {
      summary: data.summary ?? null,
      description: data.description ?? null,
      status: data.status ?? null,
      startTime: data.startTime ?? null,
      endTime: data.endTime ?? null,
      rawPayload: data.rawPayload ?? null,
      appointmentId: appointmentId ?? null,
    },
    create: {
      connectionId,
      provider,
      externalEventId: data.id,
      summary: data.summary ?? null,
      description: data.description ?? null,
      status: data.status ?? null,
      startTime: data.startTime ?? null,
      endTime: data.endTime ?? null,
      rawPayload: data.rawPayload ?? null,
      appointmentId: appointmentId ?? null,
    },
  });
};

const syncAppointmentFromGoogleEvent = async (
  connection: any,
  event: calendar_v3.Schema$Event,
  appointmentId: string,
) => {
  const appointment = await db.appointment.findUnique({
    where: { id: appointmentId },
  });

  if (!appointment || appointment.businessId !== connection.businessId) {
    await upsertExternalEventRecord(
      connection.id,
      connection.provider,
      mapGoogleEventToPayload(event),
      null,
    );
    return;
  }

  const eventStart = parseGoogleDate(event.start);
  const eventEnd = parseGoogleDate(event.end);
  const metadata = ((appointment.metadata as Record<string, unknown>) || {}) as Record<string, unknown>;
  let shouldUpdate = false;
  const data: Record<string, unknown> = {};

  if (event.status === 'cancelled') {
    if (appointment.status !== 'CANCELLED') {
      data.status = 'CANCELLED';
      shouldUpdate = true;
    }
  } else if (eventStart && eventEnd) {
    if (Math.abs(eventStart.getTime() - appointment.startTime.getTime()) > GOOGLE_EVENT_COMPARE_THRESHOLD_MS) {
      data.startTime = eventStart;
      shouldUpdate = true;
    }

    if (Math.abs(eventEnd.getTime() - appointment.endTime.getTime()) > GOOGLE_EVENT_COMPARE_THRESHOLD_MS) {
      data.endTime = eventEnd;
      shouldUpdate = true;
    }
  }

  if (event.id && metadata.googleEventId !== event.id) {
    metadata.googleEventId = event.id;
    shouldUpdate = true;
  }

  if (shouldUpdate) {
    data.metadata = metadata;
    const updated = await db.appointment.update({
      where: { id: appointmentId },
      data,
      include: {
        service: true,
        customer: true,
        staff: true,
      },
    });

    publishAppointmentEvent({
      id: updated.id,
      businessId: updated.businessId,
      type: 'appointment.updated',
      data: updated,
    });
  } else if (metadata.googleEventId !== event.id) {
    await db.appointment.update({
      where: { id: appointmentId },
      data: { metadata },
    });
  }

  await upsertExternalEventRecord(
    connection.id,
    connection.provider,
    mapGoogleEventToPayload(event),
    appointmentId,
  );
};

const fetchGoogleEventChanges = async (connection: any, allowFullSyncReset = true) => {
  const calendar = await getGoogleCalendarClient(
    connection.accessToken,
    connection.refreshToken || undefined,
    connection.tokenExpiresAt,
  );

  const calendarId = connection.calendarId || 'primary';
  const params: calendar_v3.Params$Resource$Events$List = {
    calendarId,
    singleEvents: true,
    showDeleted: true,
    maxResults: 2500,
  };

  if (connection.googleSyncToken) {
    params.syncToken = connection.googleSyncToken;
  } else {
    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - GOOGLE_SYNC_LOOKBACK_DAYS);
    params.timeMin = timeMin.toISOString();
  }

  try {
    let nextPageToken: string | undefined;
    let latestSyncToken: string | undefined;

    do {
      if (nextPageToken) {
        params.pageToken = nextPageToken;
      } else {
        delete params.pageToken;
      }

      const response = await calendar.events.list(params);
      const items = response.data.items ?? [];

      for (const event of items) {
        const booklyAppointmentId =
          event.extendedProperties?.private?.booklyAppointmentId ??
          event.extendedProperties?.private?.booklyappointmentid;

        if (booklyAppointmentId) {
        await syncAppointmentFromGoogleEvent(connection, event, String(booklyAppointmentId));
        } else {
        await upsertExternalEventRecord(
          connection.id,
          connection.provider,
          mapGoogleEventToPayload(event),
          null,
        );
        }
      }

      nextPageToken = response.data.nextPageToken ?? undefined;
      if (response.data.nextSyncToken) {
        latestSyncToken = response.data.nextSyncToken;
      }
    } while (nextPageToken);

    if (latestSyncToken) {
      await db.calendarConnection.update({
        where: { id: connection.id },
        data: {
          googleSyncToken: latestSyncToken,
          lastGoogleSyncAt: new Date(),
        },
      });
    }
  } catch (error: any) {
    // If sync token is expired or invalid, clear it and retry once
    const shouldReset =
      error?.code === 410 ||
      error?.status === 410 ||
      error?.errors?.some((err: { reason?: string }) => err.reason === 'fullSyncRequired');

    if (allowFullSyncReset && shouldReset) {
      logger.warn('Google sync token expired, resetting full sync', { connectionId: connection.id });
      await db.calendarConnection.update({
        where: { id: connection.id },
        data: {
          googleSyncToken: null,
        },
      });
      await fetchGoogleEventChanges(
        {
          ...connection,
          googleSyncToken: null,
        },
        false,
      );
      return;
    }

    logger.error('Failed to fetch Google Calendar changes', {
      error,
      connectionId: connection.id,
    });
  }
};

/**
 * Process incoming Google Calendar webhook notifications.
 */
export const processGoogleCalendarNotification = async (
  connectionId: string,
  headers: Record<string, string | undefined>,
) => {
  const resourceState = headers['x-goog-resource-state'];
  const messageNumber = headers['x-goog-message-number'];

  logger.debug('Received Google Calendar webhook notification', {
    connectionId,
    resourceState,
    messageNumber,
  });

  const connection = await db.calendarConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection || connection.provider !== 'GOOGLE' || connection.status !== 'ACTIVE') {
    logger.warn('Ignoring Google webhook for inactive or missing connection', { connectionId });
    return;
  }

  await fetchGoogleEventChanges(connection);
};

const fetchExternalAppointmentId = async (connectionId: string, eventId: string) => {
  const existing = await db.externalCalendarEvent.findUnique({
    where: {
      connectionId_externalEventId: {
        connectionId,
        externalEventId: eventId,
      },
    },
  });
  return existing?.appointmentId ?? undefined;
};

const syncAppointmentFromOutlookEvent = async (
  connection: any,
  event: any,
  appointmentId?: string,
) => {
  const resolvedAppointmentId =
    appointmentId ?? (event.id ? await fetchExternalAppointmentId(connection.id, event.id) : undefined);

  if (!resolvedAppointmentId) {
    await upsertExternalEventRecord(connection.id, connection.provider, mapOutlookEventToPayload(event), null);
    return;
  }

  const appointment = await db.appointment.findUnique({
    where: { id: resolvedAppointmentId },
  });

  if (!appointment || appointment.businessId !== connection.businessId) {
    await upsertExternalEventRecord(connection.id, connection.provider, mapOutlookEventToPayload(event), null);
    return;
  }

  const metadata = ((appointment.metadata as Record<string, unknown>) || {}) as Record<string, unknown>;
  let shouldUpdate = false;
  const data: Record<string, unknown> = {};

  const removed = Boolean(event['@removed']);
  const isCancelled = removed || event.isCancelled;
  const eventStart = parseOutlookDate(event.start);
  const eventEnd = parseOutlookDate(event.end);

  if (isCancelled) {
    if (appointment.status !== 'CANCELLED') {
      data.status = 'CANCELLED';
      shouldUpdate = true;
    }
  } else if (eventStart && eventEnd) {
    if (Math.abs(eventStart.getTime() - appointment.startTime.getTime()) > OUTLOOK_EVENT_COMPARE_THRESHOLD_MS) {
      data.startTime = eventStart;
      shouldUpdate = true;
    }

    if (Math.abs(eventEnd.getTime() - appointment.endTime.getTime()) > OUTLOOK_EVENT_COMPARE_THRESHOLD_MS) {
      data.endTime = eventEnd;
      shouldUpdate = true;
    }
  }

  if (event.id && metadata.outlookEventId !== event.id) {
    metadata.outlookEventId = event.id;
    shouldUpdate = true;
  }

  if (shouldUpdate) {
    data.metadata = metadata;
    const updated = await db.appointment.update({
      where: { id: appointment.id },
      data,
      include: {
        service: true,
        customer: true,
        staff: true,
      },
    });

    publishAppointmentEvent({
      id: updated.id,
      businessId: updated.businessId,
      type: 'appointment.updated',
      data: updated,
    });
  } else if (metadata.outlookEventId !== event.id) {
    await db.appointment.update({
      where: { id: appointment.id },
      data: { metadata },
    });
  }

  if (removed && event.id) {
    await db.externalCalendarEvent.deleteMany({
      where: {
        connectionId: connection.id,
        externalEventId: event.id,
      },
    });
  } else {
    await upsertExternalEventRecord(
      connection.id,
      connection.provider,
      mapOutlookEventToPayload(event),
      appointment.id,
    );
  }
};

const fetchOutlookEventChanges = async (connection: any, allowReset = true) => {
  const { accessToken, connection: latestConnection } = await ensureOutlookAccessToken(connection);
  const calendarId = latestConnection.calendarId || 'calendar';
  let requestUrl = connection.outlookDeltaToken;

  if (!requestUrl) {
    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - OUTLOOK_SYNC_LOOKBACK_DAYS);
    const timeMax = new Date(timeMin.getTime());
    timeMax.setDate(timeMax.getDate() + OUTLOOK_SYNC_LOOKBACK_DAYS * 2);
    const params = new URLSearchParams({
      startDateTime: timeMin.toISOString(),
      endDateTime: timeMax.toISOString(),
      '$top': '500',
      '$select': 'id,subject,bodyPreview,start,end,isAllDay,type,showAs,isCancelled,lastModifiedDateTime,body',
    });
    requestUrl = `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/events/delta?${params.toString()}`;
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Prefer: 'outlook.timezone="UTC"',
  };

  try {
    let deltaLink: string | undefined;
    let nextLink: string | undefined = requestUrl;

    while (nextLink) {
      const response = await fetch(nextLink, { headers });

      if (response.status === 410) {
        if (allowReset) {
          await db.calendarConnection.update({
            where: { id: connection.id },
            data: { outlookDeltaToken: null },
          });
          await fetchOutlookEventChanges(
            {
              ...connection,
              outlookDeltaToken: null,
            },
            false,
          );
        }
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch Outlook delta: ${await response.text()}`);
      }

      const data = await response.json();
      const events = data.value ?? [];

      for (const event of events) {
        if (!event.id) continue;
        const appointmentId = await fetchExternalAppointmentId(connection.id, event.id);

        if (event['@removed']) {
          if (appointmentId) {
            await syncAppointmentFromOutlookEvent(connection, event, appointmentId);
          } else {
            await db.externalCalendarEvent.deleteMany({
              where: {
                connectionId: connection.id,
                externalEventId: event.id,
              },
            });
          }
          continue;
        }

        if (appointmentId) {
          await syncAppointmentFromOutlookEvent(connection, event, appointmentId);
        } else {
          await upsertExternalEventRecord(
            connection.id,
            connection.provider,
            mapOutlookEventToPayload(event),
            null,
          );
        }
      }

      nextLink = data['@odata.nextLink'] ?? undefined;
      deltaLink = data['@odata.deltaLink'] ?? deltaLink;
    }

    if (deltaLink) {
      await db.calendarConnection.update({
        where: { id: connection.id },
        data: {
          outlookDeltaToken: deltaLink,
          lastOutlookSyncAt: new Date(),
        },
      });
    }
  } catch (error) {
    if (allowReset) {
      logger.warn('Outlook delta sync failed; clearing token', { connectionId: connection.id, error });
      await db.calendarConnection.update({
        where: { id: connection.id },
        data: { outlookDeltaToken: null },
      });
    } else {
      logger.error('Outlook delta sync failed', { connectionId: connection.id, error });
    }
  }
};

export const startOutlookSubscription = async (connectionId: string) => {
  if (!env.OUTLOOK_CALENDAR_WEBHOOK_URL) {
    logger.warn('OUTLOOK_CALENDAR_WEBHOOK_URL not configured; skipping subscription creation.');
    return null;
  }

  const connection = await db.calendarConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection || connection.provider !== 'OUTLOOK') {
    throw new Error('Calendar connection not found or not an Outlook connection');
  }

  if (connection.watchChannelId) {
    await stopOutlookSubscription(connectionId).catch((error) =>
      logger.warn('Failed to stop existing Outlook subscription', { error }),
    );
  }

  const { accessToken, connection: latestConnection } = await ensureOutlookAccessToken(connection);
  const clientState = randomBytes(24).toString('hex');
  const expiration = new Date(Date.now() + OUTLOOK_SUBSCRIPTION_TTL_MINUTES * 60 * 1000);

  const response = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      changeType: 'created,updated,deleted',
      notificationUrl: env.OUTLOOK_CALENDAR_WEBHOOK_URL,
      resource: `/me/calendars/${latestConnection.calendarId || 'calendar'}/events`,
      expirationDateTime: expiration.toISOString(),
      clientState,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to start Outlook subscription: ${await response.text()}`);
  }

  const subscription = await response.json();

  await db.calendarConnection.update({
    where: { id: connectionId },
    data: {
      watchChannelId: subscription.id,
      watchResourceId: subscription.resource,
      watchChannelToken: clientState,
      webhookExpiresAt: subscription.expirationDateTime
        ? new Date(subscription.expirationDateTime)
        : expiration,
      lastWebhookAt: null,
    },
  });

  return subscription;
};

export const stopOutlookSubscription = async (connectionId: string) => {
  const connection = await db.calendarConnection.findUnique({
    where: { id: connectionId },
  });

  if (
    !connection ||
    connection.provider !== 'OUTLOOK' ||
    !connection.watchChannelId
  ) {
    return;
  }

  try {
    const { accessToken } = await ensureOutlookAccessToken(connection);
    await fetch(`https://graph.microsoft.com/v1.0/subscriptions/${connection.watchChannelId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (error) {
    logger.warn('Failed to delete Outlook subscription', { error, connectionId });
  }

  await db.calendarConnection.update({
    where: { id: connectionId },
    data: {
      watchChannelId: null,
      watchResourceId: null,
      watchChannelToken: null,
      webhookExpiresAt: null,
    },
  });
};

export const processOutlookCalendarNotification = async (
  connectionId: string,
) => {
  const connection = await db.calendarConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection || connection.provider !== 'OUTLOOK' || connection.status !== 'ACTIVE') {
    logger.warn('Ignoring Outlook webhook for inactive or missing connection', { connectionId });
    return;
  }

  await db.calendarConnection.update({
    where: { id: connectionId },
    data: {
      lastWebhookAt: new Date(),
    },
  });

  await fetchOutlookEventChanges(connection);
};

/**
 * Check for conflicts between Bookly appointments and Google Calendar
 */
export const checkGoogleCalendarConflicts = async (
  connectionId: string,
  startTime: Date,
  endTime: Date,
  excludeAppointmentId?: string,
): Promise<boolean> => {
  const events = await fetchGoogleCalendarEvents(connectionId, startTime, endTime);

  // Check for overlapping events
  return events.some((event) => {
    return event.start < endTime && event.end > startTime;
  });
};

/**
 * Get Microsoft Graph API access token (for Outlook)
 */
const getOutlookAccessToken = async (accessToken: string, refreshToken?: string): Promise<string> => {
  // If token is expired, refresh it
  // For now, we'll assume the token is valid. In production, check expiry and refresh if needed.
  // Microsoft Graph tokens typically last 1 hour
  return accessToken;
};

/**
 * Refresh Outlook access token
 */
const refreshOutlookToken = async (refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> => {
  if (!env.OUTLOOK_CLIENT_ID || !env.OUTLOOK_CLIENT_SECRET) {
    throw new Error('Outlook credentials not configured');
  }

  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: env.OUTLOOK_CLIENT_ID,
      client_secret: env.OUTLOOK_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: 'https://graph.microsoft.com/Calendars.ReadWrite',
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh Outlook token');
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
};

const ensureOutlookAccessToken = async (connection: any) => {
  let accessToken = connection.accessToken;
  let updatedConnection = connection;

  const expiresAt = connection.tokenExpiresAt ? new Date(connection.tokenExpiresAt) : null;
  const needsRefresh =
    connection.refreshToken && (!expiresAt || expiresAt.getTime() - Date.now() < 2 * 60 * 1000);

  if (needsRefresh) {
    const refreshed = await refreshOutlookToken(connection.refreshToken);
    accessToken = refreshed.accessToken;
    updatedConnection = await db.calendarConnection.update({
      where: { id: connection.id },
      data: {
        accessToken: refreshed.accessToken,
        tokenExpiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
      },
    });
  }

  return { accessToken, connection: updatedConnection };
};

/**
 * Sync Bookly appointment to Outlook Calendar
 */
export const syncAppointmentToOutlook = async (
  connectionId: string,
  appointment: Appointment & { service?: { name: string } | null; customer?: { firstName: string; lastName: string } | null },
) => {
  const connection = await db.calendarConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection || connection.provider !== 'OUTLOOK' || connection.status !== 'ACTIVE') {
    throw new Error('Invalid or inactive calendar connection');
  }

  const { accessToken, connection: latestConnection } = await ensureOutlookAccessToken(connection);

  const calendarId = latestConnection.calendarId || 'calendar';
  const graphUrl = `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/events`;

  const event = {
    subject: appointment.service?.name || 'Appointment',
    body: {
      contentType: 'HTML',
      content: appointment.customer
        ? `Customer: ${appointment.customer.firstName} ${appointment.customer.lastName}`
        : 'Appointment',
    },
    start: {
      dateTime: appointment.startTime.toISOString(),
      timeZone: 'UTC',
    },
    end: {
      dateTime: appointment.endTime.toISOString(),
      timeZone: 'UTC',
    },
    isAllDay: false,
  };

  // Check if appointment already has a calendar event ID
  const metadata = (appointment.metadata as Record<string, unknown>) || {};
  const existingEventId = metadata.outlookEventId as string | undefined;

  if (existingEventId) {
    // Update existing event
    const response = await fetch(`${graphUrl}/${existingEventId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      throw new Error('Failed to update Outlook Calendar event');
    }

    const updatedBody = response.status === 204 ? null : await response.json();

    await upsertExternalEventRecord(
      latestConnection.id,
      latestConnection.provider,
      mapOutlookEventToPayload(
        updatedBody ?? {
          id: existingEventId,
          subject: event.subject,
          start: event.start,
          end: event.end,
          body: event.body,
        },
      ),
      appointment.id,
    );
    return existingEventId;
  } else {
    // Create new event
    const response = await fetch(graphUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create Outlook Calendar event: ${error}`);
    }

    const created = await response.json();

    // Store event ID in appointment metadata
    await db.appointment.update({
      where: { id: appointment.id },
      data: {
        metadata: {
          ...metadata,
          outlookEventId: created.id,
        },
      },
    });

    await upsertExternalEventRecord(
      latestConnection.id,
      latestConnection.provider,
      mapOutlookEventToPayload(created),
      appointment.id,
    );

    return created.id;
  }
};

/**
 * Delete appointment from Outlook Calendar
 */
export const deleteAppointmentFromOutlook = async (connectionId: string, eventId: string) => {
  const connection = await db.calendarConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection || connection.provider !== 'OUTLOOK' || connection.status !== 'ACTIVE') {
    return; // Silently fail if connection is invalid
  }

  const { accessToken } = await ensureOutlookAccessToken(connection);

  const calendarId = connection.calendarId || 'calendar';
  const graphUrl = `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/events/${eventId}`;

  try {
    const response = await fetch(graphUrl, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok && response.status !== 404) {
      console.error('Failed to delete Outlook Calendar event:', response.statusText);
    }
  } catch (error) {
    console.error('Failed to delete Outlook Calendar event:', error);
    // Don't throw - event might already be deleted
  }

  await db.externalCalendarEvent.deleteMany({
    where: {
      connectionId: connection.id,
      externalEventId: eventId,
    },
  });
};

/**
 * Fetch events from Outlook Calendar and detect conflicts
 */
export const fetchOutlookCalendarEvents = async (
  connectionId: string,
  timeMin: Date,
  timeMax: Date,
): Promise<Array<{ id: string; start: Date; end: Date; summary: string }>> => {
  const connection = await db.calendarConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection || connection.provider !== 'OUTLOOK' || connection.status !== 'ACTIVE') {
    return [];
  }

  const { accessToken, connection: latestConnection } = await ensureOutlookAccessToken(connection);

  const calendarId = latestConnection.calendarId || 'calendar';
  const graphUrl = `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/calendarView?startDateTime=${timeMin.toISOString()}&endDateTime=${timeMax.toISOString()}`;

  try {
    const response = await fetch(graphUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'outlook.timezone="UTC"',
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    return (
      data.value?.map(
        (event: { id: string; start: OutlookDateTime; end: OutlookDateTime; subject: string }) => ({
          id: event.id,
          start: parseOutlookDate(event.start) ?? new Date(event.start?.dateTime ?? Date.now()),
          end: parseOutlookDate(event.end) ?? new Date(event.end?.dateTime ?? Date.now()),
          summary: event.subject || 'Busy',
        }),
      ) || []
    );
  } catch (error) {
    console.error('Failed to fetch Outlook Calendar events:', error);
    return [];
  }
};

/**
 * Check for conflicts between Bookly appointments and Outlook Calendar
 */
export const checkOutlookCalendarConflicts = async (
  connectionId: string,
  startTime: Date,
  endTime: Date,
  excludeAppointmentId?: string,
): Promise<boolean> => {
  const events = await fetchOutlookCalendarEvents(connectionId, startTime, endTime);

  // Check for overlapping events
  return events.some((event) => {
    return event.start < endTime && event.end > startTime;
  });
};

