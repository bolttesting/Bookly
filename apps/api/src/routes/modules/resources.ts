import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../../config/prisma.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { requirePermission } from '../../middleware/requirePermission.js';

const resourcesRouter = Router();

const resourceSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  quantity: z.number().min(1).max(100),
  color: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const reservationSchema = z.object({
  appointmentId: z.string().cuid().optional(),
  classOccurrenceId: z.string().cuid().optional(),
  quantity: z.number().min(1).default(1),
});

resourcesRouter.use(requirePermission(PERMISSIONS.MANAGE_BUSINESS));

resourcesRouter.get('/', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const resources = await prisma.resource.findMany({
      where: { businessId: req.user.businessId },
      include: {
        reservations: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ resources });
  } catch (error) {
    next(error);
  }
});

resourcesRouter.post('/', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const payload = resourceSchema.parse(req.body);

    const resource = await prisma.resource.create({
      data: {
        businessId: req.user.businessId,
        ...payload,
      },
    });

    res.status(201).json({ resource });
  } catch (error) {
    next(error);
  }
});

resourcesRouter.put('/:resourceId', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const payload = resourceSchema.partial().parse(req.body);
    const { resourceId } = req.params;

    const existing = await prisma.resource.findUnique({ where: { id: resourceId } });
    if (!existing || existing.businessId !== req.user.businessId) {
      return res.status(404).json({ message: 'Resource not found' });
    }

    const resource = await prisma.resource.update({
      where: { id: resourceId },
      data: payload,
    });

    res.json({ resource });
  } catch (error) {
    next(error);
  }
});

resourcesRouter.delete('/:resourceId', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const { resourceId } = req.params;
    const existing = await prisma.resource.findUnique({ where: { id: resourceId } });
    if (!existing || existing.businessId !== req.user.businessId) {
      return res.status(404).json({ message: 'Resource not found' });
    }

    await prisma.resource.delete({ where: { id: resourceId } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

resourcesRouter.post('/:resourceId/reservations', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const payload = reservationSchema.parse(req.body);
    const { resourceId } = req.params;

    const resource = await prisma.resource.findUnique({ where: { id: resourceId } });
    if (!resource || resource.businessId !== req.user.businessId) {
      return res.status(404).json({ message: 'Resource not found' });
    }

    if (!payload.appointmentId && !payload.classOccurrenceId) {
      return res.status(400).json({ message: 'appointmentId or classOccurrenceId required' });
    }

    const reservation = await prisma.resourceReservation.create({
      data: {
        businessId: req.user.businessId,
        resourceId,
        appointmentId: payload.appointmentId,
        classOccurrenceId: payload.classOccurrenceId,
        quantity: payload.quantity,
      },
    });

    res.status(201).json({ reservation });
  } catch (error) {
    next(error);
  }
});

export { resourcesRouter };

