import { apiRequest } from './client';

export type DateRange = {
  start: string;
  end: string;
};

export type BookingMetrics = {
  total: number;
  confirmed: number;
  cancelled: number;
  noShow: number;
  pending: number;
  byStatus: Array<{ status: string; count: number }>;
  trend: Array<{ date: string; count: number }>;
};

export type RevenueMetrics = {
  total: number;
  paid: number;
  pending: number;
  refunded: number;
  byService: Array<{ serviceId: string; serviceName: string; revenue: number; count: number }>;
  byStaff: Array<{ staffId: string; staffName: string; revenue: number; count: number }>;
  trend: Array<{ date: string; revenue: number; count: number }>;
};

export type StaffUtilization = {
  staffId: string;
  staffName: string;
  totalHours: number;
  bookedHours: number;
  utilizationRate: number;
  appointmentCount: number;
  revenue: number;
};

export type CustomerMetrics = {
  total: number;
  new: number;
  returning: number;
  retentionRate: number;
  topCustomers: Array<{ customerId: string; customerName: string; appointmentCount: number; totalSpent: number }>;
};

export type ServicePerformance = {
  serviceId: string;
  serviceName: string;
  appointmentCount: number;
  revenue: number;
  averagePrice: number;
  cancellationRate: number;
  popularityRank: number;
};

export const fetchBookingMetrics = (dateRange: DateRange) =>
  apiRequest<BookingMetrics>(
    `/analytics/bookings?start=${dateRange.start}&end=${dateRange.end}`,
  );

export const fetchRevenueMetrics = (dateRange: DateRange) =>
  apiRequest<RevenueMetrics>(
    `/analytics/revenue?start=${dateRange.start}&end=${dateRange.end}`,
  );

export const fetchStaffUtilization = (dateRange: DateRange) =>
  apiRequest<StaffUtilization[]>(
    `/analytics/staff-utilization?start=${dateRange.start}&end=${dateRange.end}`,
  );

export const fetchCustomerMetrics = (dateRange: DateRange) =>
  apiRequest<CustomerMetrics>(
    `/analytics/customers?start=${dateRange.start}&end=${dateRange.end}`,
  );

export const fetchServicePerformance = (dateRange: DateRange) =>
  apiRequest<ServicePerformance[]>(
    `/analytics/services?start=${dateRange.start}&end=${dateRange.end}`,
  );

export const fetchDatePresets = () =>
  apiRequest<Record<string, { start: string; end: string }>>('/analytics/date-presets');

