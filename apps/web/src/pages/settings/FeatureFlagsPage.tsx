import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { fetchFeatureFlags, updateFeatureFlags } from '../../api/featureFlags';
import { useAuthStore } from '../../stores/authStore';

const FEATURE_COPY: Record<
  string,
  {
    title: string;
    description: string;
  }
> = {
  PILATES_TOOLKIT: {
    title: 'Pilates toolkit',
    description: 'Group class templates, reformer scheduling, and equipment allocation controls.',
  },
  MEDICAL_COMPLIANCE: {
    title: 'Medical compliance fields',
    description: 'HIPAA-ready intake forms, consent tracking, and document placeholders.',
  },
  AGENCY_RETAINER: {
    title: 'Agency retainer tracking',
    description: 'Track billed retainers, utilization, and client plan usage per period.',
  },
  MARKETING_AUTOMATION: {
    title: 'Marketing automation (beta)',
    description: 'Segmented email drip workflows with opt-in/out tracking.',
  },
  EMBED_WIDGETS: {
    title: 'Embedded booking widgets',
    description: 'Allow tenants to drop Bookly into their existing sites with SSO handoff.',
  },
};

export const FeatureFlagsPage = () => {
  const queryClient = useQueryClient();
  const setFeatureFlags = useAuthStore((state) => state.setFeatureFlags);

  const reduceToMap = (items: { key: string; enabled: boolean }[]) => {
    const map: Record<string, boolean> = {};
    items.forEach((flag) => {
      map[flag.key] = flag.enabled;
    });
    return map;
  };

  const flagsQuery = useQuery({
    queryKey: ['feature-flags'],
    queryFn: fetchFeatureFlags,
  });

  const mutation = useMutation({
    mutationFn: updateFeatureFlags,
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
      if (data?.flags) {
        setFeatureFlags(reduceToMap(data.flags));
      }
    },
  });

  const flags = flagsQuery.data?.flags ?? [];
  const flagMap = useMemo(() => {
    return reduceToMap(flags);
  }, [flags]);

  useEffect(() => {
    setFeatureFlags(flagMap);
  }, [flagMap, setFeatureFlags]);

  const isLoading = flagsQuery.isLoading || mutation.isPending;

  const handleToggle = (key: string, enabled: boolean) => {
    mutation.mutate([{ key, enabled }]);
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-wide text-primary font-semibold">Feature flags</p>
        <h1 className="text-h2 text-neutral-900">Industry modules</h1>
        <p className="text-neutral-500 max-w-2xl">
          Enable or disable modules per tenant. Flags seeded automatically based on the industry selected during onboarding.
        </p>
      </div>

      {flagsQuery.isError && (
        <div className="text-danger bg-danger/10 border border-danger/20 rounded-3xl px-4 py-3 text-sm">
          Failed to load feature flags. Please refresh and try again.
        </div>
      )}

      <div className="grid gap-4">
        {Object.entries(FEATURE_COPY).map(([key, meta]) => {
          const enabled = flagMap[key] ?? false;

          return (
            <div
              key={key}
              className="rounded-3xl border border-neutral-200 bg-white p-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="text-h4 text-neutral-900">{meta.title}</p>
                <p className="text-sm text-neutral-500">{meta.description}</p>
              </div>
              <button
                className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition ${
                  enabled ? 'bg-primary text-white' : 'bg-neutral-100 text-neutral-600'
                } ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                disabled={isLoading}
                onClick={() => handleToggle(key, !enabled)}
              >
                {enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

