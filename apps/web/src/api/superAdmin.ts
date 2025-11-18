import { apiRequest } from './client';

export type TenantSummary = {
  id: string;
  name: string;
  industry?: string | null;
  timezone: string;
  currency: string;
  onboardingState: string;
  paymentConnectionStatus: string;
  stripeChargesEnabled: boolean;
  testDriveStatus?: string | null;
  createdAt: string;
  owner: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  } | null;
  _count: {
    customers: number;
    appointments: number;
    staffMembers: number;
  };
};

export const fetchTenants = () =>
  apiRequest<{ businesses: TenantSummary[] }>('/super-admin/businesses');

export const requestImpersonationToken = (businessId: string) =>
  apiRequest<{ accessToken: string }>(`/super-admin/businesses/${businessId}/impersonate`, {
    method: 'POST',
  });

export type TenantHealthMetrics = {
  businessId: string;
  businessName: string;
  industry: string | null;
  ownerEmail: string;
  createdAt: string;
  onboardingState: string;
  paymentStatus: string;
  testDriveStatus: string | null;
  metrics: {
    totalAppointments: number;
    totalCustomers: number;
    totalRevenue: number;
    activeStaff: number;
    activeServices: number;
    recentActivity: {
      appointmentsLast7Days: number;
      customersLast7Days: number;
      revenueLast7Days: number;
    };
    utilization: {
      avgStaffUtilization: number;
      topService: string | null;
    };
  };
};

export type PlatformSummary = {
  totalBusinesses: number;
  totalCustomers: number;
  totalAppointments: number;
  totalPlatformRevenue: number;
  activeTestDrives: number;
  businessesWithPayments: number;
};

export const fetchTenantHealthMetrics = () =>
  apiRequest<{ tenants: TenantHealthMetrics[] }>('/super-admin/analytics/tenants');

export const fetchPlatformSummary = () =>
  apiRequest<PlatformSummary>('/super-admin/analytics/summary');

