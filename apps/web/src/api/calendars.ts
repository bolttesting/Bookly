import { apiRequest } from './client';

export type CalendarConnection = {
  id: string;
  provider: 'GOOGLE' | 'OUTLOOK';
  status: 'PENDING' | 'ACTIVE' | 'ERROR' | 'DISCONNECTED';
  calendarId?: string | null;
  calendarName?: string | null;
  syncEnabled: boolean;
  syncDirection: string;
  lastSyncAt?: string | null;
  lastSyncError?: string | null;
  staff?: {
    id: string;
    name: string;
    email?: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type CalendarConnectionsResponse = {
  connections: CalendarConnection[];
};

export const fetchCalendarConnections = (staffId?: string) =>
  apiRequest<CalendarConnectionsResponse>(
    `/calendars${staffId ? `?staffId=${staffId}` : ''}`,
  );

export const initiateGoogleConnect = (staffId?: string) =>
  apiRequest<{ authUrl: string; state: string }>(
    `/calendars/google/connect${staffId ? `?staffId=${staffId}` : ''}`,
  );

export const initiateOutlookConnect = (staffId?: string) =>
  apiRequest<{ authUrl: string; state: string }>(
    `/calendars/outlook/connect${staffId ? `?staffId=${staffId}` : ''}`,
  );

export const disconnectCalendar = (connectionId: string) =>
  apiRequest<{ success: boolean }>(`/calendars/${connectionId}`, {
    method: 'DELETE',
  });

export const toggleCalendarSync = (connectionId: string, syncEnabled: boolean) =>
  apiRequest<{ connection: CalendarConnection }>(`/calendars/${connectionId}/sync`, {
    method: 'PUT',
    body: JSON.stringify({ syncEnabled }),
  });

export const syncCalendarNow = (connectionId: string) =>
  apiRequest<{ success: boolean; message: string }>(`/calendars/${connectionId}/sync-now`, {
    method: 'POST',
  });

