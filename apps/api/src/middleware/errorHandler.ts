import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Sentry } from '../config/sentry.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  void _next;
  
  if (err instanceof ZodError) {
    logger.warn('Validation error', { path: req.path, issues: err.flatten() });
    return res.status(400).json({ message: 'Validation error', issues: err.flatten() });
  }

  if (err instanceof Error) {
    logger.error('Request error', err, {
      method: req.method,
      path: req.path,
      userId: (req as any).user?.id,
      businessId: (req as any).user?.businessId,
    });

    // Capture in Sentry with context
    if (env.SENTRY_DSN) {
      Sentry.withScope((scope) => {
        scope.setTag('path', req.path);
        scope.setTag('method', req.method);
        scope.setContext('user', {
          id: (req as any).user?.id,
          businessId: (req as any).user?.businessId,
          role: (req as any).user?.role,
        });
        scope.setContext('request', {
          url: req.url,
          headers: {
            'user-agent': req.get('user-agent'),
            'referer': req.get('referer'),
          },
        });
        Sentry.captureException(err);
      });
    }
    
    const status = (err as any).status || (err as any).statusCode || 500;
    return res.status(status).json({
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  }

  logger.error('Unexpected error', undefined, { path: req.path });
  return res.status(500).json({ message: 'Unexpected error' });
};

