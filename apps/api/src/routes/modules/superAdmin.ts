import { Router } from 'express';

import { prisma } from '../../config/prisma.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { createAccessToken } from '../../utils/tokens.js';
import { getAllTenantHealthMetrics, getPlatformSummary } from '../../services/tenantAnalyticsService.js';

const superAdminRouter = Router();

superAdminRouter.use(requirePermission(PERMISSIONS.MANAGE_TENANTS));

superAdminRouter.get('/businesses', async (_req, res, next) => {
  try {
    const db = prisma as any;
    const businesses = await db.business.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        industry: true,
        timezone: true,
        currency: true,
        onboardingState: true,
        paymentConnectionStatus: true,
        stripeChargesEnabled: true,
        testDriveStatus: true,
        testDriveEndsAt: true,
        createdAt: true,
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: {
            customers: true,
            appointments: true,
            staffMembers: true,
          },
        },
      },
    });

    res.json({ businesses });
  } catch (error) {
    next(error);
  }
});

superAdminRouter.post('/businesses/:businessId/impersonate', requirePermission(PERMISSIONS.IMPERSONATE_TENANT), async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    });

    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    const accessToken = createAccessToken({
      sub: req.user!.id,
      businessId: business.id,
      role: 'impersonation',
      impersonated: true,
    });

    res.json({ accessToken });
  } catch (error) {
    next(error);
  }
});

// Get tenant health metrics
superAdminRouter.get('/analytics/tenants', async (_req, res, next) => {
  try {
    const metrics = await getAllTenantHealthMetrics();
    res.json({ tenants: metrics });
  } catch (error) {
    next(error);
  }
});

// Get platform-wide summary
superAdminRouter.get('/analytics/summary', async (_req, res, next) => {
  try {
    const summary = await getPlatformSummary();
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

export { superAdminRouter };

