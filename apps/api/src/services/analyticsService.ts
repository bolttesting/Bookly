import { prisma } from '../config/prisma.js';
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

const db = prisma as any;

export type DateRange = {
  start: Date;
  end: Date;
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

/**
 * Get booking metrics for a business
 */
export const getBookingMetrics = async (businessId: string, dateRange: DateRange): Promise<BookingMetrics> => {
  const appointments = await db.appointment.findMany({
    where: {
      businessId,
      startTime: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    select: {
      status: true,
      startTime: true,
    },
  });

  const total = appointments.length;
  const confirmed = appointments.filter((a: any) => a.status === 'CONFIRMED').length;
  const cancelled = appointments.filter((a: any) => a.status === 'CANCELLED').length;
  const noShow = appointments.filter((a: any) => a.status === 'NO_SHOW').length;
  const pending = appointments.filter((a: any) => a.status === 'PENDING').length;

  // Group by status
  const statusMap = new Map<string, number>();
  appointments.forEach((a: any) => {
    statusMap.set(a.status, (statusMap.get(a.status) || 0) + 1);
  });
  const byStatus = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }));

  // Daily trend
  const trendMap = new Map<string, number>();
  appointments.forEach((a: any) => {
    const date = new Date(a.startTime).toISOString().split('T')[0];
    trendMap.set(date, (trendMap.get(date) || 0) + 1);
  });
  const trend = Array.from(trendMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    total,
    confirmed,
    cancelled,
    noShow,
    pending,
    byStatus,
    trend,
  };
};

/**
 * Get revenue metrics for a business
 */
