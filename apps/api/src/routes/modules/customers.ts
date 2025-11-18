import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../../config/prisma.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { requirePermission } from '../../middleware/requirePermission.js';

const customersRouter = Router();

const customerSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  notes: z.string().max(2000).optional(),
  marketingConsent: z.boolean().default(false),
});

customersRouter.use(requirePermission(PERMISSIONS.MANAGE_CUSTOMERS));

customersRouter.get('/', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const customers = await prisma.customer.findMany({
      where: { businessId: req.user.businessId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ customers });
  } catch (error) {
    next(error);
  }
});

customersRouter.post('/', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const payload = customerSchema.parse(req.body);

    const customer = await prisma.customer.create({
      data: {
        businessId: req.user.businessId,
        ...payload,
      },
    });

    res.status(201).json({ customer });
  } catch (error) {
    next(error);
  }
});

customersRouter.put('/:customerId', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const payload = customerSchema.partial().parse(req.body);
    const { customerId } = req.params;

    const existing = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!existing || existing.businessId !== req.user.businessId) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: payload,
    });

    res.json({ customer });
  } catch (error) {
    next(error);
  }
});

customersRouter.delete('/:customerId', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const { customerId } = req.params;
    const existing = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!existing || existing.businessId !== req.user.businessId) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    await prisma.customer.delete({ where: { id: customerId } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export { customersRouter };

