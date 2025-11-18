import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AuthUser = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role?: string;
};

export type AuthBusiness = {
  id: string;
  name: string;
  onboardingState?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
};

type AuthState = {
  user?: AuthUser;
  business?: AuthBusiness;
  accessToken?: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  isImpersonating?: boolean;
  featureFlags?: Record<string, boolean>;
  setSession: (payload: {
    user: AuthUser;
    business?: AuthBusiness;
    accessToken: string;
    isImpersonating?: boolean;
    featureFlags?: Record<string, boolean>;
  }) => void;
  clearSession: () => void;
  setLoading: (value: boolean) => void;
  updateAccessToken: (token: string) => void;
  setFeatureFlags: (flags?: Record<string, boolean>) => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      isLoading: false,
      setSession: ({ user, business, accessToken, isImpersonating, featureFlags }) =>
        set({
          user,
          business,
          accessToken,
          featureFlags: featureFlags ?? {},
          isImpersonating: isImpersonating ?? false,
          isAuthenticated: true,
        }),
      clearSession: () =>
        set({
          user: undefined,
          business: undefined,
          accessToken: undefined,
          isAuthenticated: false,
          isImpersonating: false,
          featureFlags: undefined,
        }),
      setLoading: (value: boolean) => set({ isLoading: value }),
      updateAccessToken: (token: string) =>
        set({
          accessToken: token,
          isAuthenticated: true,
        }),
      setFeatureFlags: (flags) => set({ featureFlags: flags ?? {} }),
    }),
    {
      name: 'bookly-auth',
      partialize: (state) => ({
        user: state.user,
        business: state.business,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
        isImpersonating: state.isImpersonating,
        featureFlags: state.featureFlags,
      }),
    },
  ),
);

