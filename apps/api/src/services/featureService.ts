import { prisma } from '../config/prisma.js';
import type { FeatureFlagKey } from '../constants/featureFlags.js';
import { FEATURE_FLAG_ENUM } from '../constants/featureFlags.js';
const db = prisma as any;

const INDUSTRY_DEFAULTS: Record<string, FeatureFlagKey[]> = {
  PILATES: [FEATURE_FLAG_ENUM.PILATES_TOOLKIT, FEATURE_FLAG_ENUM.EMBED_WIDGETS],
  FITNESS: [FEATURE_FLAG_ENUM.PILATES_TOOLKIT, FEATURE_FLAG_ENUM.EMBED_WIDGETS],
  SALON: [FEATURE_FLAG_ENUM.EMBED_WIDGETS, FEATURE_FLAG_ENUM.MARKETING_AUTOMATION],
  MEDICAL: [FEATURE_FLAG_ENUM.MEDICAL_COMPLIANCE, FEATURE_FLAG_ENUM.EMBED_WIDGETS],
  AGENCY: [FEATURE_FLAG_ENUM.AGENCY_RETAINER, FEATURE_FLAG_ENUM.MARKETING_AUTOMATION],
};

const BASE_DEFAULTS: FeatureFlagKey[] = [FEATURE_FLAG_ENUM.EMBED_WIDGETS];

const determineDefaults = (industry?: string | null) => {
  if (!industry) {
    return BASE_DEFAULTS;
  }

  const normalized = industry.trim().toUpperCase();
  return Array.from(new Set([...(INDUSTRY_DEFAULTS[normalized] ?? []), ...BASE_DEFAULTS]));
};

export const syncIndustryFeatureFlags = async ({
  businessId,
  industry,
}: {
  businessId: string;
  industry?: string | null;
}) => {
  const defaults = determineDefaults(industry);

  if (!defaults.length) {
    return;
  }

  await Promise.all(
    defaults.map((key) =>
      db.businessFeature.upsert({
        where: {
          businessId_key: {
            businessId,
            key,
          },
        },
        update: { enabled: true },
        create: {
          businessId,
          key,
          enabled: true,
        },
      }),
    ),
  );
};

type FeatureFlagRecord = { key: FeatureFlagKey; enabled: boolean };

export const listFeatureFlags = async (businessId: string) => {
  return db.businessFeature.findMany({
    where: { businessId },
    orderBy: { key: 'asc' },
  }) as Promise<FeatureFlagRecord[]>;
};

export const hasFeatureFlag = async (businessId: string, key: FeatureFlagKey) => {
  const record = await db.businessFeature.findUnique({
    where: {
      businessId_key: {
        businessId,
        key,
      },
    },
  });

  return Boolean(record?.enabled);
};

export const featureFlagMap = async (businessId: string) => {
  const flags = await listFeatureFlags(businessId);

  return flags.reduce<Partial<Record<FeatureFlagKey, boolean>>>((acc, flag) => {
    acc[flag.key] = flag.enabled;
    return acc;
  }, {});
};

export const updateFeatureFlags = async (
  businessId: string,
  updates: { key: FeatureFlagKey; enabled: boolean }[],
) => {
  if (!updates.length) return listFeatureFlags(businessId);

  await db.$transaction(
    updates.map((flag) =>
      db.businessFeature.upsert({
        where: {
          businessId_key: {
            businessId,
            key: flag.key,
          },
        },
        update: { enabled: flag.enabled },
        create: {
          businessId,
          key: flag.key,
          enabled: flag.enabled,
        },
      }),
    ),
  );

  return listFeatureFlags(businessId);
};

