import { Router } from 'express';

import { authenticate } from '../middleware/authenticate.js';

import { auditRouter } from './modules/auditLogs.js';
import { appointmentsRouter } from './modules/appointments.js';
import { authRouter } from './modules/auth.js';
import { bookingPagesRouter } from './modules/bookingPages.js';
import { classesRouter } from './modules/classes.js';
import { resourcesRouter } from './modules/resources.js';
import { packagesRouter } from './modules/packages.js';
import { waitlistRouter } from './modules/waitlist.js';
import { customersRouter } from './modules/customers.js';
import { onboardingRouter } from './modules/onboarding.js';
import { publicBookingRouter } from './modules/publicBooking.js';
import { servicesRouter } from './modules/services.js';
import { sessionsRouter } from './modules/sessions.js';
import { staffRouter } from './modules/staff.js';
import { portalRouter } from './modules/clientPortal.js';
import { availabilityRouter } from './modules/availability.js';
import { paymentsRouter } from './modules/payments.js';
import { superAdminRouter } from './modules/superAdmin.js';
import { featureFlagsRouter } from './modules/featureFlags.js';
import { marketingRouter } from './modules/marketing.js';
import { testDriveRouter } from './modules/testDrive.js';
import { testNotificationsRouter } from './modules/testNotifications.js';
import { notificationsRouter } from './modules/notifications.js';
import { calendarsRouter } from './modules/calendars.js';
import { analyticsRouter } from './modules/analytics.js';
import { metricsRouter } from './modules/metrics.js';
import { embedTrackingRouter } from './modules/embedTracking.js';
import { billingRouter } from './modules/billing.js';
import { webhooksRouter } from './modules/webhooks.js';
import { getHealthStatus, getReadinessStatus, getLivenessStatus } from '../services/healthService.js';
import { requireFeatureFlag } from '../middleware/requireFeatureFlag.js';
import { checkSuspension } from '../middleware/checkSuspension.js';
import { FEATURE_FLAG_ENUM } from '../constants/featureFlags.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/onboarding', authenticate(), checkSuspension, onboardingRouter);
router.use('/audit-logs', authenticate(), checkSuspension, auditRouter);
router.use('/sessions', authenticate(), checkSuspension, sessionsRouter);
router.use('/services', authenticate(), checkSuspension, servicesRouter);
router.use('/staff', authenticate(), checkSuspension, staffRouter);
router.use('/availability', authenticate(), checkSuspension, availabilityRouter);
router.use('/customers', authenticate(), checkSuspension, customersRouter);
router.use('/booking-pages', authenticate(), checkSuspension, bookingPagesRouter);
router.use('/appointments', authenticate(), checkSuspension, appointmentsRouter);
router.use(
  '/classes',
  authenticate(),
  checkSuspension,
  requireFeatureFlag(FEATURE_FLAG_ENUM.PILATES_TOOLKIT),
  classesRouter,
);
router.use(
  '/resources',
  authenticate(),
  checkSuspension,
  requireFeatureFlag(FEATURE_FLAG_ENUM.PILATES_TOOLKIT),
  resourcesRouter,
);
router.use('/packages', authenticate(), checkSuspension, packagesRouter);
router.use('/payments', authenticate(), paymentsRouter);
router.use('/billing', authenticate(), billingRouter); // Billing accessible even when suspended
router.use('/feature-flags', authenticate(), checkSuspension, featureFlagsRouter);
router.use(
  '/marketing',
  authenticate(),
  checkSuspension,
  requireFeatureFlag(FEATURE_FLAG_ENUM.MARKETING_AUTOMATION),
  marketingRouter,
);
router.use('/test-drive', authenticate(), checkSuspension, testDriveRouter);
router.use('/test', authenticate(), checkSuspension, testNotificationsRouter);
router.use('/notifications', authenticate(), checkSuspension, notificationsRouter);
router.use('/calendars', authenticate(), checkSuspension, calendarsRouter);
router.use('/analytics', analyticsRouter);
router.use('/metrics', metricsRouter);
router.use(
  '/embed-tracking',
  authenticate(),
  requireFeatureFlag(FEATURE_FLAG_ENUM.EMBED_WIDGETS),
  embedTrackingRouter,
);
router.use('/public/booking', publicBookingRouter);
router.use('/waitlist', authenticate(), waitlistRouter);
router.use('/client-portal', portalRouter);
router.use('/super-admin', authenticate(), superAdminRouter);
router.use('/webhooks', webhooksRouter);

router.get('/health', async (_req, res, next) => {
  try {
    const health = await getHealthStatus();
    const statusCode = health.status === 'unhealthy' ? 503 : health.status === 'degraded' ? 200 : 200;
    res.status(statusCode).json(health);
  } catch (error) {
    next(error);
  }
});

router.get('/health/ready', async (_req, res, next) => {
  try {
    const readiness = await getReadinessStatus();
    res.status(readiness.ready ? 200 : 503).json(readiness);
  } catch (error) {
    next(error);
  }
});

router.get('/health/live', (_req, res) => {
  const liveness = getLivenessStatus();
  res.status(liveness.alive ? 200 : 503).json(liveness);
});

export { router };

