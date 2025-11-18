import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { prisma } from '../../config/prisma.js';
import { ROLE_PERMISSION_MAP } from '../../constants/permissions.js';
import { AUDIT_ACTIONS } from '../../constants/enums.js';
import { authenticate } from '../../middleware/authenticate.js';
import { recordAuditFromRequest, recordAuditLog } from '../../middleware/auditLogger.js';
import { createSession } from '../../services/sessionService.js';
import { syncIndustryFeatureFlags, featureFlagMap } from '../../services/featureService.js';
import { startTestDrive } from '../../services/testDriveService.js';
import { sendPasswordResetEmail, sendEmailVerification, sendWelcomeEmail } from '../../services/notificationService.js';
import { clearRefreshCookie, setRefreshCookie } from '../../utils/cookies.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { createAccessToken, verifyRefreshToken } from '../../utils/tokens.js';
import { env } from '../../config/env.js';
import crypto from 'crypto';

const authRouter = Router();

const buildFeatureFlagPayload = async (businessId?: string | null) => {
  if (!businessId) return {};
  return featureFlagMap(businessId);
};

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  businessName: z.string().min(2),
  industry: z.string().optional(),
  timezone: z.string().default('Asia/Dubai'),
  currency: z.string().default('AED'),
  testDrive: z.boolean().default(false),
});

authRouter.post('/register', async (req, res, next) => {
  try {
    const payload = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: payload.email } });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const passwordHash = await hashPassword(payload.password);

    // Generate email verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationTokenExpiresAt = new Date();
    emailVerificationTokenExpiresAt.setHours(emailVerificationTokenExpiresAt.getHours() + 24); // 24 hours

    // Use raw SQL to create user with verification token (bypasses Prisma type checking)
    const result = await prisma.$transaction(async (tx: any) => {
      // Create user using raw SQL
      const userResult = await tx.$executeRawUnsafe(
        `INSERT INTO "User" (id, email, "passwordHash", "firstName", "lastName", role, "emailVerificationToken", "emailVerificationTokenExpiresAt", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 'OWNER'::"UserRole", $5, $6, NOW(), NOW())
         RETURNING id, email, "firstName", "lastName", role`,
        payload.email,
        passwordHash,
        payload.firstName,
        payload.lastName,
        emailVerificationToken,
        emailVerificationTokenExpiresAt,
      );

      // Get the created user
      const users = await tx.$queryRawUnsafe(
        `SELECT id, email, "firstName", "lastName", role FROM "User" WHERE email = $1`,
        payload.email,
      ) as Array<{
        id: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
        role: string;
      }>;

      const user = users[0];

      const business = await tx.business.create({
        data: {
          name: payload.businessName,
          industry: payload.industry,
          timezone: payload.timezone,
          currency: payload.currency,
          ownerId: user.id,
          onboardingState: 'IN_PROGRESS',
          onboardingContext: {
            step: 1,
          },
        },
      });

      await tx.staffMember.create({
        data: {
          businessId: business.id,
          userId: user.id,
          name: `${payload.firstName} ${payload.lastName}`,
          role: 'OWNER',
          permissions: ROLE_PERMISSION_MAP.owner,
          email: payload.email,
        },
      });

      return { 
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role as any,
        }, 
        business 
      };
    });

    await syncIndustryFeatureFlags({
      businessId: result.business.id,
      industry: payload.industry,
    });

    const { refreshToken, sessionId } = await createSession(result.user.id, req);
    const accessToken = createAccessToken({
      sub: result.user.id,
      businessId: result.business.id,
      role: 'owner',
    });

    if (payload.testDrive) {
      await startTestDrive(result.business.id);
    }

    await recordAuditLog({
      action: AUDIT_ACTIONS.USER_CREATED,
      userId: result.user.id,
      businessId: result.business.id,
      metadata: {
        email: result.user.email,
        businessName: result.business.name,
      },
    });

    await recordAuditLog({
      action: AUDIT_ACTIONS.AUTH_LOGIN,
      userId: result.user.id,
      businessId: result.business.id,
      metadata: { method: 'register', sessionId },
    });

    const featureFlags = await buildFeatureFlagPayload(result.business.id);

    // Send welcome email and email verification
    const dashboardLink = `${env.APP_BASE_URLS[0] || env.APP_BASE_URL}/dashboard`;
    const verificationLink = `${env.APP_BASE_URLS[0] || env.APP_BASE_URL}/verify-email?token=${emailVerificationToken}`;

    try {
      // Send welcome email
      await sendWelcomeEmail(
        payload.email,
        result.user.firstName,
        result.business.name,
        dashboardLink,
      );
      console.log('✅ Welcome email sent to:', payload.email);
    } catch (error) {
      console.error('❌ Failed to send welcome email:', error);
      // Don't fail registration if email fails
    }

    try {
      // Send email verification
      await sendEmailVerification(payload.email, verificationLink);
      console.log('✅ Verification email sent to:', payload.email);
    } catch (error) {
      console.error('❌ Failed to send verification email:', error);
      // Don't fail registration if email fails
    }

    setRefreshCookie(res, refreshToken);

    res.status(201).json({
      accessToken,
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
      },
      business: result.business,
      featureFlags,
    });
  } catch (error) {
    next(error);
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const payload = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: payload.email },
      include: { businesses: { take: 1 } },
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const valid = await verifyPassword(user.passwordHash, payload.password);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check email verification (allow super admins to bypass)
    const emailVerified = (user as any).emailVerified ?? false;
    if (!emailVerified && user.role !== 'SUPERADMIN') {
      return res.status(403).json({
        message: 'Please verify your email address before logging in. Check your inbox for the verification link.',
        requiresVerification: true,
        email: user.email,
      });
    }

    const business = user.businesses[0];

    const { refreshToken, sessionId } = await createSession(user.id, req);
    const accessToken = createAccessToken({
      sub: user.id,
      businessId: business?.id,
      role: user.role.toLowerCase(),
    });

    await recordAuditLog({
      action: AUDIT_ACTIONS.AUTH_LOGIN,
      userId: user.id,
      businessId: business?.id,
      metadata: {
        sessionId: sessionId ?? undefined,
        userAgent: req.headers['user-agent'],
      },
    });

    const featureFlags = await buildFeatureFlagPayload(business?.id);

    setRefreshCookie(res, refreshToken);

    res.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      business,
      featureFlags,
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/logout', authenticate(), async (req, res, next) => {
  try {
    const refresh = req.cookies.refreshToken;
    let sessionId: string | undefined;
    if (refresh) {
      try {
        const decoded = verifyRefreshToken(refresh);
        sessionId = decoded.sessionId;
        await prisma.session.delete({ where: { id: decoded.sessionId } });
      } catch (err) {
        console.warn('Failed to revoke session', err);
      }
    }
    clearRefreshCookie(res);

    await recordAuditFromRequest(req, AUDIT_ACTIONS.AUTH_LOGOUT, {
      sessionId,
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

authRouter.post('/refresh-token', async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) {
      return res.status(401).json({ message: 'Missing refresh token' });
    }

    const decoded = verifyRefreshToken(token);
    const session = await prisma.session.findUnique({ where: { id: decoded.sessionId } });
    if (!session) {
      return res.status(401).json({ message: 'Session expired' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      include: { businesses: { take: 1 } },
    });

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const business = user.businesses[0];

    const accessToken = createAccessToken({
      sub: user.id,
      businessId: business?.id,
      role: user.role.toLowerCase(),
    });

    res.json({ accessToken });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }
    next(error);
  }
});

