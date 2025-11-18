import { prisma } from '../config/prisma.js';
import { sendEmail } from './emailService.js';

export class WaitlistPromotionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WaitlistPromotionError';
  }
}

export const promoteNextWaitlistEntry = async ({
  businessId,
  occurrenceId,
}: {
  businessId: string;
  occurrenceId: string;
}) => {
  const occurrence = await prisma.classOccurrence.findUnique({
    where: { id: occurrenceId },
    select: {
      id: true,
      businessId: true,
      startTime: true,
      capacity: true,
      bookedCount: true,
      template: {
        select: { name: true },
      },
    },
  });

  if (!occurrence || occurrence.businessId !== businessId) {
    throw new WaitlistPromotionError('Class occurrence not found.');
  }

  if (occurrence.bookedCount >= occurrence.capacity) {
    throw new WaitlistPromotionError('Class still full. No seats available.');
  }

  const nextEntry = await prisma.waitlistEntry.findFirst({
    where: {
      businessId,
      classOccurrenceId: occurrenceId,
      status: 'PENDING',
    },
    orderBy: { position: 'asc' },
    include: {
      customer: {
        select: { id: true, firstName: true, email: true },
      },
    },
  });

  if (!nextEntry) {
    throw new WaitlistPromotionError('No pending waitlist entries.');
  }

  await prisma.waitlistEntry.update({
    where: { id: nextEntry.id },
    data: {
      status: 'PROMOTED',
    },
  });

  if (nextEntry.customer?.email) {
    try {
      const date = occurrence.startTime
        ? occurrence.startTime.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
          })
        : 'upcoming date';
      const time = occurrence.startTime
        ? occurrence.startTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : '';

      await sendEmail({
        to: nextEntry.customer.email,
        subject: `You're in for ${occurrence.template?.name ?? 'class'}!`,
        text: `Hi ${nextEntry.customer.firstName ?? ''},

A seat just opened up for ${occurrence.template?.name ?? 'your class'} on ${date} ${time}.
Log into your portal or use the booking link to confirm.

— Bookly`,
        html: `
          <p>Hi ${nextEntry.customer.firstName ?? ''},</p>
          <p>Good news! A spot is now available for <strong>${
            occurrence.template?.name ?? 'your class'
          }</strong>.</p>
          <ul>
            <li><strong>Date:</strong> ${date}</li>
            ${time ? `<li><strong>Time:</strong> ${time}</li>` : ''}
          </ul>
          <p>Please confirm in your client portal or reply to this email if you have questions.</p>
          <p>— Bookly</p>
        `,
      });
    } catch (error) {
      console.error('Failed to send waitlist promotion email', error);
    }
  }

  return nextEntry;
};

