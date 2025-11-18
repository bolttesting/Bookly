import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../../config/prisma.js';
import { syncIndustryFeatureFlags } from '../../services/featureService.js';

const onboardingRouter = Router();

onboardingRouter.get('/state', async (req, res, next) => {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) {
      return res.status(404).json({ message: 'Business not found' });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
    });

    res.json({
      onboardingState: business?.onboardingState,
      onboardingContext: business?.onboardingContext,
    });
  } catch (error) {
    next(error);
  }
});

const stepSchema = z.object({
  step: z.number().min(1).max(3),
  data: z.record(z.any()).optional(),
  complete: z.boolean().optional(),
});

const stepOneSchema = z.object({
  businessName: z.string().min(1).optional(),
  industry: z.string().optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
});

const stepTwoSchema = z.object({
  serviceName: z.string().min(1).optional(),
  duration: z.number().int().min(5).max(480).optional(),
  price: z.number().nonnegative().optional(),
});

const stepThreeSchema = z.object({
  staffName: z.string().min(1).optional(),
  staffEmail: z.string().email().optional(),
});

onboardingRouter.post('/step', async (req, res, next) => {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) {
      return res.status(404).json({ message: 'Business not found' });
    }

    const payload = stepSchema.parse(req.body);

    const business = await prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    const nextContext =
      typeof business.onboardingContext === 'object' && business.onboardingContext !== null
        ? { ...business.onboardingContext }
        : {};

    nextContext[`step${payload.step}`] = payload.data;
    nextContext.step = payload.step;

    const updates: Prisma.BusinessUpdateInput = {
      onboardingState: payload.complete ? 'COMPLETED' : 'IN_PROGRESS',
      onboardingContext: nextContext,
    };

    if (payload.step === 1 && payload.data) {
      const data = stepOneSchema.parse(payload.data);

      if (data.businessName) {
        updates.name = data.businessName;
      }
      if (data.industry) {
        updates.industry = data.industry;
        nextContext.industry = data.industry;
      }
      if (data.timezone) {
        updates.timezone = data.timezone;
      }
      if (data.currency) {
        updates.currency = data.currency;
      }
    }

    const updatedBusiness = await prisma.business.update({
      where: { id: businessId },
      data: updates,
    });

    if (payload.step === 1) {
      await syncIndustryFeatureFlags({
        businessId,
        industry: updatedBusiness.industry ?? nextContext.industry,
      });
    }

    if (payload.step === 2 && payload.data) {
      const data = stepTwoSchema.safeParse(payload.data);
      if (data.success && data.data.serviceName) {
        const existingService = await prisma.service.findFirst({
          where: {
            businessId,
            name: data.data.serviceName,
          },
        });

        if (!existingService) {
          await prisma.service.create({
            data: {
              businessId,
              name: data.data.serviceName,
              durationMinutes: data.data.duration ?? 60,
              price: new Prisma.Decimal(data.data.price ?? 250),
              bufferBeforeMinutes: 0,
              bufferAfterMinutes: 0,
              isActive: true,
              capacityType: 'SINGLE',
              maxClientsPerSlot: 1,
              allowAnyStaff: true,
            },
          });
        }
      }
    }

    if (payload.step === 3 && payload.data) {
      const data = stepThreeSchema.safeParse(payload.data);
      if (data.success && data.data.staffName) {
        const existingStaff = await prisma.staffMember.findFirst({
          where: {
            businessId,
            name: data.data.staffName,
          },
        });

        if (!existingStaff) {
          await prisma.staffMember.create({
            data: {
              businessId,
              name: data.data.staffName,
              email: data.data.staffEmail,
              role: 'OWNER',
              permissions: [],
              isActive: true,
            },
          });
        }
      }
    }

    res.json({ business: updatedBusiness });
  } catch (error) {
    next(error);
  }
});

export { onboardingRouter };

