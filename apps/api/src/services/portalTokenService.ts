import { randomBytes, createHash } from 'node:crypto';

import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';

type IssuePortalTokenOptions = {
  businessId: string;
  customerId: string;
  userAgent?: string | string[];
};

export const issuePortalToken = async ({ businessId, customerId, userAgent }: IssuePortalTokenOptions) => {
  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  await prisma.customerPortalToken.create({
    data: {
      businessId,
      customerId,
      tokenHash,
      expiresAt,
      userAgent: Array.isArray(userAgent) ? userAgent.join(', ') : userAgent,
    },
  });

  const portalBaseUrl = (env.CLIENT_PORTAL_URL ?? env.APP_BASE_URL).replace(/\/$/, '');
  const portalUrl = `${portalBaseUrl}/portal/verify?token=${rawToken}`;

  return {
    token: rawToken,
    expiresAt,
    portalUrl,
  };
};

