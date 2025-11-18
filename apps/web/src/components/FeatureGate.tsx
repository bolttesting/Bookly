import type { ReactNode } from 'react';

import { useFeatureFlag } from '../hooks/useFeatureFlag';

type FeatureGateProps = {
  flag: string;
  children: ReactNode;
  fallback?: ReactNode;
};

export const FeatureGate = ({ flag, children, fallback }: FeatureGateProps) => {
  const enabled = useFeatureFlag(flag);

  if (!enabled) {
    return (
      <div className="rounded-3xl border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-500">
        {fallback ?? 'This feature is not enabled for your workspace yet.'}
      </div>
    );
  }

  return <>{children}</>;
};

