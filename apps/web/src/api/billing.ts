import { apiRequest } from './client.js';

export type SubscriptionPlan = 'STARTER' | 'GROWTH' | 'BUSINESS';
export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'SUSPENDED';

export interface Subscription {
  plan: SubscriptionPlan | null;
  status: SubscriptionStatus | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
}

export interface UsageMetrics {
  staffCount: number;
  serviceCount: number;
  bookingPageCount: number;
  appointmentCount: number;
}

export interface PlanLimits {
  staff: number;
  services: number;
  bookingPages: number;
  price: number;
  features: string[];
}

export interface LimitCheck {
  withinLimits: boolean;
  violations: string[];
}

export interface SuspensionInfo {
  suspendedAt: string;
  reason: string | null;
  dunningAttempts: number;
}

export interface BillingInfo {
  subscription: Subscription;
  usage: UsageMetrics;
  limits: PlanLimits | null;
  limitCheck: LimitCheck;
  suspension: SuspensionInfo | null;
}

export interface SubscriptionResponse {
  subscriptionId: string;
  clientSecret?: string;
  message: string;
}

/**
 * Get current subscription and usage
 */
export async function fetchBillingInfo(): Promise<BillingInfo> {
  return apiRequest<BillingInfo>('/billing', { method: 'GET' });
}

/**
 * Create a new subscription
 */
export async function createSubscription(
  plan: SubscriptionPlan,
  paymentMethodId?: string
): Promise<SubscriptionResponse> {
  return apiRequest<SubscriptionResponse>('/billing/subscribe', {
    method: 'POST',
    body: JSON.stringify({ plan, paymentMethodId }),
  });
}

/**
 * Update subscription plan
 */
export async function updateSubscriptionPlan(plan: SubscriptionPlan): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/billing/subscription', {
    method: 'PUT',
    body: JSON.stringify({ plan }),
  });
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(immediately = false): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/billing/subscription/cancel', {
    method: 'POST',
    body: JSON.stringify({ immediately }),
  });
}

/**
 * Reactivate subscription
 */
export async function reactivateSubscription(): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/billing/subscription/reactivate', {
    method: 'POST',
  });
}

/**
 * Sync usage metrics
 */
export async function syncUsage(): Promise<{ usage: UsageMetrics; message: string }> {
  return apiRequest<{ usage: UsageMetrics; message: string }>('/billing/usage/sync', {
    method: 'POST',
  });
}

// Super-admin endpoints
export interface AdminSubscription {
  id: string;
  name: string;
  subscriptionPlan: SubscriptionPlan | null;
  subscriptionStatus: SubscriptionStatus | null;
  subscriptionCurrentPeriodStart: string | null;
  subscriptionCurrentPeriodEnd: string | null;
  subscriptionCancelAtPeriodEnd: boolean;
  usageStaffCount: number;
  usageServiceCount: number;
  usageBookingPageCount: number;
  stripeSubscriptionId: string | null;
  owner: {
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

export interface AdminSubscriptionsResponse {
  subscriptions: AdminSubscription[];
}

/**
 * Get all subscriptions (super-admin only)
 */
export async function fetchAdminSubscriptions(): Promise<AdminSubscriptionsResponse> {
  return apiRequest<AdminSubscriptionsResponse>('/billing/admin/subscriptions', { method: 'GET' });
}

/**
 * Update subscription for a business (super-admin only)
 */
export async function updateAdminSubscription(
  businessId: string,
  plan?: SubscriptionPlan,
  status?: SubscriptionStatus
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/billing/admin/subscriptions/${businessId}`, {
    method: 'PUT',
    body: JSON.stringify({ plan, status }),
  });
}

