import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { requestPortalLink } from '../../api/portal';

export const PortalLoginPage = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => requestPortalLink(email),
    onSuccess: () => {
      setMessage('Magic link sent! Check your inbox (and spam) for access.');
    },
  });

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-3xl bg-white/10 backdrop-blur border border-white/10 p-8 space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-primary/80">Client portal</p>
          <h1 className="text-3xl font-semibold mt-2">Access your account</h1>
          <p className="text-sm text-white/70">
            Enter the email you use with Bookly-powered businesses. We’ll send a one-time link.
          </p>
        </div>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <div>
            <label className="text-sm text-white/70">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-primary focus:outline-none"
              placeholder="you@example.com"
            />
          </div>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full rounded-2xl bg-white text-neutral-900 font-semibold py-3 disabled:opacity-60"
          >
            {mutation.isPending ? 'Sending link…' : 'Send secure link'}
          </button>
        </form>
        {message && <p className="text-sm text-emerald-300">{message}</p>}
        {mutation.isError && (
          <p className="text-sm text-rose-300">
            {(mutation.error as Error)?.message ?? 'Could not send link. Try again.'}
          </p>
        )}
      </div>
    </div>
  );
};

