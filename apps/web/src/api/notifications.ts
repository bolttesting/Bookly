import { apiRequest } from './client';

export type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  status: 'UNREAD' | 'READ' | 'ARCHIVED';
  link?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  readAt?: string | null;
};

export type NotificationsResponse = {
  notifications: Notification[];
  unreadCount: number;
};

export const fetchNotifications = (status?: string, limit?: number) =>
  apiRequest<NotificationsResponse>(
    `/notifications${status || limit ? `?${new URLSearchParams({ ...(status && { status }), ...(limit && { limit: limit.toString() }) }).toString()}` : ''}`,
  );

export const markNotificationAsRead = (id: string) =>
  apiRequest<{ success: boolean }>(`/notifications/${id}/read`, {
    method: 'PUT',
  });

export const markAllNotificationsAsRead = () =>
  apiRequest<{ success: boolean }>('/notifications/read-all', {
    method: 'PUT',
  });

export const createNotification = (payload: {
  type: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
}) =>
  apiRequest<Notification>('/notifications', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

