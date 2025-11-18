import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CreditCard, Check, X, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { toast } from 'react-hot-toast';

import {
  fetchBillingInfo,
  createSubscription,
  updateSubscriptionPlan,
  cancelSubscription,
  reactivateSubscription,
  syncUsage,
  type SubscriptionPlan,
} from '../../api/billing.js';
import {
  fetchStripeConnectStatus,
  createStripeConnectLink,
  createStripeLoginLink,
} from '../../api/payments.js';

const PLAN_DETAILS: Record<SubscriptionPlan, { name: string; price: string; description: string }> = {
  STARTER: {
    name: 'Starter',
    price: 'AED 20/month',
    description: 'Perfect for solo practitioners',
  },
  GROWTH: {
    name: 'Growth',
    price: 'AED 50/month',
    description: 'For growing teams',
  },
  BUSINESS: {
    name: 'Business',
    price: 'AED 150/month',
    description: 'For established businesses',
  },
};

export const BillingPage = () => {
  const queryClient = useQueryClient();

  const billingQuery = useQuery({
    queryKey: ['billing'],
    queryFn: fetchBillingInfo,
  });

  const stripeConnectQuery = useQuery({
    queryKey: ['stripe-connect'],
    queryFn: fetchStripeConnectStatus,
  });

  const syncMutation = useMutation({
    mutationFn: syncUsage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] });
      toast.success('Usage metrics updated');
    },
    onError: () => {
      toast.error('Failed to sync usage');
    },
  });

  const subscribeMutation = useMutation({
    mutationFn: ({ plan }: { plan: SubscriptionPlan }) => createSubscription(plan),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] });
      toast.success('Subscription created successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create subscription');
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: updateSubscriptionPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] });
      toast.success('Plan updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update plan');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] });
      toast.success('Subscription canceled');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to cancel subscription');
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: reactivateSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] });
      toast.success('Subscription reactivated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to reactivate subscription');
    },
  });

  const connectStripeMutation = useMutation({
    mutationFn: createStripeConnectLink,
    onSuccess: (data) => {
      window.location.href = data.onboardingUrl;
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to start Stripe onboarding');
    },
  });

  const stripeLoginMutation = useMutation({
    mutationFn: createStripeLoginLink,
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to open Stripe dashboard');
    },
  });

  if (billingQuery.isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-neutral-500">Loading billing information...</div>
      </div>
    );
  }

  if (billingQuery.error || !billingQuery.data) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-red-500">Failed to load billing information</div>
      </div>
    );
  }

  const { subscription, usage, limits, limitCheck, suspension } = billingQuery.data;
  const hasActiveSubscription = subscription.plan && subscription.status === 'ACTIVE';
  const isCanceled = subscription.cancelAtPeriodEnd || subscription.status === 'CANCELED';

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h2 text-neutral-900">Billing & Subscription</h1>
          <p className="text-sm text-neutral-500 mt-1">Manage your subscription and usage</p>
        </div>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="flex items-center gap-2 rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition disabled:opacity-50"
        >
          <RefreshCw size={16} className={syncMutation.isPending ? 'animate-spin' : ''} />
          Sync Usage
        </button>
      </div>

      {/* Suspension Alert */}
      {suspension && (
        <div className="rounded-3xl bg-red-50 border border-red-200 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle size={24} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 mb-1">Account Suspended</h3>
              <p className="text-sm text-red-700 mb-3">
                {suspension.reason || 'Your account has been suspended due to payment issues.'}
              </p>
              <p className="text-xs text-red-600 mb-4">
                Suspended on {format(new Date(suspension.suspendedAt), 'MMM d, yyyy')} • {suspension.dunningAttempts} payment attempt{suspension.dunningAttempts !== 1 ? 's' : ''}
              </p>
              <p className="text-sm text-red-800 mb-4">
                To restore access, please update your payment method below.
              </p>
              <button
                onClick={() => {
                  // Scroll to subscription section or trigger payment update
                  window.location.href = '#subscription';
                }}
                className="px-4 py-2 rounded-full bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition"
              >
                Update Payment Method
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Current Subscription */}
      <div className="rounded-3xl bg-white shadow-card p-6 space-y-4" id="subscription">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">Current Plan</h2>
          {subscription.status && (
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                subscription.status === 'ACTIVE'
                  ? 'bg-green-100 text-green-700'
                  : subscription.status === 'TRIAL'
                  ? 'bg-blue-100 text-blue-700'
                  : subscription.status === 'PAST_DUE' || subscription.status === 'SUSPENDED'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-neutral-100 text-neutral-700'
              }`}
            >
              {subscription.status.replace('_', ' ')}
            </span>
          )}
        </div>

        {subscription.plan ? (
          <div className="space-y-4">
            <div>
              <div className="text-2xl font-semibold text-neutral-900">
                {PLAN_DETAILS[subscription.plan].name}
              </div>
              <div className="text-sm text-neutral-500 mt-1">
                {PLAN_DETAILS[subscription.plan].price}
              </div>
            </div>

            {subscription.currentPeriodEnd && (
              <div className="text-sm text-neutral-600">
                {isCanceled ? (
                  <span className="text-red-600">
                    Expires on {format(new Date(subscription.currentPeriodEnd), 'MMM d, yyyy')}
                  </span>
                ) : (
                  <span>
                    Renews on {format(new Date(subscription.currentPeriodEnd), 'MMM d, yyyy')}
                  </span>
                )}
              </div>
            )}

            {isCanceled && (
              <button
                onClick={() => reactivateMutation.mutate()}
                disabled={reactivateMutation.isPending}
                className="px-4 py-2 rounded-full bg-primary text-white text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50"
              >
                Reactivate Subscription
              </button>
            )}

            {!isCanceled && hasActiveSubscription && (
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to cancel your subscription?')) {
                    cancelMutation.mutate(false);
                  }
                }}
                disabled={cancelMutation.isPending}
                className="px-4 py-2 rounded-full border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition disabled:opacity-50"
              >
                Cancel Subscription
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-neutral-600">No active subscription</p>
            <div className="grid gap-3 md:grid-cols-3">
              {(['STARTER', 'GROWTH', 'BUSINESS'] as SubscriptionPlan[]).map((plan) => (
                <button
                  key={plan}
                  onClick={() => subscribeMutation.mutate({ plan })}
                  disabled={subscribeMutation.isPending}
                  className="p-4 rounded-2xl border border-neutral-200 hover:border-primary hover:bg-primary/5 transition text-left disabled:opacity-50"
                >
                  <div className="font-semibold text-neutral-900">{PLAN_DETAILS[plan].name}</div>
                  <div className="text-sm text-neutral-500 mt-1">{PLAN_DETAILS[plan].price}</div>
                  <div className="text-xs text-neutral-400 mt-2">
                    {PLAN_DETAILS[plan].description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Usage Metrics */}
      {limits && (
        <div className="rounded-3xl bg-white shadow-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-neutral-900">Usage</h2>

          {!limitCheck.withinLimits && (
            <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-medium text-red-900">Plan limits exceeded</div>
                  <ul className="mt-2 space-y-1 text-sm text-red-700">
                    {limitCheck.violations.map((violation, idx) => (
                      <li key={idx}>• {violation}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="p-4 rounded-2xl bg-neutral-50">
              <div className="text-sm text-neutral-500">Staff Members</div>
              <div className="text-2xl font-semibold text-neutral-900 mt-1">
                {usage.staffCount}
                {limits && <span className="text-sm text-neutral-400">/{limits.staff}</span>}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-neutral-50">
              <div className="text-sm text-neutral-500">Services</div>
              <div className="text-2xl font-semibold text-neutral-900 mt-1">
                {usage.serviceCount}
                {limits && <span className="text-sm text-neutral-400">/{limits.services}</span>}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-neutral-50">
              <div className="text-sm text-neutral-500">Booking Pages</div>
              <div className="text-2xl font-semibold text-neutral-900 mt-1">
                {usage.bookingPageCount}
                {limits && (
                  <span className="text-sm text-neutral-400">/{limits.bookingPages}</span>
                )}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-neutral-50">
              <div className="text-sm text-neutral-500">Appointments (30d)</div>
              <div className="text-2xl font-semibold text-neutral-900 mt-1">
                {usage.appointmentCount}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plan Features */}
      {limits && (
        <div className="rounded-3xl bg-white shadow-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-neutral-900">Plan Features</h2>
          <ul className="space-y-2">
            {limits.features.map((feature, idx) => (
              <li key={idx} className="flex items-center gap-2 text-sm text-neutral-600">
                <Check size={16} className="text-green-600 flex-shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Upgrade Options */}
      {hasActiveSubscription && subscription.plan && (
        <div className="rounded-3xl bg-white shadow-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-neutral-900">Change Plan</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {(['STARTER', 'GROWTH', 'BUSINESS'] as SubscriptionPlan[])
              .filter((plan) => plan !== subscription.plan)
              .map((plan) => (
                <button
                  key={plan}
                  onClick={() => {
                    if (confirm(`Switch to ${PLAN_DETAILS[plan].name}?`)) {
                      updatePlanMutation.mutate(plan);
                    }
                  }}
                  disabled={updatePlanMutation.isPending}
                  className="p-4 rounded-2xl border border-neutral-200 hover:border-primary hover:bg-primary/5 transition text-left disabled:opacity-50"
                >
                  <div className="font-semibold text-neutral-900">{PLAN_DETAILS[plan].name}</div>
                  <div className="text-sm text-neutral-500 mt-1">{PLAN_DETAILS[plan].price}</div>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Stripe Connect - Payment Receiving Setup */}
      <div className="rounded-3xl bg-white shadow-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Payment Receiving</h2>
            <p className="text-sm text-neutral-500 mt-1">
              Connect your Stripe account to receive payments from customers
            </p>
          </div>
        </div>

        {stripeConnectQuery.isLoading ? (
          <div className="text-neutral-500">Loading payment connection status...</div>
        ) : stripeConnectQuery.error ? (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
            <div className="text-sm text-red-700">
              Failed to load payment connection status. Please try again.
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {stripeConnectQuery.data?.status === 'NOT_CONNECTED' && (
              <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4">
                <div className="flex items-start gap-3">
                  <CreditCard size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium text-blue-900 mb-1">Connect Stripe Account</div>
                    <div className="text-sm text-blue-700 mb-4">
                      Connect your Stripe account to start accepting payments from customers. You'll
                      be able to receive payments directly to your bank account.
                    </div>
                    <button
                      onClick={() => connectStripeMutation.mutate()}
                      disabled={connectStripeMutation.isPending}
                      className="px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                    >
                      {connectStripeMutation.isPending ? (
                        'Connecting...'
                      ) : (
                        <>
                          Connect Stripe Account
                          <ExternalLink size={16} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {stripeConnectQuery.data?.status === 'PENDING' && (
              <div className="rounded-2xl bg-yellow-50 border border-yellow-200 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium text-yellow-900 mb-1">Onboarding In Progress</div>
                    <div className="text-sm text-yellow-700 mb-2">
                      Your Stripe account is being set up. Please complete the onboarding process.
                    </div>
                    {stripeConnectQuery.data.requirementsDue.length > 0 && (
                      <div className="text-xs text-yellow-600 mb-4">
                        Requirements: {stripeConnectQuery.data.requirementsDue.join(', ')}
                      </div>
                    )}
                    <button
                      onClick={() => connectStripeMutation.mutate()}
                      disabled={connectStripeMutation.isPending}
                      className="px-4 py-2 rounded-full bg-yellow-600 text-white text-sm font-medium hover:bg-yellow-700 transition disabled:opacity-50 flex items-center gap-2"
                    >
                      {connectStripeMutation.isPending ? (
                        'Loading...'
                      ) : (
                        <>
                          Complete Onboarding
                          <ExternalLink size={16} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {stripeConnectQuery.data?.status === 'ACTIVE' && (
              <div className="rounded-2xl bg-green-50 border border-green-200 p-4">
                <div className="flex items-start gap-3">
                  <Check size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium text-green-900 mb-1">Stripe Account Connected</div>
                    <div className="text-sm text-green-700 mb-2">
                      Your Stripe account is active and ready to receive payments.
                      {stripeConnectQuery.data.chargesEnabled && ' Charges are enabled.'}
                      {stripeConnectQuery.data.payoutsEnabled && ' Payouts are enabled.'}
                    </div>
                    <button
                      onClick={() => {
                        queryClient.invalidateQueries({ queryKey: ['stripe-connect'] });
                        stripeLoginMutation.mutate();
                      }}
                      disabled={stripeLoginMutation.isPending}
                      className="px-4 py-2 rounded-full border border-green-600 text-green-700 text-sm font-medium hover:bg-green-50 transition disabled:opacity-50 flex items-center gap-2"
                    >
                      {stripeLoginMutation.isPending ? (
                        'Opening...'
                      ) : (
                        <>
                          Open Stripe Dashboard
                          <ExternalLink size={16} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

