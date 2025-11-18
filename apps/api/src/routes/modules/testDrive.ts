import { Router } from 'express';
import { z } from 'zod';

import { PERMISSIONS } from '../../constants/permissions.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import {
  completeTestDrive,
  expireTestDriveIfNeeded,
  getTestDriveStatus,
  startTestDrive,
} from '../../services/testDriveService.js';

const testDriveRouter = Router();

testDriveRouter.use(requirePermission(PERMISSIONS.MANAGE_BUSINESS));

testDriveRouter.get('/', async (req, res, next) => {
  try {
    const businessId = req.user?.businessId;

    if (!businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    // Check expiration first
    await expireTestDriveIfNeeded(businessId);
    const snapshot = await getTestDriveStatus(businessId);

    res.json({ testDrive: snapshot });
  } catch (error) {
    next(error);
  }
});

const requestSchema = z.object({
  action: z.enum(['START', 'COMPLETE']),
  feedback: z.string().max(2000).optional(),
});

testDriveRouter.post('/', async (req, res, next) => {
  try {
    const businessId = req.user?.businessId;

    if (!businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const payload = requestSchema.parse(req.body);

    if (payload.action === 'START') {
      const business = await startTestDrive(businessId);
      const snapshot = await getTestDriveStatus(businessId);
      return res.json({ testDrive: snapshot });
    }

    // If completing, optionally save feedback
    if (payload.feedback) {
      const db = prisma as any;
      await db.testDriveFeedback.create({
        data: {
          businessId,
          feedback: payload.feedback,
          status: 'COMPLETED',
        },
      });
    }

    const business = await completeTestDrive(businessId);
    const snapshot = await getTestDriveStatus(businessId);
    return res.json({ testDrive: snapshot });
  } catch (error) {
    next(error);
  }
});

export { testDriveRouter };

