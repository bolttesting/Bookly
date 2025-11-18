import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from '../../api/client';

type Session = {
  id: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  lastUsedAt: string;
  createdAt: string;
};

export const SessionList = () => {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => apiRequest<{ sessions: Session[] }>('/sessions'),
  });

  const endSession = useMutation<unknown, Error, string>({
    mutationFn: (sessionId) =>
      apiRequest(`/sessions/${sessionId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });

  if (isLoading) return <p>Loading sessions...</p>;
  if (error instanceof Error) return <p className="text-danger">{error.message}</p>;

  return (
    <div className="bg-white rounded-3xl shadow-card p-6">
      <h3 className="text-h2 text-neutral-900 mb-2">Active sessions</h3>
      <p className="text-sm text-neutral-500 mb-6">
        Manage device access and terminate old sessions.
      </p>
      <div className="space-y-4">
        {data?.sessions?.map((session) => (
          <div
            key={session.id}
            className="flex flex-col md:flex-row md:items-center justify-between border border-neutral-100 rounded-2xl p-4"
          >
            <div>
              <p className="font-semibold text-neutral-900">{session.userAgent ?? 'Unknown device'}</p>
              <p className="text-xs text-neutral-500">
                IP {session.ipAddress ?? '—'} · Last active{' '}
                {new Date(session.lastUsedAt).toLocaleString()}
              </p>
            </div>
            <button
              className="mt-3 md:mt-0 px-4 py-2 rounded-full border border-danger text-danger disabled:opacity-60"
              onClick={() => endSession.mutate(session.id)}
              disabled={endSession.isPending && endSession.variables === session.id}
            >
              {endSession.isPending && endSession.variables === session.id
                ? 'Ending...'
                : 'End session'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

