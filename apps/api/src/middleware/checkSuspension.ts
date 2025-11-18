import type { NextFunction, Request, Response } from 'express';
import { isBusinessSuspended } from '../services/dunningService.js';
import { logger } from '../utils/logger.js';

/**
 * Middleware to check if business account is suspended
 * Blocks access to protected routes if account is suspended
 */
export const checkSuspension = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user?.businessId) {
    return next();
  }

  try {
    const suspended = await isBusinessSuspended(req.user.businessId);

    if (suspended) {
      // Allow access to billing page to update payment
      if (req.path.includes('/billing') || req.path.includes('/settings/billing')) {
        next();
        return;
      }

      res.status(403).json({
        error: 'Account suspended',
        message: 'Your account has been suspended due to payment issues. Please update your payment method to restore access.',
        suspended: true,
      });
      return;
    }

    next();
  } catch (error) {
    // If check fails, allow request to proceed (fail open)
    logger.error('Error checking suspension status', { error, businessId: req.user.businessId });
    return next();
  }
};

