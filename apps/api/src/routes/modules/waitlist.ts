import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../../config/prisma.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { promoteNextWaitlistEntry, WaitlistPromotionError } from '../../services/waitlistService.js';

const waitlistRouter = Router();

const joinSchema = z.object({
  customerId: z.string().cuid(),
});

const updateSchema = z.object({
  status: z.enum(['PENDING', 'PROMOTED', 'REMOVED']).optional(),
  position: z.number().min(1).optional(),
});

waitlistRouter.use(requirePermission(PERMISSIONS.MANAGE_STAFF));

waitlistRouter.get('/:occurrenceId', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const { occurrenceId } = req.params;

    const entries = await prisma.waitlistEntry.findMany({
      where: { businessId: req.user.businessId, classOccurrenceId: occurrenceId },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { position: 'asc' },
    });

    res.json({ entries });
  } catch (error) {
    next(error);
  }
});

waitlistRouter.post('/:occurrenceId', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const payload = joinSchema.parse(req.body);
    const { occurrenceId } = req.params;

    const occurrence = await prisma.classOccurrence.findUnique({ where: { id: occurrenceId } });
    if (!occurrence || occurrence.businessId !== req.user.businessId) {
      return res.status(404).json({ message: 'Class occurrence not found' });
    }

    const customer = await prisma.customer.findUnique({ where: { id: payload.customerId } });
    if (!customer || customer.businessId !== req.user.businessId) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const count = await prisma.waitlistEntry.count({
      where: { classOccurrenceId: occurrenceId },
    });

    const entry = await prisma.waitlistEntry.create({
      data: {
        businessId: req.user.businessId,
        classOccurrenceId: occurrenceId,
        customerId: payload.customerId,
        position: count + 1,
      },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.status(201).json({ entry });
  } catch (error) {
    next(error);
  }
});

waitlistRouter.post('/:occurrenceId/promote', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const { occurrenceId } = req.params;

    const entry = await promoteNextWaitlistEntry({
      businessId: req.user.businessId,
      occurrenceId,
    });

    res.json({ promoted: entry });
  } catch (error) {
    if (error instanceof WaitlistPromotionError) {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
});

waitlistRouter.put('/entry/:entryId', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const payload = updateSchema.parse(req.body);
    const { entryId } = req.params;

    const existing = await prisma.waitlistEntry.findUnique({ where: { id: entryId } });
    if (!existing || existing.businessId !== req.user.businessId) {
      return res.status(404).json({ message: 'Waitlist entry not found' });
    }

    const entry = await prisma.waitlistEntry.update({
      where: { id: entryId },
      data: payload,
    });

    res.json({ entry });
  } catch (error) {
    next(error);
  }
});

waitlistRouter.delete('/entry/:entryId', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const { entryId } = req.params;
    const existing = await prisma.waitlistEntry.findUnique({ where: { id: entryId } });
    if (!existing || existing.businessId !== req.user.businessId) {
      return res.status(404).json({ message: 'Waitlist entry not found' });
    }

    await prisma.waitlistEntry.delete({ where: { id: entryId } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export { waitlistRouter };

