import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { prisma } from '../../config/prisma.js';

const metricsRouter = Router();
metricsRouter.use(authenticate());

// Get basic metrics for the business
metricsRouter.get('/', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Business context required' });
    }

    const businessId = req.user.businessId;

    // Get counts
    const [
      appointmentsCount,
      customersCount,
      servicesCount,
      staffCount,
      activeAppointmentsCount,
    ] = await Promise.all([
      prisma.appointment.count({ where: { businessId } }),
      prisma.customer.count({ where: { businessId } }),
      prisma.service.count({ where: { businessId, isActive: true } }),
      prisma.staffMember.count({ where: { businessId, isActive: true } }),
      prisma.appointment.count({
        where: {
          businessId,
          status: { in: ['PENDING', 'CONFIRMED'] },
          startTime: { gte: new Date() },
        },
      }),
    ]);

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentAppointments = await prisma.appointment.count({
      where: {
        businessId,
        createdAt: { gte: sevenDaysAgo },
      },
    });

    const recentCustomers = await prisma.customer.count({
      where: {
        businessId,
        createdAt: { gte: sevenDaysAgo },
      },
    });

    res.json({
      counts: {
        appointments: appointmentsCount,
        customers: customersCount,
        services: servicesCount,
        staff: staffCount,
        activeAppointments: activeAppointmentsCount,
      },
      recent: {
        appointments: recentAppointments,
        customers: recentCustomers,
        period: '7 days',
      },
    });
  } catch (error) {
    next(error);
  }
});

export { metricsRouter };

