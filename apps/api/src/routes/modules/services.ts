import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../../config/prisma.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { SERVICE_CAPACITY_TYPE_VALUES } from '../../constants/enums.js';
import { requirePermission } from '../../middleware/requirePermission.js';

const servicesRouter = Router();

const capacityEnum = z.enum(SERVICE_CAPACITY_TYPE_VALUES);

const serviceBaseSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  durationMinutes: z.number().min(5).max(480),
  price: z.number().nonnegative(),
  color: z.string().optional(),
  bufferBeforeMinutes: z.number().min(0).max(240).default(0),
  bufferAfterMinutes: z.number().min(0).max(240).default(0),
  isActive: z.boolean().default(true),
  capacityType: capacityEnum.default('SINGLE'),
  maxClientsPerSlot: z.number().int().min(1).max(50).default(1),
  allowAnyStaff: z.boolean().default(true),
  staffIds: z.array(z.string().cuid()).optional(),
});

const serviceSchema = serviceBaseSchema.superRefine((schema, ctx) => {
  if (schema.capacityType === 'SINGLE' && schema.maxClientsPerSlot !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Single-capacity services must have maxClientsPerSlot set to 1.',
      path: ['maxClientsPerSlot'],
    });
  }
});

const serviceUpdateSchema = serviceBaseSchema.partial().superRefine((schema, ctx) => {
  if (schema.capacityType === 'SINGLE' && schema.maxClientsPerSlot !== undefined && schema.maxClientsPerSlot !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Single-capacity services must have maxClientsPerSlot set to 1.',
      path: ['maxClientsPerSlot'],
    });
  }
});

servicesRouter.use(requirePermission(PERMISSIONS.MANAGE_SERVICES));

const serviceInclude = {
  serviceStaff: {
    select: {
      id: true,
      staffId: true,
      isPrimary: true,
      displayOrder: true,
      staff: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: { displayOrder: 'asc' as const },
  },
} satisfies Prisma.ServiceInclude;

servicesRouter.get('/', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const businessId = req.user.businessId;
    const services = await prisma.service.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      include: serviceInclude,
    });

    res.json({ services });
  } catch (error) {
    next(error);
  }
});

servicesRouter.post('/', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const businessId = req.user.businessId;
    const payload = serviceSchema.parse(req.body);
    const { staffIds, ...serviceData } = payload;

    const service = await prisma.service.create({
      data: {
        ...serviceData,
        price: new Prisma.Decimal(serviceData.price),
        businessId,
      },
    });

    if (staffIds?.length) {
      const validStaff = await prisma.staffMember.findMany({
        where: {
          id: { in: staffIds },
          businessId: req.user.businessId,
        },
        select: { id: true },
      });

      if (validStaff.length) {
        await prisma.serviceStaff.createMany({
          data: validStaff.map((staff, index) => ({
            businessId,
            serviceId: service.id,
            staffId: staff.id,
            displayOrder: index,
            isPrimary: index === 0,
          })),
          skipDuplicates: true,
        });
      }
    }

    const serviceWithRelations = await prisma.service.findUnique({
      where: { id: service.id },
      include: serviceInclude,
    });

    res.status(201).json({ service: serviceWithRelations });
  } catch (error) {
    next(error);
  }
});

servicesRouter.put('/:serviceId', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const businessId = req.user.businessId;
    const payload = serviceUpdateSchema.parse(req.body);
    const { staffIds, ...serviceData } = payload;
    const { serviceId } = req.params;

    const existing = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!existing || existing.businessId !== businessId) {
      return res.status(404).json({ message: 'Service not found' });
    }

    const service = await prisma.service.update({
      where: { id: serviceId },
      data: {
        ...serviceData,
        price: serviceData.price !== undefined ? new Prisma.Decimal(serviceData.price) : undefined,
      },
    });

    if (staffIds) {
      const validStaff = await prisma.staffMember.findMany({
        where: {
          id: { in: staffIds },
          businessId,
        },
        select: { id: true },
      });

      const validIds = new Set(validStaff.map((s) => s.id));

      await prisma.serviceStaff.deleteMany({
        where: {
          serviceId,
          staffId: { notIn: Array.from(validIds) },
        },
      });

      const existingAssignments = await prisma.serviceStaff.findMany({
        where: { serviceId },
        select: { staffId: true },
      });
      const existingIds = new Set(existingAssignments.map((a) => a.staffId));

      const newAssignments = staffIds
        .filter((id) => validIds.has(id) && !existingIds.has(id))
        .map((id, index) => ({
          businessId,
          serviceId,
          staffId: id,
          displayOrder: index,
          isPrimary: index === 0,
        }));

      if (newAssignments.length) {
        await prisma.serviceStaff.createMany({
          data: newAssignments,
          skipDuplicates: true,
        });
      }

      // update ordering/isPrimary for all
      await Promise.all(
        staffIds
          .filter((id) => validIds.has(id))
          .map((staffId, index) =>
            prisma.serviceStaff.updateMany({
              where: { serviceId, staffId },
              data: {
                displayOrder: index,
                isPrimary: index === 0,
              },
            }),
          ),
      );
    }

    const serviceWithRelations = await prisma.service.findUnique({
      where: { id: service.id },
      include: serviceInclude,
    });

    res.json({ service: serviceWithRelations });
  } catch (error) {
    next(error);
  }
});

servicesRouter.delete('/:serviceId', async (req, res, next) => {
  try {
    if (!req.user?.businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const { serviceId } = req.params;

    const existing = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!existing || existing.businessId !== req.user.businessId) {
      return res.status(404).json({ message: 'Service not found' });
    }

    await prisma.serviceStaff.deleteMany({ where: { serviceId } });

    await prisma.service.delete({
      where: { id: serviceId },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export { servicesRouter };

