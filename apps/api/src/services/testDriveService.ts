import { prisma } from '../config/prisma.js';
import { TEST_DRIVE_STATUS } from '../constants/prismaEnums.js';

const TEST_DRIVE_DAYS = 14;
const APPOINTMENT_LIMIT = 50;

// Cast to any to bypass Prisma type issues with test drive fields
const db = prisma as any;

export const startTestDrive = async (businessId: string) => {
  const activatedAt = new Date();
  const endsAt = new Date(activatedAt.getTime() + TEST_DRIVE_DAYS * 24 * 60 * 60 * 1000);

  return db.business.update({
    where: { id: businessId },
    data: {
      testDriveStatus: TEST_DRIVE_STATUS.ACTIVE,
      testDriveActivatedAt: activatedAt,
      testDriveEndsAt: endsAt,
    },
  });
};

export const completeTestDrive = async (businessId: string) => {
  return db.business.update({
    where: { id: businessId },
    data: {
      testDriveStatus: TEST_DRIVE_STATUS.COMPLETED,
      testDriveEndsAt: null,
    },
  });
};

export const expireTestDriveIfNeeded = async (businessId: string) => {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: {
      testDriveStatus: true,
      testDriveEndsAt: true,
    },
  });

  if (!business) return null;

  if (
    business.testDriveStatus === TEST_DRIVE_STATUS.ACTIVE &&
    business.testDriveEndsAt &&
    business.testDriveEndsAt < new Date()
  ) {
    return db.business.update({
      where: { id: businessId },
      data: {
        testDriveStatus: TEST_DRIVE_STATUS.EXPIRED,
      },
    });
  }

  return business;
};

export const ensureTestDriveLimit = async (businessId: string) => {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: {
      testDriveStatus: true,
    },
  });

  if (!business || business.testDriveStatus !== TEST_DRIVE_STATUS.ACTIVE) {
    return;
  }

  const appointmentCount = await prisma.appointment.count({
    where: {
      businessId,
    },
  });

  if (appointmentCount >= APPOINTMENT_LIMIT) {
    throw new Error('Test Drive limit reached. Upgrade to continue booking.');
  }
};

export const getTestDriveStatus = async (businessId: string) => {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: {
      testDriveStatus: true,
      testDriveActivatedAt: true,
      testDriveEndsAt: true,
    },
  });

  if (!business) return null;

  // Get appointment count if test drive is active
  let appointmentCount = 0;
  if (business.testDriveStatus === TEST_DRIVE_STATUS.ACTIVE) {
    appointmentCount = await prisma.appointment.count({
      where: { businessId },
    });
  }

  return {
    ...business,
    appointmentCount,
    appointmentLimit: APPOINTMENT_LIMIT,
  };
};

