import type { NextFunction, Request, Response } from 'express';

import type { Permission } from '../constants/permissions.js';

export const requirePermission =
  (required: Permission | Permission[]) => (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const requiredList = Array.isArray(required) ? required : [required];

    const hasPermission = requiredList.every((perm) => req.user?.permissions.includes(perm));

    if (!hasPermission) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    return next();
  };

