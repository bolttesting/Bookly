import { apiRequest } from './client';

export type MarketingStep = {
  id: string;
  delayMinutes: number;
  channel: string;
  subject?: string | null;
  body: string;
  stepOrder: number;
};

export type MarketingCampaign = {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  triggerType: string;
  createdAt: string;
  steps: MarketingStep[];
};

export const fetchCampaigns = () =>
  apiRequest<{ campaigns: MarketingCampaign[] }>('/marketing/campaigns');

export const createCampaign = (payload: {
  name: string;
  description?: string;
  triggerType: string;
  steps: Array<{ delayMinutes: number; channel: string; subject?: string; body: string }>;
}) =>
  apiRequest<{ campaign: MarketingCampaign }>('/marketing/campaigns', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const updateCampaignStatus = (campaignId: string, status: string) =>
  apiRequest<{ campaign: MarketingCampaign }>(`/marketing/campaigns/${campaignId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

