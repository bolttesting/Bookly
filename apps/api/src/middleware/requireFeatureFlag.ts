import type { Request, Response, NextFunction } from 'express';

import type { FeatureFlagKey } from '../constants/featureFlags.js';
import { hasFeatureFlag } from '../services/featureService.js';

export const requireFeatureFlag =
  (flag: FeatureFlagKey) => async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.businessId) {
        return res.status(403).json({
          message: 'Feature unavailable without business context',
          feature: flag,
        });
      }

      const enabled = await hasFeatureFlag(req.user.businessId, flag);

      if (!enabled) {
        return res.status(403).json({
          message: 'This feature is not enabled for your plan or industry.',
          feature: flag,
        });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };

