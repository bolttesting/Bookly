import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../../config/prisma.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { requirePermission } from '../../middleware/requirePermission.js';

const bookingPagesRouter = Router();

const bookingPageSchema = z.object({
  name: z.string().min(2),
  slug: z
    .string()
    .min(3)
    .max(60)
    .regex(/^[a-z0-9-]+$/, { message: 'Slug can contain lowercase letters, numbers, and dashes' }),
  settings: z.record(z.any()).optional(),
  isActive: z.boolean().default(true),
});

bookingPagesRouter.use(requirePermission(PERMISSIONS.MANAGE_BOOKING_PAGES));

bookingPagesRouter.get('/', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const bookingPages = await prisma.bookingPage.findMany({
      where: { businessId: req.user.businessId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ bookingPages });
  } catch (error) {
    next(error);
  }
});

bookingPagesRouter.post('/', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const payload = bookingPageSchema.parse(req.body);

    const bookingPage = await prisma.bookingPage.create({
      data: {
        businessId: req.user.businessId,
        ...payload,
      },
    });

    res.status(201).json({ bookingPage });
  } catch (error) {
    next(error);
  }
});

bookingPagesRouter.put('/:bookingPageId', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const payload = bookingPageSchema.partial().parse(req.body);
    const { bookingPageId } = req.params;

    const existing = await prisma.bookingPage.findUnique({ where: { id: bookingPageId } });
    if (!existing || existing.businessId !== req.user.businessId) {
      return res.status(404).json({ message: 'Booking page not found' });
    }

    const bookingPage = await prisma.bookingPage.update({
      where: { id: bookingPageId },
      data: payload,
    });

    res.json({ bookingPage });
  } catch (error) {
    next(error);
  }
});

bookingPagesRouter.delete('/:bookingPageId', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const { bookingPageId } = req.params;
    const existing = await prisma.bookingPage.findUnique({ where: { id: bookingPageId } });
    if (!existing || existing.businessId !== req.user.businessId) {
      return res.status(404).json({ message: 'Booking page not found' });
    }

    await prisma.bookingPage.delete({ where: { id: bookingPageId } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export { bookingPagesRouter };

