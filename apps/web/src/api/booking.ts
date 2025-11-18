import { apiRequest } from './client';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

export const fetchBookingPage = (slug: string) =>
  apiRequest<{
    bookingPage: { id: string; name: string; slug: string; settings?: Record<string, unknown> };
    business: {
      name: string;
      timezone: string;
      currency: string;
      paymentConnectionStatus: string;
      paymentsEnabled: boolean;
    };
    services: Service[];
    staff: StaffMember[];
  }>(`/public/booking/${slug}`);

export const fetchAvailability = (slug: string, params: { serviceId: string; staffId?: string; date: string }) => {
  const query = new URLSearchParams({
    serviceId: params.serviceId,
    date: params.date,
    ...(params.staffId ? { staffId: params.staffId } : {}),
  });
  return apiRequest<{ availability: Slot[] }>(`/public/booking/${slug}/availability?${query.toString()}`);
};

export type PublicBookingResponse = {
  appointment: {
    id: string;
    startTime: string;
    endTime: string;
    status: string;
    staffId: string | null;
    serviceId: string;
  };
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  summary: {
    date: string;
    time: string;
  };
  paymentStatus: string;
  portalSso?: {
    token: string;
    portalUrl: string;
    expiresAt: string;
  };
};

export const createPublicBooking = (
  slug: string,
  payload: {
    serviceId: string;
    staffId?: string;
    startTime: string;
    paymentIntentId?: string;
    customer: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      marketingConsent: boolean;
      notes?: string;
    };
  },
  options?: {
    embedded?: boolean;
  },
) =>
  apiRequest<PublicBookingResponse>(`/public/booking/${slug}/book`, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: options?.embedded ? { 'X-Bookly-Embed': '1' } : undefined,
  });

export type PaymentIntentResponse = {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
};

export const createPaymentIntent = (
  slug: string,
  payload: {
    serviceId: string;
    staffId?: string;
    startTime: string;
    customer: {
      firstName: string;
      lastName: string;
      email: string;
    };
  },
  options?: {
    embedded?: boolean;
  },
) =>
  apiRequest<PaymentIntentResponse>(`/public/booking/${slug}/payment-intent`, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: options?.embedded ? { 'X-Bookly-Embed': '1' } : undefined,
  });

export type Service = {
  id: string;
  name: string;
  description?: string | null;
  durationMinutes: number;
  price: string;
  color?: string | null;
};

export type StaffMember = {
  id: string;
  name: string;
  role: string;
};

export type Slot = {
  staffId: string;
  startTime: string;
  endTime: string;
};

