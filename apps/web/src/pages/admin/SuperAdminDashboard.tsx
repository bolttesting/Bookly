import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Navigate } from 'react-router-dom';
import { Users, Calendar, DollarSign, Activity } from 'lucide-react';

import {
  fetchTenants,
  requestImpersonationToken,
  fetchTenantHealthMetrics,
  fetchPlatformSummary,
  type TenantHealthMetrics,
  type PlatformSummary,
} from '../../api/superAdmin';
import { fetchAdminSubscriptions, type AdminSubscription } from '../../api/billing';
import { useAuthStore } from '../../stores/authStore';

export const SuperAdminDashboard = () => {
  const { user, setSession } = useAuthStore();
  const [view, setView] = useState<'overview' | 'analytics' | 'billing'>('overview');

  const tenantsQuery = useQuery({
    queryKey: ['super-admin', 'businesses'],
    queryFn: fetchTenants,
    enabled: user?.role === 'SUPERADMIN',
  });

  const analyticsQuery = useQuery({
    queryKey: ['super-admin', 'analytics'],
    queryFn: fetchTenantHealthMetrics,
    enabled: user?.role === 'SUPERADMIN' && view === 'analytics',
  });

  const summaryQuery = useQuery({
    queryKey: ['super-admin', 'summary'],
    queryFn: fetchPlatformSummary,
    enabled: user?.role === 'SUPERADMIN',
  });

  const subscriptionsQuery = useQuery({
    queryKey: ['super-admin', 'subscriptions'],
    queryFn: fetchAdminSubscriptions,
    enabled: user?.role === 'SUPERADMIN' && view === 'billing',
  });

  const impersonateMutation = useMutation({
    mutationFn: requestImpersonationToken,
    onSuccess: ({ accessToken }) => {
      if (!user) return;
      // Set session with impersonation flag - RequireAuth will fetch business info
      setSession({
        user: {
          id: user.id,
          email: user.email!,
          firstName: user.firstName,
          lastName: user.lastName,
          role: 'SUPERADMIN',
        },
        business: undefined, // Will be fetched by RequireAuth from /auth/me
        accessToken,
        isImpersonating: true,
      });
      window.location.href = '/dashboard';
    },
  });

  if (user?.role !== 'SUPERADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  if (tenantsQuery.isLoading) {
    return (
      <div className="py-20 text-center text-neutral-500">
        Loading tenant overview...
      </div>
    );
  }

  if (tenantsQuery.isError) {
    return (
      <div className="py-20 text-center text-danger">
        Failed to load tenants. Please try again later.
      </div>
    );
  }

  const businesses = tenantsQuery.data?.businesses ?? [];
  const tenantMetrics: TenantHealthMetrics[] = analyticsQuery.data?.tenants ?? [];
  const summary: PlatformSummary | undefined = summaryQuery.data;

  const totalCustomers = businesses.reduce((sum, biz) => sum + biz._count.customers, 0);
  const totalAppointments = businesses.reduce((sum, biz) => sum + biz._count.appointments, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' }).format(amount);
  };

  return (
    <div className="space-y-3 lg:space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4">
        <div>
          <p className="text-xs lg:text-sm uppercase tracking-wide text-primary font-semibold mb-1">Super Admin</p>
          <h1 className="text-xl lg:text-h1 text-neutral-900 mb-1">Tenant Control Center</h1>
          <p className="text-sm lg:text-base text-neutral-500 max-w-2xl">
            Monitor tenant health, payment readiness, and onboarding progress across the platform.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView('overview')}
            className={`px-3 lg:px-4 py-1.5 lg:py-2 rounded-full text-sm lg:text-base font-medium transition ${
              view === 'overview'
                ? 'bg-primary text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setView('analytics')}
            className={`px-3 lg:px-4 py-1.5 lg:py-2 rounded-full text-sm lg:text-base font-medium transition ${
              view === 'analytics'
                ? 'bg-primary text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            Analytics
          </button>
          <button
            onClick={() => setView('billing')}
            className={`px-3 lg:px-4 py-1.5 lg:py-2 rounded-full text-sm lg:text-base font-medium transition ${
              view === 'billing'
                ? 'bg-primary text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            Billing
          </button>
        </div>
      </div>

      {/* Platform Summary Cards */}
      {summary && (
        <div className="grid gap-3 lg:gap-4 grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl lg:rounded-3xl border border-neutral-200 bg-white p-3 lg:p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs lg:text-base text-neutral-500">Total Businesses</p>
              <Users size={20} className="lg:w-6 lg:h-6 text-primary" />
            </div>
            <p className="text-xl lg:text-h2 text-neutral-900">{summary.totalBusinesses}</p>
            <p className="text-xs lg:text-sm text-neutral-500 mt-1">
              {summary.businessesWithPayments} with payments enabled
            </p>
          </div>

          <div className="rounded-2xl lg:rounded-3xl border border-neutral-200 bg-white p-3 lg:p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs lg:text-base text-neutral-500">Total Customers</p>
              <Users size={20} className="lg:w-6 lg:h-6 text-blue-500" />
            </div>
            <p className="text-xl lg:text-h2 text-neutral-900">{summary.totalCustomers.toLocaleString()}</p>
            <p className="text-xs lg:text-sm text-neutral-500 mt-1">Across all tenants</p>
          </div>

          <div className="rounded-2xl lg:rounded-3xl border border-neutral-200 bg-white p-3 lg:p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs lg:text-base text-neutral-500">Total Appointments</p>
              <Calendar size={20} className="lg:w-6 lg:h-6 text-emerald-500" />
            </div>
            <p className="text-xl lg:text-h2 text-neutral-900">{summary.totalAppointments.toLocaleString()}</p>
            <p className="text-xs lg:text-sm text-neutral-500 mt-1">All time</p>
          </div>

          <div className="rounded-2xl lg:rounded-3xl border border-neutral-200 bg-white p-3 lg:p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs lg:text-base text-neutral-500">Platform Revenue</p>
              <DollarSign size={20} className="lg:w-6 lg:h-6 text-purple-500" />
            </div>
            <p className="text-xl lg:text-h2 text-neutral-900">{formatCurrency(summary.totalPlatformRevenue)}</p>
            <p className="text-xs lg:text-sm text-neutral-500 mt-1">From all businesses</p>
          </div>
        </div>
      )}

      {view === 'analytics' ? (
        /* Analytics View */
        <div className="space-y-6">
          {analyticsQuery.isLoading ? (
            <div className="text-center py-12 text-neutral-500">Loading tenant analytics...</div>
          ) : (
            <div className="rounded-2xl lg:rounded-3xl border border-neutral-200 bg-white overflow-hidden">
              <div className="p-4 lg:p-6 border-b border-neutral-200">
                <h3 className="text-lg lg:text-h3 text-neutral-900">Tenant Health Metrics</h3>
                <p className="text-sm lg:text-base text-neutral-500 mt-1">Detailed analytics for each business</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs lg:text-base">
                  <thead className="bg-neutral-50 text-neutral-500">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Business</th>
                      <th className="px-4 py-3 text-left font-medium">Revenue</th>
                      <th className="px-4 py-3 text-left font-medium">Customers</th>
                      <th className="px-4 py-3 text-left font-medium">Appointments</th>
                      <th className="px-4 py-3 text-left font-medium">Recent Activity</th>
                      <th className="px-4 py-3 text-left font-medium">Utilization</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenantMetrics.map((tenant) => (
                      <tr key={tenant.businessId} className="border-t border-neutral-100">
                        <td className="px-4 py-3">
                          <div className="font-medium text-neutral-900">{tenant.businessName}</div>
                          <div className="text-sm text-neutral-500">
                            {tenant.industry || 'Unspecified'} · {tenant.ownerEmail}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-neutral-900">
                            {formatCurrency(tenant.metrics.totalRevenue)}
                          </div>
                          <div className="text-sm text-neutral-500">
                            +{formatCurrency(tenant.metrics.recentActivity.revenueLast7Days)} (7d)
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-neutral-900">{tenant.metrics.totalCustomers}</div>
                          <div className="text-sm text-neutral-500">
                            +{tenant.metrics.recentActivity.customersLast7Days} new
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-neutral-900">{tenant.metrics.totalAppointments}</div>
                          <div className="text-sm text-neutral-500">
                            +{tenant.metrics.recentActivity.appointmentsLast7Days} (7d)
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Activity
                              size={16}
                              className={
                                tenant.metrics.recentActivity.appointmentsLast7Days > 0
                                  ? 'text-emerald-500'
                                  : 'text-neutral-300'
                              }
                            />
                            <span className="text-sm text-neutral-600">
                              {tenant.metrics.recentActivity.appointmentsLast7Days} appointments
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-neutral-900">
                            {tenant.metrics.utilization.avgStaffUtilization}%
                          </div>
                          <div className="text-sm text-neutral-500">
                            {tenant.metrics.utilization.topService || 'N/A'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-medium ${
                                tenant.paymentStatus === 'ACTIVE'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  tenant.paymentStatus === 'ACTIVE' ? 'bg-emerald-500' : 'bg-amber-500'
                                }`}
                              />
                              {tenant.paymentStatus}
                            </span>
                            {tenant.testDriveStatus && (
                              <span className="text-sm text-neutral-500">
                                Test Drive: {tenant.testDriveStatus}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {tenantMetrics.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">
                          No tenant metrics available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Overview View */
        <>

      <div className="grid gap-3 lg:gap-4 grid-cols-1 sm:grid-cols-3">
        <div className="rounded-2xl lg:rounded-3xl border border-neutral-200 bg-white p-3 lg:p-4">
          <p className="text-sm lg:text-base text-neutral-500">Active tenants</p>
          <p className="text-2xl lg:text-display text-neutral-900">{businesses.length}</p>
        </div>
        <div className="rounded-2xl lg:rounded-3xl border border-neutral-200 bg-white p-3 lg:p-4">
          <p className="text-sm lg:text-base text-neutral-500">Total customers</p>
          <p className="text-2xl lg:text-display text-neutral-900">{totalCustomers}</p>
        </div>
        <div className="rounded-2xl lg:rounded-3xl border border-neutral-200 bg-white p-3 lg:p-4">
          <p className="text-sm lg:text-base text-neutral-500">Appointments tracked</p>
          <p className="text-2xl lg:text-display text-neutral-900">{totalAppointments}</p>
        </div>
      </div>

      <div className="rounded-2xl lg:rounded-3xl border border-neutral-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs lg:text-sm">
          <thead className="bg-neutral-50 text-neutral-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Business</th>
              <th className="px-4 py-3 text-left font-medium">Owner</th>
              <th className="px-4 py-3 text-left font-medium">Customers</th>
              <th className="px-4 py-3 text-left font-medium">Appointments</th>
              <th className="px-4 py-3 text-left font-medium">Payments</th>
              <th className="px-4 py-3 text-left font-medium">Created</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((biz) => {
              const ownerName = biz.owner
                ? `${biz.owner.firstName ?? ''} ${biz.owner.lastName ?? ''}`.trim()
                : '—';
              const paymentsReady =
                biz.paymentConnectionStatus === 'ACTIVE' && biz.stripeChargesEnabled;

              return (
                <tr key={biz.id} className="border-t border-neutral-100">
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-900">{biz.name}</div>
                    <div className="text-xs text-neutral-500">
                      {biz.industry ?? 'Unspecified'} · {biz.currency}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-neutral-900">{ownerName || 'No owner'}</div>
                    <div className="text-sm text-neutral-500">{biz.owner?.email ?? '—'}</div>
                  </td>
                  <td className="px-4 py-3">{biz._count.customers}</td>
                  <td className="px-4 py-3">{biz._count.appointments}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                        paymentsReady
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${paymentsReady ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      {paymentsReady ? 'Ready' : biz.paymentConnectionStatus ?? 'Pending'}
                    </span>
                    <div className="text-sm text-neutral-500 mt-1">
                      Test Drive: {biz.testDriveStatus ?? 'NONE'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {format(new Date(biz.createdAt), 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      className="rounded-full border px-3 py-1.5 lg:py-1 text-xs lg:text-sm font-semibold hover:bg-neutral-50 disabled:opacity-60 touch-manipulation"
                      onClick={() => impersonateMutation.mutate(biz.id)}
                      disabled={impersonateMutation.isPending}
                    >
                      {impersonateMutation.isPending ? 'Switching…' : 'Impersonate tenant'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {!businesses.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                  No tenants found yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
        </>
      )}

      {/* Billing View */}
      {view === 'billing' && (
        <div className="rounded-3xl bg-white shadow-card p-4 lg:p-6">
          <h2 className="text-lg lg:text-h2 text-neutral-900 mb-4 lg:mb-6">Subscription Management</h2>
          {subscriptionsQuery.isLoading ? (
            <div className="py-12 text-center text-neutral-500">Loading subscriptions...</div>
          ) : subscriptionsQuery.isError ? (
            <div className="py-12 text-center text-red-500">Failed to load subscriptions</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-200">
                    <th className="px-4 py-3 text-left text-xs lg:text-sm font-semibold text-neutral-700">Business</th>
                    <th className="px-4 py-3 text-left text-xs lg:text-sm font-semibold text-neutral-700">Owner</th>
                    <th className="px-4 py-3 text-left text-xs lg:text-sm font-semibold text-neutral-700">Plan</th>
                    <th className="px-4 py-3 text-left text-xs lg:text-sm font-semibold text-neutral-700">Status</th>
                    <th className="px-4 py-3 text-left text-xs lg:text-sm font-semibold text-neutral-700">Usage</th>
                    <th className="px-4 py-3 text-left text-xs lg:text-sm font-semibold text-neutral-700">Period End</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptionsQuery.data?.subscriptions.map((sub) => (
                    <tr key={sub.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-neutral-900">{sub.name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-neutral-600">
                          {sub.owner.firstName} {sub.owner.lastName}
                        </div>
                        <div className="text-xs text-neutral-500">{sub.owner.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-primary/10 text-primary">
                          {sub.subscriptionPlan ?? 'None'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                            sub.subscriptionStatus === 'ACTIVE'
                              ? 'bg-green-100 text-green-700'
                              : sub.subscriptionStatus === 'TRIAL'
                              ? 'bg-blue-100 text-blue-700'
                              : sub.subscriptionStatus === 'PAST_DUE'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-neutral-100 text-neutral-700'
                          }`}
                        >
                          {sub.subscriptionStatus ?? 'None'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-neutral-600">
                          Staff: {sub.usageStaffCount}
                        </div>
                        <div className="text-xs text-neutral-600">
                          Services: {sub.usageServiceCount}
                        </div>
                        <div className="text-xs text-neutral-600">
                          Pages: {sub.usageBookingPageCount}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600">
                        {sub.subscriptionCurrentPeriodEnd
                          ? format(new Date(sub.subscriptionCurrentPeriodEnd), 'MMM d, yyyy')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                  {!subscriptionsQuery.data?.subscriptions.length && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                        No subscriptions found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

