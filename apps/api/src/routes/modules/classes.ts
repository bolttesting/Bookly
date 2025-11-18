import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../../config/prisma.js';
import { CLASS_TYPE_VALUES } from '../../constants/enums.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { generateOccurrencesFromTemplate } from '../../services/classScheduler.js';

const classesRouter = Router();
const db = prisma as any;

const templateSchema = z.object({
  name: z.string().min(1),
  type: z.enum(CLASS_TYPE_VALUES),
  durationMinutes: z.number().min(15).max(360),
  defaultCapacity: z.number().min(1).max(30),
  description: z.string().optional(),
  color: z.string().optional(),
  defaultInstructorId: z.string().cuid().optional(),
  settings: z.record(z.any()).optional(),
});

const seriesSchema = z.object({
  recurrenceRule: z.string().min(5),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  timezone: z.string().optional(),
});

const createOccurrenceSchema = z.object({
  templateId: z.string().cuid(),
  startTime: z.string().datetime(),
  instructorId: z.string().cuid().optional(),
  capacity: z.number().int().min(1).optional(),
});

classesRouter.use(requirePermission([PERMISSIONS.MANAGE_SERVICES, PERMISSIONS.MANAGE_STAFF]));

classesRouter.get('/templates', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const templates = await db.classTemplate.findMany({
      where: { businessId: req.user.businessId },
      include: {
        defaultInstructor: {
          select: { id: true, name: true },
        },
        series: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ templates });
  } catch (error) {
    next(error);
  }
});

classesRouter.post('/templates', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const payload = templateSchema.parse(req.body);

    const template = await db.classTemplate.create({
      data: {
        businessId: req.user.businessId,
        name: payload.name,
        type: payload.type,
        durationMinutes: payload.durationMinutes,
        defaultCapacity: payload.defaultCapacity,
        description: payload.description,
        color: payload.color,
        defaultInstructorId: payload.defaultInstructorId,
        settings: payload.settings,
      },
      include: {
        defaultInstructor: {
          select: { id: true, name: true },
        },
      },
    });

    res.status(201).json({ template });
  } catch (error) {
    next(error);
  }
});

classesRouter.put('/templates/:templateId', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const payload = templateSchema.partial().parse(req.body);
    const { templateId } = req.params;

    const existing = await db.classTemplate.findUnique({ where: { id: templateId } });
    if (!existing || existing.businessId !== req.user.businessId) {
      return res.status(404).json({ message: 'Class template not found' });
    }

    const template = await db.classTemplate.update({
      where: { id: templateId },
      data: payload,
      include: {
        defaultInstructor: {
          select: { id: true, name: true },
        },
      },
    });

    res.json({ template });
  } catch (error) {
    next(error);
  }
});

classesRouter.delete('/templates/:templateId', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const { templateId } = req.params;

    const existing = await db.classTemplate.findUnique({ where: { id: templateId } });
    if (!existing || existing.businessId !== req.user.businessId) {
      return res.status(404).json({ message: 'Class template not found' });
    }

    await db.classTemplate.delete({ where: { id: templateId } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

classesRouter.post('/templates/:templateId/series', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const payload = seriesSchema.parse(req.body);
    const { templateId } = req.params;

    const template = await db.classTemplate.findUnique({ where: { id: templateId } });
    if (!template || template.businessId !== req.user.businessId) {
      return res.status(404).json({ message: 'Class template not found' });
    }

    const series = await db.classSeries.create({
      data: {
        templateId,
        businessId: req.user.businessId,
        recurrenceRule: payload.recurrenceRule,
        startDate: new Date(payload.startDate),
        endDate: payload.endDate ? new Date(payload.endDate) : undefined,
        timezone: payload.timezone ?? 'Asia/Dubai',
      },
    });

    res.status(201).json({ series });
  } catch (error) {
    next(error);
  }
});

classesRouter.post('/occurrences', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const payload = createOccurrenceSchema.parse(req.body);

    const template = await db.classTemplate.findUnique({
      where: { id: payload.templateId },
    });

    if (!template || template.businessId !== req.user.businessId) {
      return res.status(404).json({ message: 'Class template not found' });
    }

    const occurrence = await db.classOccurrence.create({
      data: {
        businessId: req.user.businessId,
        templateId: template.id,
        instructorId: payload.instructorId ?? template.defaultInstructorId,
        startTime: new Date(payload.startTime),
        endTime: new Date(new Date(payload.startTime).getTime() + template.durationMinutes * 60000),
        capacity: payload.capacity ?? template.defaultCapacity,
        bookedCount: 0,
        waitlistCount: 0,
        status: 'SCHEDULED',
      },
    });

    res.status(201).json({ occurrence });
  } catch (error) {
    next(error);
  }
});

classesRouter.get('/occurrences', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const occurrences = await db.classOccurrence.findMany({
      where: {
        businessId: req.user.businessId,
        startTime: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      include: {
        template: { select: { name: true, type: true } },
        instructor: { select: { id: true, name: true } },
      },
      orderBy: { startTime: 'asc' },
      take: 50,
    });

    res.json({ occurrences });
  } catch (error) {
    next(error);
  }
});

classesRouter.post('/templates/:templateId/generate', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const payload = seriesSchema.parse(req.body);
    const { templateId } = req.params;

    const template = await db.classTemplate.findUnique({ where: { id: templateId } });
    if (!template || template.businessId !== req.user.businessId) {
      return res.status(404).json({ message: 'Class template not found' });
    }

    const result = await generateOccurrencesFromTemplate({
      templateId,
      businessId: req.user.businessId,
      instructorId: template.defaultInstructorId,
      startDate: new Date(payload.startDate),
      endDate: payload.endDate ? new Date(payload.endDate) : undefined,
      timezone: payload.timezone ?? template?.settings?.timezone ?? 'Asia/Dubai',
      recurrence: payload.recurrenceRule,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

export { classesRouter };

