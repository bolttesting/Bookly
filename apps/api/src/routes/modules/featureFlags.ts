import { Router } from 'express';
import { z } from 'zod';

import { PERMISSIONS } from '../../constants/permissions.js';
import { FEATURE_FLAG_ENUM } from '../../constants/featureFlags.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { listFeatureFlags, updateFeatureFlags } from '../../services/featureService.js';

const featureFlagsRouter = Router();

featureFlagsRouter.use(requirePermission(PERMISSIONS.MANAGE_BUSINESS));

featureFlagsRouter.get('/', async (req, res, next) => {
  try {
    const businessId = req.user?.businessId;

    if (!businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const flags = await listFeatureFlags(businessId);
    res.json({ flags });
  } catch (error) {
    next(error);
  }
});

const updateSchema = z.object({
  flags: z.array(
    z.object({
      key: z.nativeEnum(FEATURE_FLAG_ENUM),
      enabled: z.boolean(),
    }),
  ),
});

featureFlagsRouter.put('/', async (req, res, next) => {
  try {
    const businessId = req.user?.businessId;

    if (!businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const payload = updateSchema.parse(req.body);

    const flags = await updateFeatureFlags(businessId, payload.flags);
    res.json({ flags });
  } catch (error) {
    next(error);
  }
});

export { featureFlagsRouter };

