import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';

type AccessPayload = {
  sub: string;
  businessId?: string;
  role: string;
  impersonated?: boolean;
};

type RefreshPayload = {
  sub: string;
  sessionId: string;
};

export const createAccessToken = (payload: AccessPayload) => {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
  });
};

export const createRefreshToken = (payload: RefreshPayload) => {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: '7d',
  });
};

export const verifyAccessToken = (token: string) => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload & jwt.JwtPayload;
};

export const verifyRefreshToken = (token: string) => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshPayload & jwt.JwtPayload;
};

