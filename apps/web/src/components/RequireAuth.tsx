import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { apiRequest } from '../api/client';
import { useAuthStore } from '../stores/authStore';
import type { AuthBusiness, AuthUser } from '../stores/authStore';

export const RequireAuth = () => {
  const location = useLocation();
  const { setSession, setLoading, isLoading, accessToken } = useAuthStore();

  useEffect(() => {
    const bootstrap = async () => {
      if (!accessToken) return;
      try {
        setLoading(true);
        const data = await apiRequest<{
          user: AuthUser;
          business: AuthBusiness;
          impersonated?: boolean;
          featureFlags?: Record<string, boolean>;
        }>('/auth/me');
        if (data.user) {
          setSession({
            user: data.user,
            business: data.business,
            accessToken,
            isImpersonating: data.impersonated ?? false,
            featureFlags: data.featureFlags,
          });
        }
      } catch {
        // ignore; user will be redirected below
      } finally {
        setLoading(false);
      }
    };

    void bootstrap();
  }, [accessToken, setLoading, setSession]);

  if (!accessToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-neutral-600">
        Loading...
      </div>
    );
  }

  return <Outlet />;
};

