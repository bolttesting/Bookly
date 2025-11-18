import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../../config/prisma.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { requirePermission } from '../../middleware/requirePermission.js';

const availabilityRouter = Router();

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMinutes = (value: string) => {
  const [h, m] = value.split(':').map((part) => parseInt(part, 10));
  return h * 60 + m;
};

const baseBlockSchema = z.object({
  staffId: z.string().cuid(),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(timePattern, 'startTime must be HH:MM'),
  endTime: z.string().regex(timePattern, 'endTime must be HH:MM'),
  isOverride: z.boolean().default(false),
  date: z.string().datetime().optional(),
});

const availabilitySchema = baseBlockSchema.superRefine((data, ctx) => {
  if (toMinutes(data.endTime) <= toMinutes(data.startTime)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'endTime must be greater than startTime',
      path: ['endTime'],
    });
  }

  if (data.isOverride && !data.date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Overrides require an exact date.',
      path: ['date'],
    });
  }

  if (!data.isOverride && data.date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Weekly templates must omit date.',
      path: ['date'],
    });
  }
});

const availabilityUpdateSchema = baseBlockSchema
  .partial()
  .superRefine((data, ctx) => {
    if (data.startTime && data.endTime && toMinutes(data.endTime) <= toMinutes(data.startTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endTime must be greater than startTime',
        path: ['endTime'],
      });
    }

    if (data.isOverride !== undefined || data.date !== undefined) {
      const isOverride = data.isOverride ?? false;
      if (isOverride && !data.date) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Overrides require an exact date.',
          path: ['date'],
        });
      }
      if (!isOverride && data.date) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Weekly templates must omit date.',
          path: ['date'],
        });
      }
    }
  });

availabilityRouter.use(requirePermission(PERMISSIONS.MANAGE_STAFF));

availabilityRouter.get('/', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const { staffId } = req.query as { staffId?: string };

    const blocks = await prisma.availabilityBlock.findMany({
      where: {
        businessId: req.user.businessId,
        ...(staffId ? { staffId } : {}),
      },
      orderBy: [{ date: 'asc' }, { dayOfWeek: 'asc' }, { startTime: 'asc' }],
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json({ availability: blocks });
  } catch (error) {
    next(error);
  }
});

availabilityRouter.post('/', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const businessId = req.user.businessId;
    const payload = availabilitySchema.parse(req.body);

    const staff = await prisma.staffMember.findUnique({
      where: { id: payload.staffId },
      select: { businessId: true },
    });
    if (!staff || staff.businessId !== req.user.businessId) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    const block = await prisma.availabilityBlock.create({
      data: {
        businessId,
        staffId: payload.staffId,
        dayOfWeek: payload.dayOfWeek,
        startTime: payload.startTime,
        endTime: payload.endTime,
        isOverride: payload.isOverride,
        date: payload.date ? new Date(payload.date) : undefined,
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.status(201).json({ availability: block });
  } catch (error) {
    next(error);
  }
});

availabilityRouter.put('/:availabilityId', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const payload = availabilityUpdateSchema.parse(req.body);
    const { availabilityId } = req.params;

    const existing = await prisma.availabilityBlock.findUnique({
      where: { id: availabilityId },
    });
    if (!existing || existing.businessId !== req.user.businessId) {
      return res.status(404).json({ message: 'Availability block not found' });
    }

    if (payload.staffId) {
      const staff = await prisma.staffMember.findUnique({
        where: { id: payload.staffId },
        select: { businessId: true },
      });
      if (!staff || staff.businessId !== req.user.businessId) {
        return res.status(404).json({ message: 'Staff member not found' });
      }
    }

    const block = await prisma.availabilityBlock.update({
      where: { id: availabilityId },
      data: {
        staffId: payload.staffId ?? existing.staffId,
        dayOfWeek: payload.dayOfWeek ?? existing.dayOfWeek,
        startTime: payload.startTime ?? existing.startTime,
        endTime: payload.endTime ?? existing.endTime,
        isOverride: payload.isOverride ?? existing.isOverride,
        date:
          payload.date !== undefined
            ? payload.date
              ? new Date(payload.date)
              : null
            : existing.date,
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json({ availability: block });
  } catch (error) {
    next(error);
  }
});

availabilityRouter.delete('/:availabilityId', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const { availabilityId } = req.params;

    const existing = await prisma.availabilityBlock.findUnique({
      where: { id: availabilityId },
    });
    if (!existing || existing.businessId !== req.user.businessId) {
      return res.status(404).json({ message: 'Availability block not found' });
    }

    await prisma.availabilityBlock.delete({ where: { id: availabilityId } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export { availabilityRouter };

