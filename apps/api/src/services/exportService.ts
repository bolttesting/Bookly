import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import type { BookingMetrics, RevenueMetrics, StaffUtilization, CustomerMetrics, ServicePerformance } from './analyticsService.js';

/**
 * Generate CSV content from data array
 */
export const generateCSV = (headers: string[], rows: (string | number)[][]): string => {
  const csvRows: string[] = [];

  // Add headers
  csvRows.push(headers.map((h) => `"${h}"`).join(','));

  // Add rows
  rows.forEach((row) => {
    csvRows.push(row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','));
  });

  return csvRows.join('\n');
};

/**
 * Export booking metrics to CSV
 */
export const exportBookingsToCSV = (metrics: BookingMetrics, dateRange: { start: Date; end: Date }): string => {
  const headers = ['Date', 'Bookings'];
  const rows = metrics.trend.map((item) => [item.date, item.count]);

  const title = `Booking Metrics Report\nPeriod: ${format(dateRange.start, 'yyyy-MM-dd')} to ${format(dateRange.end, 'yyyy-MM-dd')}\n\n`;
  const summary = `Total Bookings: ${metrics.total}\nConfirmed: ${metrics.confirmed}\nCancelled: ${metrics.cancelled}\nNo Shows: ${metrics.noShow}\nPending: ${metrics.pending}\n\n`;

  return title + summary + generateCSV(headers, rows);
};

/**
 * Export revenue metrics to CSV
 */
export const exportRevenueToCSV = (metrics: RevenueMetrics, dateRange: { start: Date; end: Date }): string => {
  const headers = ['Date', 'Revenue', 'Bookings'];
  const rows = metrics.trend.map((item) => [item.date, item.revenue.toFixed(2), item.count]);

  const title = `Revenue Metrics Report\nPeriod: ${format(dateRange.start, 'yyyy-MM-dd')} to ${format(dateRange.end, 'yyyy-MM-dd')}\n\n`;
  const summary = `Total Revenue: ${metrics.total.toFixed(2)}\nPaid: ${metrics.paid.toFixed(2)}\nPending: ${metrics.pending.toFixed(2)}\nRefunded: ${metrics.refunded.toFixed(2)}\n\n`;

  return title + summary + generateCSV(headers, rows);
};

/**
 * Export staff utilization to CSV
 */
export const exportStaffUtilizationToCSV = (utilization: StaffUtilization[]): string => {
  const headers = ['Staff Name', 'Booked Hours', 'Total Hours', 'Utilization Rate (%)', 'Appointments', 'Revenue'];
  const rows = utilization.map((staff) => [
    staff.staffName,
    staff.bookedHours.toFixed(2),
    staff.totalHours.toFixed(2),
    staff.utilizationRate.toFixed(2),
    staff.appointmentCount,
    staff.revenue.toFixed(2),
  ]);

  return generateCSV(headers, rows);
};

/**
 * Export customer metrics to CSV
 */
export const exportCustomersToCSV = (metrics: CustomerMetrics): string => {
  const headers = ['Customer Name', 'Appointments', 'Total Spent'];
  const rows = metrics.topCustomers.map((customer) => [
    customer.customerName,
    customer.appointmentCount,
    customer.totalSpent.toFixed(2),
  ]);

  const title = `Customer Metrics Report\n\n`;
  const summary = `Total Customers: ${metrics.total}\nNew Customers: ${metrics.new}\nReturning Customers: ${metrics.returning}\nRetention Rate: ${metrics.retentionRate.toFixed(2)}%\n\n`;

  return title + summary + generateCSV(headers, rows);
};

/**
 * Export service performance to CSV
 */
export const exportServicePerformanceToCSV = (performance: ServicePerformance[]): string => {
  const headers = ['Service Name', 'Appointments', 'Revenue', 'Average Price', 'Cancellation Rate (%)', 'Rank'];
  const rows = performance.map((service) => [
    service.serviceName,
    service.appointmentCount,
    service.revenue.toFixed(2),
    service.averagePrice.toFixed(2),
    service.cancellationRate.toFixed(2),
    service.popularityRank,
  ]);

  return generateCSV(headers, rows);
};

/**
 * Generate PDF report
 */
export const generatePDFReport = async (
  businessName: string,
  reportType: string,
  dateRange: { start: Date; end: Date },
  data: {
    bookings?: BookingMetrics;
    revenue?: RevenueMetrics;
    staff?: StaffUtilization[];
    customers?: CustomerMetrics;
    services?: ServicePerformance[];
  },
): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
      doc.on('error', reject);

      // Header
      doc.fontSize(20).text(`${businessName} - ${reportType} Report`, { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Period: ${format(dateRange.start, 'MMM dd, yyyy')} to ${format(dateRange.end, 'MMM dd, yyyy')}`, { align: 'center' });
      doc.moveDown(2);

      // Bookings section
      if (data.bookings) {
        doc.fontSize(16).text('Booking Metrics', { underline: true });
        doc.moveDown();
        doc.fontSize(11);
        doc.text(`Total Bookings: ${data.bookings.total}`);
        doc.text(`Confirmed: ${data.bookings.confirmed}`);
        doc.text(`Cancelled: ${data.bookings.cancelled}`);
        doc.text(`No Shows: ${data.bookings.noShow}`);
        doc.text(`Pending: ${data.bookings.pending}`);
        doc.moveDown(2);
      }

      // Revenue section
      if (data.revenue) {
        doc.fontSize(16).text('Revenue Metrics', { underline: true });
        doc.moveDown();
        doc.fontSize(11);
        doc.text(`Total Revenue: AED ${data.revenue.total.toFixed(2)}`);
        doc.text(`Paid: AED ${data.revenue.paid.toFixed(2)}`);
        doc.text(`Pending: AED ${data.revenue.pending.toFixed(2)}`);
        doc.text(`Refunded: AED ${data.revenue.refunded.toFixed(2)}`);
        doc.moveDown(2);
      }

      // Staff utilization section
      if (data.staff && data.staff.length > 0) {
        doc.fontSize(16).text('Staff Utilization', { underline: true });
        doc.moveDown();
        doc.fontSize(11);
        data.staff.forEach((staff) => {
          doc.text(`${staff.staffName}: ${staff.utilizationRate.toFixed(1)}% utilization (${staff.appointmentCount} appointments, AED ${staff.revenue.toFixed(2)})`);
        });
        doc.moveDown(2);
      }

      // Customer section
      if (data.customers) {
        doc.fontSize(16).text('Customer Metrics', { underline: true });
        doc.moveDown();
        doc.fontSize(11);
        doc.text(`Total Customers: ${data.customers.total}`);
        doc.text(`New Customers: ${data.customers.new}`);
        doc.text(`Returning Customers: ${data.customers.returning}`);
        doc.text(`Retention Rate: ${data.customers.retentionRate.toFixed(2)}%`);
        doc.moveDown(2);
      }

      // Service performance section
      if (data.services && data.services.length > 0) {
        doc.fontSize(16).text('Top Services', { underline: true });
        doc.moveDown();
        doc.fontSize(11);
        data.services.slice(0, 10).forEach((service) => {
          doc.text(`#${service.popularityRank} ${service.serviceName}: ${service.appointmentCount} bookings, AED ${service.revenue.toFixed(2)}`);
        });
      }

      // Footer
      doc.fontSize(10).text(`Generated on ${format(new Date(), 'MMM dd, yyyy HH:mm')}`, 50, doc.page.height - 50, { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

