import type { Request } from 'express';

import { prisma } from '../config/prisma.js';
import type { AuditActionValue } from '../constants/enums.js';

type AuditMetadata = any;

type AuditLogInput = {
  action: AuditActionValue;
  userId?: string;
  businessId?: string;
  metadata?: AuditMetadata;
};

export const recordAuditLog = async ({
  action,
  userId,
  businessId,
  metadata,
}: AuditLogInput) => {
  await prisma.auditLog.create({
    data: {
      action,
      userId,
      businessId,
      metadata,
    },
  });
};

export const recordAuditFromRequest = async (req: Request, action: AuditActionValue, metadata?: Record<string, unknown>) => {
  await recordAuditLog({
    action,
    userId: req.user?.id,
    businessId: req.user?.businessId,
    metadata: metadata as AuditMetadata | undefined,
  });
};

