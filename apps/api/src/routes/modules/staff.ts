import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../../config/prisma.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { STAFF_ROLE_VALUES } from '../../constants/enums.js';
import { requirePermission } from '../../middleware/requirePermission.js';

const staffRouter = Router();

const staffInclude = {
  availability: {
    orderBy: [
      { date: 'asc' },
      { dayOfWeek: 'asc' },
      { startTime: 'asc' },
    ],
  },
  serviceAssignments: {
    orderBy: { displayOrder: 'asc' },
    select: {
      id: true,
      serviceId: true,
      isPrimary: true,
      displayOrder: true,
      service: {
        select: {
          id: true,
          name: true,
          capacityType: true,
          maxClientsPerSlot: true,
          allowAnyStaff: true,
        },
      },
    },
  },
};

const permissionValues = Object.values(PERMISSIONS);

const staffSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  role: z.enum(STAFF_ROLE_VALUES).default('TEAM'),
  permissions: z.array(z.enum(permissionValues as [string, ...string[]])).optional(),
  isActive: z.boolean().default(true),
});

staffRouter.use(requirePermission(PERMISSIONS.MANAGE_STAFF));

staffRouter.get('/', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const staff = await prisma.staffMember.findMany({
      where: { businessId: req.user.businessId },
      orderBy: { createdAt: 'desc' },
      include: staffInclude,
    });

    res.json({ staff });
  } catch (error) {
    next(error);
  }
});

staffRouter.post('/', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const payload = staffSchema.parse(req.body);

    const staffRecord = await prisma.staffMember.create({
      data: {
        businessId: req.user.businessId,
        name: payload.name,
        email: payload.email,
        role: payload.role,
        permissions: payload.permissions ?? [],
        isActive: payload.isActive,
      },
    });
    const staff = await prisma.staffMember.findUnique({
      where: { id: staffRecord.id },
      include: staffInclude,
    });

    res.status(201).json({ staff });
  } catch (error) {
    next(error);
  }
});

staffRouter.put('/:staffId', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const payload = staffSchema.partial().parse(req.body);
    const { staffId } = req.params;

    const existing = await prisma.staffMember.findUnique({ where: { id: staffId } });
    if (!existing || existing.businessId !== req.user.businessId) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    const staffRecord = await prisma.staffMember.update({
      where: { id: staffId },
      data: {
        ...payload,
        permissions: payload.permissions ?? existing.permissions,
      },
    });
    const staff = await prisma.staffMember.findUnique({
      where: { id: staffRecord.id },
      include: staffInclude,
    });

    res.json({ staff });
  } catch (error) {
    next(error);
  }
});

staffRouter.delete('/:staffId', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const { staffId } = req.params;
    const existing = await prisma.staffMember.findUnique({ where: { id: staffId } });
    if (!existing || existing.businessId !== req.user.businessId) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    await prisma.$transaction([
      prisma.availabilityBlock.deleteMany({ where: { staffId } }),
      prisma.serviceStaff.deleteMany({ where: { staffId } }),
      prisma.staffMember.delete({ where: { id: staffId } }),
    ]);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export { staffRouter };

