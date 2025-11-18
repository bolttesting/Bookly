import { Router } from 'express';

import { prisma } from '../../config/prisma.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { requirePermission } from '../../middleware/requirePermission.js';

const auditRouter = Router();

auditRouter.get(
  '/',
  requirePermission(PERMISSIONS.VIEW_AUDIT_LOGS),
  async (req, res, next) => {
    try {
      if (!req.user?.businessId) {
        return res.status(400).json({ message: 'Missing business context' });
      }

      const logs = await prisma.auditLog.findMany({
        where: { businessId: req.user.businessId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      res.json({ logs });
    } catch (error) {
      next(error);
    }
  },
);

export { auditRouter };

