import type { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma.js';

type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED';
type TriggerType = 'MANUAL' | 'NEW_CUSTOMER' | 'CLASS_BOOKED';
type Channel = 'EMAIL' | 'SMS';

const db = prisma as typeof prisma & {
  marketingCampaign: any;
  marketingEvent: any;
};

export const listCampaigns = async (businessId: string) => {
  return db.marketingCampaign.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
    include: {
      steps: {
        orderBy: { stepOrder: 'asc' },
      },
    },
  });
};

export const createCampaign = async (
  businessId: string,
  payload: {
    name: string;
    description?: string;
    triggerType: TriggerType;
    steps: Array<{
      delayMinutes: number;
      channel: string;
      subject?: string;
      body: string;
    }>;
  },
) => {
  if (!payload.steps.length) {
    throw new Error('Campaign must include at least one step.');
  }

  const stepData = payload.steps.map((step, index) => ({
    delayMinutes: step.delayMinutes ?? 0,
    channel: step.channel?.toUpperCase() === 'SMS' ? 'SMS' : 'EMAIL',
    subject: step.subject,
    body: step.body,
    stepOrder: index,
  }));

  return db.marketingCampaign.create({
    data: {
      businessId,
      name: payload.name,
      description: payload.description,
      triggerType: payload.triggerType,
      steps: {
        createMany: {
          data: stepData,
        },
      },
    },
    include: {
      steps: {
        orderBy: { stepOrder: 'asc' },
      },
    },
  });
};

export const updateCampaignStatus = async ({
  businessId,
  campaignId,
  status,
}: {
  businessId: string;
  campaignId: string;
  status: CampaignStatus;
}) => {
  const existing = await db.marketingCampaign.findUnique({
    where: { id: campaignId },
    select: { businessId: true },
  });

  if (!existing || existing.businessId !== businessId) {
    throw new Error('Campaign not found');
  }

  return db.marketingCampaign.update({
    where: { id: campaignId },
    data: { status },
    include: {
      steps: {
        orderBy: { stepOrder: 'asc' },
      },
    },
  });
};

type TriggerPayload = {
  businessId: string;
  triggerType: TriggerType;
  customerId?: string | null;
  subjectContext?: string;
  messageContext?: string;
};

export const queueCampaignEvents = async ({
  businessId,
  triggerType,
  customerId,
  subjectContext,
  messageContext,
}: TriggerPayload) => {
  const campaigns = await db.marketingCampaign.findMany({
    where: {
      businessId,
      status: 'ACTIVE',
      triggerType,
    },
    include: {
      steps: true,
    },
  });

  if (!campaigns.length) {
    return;
  }

  type EventInput = {
    campaignId: string;
    customerId?: string | null;
    channel: Channel;
    subject?: string | null;
    body: string;
    status: string;
    scheduledAt: Date;
    metadata?: Record<string, unknown>;
  };

  const events: EventInput[] = [];
  const now = Date.now();

  for (const campaign of campaigns) {
    for (const step of campaign.steps) {
      const scheduledAt = new Date(now + (step.delayMinutes ?? 0) * 60000);
      events.push({
        campaignId: campaign.id,
        customerId: customerId ?? null,
        channel: step.channel,
        subject: step.subject ?? subjectContext ?? campaign.name,
        body: step.body,
        status: 'QUEUED',
        scheduledAt,
        metadata: {
          triggerType,
          subjectContext,
          messageContext,
        },
      });
    }
  }

  if (events.length) {
    await db.marketingEvent.createMany({
      data: events,
    });
  }
};

