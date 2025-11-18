import { Router } from 'express';
import { z } from 'zod';
import { format } from 'date-fns';
import { authenticate } from '../../middleware/authenticate.js';
import {
  getBookingMetrics,
  getRevenueMetrics,
  getStaffUtilization,
  getCustomerMetrics,
  getServicePerformance,
  getDateRangePresets,
  type DateRange,
} from '../../services/analyticsService.js';
import {
  exportBookingsToCSV,
  exportRevenueToCSV,
  exportStaffUtilizationToCSV,
  exportCustomersToCSV,
  exportServicePerformanceToCSV,
  generatePDFReport,
} from '../../services/exportService.js';
import { prisma } from '../../config/prisma.js';

const analyticsRouter = Router();
analyticsRouter.use(authenticate());

const dateRangeSchema = z.object({
  start: z.coerce.date(),
  end: z.coerce.date(),
});

// Get booking metrics
analyticsRouter.get('/bookings', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Business context required' });
    }

    const dateRange = dateRangeSchema.parse(req.query);
    const metrics = await getBookingMetrics(req.user.businessId, dateRange as DateRange);

    res.json(metrics);
  } catch (error) {
    next(error);
  }
});

// Get revenue metrics
analyticsRouter.get('/revenue', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Business context required' });
    }

    const dateRange = dateRangeSchema.parse(req.query);
    const metrics = await getRevenueMetrics(req.user.businessId, dateRange as DateRange);

    res.json(metrics);
  } catch (error) {
    next(error);
  }
});

// Get staff utilization
analyticsRouter.get('/staff-utilization', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Business context required' });
    }

    const dateRange = dateRangeSchema.parse(req.query);
    const metrics = await getStaffUtilization(req.user.businessId, dateRange as DateRange);

    res.json(metrics);
  } catch (error) {
    next(error);
  }
});

// Get customer metrics
analyticsRouter.get('/customers', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Business context required' });
    }

    const dateRange = dateRangeSchema.parse(req.query);
    const metrics = await getCustomerMetrics(req.user.businessId, dateRange as DateRange);

    res.json(metrics);
  } catch (error) {
    next(error);
  }
});

// Get service performance
analyticsRouter.get('/services', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Business context required' });
    }

    const dateRange = dateRangeSchema.parse(req.query);
    const metrics = await getServicePerformance(req.user.businessId, dateRange as DateRange);

    res.json(metrics);
  } catch (error) {
    next(error);
  }
});

// Get date range presets
analyticsRouter.get('/date-presets', (req, res) => {
  const presets = getDateRangePresets();
  res.json(presets);
});

// Export bookings to CSV
analyticsRouter.get('/export/bookings.csv', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Business context required' });
    }

    const dateRange = dateRangeSchema.parse(req.query);
    const metrics = await getBookingMetrics(req.user.businessId, dateRange as DateRange);
    const csv = exportBookingsToCSV(metrics, dateRange as DateRange);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="bookings-${format(dateRange.start as Date, 'yyyy-MM-dd')}-${format(dateRange.end as Date, 'yyyy-MM-dd')}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

// Export revenue to CSV
analyticsRouter.get('/export/revenue.csv', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Business context required' });
    }

    const dateRange = dateRangeSchema.parse(req.query);
    const metrics = await getRevenueMetrics(req.user.businessId, dateRange as DateRange);
    const csv = exportRevenueToCSV(metrics, dateRange as DateRange);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="revenue-${format(dateRange.start as Date, 'yyyy-MM-dd')}-${format(dateRange.end as Date, 'yyyy-MM-dd')}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

// Export staff utilization to CSV
analyticsRouter.get('/export/staff-utilization.csv', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Business context required' });
    }

    const dateRange = dateRangeSchema.parse(req.query);
    const utilization = await getStaffUtilization(req.user.businessId, dateRange as DateRange);
    const csv = exportStaffUtilizationToCSV(utilization);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="staff-utilization-${format(dateRange.start as Date, 'yyyy-MM-dd')}-${format(dateRange.end as Date, 'yyyy-MM-dd')}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

// Export customers to CSV
analyticsRouter.get('/export/customers.csv', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Business context required' });
    }

    const dateRange = dateRangeSchema.parse(req.query);
    const metrics = await getCustomerMetrics(req.user.businessId, dateRange as DateRange);
    const csv = exportCustomersToCSV(metrics);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="customers-${format(dateRange.start as Date, 'yyyy-MM-dd')}-${format(dateRange.end as Date, 'yyyy-MM-dd')}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

// Export services to CSV
analyticsRouter.get('/export/services.csv', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Business context required' });
    }

    const dateRange = dateRangeSchema.parse(req.query);
    const performance = await getServicePerformance(req.user.businessId, dateRange as DateRange);
    const csv = exportServicePerformanceToCSV(performance);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="services-${format(dateRange.start as Date, 'yyyy-MM-dd')}-${format(dateRange.end as Date, 'yyyy-MM-dd')}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

// Export full report to PDF
analyticsRouter.get('/export/report.pdf', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Business context required' });
    }

    const dateRange = dateRangeSchema.parse(req.query);

    // Get business name
    const business = await prisma.business.findUnique({
      where: { id: req.user.businessId },
      select: { name: true },
    });

    // Fetch all metrics
    const [bookings, revenue, staff, customers, services] = await Promise.all([
      getBookingMetrics(req.user.businessId, dateRange as DateRange),
      getRevenueMetrics(req.user.businessId, dateRange as DateRange),
      getStaffUtilization(req.user.businessId, dateRange as DateRange),
      getCustomerMetrics(req.user.businessId, dateRange as DateRange),
      getServicePerformance(req.user.businessId, dateRange as DateRange),
    ]);

    const pdfBuffer = await generatePDFReport(
      business?.name || 'Business',
      'Analytics',
      dateRange as DateRange,
      { bookings, revenue, staff, customers, services },
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="analytics-report-${format(dateRange.start as Date, 'yyyy-MM-dd')}-${format(dateRange.end as Date, 'yyyy-MM-dd')}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

export { analyticsRouter };

