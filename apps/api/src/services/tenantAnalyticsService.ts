import { prisma } from '../config/prisma.js';
import { startOfDay, endOfDay, subDays } from 'date-fns';

const db = prisma as any;

export type TenantHealthMetrics = {
  businessId: string;
  businessName: string;
  industry: string | null;
  ownerEmail: string;
  createdAt: Date;
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

/**
 * Get health metrics for all tenants
 */
export const getAllTenantHealthMetrics = async (): Promise<TenantHealthMetrics[]> => {
  const businesses = await db.business.findMany({
    include: {
      owner: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      _count: {
        select: {
          appointments: true,
          customers: true,
          staffMembers: {
            where: { isActive: true },
          },
          services: {
            where: { isActive: true },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const sevenDaysAgo = startOfDay(subDays(new Date(), 7));
  const now = endOfDay(new Date());

  const metrics = await Promise.all(
    businesses.map(async (business: any) => {
      // Get recent appointments
      const recentAppointments = await db.appointment.findMany({
        where: {
          businessId: business.id,
          createdAt: { gte: sevenDaysAgo, lte: now },
        },
        include: {
          service: {
            select: { price: true },
          },
        },
      });

      // Get recent customers
      const recentCustomers = await db.customer.count({
        where: {
          businessId: business.id,
          createdAt: { gte: sevenDaysAgo, lte: now },
        },
      });

      // Calculate revenue
      const totalRevenue = await db.appointment.aggregate({
        where: {
          businessId: business.id,
          paymentStatus: { in: ['PAID', 'PARTIALLY_REFUNDED'] },
        },
        _sum: {
          // We'll need to calculate from service price
        },
      });

      // Get appointments with services to calculate revenue
      const paidAppointments = await db.appointment.findMany({
        where: {
          businessId: business.id,
          paymentStatus: { in: ['PAID', 'PARTIALLY_REFUNDED'] },
        },
        include: {
          service: {
            select: { price: true },
          },
        },
      });

      const totalRevenueAmount = paidAppointments.reduce((sum: number, apt: any) => {
        const price = apt.service?.price ? Number(apt.service.price) : 0;
        const metadata = (apt.metadata as Record<string, unknown>) || {};
        const refundAmount = (metadata.refundAmount as number) || 0;
        return sum + (price - refundAmount);
      }, 0);

      const recentRevenue = recentAppointments.reduce((sum: number, apt: any) => {
        if (apt.paymentStatus === 'PAID') {
          return sum + (apt.service?.price ? Number(apt.service.price) : 0);
        }
        return sum;
      }, 0);

      // Get top service
      const serviceCounts = await db.appointment.groupBy({
        by: ['serviceId'],
        where: {
          businessId: business.id,
        },
        _count: {
          serviceId: true,
        },
        orderBy: {
          _count: {
            serviceId: 'desc',
          },
        },
        take: 1,
      });

      const topServiceId = serviceCounts[0]?.serviceId;
      const topService = topServiceId
        ? await db.service.findUnique({
            where: { id: topServiceId },
            select: { name: true },
          })
        : null;

      // Calculate staff utilization (simplified)
      const staffWithAppointments = await db.staffMember.findMany({
        where: {
          businessId: business.id,
          isActive: true,
        },
        include: {
          _count: {
            select: {
              appointments: {
                where: {
                  status: { in: ['CONFIRMED', 'COMPLETED'] },
                  startTime: { gte: sevenDaysAgo },
                },
              },
            },
          },
        },
      });

      const avgUtilization =
        staffWithAppointments.length > 0
          ? staffWithAppointments.reduce((sum: number, staff: any) => {
              // Simple calculation: appointments per staff member
              return sum + (staff._count.appointments > 0 ? 1 : 0);
            }, 0) / staffWithAppointments.length
          : 0;

      return {
        businessId: business.id,
        businessName: business.name,
        industry: business.industry,
        ownerEmail: business.owner?.email || 'N/A',
        createdAt: business.createdAt,
        onboardingState: business.onboardingState,
        paymentStatus: business.paymentConnectionStatus || 'NOT_CONNECTED',
        testDriveStatus: business.testDriveStatus,
        metrics: {
          totalAppointments: business._count.appointments,
          totalCustomers: business._count.customers,
          totalRevenue: totalRevenueAmount,
          activeStaff: business._count.staffMembers,
          activeServices: business._count.services,
          recentActivity: {
            appointmentsLast7Days: recentAppointments.length,
            customersLast7Days: recentCustomers,
            revenueLast7Days: recentRevenue,
          },
          utilization: {
            avgStaffUtilization: Math.round(avgUtilization * 100),
            topService: topService?.name || null,
          },
        },
      };
    }),
  );

  return metrics;
};

/**
 * Get platform-wide summary
 */
export const getPlatformSummary = async () => {
  const [
    totalBusinesses,
    totalCustomers,
    totalAppointments,
    activeTestDrives,
    businessesWithPayments,
  ] = await Promise.all([
    db.business.count(),
    db.customer.count(),
    db.appointment.count(),
    db.business.count({
      where: {
        testDriveStatus: { in: ['ACTIVE', 'COMPLETED'] },
      },
    }),
    db.business.count({
      where: {
        paymentConnectionStatus: 'ACTIVE',
      },
    }),
  ]);

  // Get revenue across all businesses
  const allPaidAppointments = await db.appointment.findMany({
    where: {
      paymentStatus: { in: ['PAID', 'PARTIALLY_REFUNDED'] },
    },
    include: {
      service: {
        select: { price: true },
      },
    },
  });

  const totalPlatformRevenue = allPaidAppointments.reduce((sum: number, apt: any) => {
    const price = apt.service?.price ? Number(apt.service.price) : 0;
    const metadata = (apt.metadata as Record<string, unknown>) || {};
    const refundAmount = (metadata.refundAmount as number) || 0;
    return sum + (price - refundAmount);
  }, 0);

  return {
    totalBusinesses,
    totalCustomers,
    totalAppointments,
    totalPlatformRevenue,
    activeTestDrives,
    businessesWithPayments,
  };
};

