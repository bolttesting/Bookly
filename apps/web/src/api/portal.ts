const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

type RequestOptions = RequestInit & {
  token?: string;
};

const portalFetch = async <T>(path: string, { token, ...options }: RequestOptions = {}) => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers ?? {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = 'Request failed';
    try {
      const data = await response.json();
      message = data.message ?? message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
};

export const requestPortalLink = (email: string) =>
  portalFetch<{ message: string; expiresAt: string }>('/client-portal/auth/request-link', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

export const verifyPortalToken = (token: string) =>
  portalFetch<{
    portalToken: string;
    customer: { id: string; firstName?: string; lastName?: string; email?: string };
    businessId: string;
  }>('/client-portal/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });

export const fetchPortalMe = (token: string) =>
  portalFetch<{ customer: any; business: any }>('/client-portal/me', { token });

export const updatePortalProfile = (token: string, payload: { firstName: string; lastName: string; phone?: string }) =>
  portalFetch<{ customer: any }>('/client-portal/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
    token,
  });

export const fetchPortalAppointments = (token: string) =>
  portalFetch<{ appointments: any[] }>('/client-portal/appointments', { token });

export const cancelPortalAppointment = (token: string, appointmentId: string) =>
  portalFetch(`/client-portal/appointments/${appointmentId}`, {
    method: 'DELETE',
    token,
  });

export const fetchPortalPackages = (token: string) =>
  portalFetch<{ packages: any[] }>('/client-portal/packages', { token });

export const reschedulePortalAppointment = (
  token: string,
  appointmentId: string,
  newStartTime: string,
  newEndTime?: string,
) =>
  portalFetch<{ appointment: any; message: string }>(`/client-portal/appointments/${appointmentId}/reschedule`, {
    method: 'POST',
    body: JSON.stringify({ newStartTime, newEndTime }),
    token,
  });

export const fetchPortalReceipts = (token: string) =>
  portalFetch<{ receipts: any[] }>('/client-portal/receipts', { token });

