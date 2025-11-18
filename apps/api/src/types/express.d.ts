import type { Permission } from '../constants/permissions.js';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        businessId?: string;
        role: string;
        impersonated?: boolean;
        permissions: Permission[];
      };
      requestId?: string;
    }
  }
}

export {};

