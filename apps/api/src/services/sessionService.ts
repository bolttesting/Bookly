import { randomBytes } from 'node:crypto';

import type { Request } from 'express';

import { prisma } from '../config/prisma.js';
import { hashPassword } from '../utils/password.js';
import { createRefreshToken } from '../utils/tokens.js';

export const createSession = async (userId: string, req: Request) => {
  const sessionId = randomBytes(16).toString('hex');
  const refreshToken = createRefreshToken({ sub: userId, sessionId });
  const refreshTokenHash = await hashPassword(refreshToken);

  await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      refreshTokenHash,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    },
  });

  return { refreshToken, sessionId };
};

export const revokeSession = async (sessionId: string) => {
  await prisma.session.delete({ where: { id: sessionId } });
};

export const revokeUserSessions = async (userId: string) => {
  await prisma.session.deleteMany({ where: { userId } });
};