authRouter.get('/me', authenticate({ optional: false }), async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const authUser = req.user;

    const userRecord = await prisma.user.findUnique({
      where: { id: authUser.id },
      include: { businesses: true },
    });

    // For super admins, business is null/undefined
    const isSuperAdmin = userRecord?.role === 'SUPERADMIN';
    const business =
      !isSuperAdmin && authUser.businessId && userRecord
        ? userRecord.businesses.find(
            (biz: (typeof userRecord.businesses)[number]) => biz.id === authUser.businessId,
          ) ?? userRecord.businesses[0]
        : !isSuperAdmin
          ? userRecord?.businesses[0]
          : null;

    const featureFlags = await buildFeatureFlagPayload(business?.id);
    const impersonated = Boolean(authUser.impersonated);

    res.json({
      user: {
        id: userRecord?.id,
        email: userRecord?.email,
        firstName: userRecord?.firstName,
        lastName: userRecord?.lastName,
        role: impersonated ? 'SUPERADMIN' : userRecord?.role,
        emailVerified: (userRecord as any)?.emailVerified ?? false,
      },
      business: business || null, // Explicitly set to null for super admins
      impersonated,
      featureFlags,
    });
  } catch (error) {
    next(error);
  }
});

// Request password reset
authRouter.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    
    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ message: 'If that email exists, we sent a password reset link.' });
    }

    // Generate reset token
    const passwordResetToken = crypto.randomBytes(32).toString('hex');
    const passwordResetTokenExpiresAt = new Date();
    passwordResetTokenExpiresAt.setHours(passwordResetTokenExpiresAt.getHours() + 1); // 1 hour

    // Use raw SQL to update password reset token (bypasses Prisma type checking)
    await prisma.$executeRawUnsafe(
      `UPDATE "User" SET "passwordResetToken" = $1, "passwordResetTokenExpiresAt" = $2 WHERE id = $3`,
      passwordResetToken,
      passwordResetTokenExpiresAt,
      user.id,
    );

    // Send reset email
    try {
      const resetLink = `${env.APP_BASE_URL}/reset-password?token=${passwordResetToken}`;
      await sendPasswordResetEmail(email, resetLink);
      console.log('✅ Password reset email sent to:', email);
    } catch (error: any) {
      console.error('❌ Failed to send password reset email:', error);
      // Still return success to prevent email enumeration, but log the error
      // The token is still saved, so the user can try again or contact support
      return res.status(500).json({ 
        message: 'Failed to send reset email. Please check your email configuration or contact support.' 
      });
    }

    res.json({ message: 'If that email exists, we sent a password reset link.' });
  } catch (error) {
    next(error);
  }
});

