import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../../config/prisma.js';
import { CUSTOMER_PACKAGE_STATUS_VALUES } from '../../constants/enums.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { requirePermission } from '../../middleware/requirePermission.js';

const packagesRouter = Router();

const packageSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  credits: z.number().min(1).max(1000),
  price: z.number().nonnegative().optional(),
  expiryDays: z.number().min(1).max(3650).optional(),
  isActive: z.boolean().default(true),
  settings: z.record(z.any()).optional(),
});

const assignSchema = z.object({
  customerId: z.string().cuid(),
  notes: z.string().optional(),
  expiryDate: z.string().datetime().optional(),
  remainingCredits: z.number().min(0).optional(),
});

const customerPackageUpdateSchema = z.object({
  remainingCredits: z.number().min(0).optional(),
  status: z.enum(CUSTOMER_PACKAGE_STATUS_VALUES).optional(),
  notes: z.string().optional(),
  expiryDate: z.string().datetime().optional(),
});

packagesRouter.use(requirePermission(PERMISSIONS.MANAGE_BUSINESS));

packagesRouter.get('/', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const packages = await prisma.package.findMany({
      where: { businessId: req.user.businessId },
      include: {
        customerPackages: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            customer: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ packages });
  } catch (error) {
    next(error);
  }
});

packagesRouter.post('/', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const payload = packageSchema.parse(req.body);

    const pkg = await prisma.package.create({
      data: {
        businessId: req.user.businessId,
        ...payload,
        price: payload.price !== undefined ? payload.price : null,
      },
    });

    res.status(201).json({ package: pkg });
  } catch (error) {
    next(error);
  }
});

packagesRouter.put('/:packageId', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const payload = packageSchema.partial().parse(req.body);
    const { packageId } = req.params;

    const existing = await prisma.package.findUnique({ where: { id: packageId } });
    if (!existing || existing.businessId !== req.user.businessId) {
      return res.status(404).json({ message: 'Package not found' });
    }

    const pkg = await prisma.package.update({
      where: { id: packageId },
      data: payload,
    });

    res.json({ package: pkg });
  } catch (error) {
    next(error);
  }
});

packagesRouter.delete('/:packageId', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const { packageId } = req.params;
    const existing = await prisma.package.findUnique({ where: { id: packageId } });
    if (!existing || existing.businessId !== req.user.businessId) {
      return res.status(404).json({ message: 'Package not found' });
    }

    await prisma.package.delete({ where: { id: packageId } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

packagesRouter.post('/:packageId/assign', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const payload = assignSchema.parse(req.body);
    const { packageId } = req.params;

    const pkg = await prisma.package.findUnique({ where: { id: packageId } });
    if (!pkg || pkg.businessId !== req.user.businessId) {
      return res.status(404).json({ message: 'Package not found' });
    }

    const customer = await prisma.customer.findUnique({ where: { id: payload.customerId } });
    if (!customer || customer.businessId !== req.user.businessId) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const customerPackage = await prisma.customerPackage.create({
      data: {
        businessId: req.user.businessId,
        packageId: pkg.id,
        customerId: customer.id,
        remainingCredits: payload.remainingCredits ?? pkg.credits,
        notes: payload.notes,
        expiryDate: payload.expiryDate ? new Date(payload.expiryDate) : payload.expiryDate,
      },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    res.status(201).json({ customerPackage });
  } catch (error) {
    next(error);
  }
});

packagesRouter.put('/customer-packages/:customerPackageId', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const payload = customerPackageUpdateSchema.parse(req.body);
    const { customerPackageId } = req.params;

    const existing = await prisma.customerPackage.findUnique({ where: { id: customerPackageId } });
    if (!existing || existing.businessId !== req.user.businessId) {
      return res.status(404).json({ message: 'Customer package not found' });
    }

    const updated = await prisma.customerPackage.update({
      where: { id: customerPackageId },
      data: {
        ...payload,
        expiryDate: payload.expiryDate ? new Date(payload.expiryDate) : payload.expiryDate ?? existing.expiryDate,
      },
    });

    res.json({ customerPackage: updated });
  } catch (error) {
    next(error);
  }
});

export { packagesRouter };

