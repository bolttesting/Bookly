import { prisma } from '../config/prisma.js';

const db = prisma as any;

type GenerateOccurrencesInput = {
  templateId: string;
  businessId: string;
  instructorId?: string;
  startDate: Date;
  endDate?: Date;
  timezone: string;
  recurrence: string;
};

export const generateOccurrencesFromTemplate = async ({
  templateId,
  businessId,
  instructorId,
  startDate,
  endDate,
  timezone,
  recurrence,
}: GenerateOccurrencesInput) => {
  // TODO: Parse recurrence and generate real occurrences. For now, generate a single occurrence.
  const template = await db.classTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template || template.businessId !== businessId) {
    throw new Error('Class template not found');
  }

  const occurrence = await db.classOccurrence.create({
    data: {
      businessId,
      templateId,
      instructorId: instructorId ?? template.defaultInstructorId,
      startTime: startDate,
      endTime: new Date(startDate.getTime() + template.durationMinutes * 60000),
      capacity: template.defaultCapacity,
      bookedCount: 0,
      waitlistCount: 0,
      status: 'SCHEDULED',
    },
  });

  return { occurrences: [occurrence], timezone, recurrence };
};

