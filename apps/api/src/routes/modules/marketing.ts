import { Router } from 'express';
import { z } from 'zod';

import { PERMISSIONS } from '../../constants/permissions.js';
import {
  MARKETING_CAMPAIGN_STATUS,
  MARKETING_TRIGGER_TYPE,
} from '../../constants/prismaEnums.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import {
  createCampaign,
  listCampaigns,
  updateCampaignStatus,
} from '../../services/marketingService.js';

const marketingRouter = Router();

marketingRouter.use(requirePermission(PERMISSIONS.MANAGE_BUSINESS));

marketingRouter.get('/campaigns', async (req, res, next) => {
  try {
    const businessId = req.user?.businessId;

    if (!businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const campaigns = await listCampaigns(businessId);
    res.json({ campaigns });
  } catch (error) {
    next(error);
  }
});

const campaignSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  triggerType: z.nativeEnum(MARKETING_TRIGGER_TYPE),
  steps: z
    .array(
      z.object({
        delayMinutes: z.number().int().min(0).default(0),
        channel: z.enum(['EMAIL', 'SMS']).default('EMAIL'),
        subject: z.string().optional(),
        body: z.string().min(1),
      }),
    )
    .min(1),
});

marketingRouter.post('/campaigns', async (req, res, next) => {
  try {
    const businessId = req.user?.businessId;

    if (!businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const payload = campaignSchema.parse(req.body);
    const campaign = await createCampaign(businessId, payload);
    res.status(201).json({ campaign });
  } catch (error) {
    next(error);
  }
});

const statusSchema = z.object({
  status: z.nativeEnum(MARKETING_CAMPAIGN_STATUS),
});

marketingRouter.patch('/campaigns/:campaignId/status', async (req, res, next) => {
  try {
    const businessId = req.user?.businessId;
    const { campaignId } = req.params;

    if (!businessId) {
      return res.status(400).json({ message: 'Missing business context' });
    }

    const { status } = statusSchema.parse(req.body);
    const campaign = await updateCampaignStatus({ businessId, campaignId, status });
    res.json({ campaign });
  } catch (error) {
    next(error);
  }
});

export { marketingRouter };

