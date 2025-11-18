import { apiRequest } from './client';

export type RefundRequest = {
  appointmentId: string;
  amount?: number;
  reason?: string;
};

export type Invoice = {
  id: string;
  invoiceNumber: string;
  appointmentId: string;
  customerName: string;
  customerEmail: string | null;
  serviceName: string;
  amount: number;
  refundAmount: number;
  netAmount: number;
  status: string;
  date: string;
  paymentIntentId: string | null;
};

export const createRefund = (data: RefundRequest) =>
  apiRequest<{ refundId: string; amount: number; status: string; appointmentId: string }>(
    '/payments/refund',
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
  );

export const fetchInvoices = () =>
  apiRequest<{ invoices: Invoice[] }>('/payments/invoices');

export type StripeConnectStatus = {
  status: 'NOT_CONNECTED' | 'PENDING' | 'ACTIVE';
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsDue: string[];
};

export const fetchStripeConnectStatus = () =>
  apiRequest<StripeConnectStatus>('/payments/connect');

export const createStripeConnectLink = () =>
  apiRequest<{ onboardingUrl: string; expiresAt: string }>('/payments/connect/link', {
    method: 'POST',
  });

export const createStripeLoginLink = () =>
  apiRequest<{ url: string; expiresAt: string }>('/payments/connect/login-link', {
    method: 'POST',
  });