export const getRevenueMetrics = async (businessId: string, dateRange: DateRange): Promise<RevenueMetrics> => {
  const appointments = await db.appointment.findMany({
    where: {
      businessId,
      startTime: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    include: {
      service: {
        select: {
          id: true,
          name: true,
          price: true,
        },
      },
      staff: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  let total = 0;
  let paid = 0;
  let pending = 0;
  let refunded = 0;

  const serviceMap = new Map<string, { name: string; revenue: number; count: number }>();
  const staffMap = new Map<string, { name: string; revenue: number; count: number }>();
  const trendMap = new Map<string, { revenue: number; count: number }>();

  appointments.forEach((apt: any) => {
    const price = apt.service?.price ? Number(apt.service.price) : 0;
    const date = new Date(apt.startTime).toISOString().split('T')[0];

    total += price;

    if (apt.paymentStatus === 'PAID') {
      paid += price;
    } else if (apt.paymentStatus === 'PENDING') {
      pending += price;
    } else if (apt.paymentStatus === 'REFUNDED') {
      refunded += price;
    }

    // By service
    if (apt.service) {
      const existing = serviceMap.get(apt.service.id) || { name: apt.service.name, revenue: 0, count: 0 };
      existing.revenue += price;
      existing.count += 1;
      serviceMap.set(apt.service.id, existing);
    }

    // By staff
    if (apt.staff) {
      const existing = staffMap.get(apt.staff.id) || { name: apt.staff.name, revenue: 0, count: 0 };
      existing.revenue += price;
      existing.count += 1;
      staffMap.set(apt.staff.id, existing);
    }

    // Daily trend
    const existingTrend = trendMap.get(date) || { revenue: 0, count: 0 };
    existingTrend.revenue += price;
    existingTrend.count += 1;
    trendMap.set(date, existingTrend);
  });

  const byService = Array.from(serviceMap.entries())
    .map(([serviceId, data]) => ({
      serviceId,
      serviceName: data.name,
      revenue: data.revenue,
      count: data.count,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const byStaff = Array.from(staffMap.entries())
    .map(([staffId, data]) => ({
      staffId,
      staffName: data.name,
      revenue: data.revenue,
      count: data.count,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const trend = Array.from(trendMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    total,
    paid,
    pending,
    refunded,
    byService,
    byStaff,
    trend,
  };
};

/**
 * Get staff utilization metrics
 */
export const getStaffUtilization = async (businessId: string, dateRange: DateRange): Promise<StaffUtilization[]> => {
  const staff = await db.staffMember.findMany({
    where: { businessId, isActive: true },
    select: { id: true, name: true },
  });

  const appointments = await db.appointment.findMany({
    where: {
      businessId,
      staffId: { in: staff.map((s: any) => s.id) },
      startTime: { gte: dateRange.start, lte: dateRange.end },
      status: { in: ['CONFIRMED', 'COMPLETED'] },
    },
    include: {
      service: {
        select: { durationMinutes: true, price: true },
      },
    },
  });

  const utilizationMap = new Map<string, StaffUtilization>();

  staff.forEach((s: any) => {
    utilizationMap.set(s.id, {
      staffId: s.id,
      staffName: s.name,
      totalHours: 0,
      bookedHours: 0,
      utilizationRate: 0,
      appointmentCount: 0,
      revenue: 0,
    });
  });

  appointments.forEach((apt: any) => {
    const staffId = apt.staffId;
    const existing = utilizationMap.get(staffId);
    if (!existing) return;

    const durationHours = apt.service?.durationMinutes ? apt.service.durationMinutes / 60 : 0;
    const price = apt.service?.price ? Number(apt.service.price) : 0;

    existing.bookedHours += durationHours;
    existing.appointmentCount += 1;
    existing.revenue += price;
    utilizationMap.set(staffId, existing);
  });

  // Calculate total available hours (assuming 8 hours per day, 5 days per week)
  const daysDiff = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
  const totalAvailableHours = daysDiff * 8;

  const results = Array.from(utilizationMap.values()).map((util) => {
    util.totalHours = totalAvailableHours;
    util.utilizationRate = util.totalHours > 0 ? (util.bookedHours / util.totalHours) * 100 : 0;
    return util;
  });

  return results.sort((a, b) => b.utilizationRate - a.utilizationRate);
};

/**
 * Get customer metrics
 */
export const getCustomerMetrics = async (businessId: string, dateRange: DateRange): Promise<CustomerMetrics> => {
  const allCustomers = await db.customer.findMany({
    where: { businessId },
    include: {
      appointments: {
        where: {
          startTime: { gte: dateRange.start, lte: dateRange.end },
        },
        include: {
          service: {
            select: { price: true },
          },
        },
      },
    },
  });

  const total = allCustomers.length;
  const newCustomers = allCustomers.filter((c: any) => {
    const firstAppointment = c.appointments?.[0];
    return firstAppointment && new Date(firstAppointment.startTime) >= dateRange.start;
  }).length;

  const returning = allCustomers.filter((c: any) => c.appointments && c.appointments.length > 1).length;
  const retentionRate = total > 0 ? (returning / total) * 100 : 0;

  const topCustomers = allCustomers
    .map((c: any) => {
      const appointmentCount = c.appointments?.length || 0;
      const totalSpent = c.appointments?.reduce((sum: number, apt: any) => {
        return sum + (apt.service?.price ? Number(apt.service.price) : 0);
      }, 0) || 0;

      return {
        customerId: c.id,
        customerName: `${c.firstName} ${c.lastName}`.trim() || c.email,
        appointmentCount,
        totalSpent,
      };
    })
    .filter((c: any) => c.appointmentCount > 0)
    .sort((a: any, b: any) => b.totalSpent - a.totalSpent)
    .slice(0, 10);

  return {
    total,
    new: newCustomers,
    returning,
    retentionRate,
    topCustomers,
  };
};

/**
 * Get service performance metrics
 */
export const getServicePerformance = async (businessId: string, dateRange: DateRange): Promise<ServicePerformance[]> => {
  const services = await db.service.findMany({
    where: { businessId, isActive: true },
    select: { id: true, name: true, price: true },
  });

  const appointments = await db.appointment.findMany({
    where: {
      businessId,
      serviceId: { in: services.map((s: any) => s.id) },
      startTime: { gte: dateRange.start, lte: dateRange.end },
    },
    select: {
      serviceId: true,
      status: true,
    },
  });

  const serviceMap = new Map<string, ServicePerformance>();

  services.forEach((s: any) => {
    serviceMap.set(s.id, {
      serviceId: s.id,
      serviceName: s.name,
      appointmentCount: 0,
      revenue: 0,
      averagePrice: Number(s.price) || 0,
      cancellationRate: 0,
      popularityRank: 0,
    });
  });

  let totalAppointments = 0;
  let totalCancelled = 0;

  appointments.forEach((apt: any) => {
    const service = serviceMap.get(apt.serviceId);
    if (!service) return;

    service.appointmentCount += 1;
    totalAppointments += 1;

    if (apt.status === 'CANCELLED') {
      totalCancelled += 1;
    }

    service.revenue += service.averagePrice;
    serviceMap.set(apt.serviceId, service);
  });

  const results = Array.from(serviceMap.values())
    .map((s) => {
      s.cancellationRate = s.appointmentCount > 0 ? (totalCancelled / totalAppointments) * 100 : 0;
      return s;
    })
    .sort((a, b) => b.appointmentCount - a.appointmentCount)
    .map((s, index) => {
      s.popularityRank = index + 1;
      return s;
    });

  return results;
};

/**
 * Get date range presets
 */
export const getDateRangePresets = () => {
  const now = new Date();
  return {
    today: {
      start: startOfDay(now),
      end: endOfDay(now),
    },
    yesterday: {
      start: startOfDay(subDays(now, 1)),
      end: endOfDay(subDays(now, 1)),
    },
    thisWeek: {
      start: startOfWeek(now),
      end: endOfWeek(now),
    },
    lastWeek: {
      start: startOfWeek(subDays(now, 7)),
      end: endOfWeek(subDays(now, 7)),
    },
    thisMonth: {
      start: startOfMonth(now),
      end: endOfMonth(now),
    },
    lastMonth: {
      start: startOfMonth(subDays(now, 30)),
      end: endOfMonth(subDays(now, 30)),
    },
    last30Days: {
      start: startOfDay(subDays(now, 30)),
      end: endOfDay(now),
    },
    last90Days: {
      start: startOfDay(subDays(now, 90)),
      end: endOfDay(now),
    },
  };
};

