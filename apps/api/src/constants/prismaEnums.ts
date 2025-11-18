export const MARKETING_CAMPAIGN_STATUS = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
} as const;
export type MarketingCampaignStatus =
  (typeof MARKETING_CAMPAIGN_STATUS)[keyof typeof MARKETING_CAMPAIGN_STATUS];

export const MARKETING_TRIGGER_TYPE = {
  MANUAL: 'MANUAL',
  NEW_CUSTOMER: 'NEW_CUSTOMER',
  CLASS_BOOKED: 'CLASS_BOOKED',
} as const;
export type MarketingTriggerType =
  (typeof MARKETING_TRIGGER_TYPE)[keyof typeof MARKETING_TRIGGER_TYPE];

export const MARKETING_CHANNEL = {
  EMAIL: 'EMAIL',
  SMS: 'SMS',
} as const;
export type MarketingChannel = (typeof MARKETING_CHANNEL)[keyof typeof MARKETING_CHANNEL];

export const TEST_DRIVE_STATUS = {
  NONE: 'NONE',
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  COMPLETED: 'COMPLETED',
} as const;
export type TestDriveStatus = (typeof TEST_DRIVE_STATUS)[keyof typeof TEST_DRIVE_STATUS];

export const PAYMENT_CONNECTION_STATUS = {
  NOT_CONNECTED: 'NOT_CONNECTED',
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
} as const;
export type PaymentConnectionStatus =
  (typeof PAYMENT_CONNECTION_STATUS)[keyof typeof PAYMENT_CONNECTION_STATUS];


