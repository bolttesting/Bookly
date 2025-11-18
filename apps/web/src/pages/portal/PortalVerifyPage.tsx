import { useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { verifyPortalToken } from '../../api/portal';
import { usePortalStore } from '../../stores/portalStore';

export const PortalVerifyPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const setSession = usePortalStore((state) => state.setSession);

  const mutation = useMutation({
    mutationFn: (token: string) => verifyPortalToken(token),
    onSuccess: (data) => {
      setSession({
        token: data.portalToken,
        customer: data.customer,
        business: { id: data.businessId },
      });
      navigate('/portal', { replace: true });
    },
  });

  useEffect(() => {
    const token = params.get('token');
    if (token) {
      mutation.mutate(token);
    }
  }, [params, mutation]);

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl bg-white/5 border border-white/10 p-10 text-center space-y-4">
        <div className="animate-spin mx-auto h-10 w-10 rounded-full border-2 border-white/30 border-t-white" />
        <h1 className="text-2xl font-semibold">Setting things up…</h1>
        <p className="text-sm text-white/70">
          {mutation.isError
            ? (mutation.error as Error)?.message ?? 'This link may have expired. Request a new one.'
            : 'Verifying your secure link. This only takes a moment.'}
        </p>
        {mutation.isError && (
          <button
            className="px-5 py-2 rounded-full bg-white text-neutral-900 text-sm font-semibold"
            onClick={() => navigate('/portal/login')}
          >
            Request a new link
          </button>
        )}
      </div>
    </div>
  );
};