// Reset password with token
authRouter.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = z
      .object({
        token: z.string().min(1),
        password: z.string().min(8),
      })
      .parse(req.body);

    // Use raw SQL to find user by reset token
    const users = (await prisma.$queryRawUnsafe(
      `SELECT id, "passwordResetTokenExpiresAt" FROM "User" WHERE "passwordResetToken" = $1`,
      token,
    )) as Array<{ id: string; passwordResetTokenExpiresAt: Date | null }>;

    const user = users[0];

    if (!user) {
      console.error('❌ Password reset token not found:', token.substring(0, 8) + '...');
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    if (!user.passwordResetTokenExpiresAt) {
      console.error('❌ Password reset token has no expiration date for user:', user.id);
      return res.status(400).json({ message: 'Invalid reset token' });
    }

    if (user.passwordResetTokenExpiresAt < new Date()) {
      console.error('❌ Password reset token expired for user:', user.id);
      return res.status(400).json({ message: 'Reset token has expired. Please request a new one.' });
    }

    const passwordHash = await hashPassword(password);

    // Use raw SQL to update password and clear reset token
    await prisma.$executeRawUnsafe(
      `UPDATE "User" SET "passwordHash" = $1, "passwordResetToken" = NULL, "passwordResetTokenExpiresAt" = NULL WHERE id = $2`,
      passwordHash,
      user.id,
    );

    await recordAuditLog({
      action: AUDIT_ACTIONS.AUTH_LOGIN,
      userId: user.id,
      metadata: { method: 'password_reset' },
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    next(error);
  }
});

// Verify email
authRouter.get('/verify-email', async (req, res, next) => {
  try {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.query);

    // Use raw SQL to find user by verification token
    const users = (await prisma.$queryRawUnsafe(
      `SELECT id, "emailVerificationTokenExpiresAt" FROM "User" WHERE "emailVerificationToken" = $1`,
      token,
    )) as Array<{ id: string; emailVerificationTokenExpiresAt: Date | null }>;

    const user = users[0];

    if (!user || !user.emailVerificationTokenExpiresAt || user.emailVerificationTokenExpiresAt < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired verification token' });
    }

    // Use raw SQL to update email verification status
    await prisma.$executeRawUnsafe(
      `UPDATE "User" SET "emailVerified" = true, "emailVerificationToken" = NULL, "emailVerificationTokenExpiresAt" = NULL WHERE id = $1`,
      user.id,
    );

    // Redirect to login page with success message
    const frontendUrl = env.APP_BASE_URL;
    res.redirect(`${frontendUrl}/login?verified=true`);
  } catch (error) {
    next(error);
  }
});

// Resend verification email
authRouter.post('/resend-verification', authenticate(), async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if ((user as any).emailVerified) {
      return res.json({ message: 'Email already verified' });
    }

    // Generate new verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationTokenExpiresAt = new Date();
    emailVerificationTokenExpiresAt.setHours(emailVerificationTokenExpiresAt.getHours() + 24);

    // Use raw SQL to update email verification token
    await prisma.$executeRawUnsafe(
      `UPDATE "User" SET "emailVerificationToken" = $1, "emailVerificationTokenExpiresAt" = $2 WHERE id = $3`,
      emailVerificationToken,
      emailVerificationTokenExpiresAt,
      user.id,
    );

    // Send verification email
    try {
      const verificationLink = `${env.APP_BASE_URL}/verify-email?token=${emailVerificationToken}`;
      await sendEmailVerification(user.email, verificationLink);
    } catch (error) {
      console.error('Failed to send verification email:', error);
      return res.status(500).json({ message: 'Failed to send verification email' });
    }

    res.json({ message: 'Verification email sent' });
  } catch (error) {
    next(error);
  }
});

export { authRouter };

