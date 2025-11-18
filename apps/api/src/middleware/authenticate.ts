import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import { ROLE_PERMISSION_MAP } from '../constants/permissions.js';

export const authenticate =
  (options: { optional?: boolean } = {}) =>
  (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

    if (!token) {
      if (options.optional) {
        return next();
      }
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as {
        sub: string;
        businessId?: string;
        role: string;
        impersonated?: boolean;
      };

      req.user = {
        id: decoded.sub,
        businessId: decoded.businessId,
        role: decoded.role,
        impersonated: decoded.impersonated ?? false,
        permissions: ROLE_PERMISSION_MAP[decoded.role] ?? [],
      };

      return next();
    } catch (error) {
      if (options.optional) {
        return next();
      }
      return res.status(401).json({ message: 'Invalid token' });
    }
  };

