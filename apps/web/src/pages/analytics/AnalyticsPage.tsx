import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { Calendar, TrendingUp, Users, DollarSign, BarChart3, Download, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../stores/authStore';

import {
  fetchBookingMetrics,
  fetchRevenueMetrics,
  fetchStaffUtilization,
  fetchCustomerMetrics,
  fetchServicePerformance,
  type DateRange,
} from '../../api/analytics';

type DatePreset = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'last30Days' | 'last90Days';

const getDateRangeForPreset = (preset: DatePreset): DateRange => {
  const now = new Date();
  switch (preset) {
    case 'today':
      return {
        start: format(now, "yyyy-MM-dd'T'00:00:00"),
        end: format(now, "yyyy-MM-dd'T'23:59:59"),
      };
    case 'yesterday':
      const yesterday = subDays(now, 1);
      return {
        start: format(yesterday, "yyyy-MM-dd'T'00:00:00"),
        end: format(yesterday, "yyyy-MM-dd'T'23:59:59"),
      };
    case 'thisWeek':
      return {
        start: format(startOfWeek(now), "yyyy-MM-dd'T'00:00:00"),
        end: format(endOfWeek(now), "yyyy-MM-dd'T'23:59:59"),
      };
    case 'lastWeek':
      const lastWeekStart = startOfWeek(subDays(now, 7));
      const lastWeekEnd = endOfWeek(subDays(now, 7));
      return {
        start: format(lastWeekStart, "yyyy-MM-dd'T'00:00:00"),
        end: format(lastWeekEnd, "yyyy-MM-dd'T'23:59:59"),
      };
    case 'thisMonth':
      return {
        start: format(startOfMonth(now), "yyyy-MM-dd'T'00:00:00"),
        end: format(endOfMonth(now), "yyyy-MM-dd'T'23:59:59"),
      };
    case 'lastMonth':
      const lastMonth = subDays(now, 30);
      return {
        start: format(startOfMonth(lastMonth), "yyyy-MM-dd'T'00:00:00"),
        end: format(endOfMonth(lastMonth), "yyyy-MM-dd'T'23:59:59"),
      };
    case 'last30Days':
      return {
        start: format(subDays(now, 30), "yyyy-MM-dd'T'00:00:00"),
        end: format(now, "yyyy-MM-dd'T'23:59:59"),
      };
    case 'last90Days':
      return {
        start: format(subDays(now, 90), "yyyy-MM-dd'T'00:00:00"),
        end: format(now, "yyyy-MM-dd'T'23:59:59"),
      };
    default:
      return {
        start: format(subDays(now, 30), "yyyy-MM-dd'T'00:00:00"),
        end: format(now, "yyyy-MM-dd'T'23:59:59"),
      };
  }
};

export const AnalyticsPage = () => {
  const [datePreset, setDatePreset] = useState<DatePreset>('last30Days');
  const dateRange = getDateRangeForPreset(datePreset);

  const { data: bookingMetrics, isLoading: bookingsLoading } = useQuery({
    queryKey: ['analytics', 'bookings', dateRange],
    queryFn: () => fetchBookingMetrics(dateRange),
  });

  const { data: revenueMetrics, isLoading: revenueLoading } = useQuery({
    queryKey: ['analytics', 'revenue', dateRange],
    queryFn: () => fetchRevenueMetrics(dateRange),
  });

  const { data: staffUtilization, isLoading: staffLoading } = useQuery({
    queryKey: ['analytics', 'staff', dateRange],
    queryFn: () => fetchStaffUtilization(dateRange),
  });

  const { data: customerMetrics, isLoading: customersLoading } = useQuery({
    queryKey: ['analytics', 'customers', dateRange],
    queryFn: () => fetchCustomerMetrics(dateRange),
  });

  const { data: servicePerformance, isLoading: servicesLoading } = useQuery({
    queryKey: ['analytics', 'services', dateRange],
    queryFn: () => fetchServicePerformance(dateRange),
  });

  const isLoading = bookingsLoading || revenueLoading || staffLoading || customersLoading || servicesLoading;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' }).format(amount);
  };

  const handleExport = async (format: 'csv' | 'pdf') => {
    const start = new Date(dateRange.start).toISOString();
    const end = new Date(dateRange.end).toISOString();
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
    const token = useAuthStore.getState().accessToken;

    try {
      let url: string;
      let filename: string;
      let contentType: string;

      if (format === 'pdf') {
        url = `${baseUrl}/analytics/export/report.pdf?start=${start}&end=${end}`;
        filename = `analytics-report-${dateRange.start}-${dateRange.end}.pdf`;
        contentType = 'application/pdf';
      } else {
        url = `${baseUrl}/analytics/export/bookings.csv?start=${start}&end=${end}`;
        filename = `bookings-${dateRange.start}-${dateRange.end}.csv`;
        contentType = 'text/csv';
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      toast.success(`${format.toUpperCase()} file downloading...`);
    } catch (error) {
      toast.error(`Failed to export ${format.toUpperCase()}`);
      console.error('Export error:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-display text-neutral-900">Analytics & Reports</h1>
          <p className="text-sm text-neutral-500 mt-1">Track performance, revenue, and customer insights</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleExport('csv')}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border-2 border-neutral-300 text-neutral-900 hover:bg-neutral-50 hover:border-primary transition font-medium"
          >
            <Download size={18} />
            <span className="text-sm lg:text-base">Export CSV</span>
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-white hover:bg-primary/90 transition font-medium"
          >
            <FileText size={18} />
            <span className="text-sm lg:text-base">Export PDF</span>
          </button>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <Calendar size={18} className="text-neutral-500" />
        {(['today', 'yesterday', 'thisWeek', 'lastWeek', 'thisMonth', 'lastMonth', 'last30Days', 'last90Days'] as DatePreset[]).map((preset) => (
          <button
            key={preset}
            onClick={() => setDatePreset(preset)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              datePreset === preset
                ? 'bg-primary text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            {preset.charAt(0).toUpperCase() + preset.slice(1).replace(/([A-Z])/g, ' $1')}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-neutral-500">Loading analytics...</div>
      ) : (
        <>
          {/* Key Metrics Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="bg-white rounded-3xl shadow-card p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-neutral-500">Total Bookings</p>
                <BarChart3 size={20} className="text-primary" />
              </div>
              <p className="text-h2 text-neutral-900">{bookingMetrics?.total ?? 0}</p>
              <p className="text-xs text-neutral-500 mt-1">
                {bookingMetrics?.confirmed ?? 0} confirmed
              </p>
            </div>

            <div className="bg-white rounded-3xl shadow-card p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-neutral-500">Total Revenue</p>
                <DollarSign size={20} className="text-emerald-500" />
              </div>
              <p className="text-h2 text-neutral-900">{formatCurrency(revenueMetrics?.total ?? 0)}</p>
              <p className="text-xs text-neutral-500 mt-1">
                {formatCurrency(revenueMetrics?.paid ?? 0)} paid
              </p>
            </div>

            <div className="bg-white rounded-3xl shadow-card p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-neutral-500">Customers</p>
                <Users size={20} className="text-blue-500" />
              </div>
              <p className="text-h2 text-neutral-900">{customerMetrics?.total ?? 0}</p>
              <p className="text-xs text-neutral-500 mt-1">
                {customerMetrics?.new ?? 0} new, {customerMetrics?.returning ?? 0} returning
              </p>
            </div>

            <div className="bg-white rounded-3xl shadow-card p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-neutral-500">Avg. Utilization</p>
                <TrendingUp size={20} className="text-purple-500" />
              </div>
              <p className="text-h2 text-neutral-900">
                {staffUtilization && staffUtilization.length > 0
                  ? `${Math.round(staffUtilization.reduce((sum, s) => sum + s.utilizationRate, 0) / staffUtilization.length)}%`
                  : '0%'}
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                Across {staffUtilization?.length ?? 0} staff members
              </p>
            </div>
          </div>

          {/* Revenue Breakdown */}
          <div className="bg-white rounded-3xl shadow-card p-6">
            <h3 className="text-h3 text-neutral-900 mb-4">Revenue Breakdown</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-neutral-500">Paid</p>
                <p className="text-h2 text-emerald-600">{formatCurrency(revenueMetrics?.paid ?? 0)}</p>
              </div>
              <div>
                <p className="text-sm text-neutral-500">Pending</p>
                <p className="text-h2 text-amber-600">{formatCurrency(revenueMetrics?.pending ?? 0)}</p>
              </div>
              <div>
                <p className="text-sm text-neutral-500">Refunded</p>
                <p className="text-h2 text-red-600">{formatCurrency(revenueMetrics?.refunded ?? 0)}</p>
              </div>
            </div>
          </div>

          {/* Top Services */}
          {servicePerformance && servicePerformance.length > 0 && (
            <div className="bg-white rounded-3xl shadow-card p-6">
              <h3 className="text-h3 text-neutral-900 mb-4">Top Services</h3>
              <div className="space-y-3">
                {servicePerformance.slice(0, 5).map((service) => (
                  <div key={service.serviceId} className="flex items-center justify-between p-3 rounded-2xl bg-neutral-50">
                    <div>
                      <p className="font-semibold text-neutral-900">{service.serviceName}</p>
                      <p className="text-xs text-neutral-500">
                        {service.appointmentCount} bookings · {formatCurrency(service.revenue)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-primary">#{service.popularityRank}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Staff Utilization */}
          {staffUtilization && staffUtilization.length > 0 && (
            <div className="bg-white rounded-3xl shadow-card p-6">
              <h3 className="text-h3 text-neutral-900 mb-4">Staff Utilization</h3>
              <div className="space-y-4">
                {staffUtilization.map((staff) => (
                  <div key={staff.staffId}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-neutral-900">{staff.staffName}</p>
                      <p className="text-sm font-semibold text-primary">{Math.round(staff.utilizationRate)}%</p>
                    </div>
                    <div className="w-full bg-neutral-200 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(staff.utilizationRate, 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1 text-xs text-neutral-500">
                      <span>{staff.appointmentCount} appointments</span>
                      <span>{formatCurrency(staff.revenue)} revenue</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Customers */}
          {customerMetrics && customerMetrics.topCustomers.length > 0 && (
            <div className="bg-white rounded-3xl shadow-card p-6">
              <h3 className="text-h3 text-neutral-900 mb-4">Top Customers</h3>
              <div className="space-y-3">
                {customerMetrics.topCustomers.slice(0, 5).map((customer) => (
                  <div key={customer.customerId} className="flex items-center justify-between p-3 rounded-2xl bg-neutral-50">
                    <div>
                      <p className="font-semibold text-neutral-900">{customer.customerName}</p>
                      <p className="text-xs text-neutral-500">
                        {customer.appointmentCount} appointments
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-emerald-600">
                      {formatCurrency(customer.totalSpent)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

