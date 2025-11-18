import { useAuthStore } from '../stores/authStore';

export const useFeatureFlag = (flag: string) => {
  return useAuthStore((state) => Boolean(flag ? state.featureFlags?.[flag] : true));
};

