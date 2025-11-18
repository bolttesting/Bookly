import { apiRequest } from './client';

export type FeatureFlag = {
  id: string;
  key: string;
  enabled: boolean;
};

export const fetchFeatureFlags = () =>
  apiRequest<{ flags: FeatureFlag[] }>('/feature-flags');

export const updateFeatureFlags = (flags: { key: string; enabled: boolean }[]) =>
  apiRequest<{ flags: FeatureFlag[] }>('/feature-flags', {
    method: 'PUT',
    body: JSON.stringify({ flags }),
  });

