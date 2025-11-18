import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, CheckCircle2, XCircle, RefreshCw, Trash2, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import {
  fetchCalendarConnections,
  initiateGoogleConnect,
  initiateOutlookConnect,
  disconnectCalendar,
  toggleCalendarSync,
  syncCalendarNow,
  type CalendarConnection,
} from '../../api/calendars';
import { useAuthStore } from '../../stores/authStore';

export const CalendarConnectionsPage = () => {
  const { business, user } = useAuthStore();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Handle OAuth callback success/error
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success === 'connected') {
      toast.success('Google Calendar connected successfully!');
      setSearchParams({});
      queryClient.invalidateQueries({ queryKey: ['calendar-connections'] });
    } else if (error) {
      const errorMessages: Record<string, string> = {
        missing_params: 'Missing authentication parameters',
        invalid_state: 'Invalid authentication state',
        no_token: 'Failed to get access token',
        oauth_failed: 'OAuth authentication failed',
      };
      toast.error(errorMessages[error] || 'Failed to connect calendar');
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, queryClient]);

  const { data, isLoading } = useQuery({
    queryKey: ['calendar-connections'],
    queryFn: () => fetchCalendarConnections(),
  });

  const connectGoogleMutation = useMutation({
    mutationFn: initiateGoogleConnect,
    onSuccess: ({ authUrl }) => {
      window.location.href = authUrl;
    },
  });

  const connectOutlookMutation = useMutation({
    mutationFn: initiateOutlookConnect,
    onSuccess: ({ authUrl }) => {
      window.location.href = authUrl;
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectCalendar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-connections'] });
    },
  });

  const toggleSyncMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => toggleCalendarSync(id, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-connections'] });
    },
  });

  const syncNowMutation = useMutation({
    mutationFn: syncCalendarNow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-connections'] });
    },
  });

  const getStatusIcon = (status: CalendarConnection['status']) => {
    switch (status) {
      case 'ACTIVE':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'ERROR':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'PENDING':
        return <RefreshCw className="w-5 h-5 text-amber-500 animate-spin" />;
      default:
        return <XCircle className="w-5 h-5 text-neutral-400" />;
    }
  };

  const getStatusLabel = (status: CalendarConnection['status']) => {
    switch (status) {
      case 'ACTIVE':
        return 'Connected';
      case 'ERROR':
        return 'Error';
      case 'PENDING':
        return 'Connecting...';
      case 'DISCONNECTED':
        return 'Disconnected';
      default:
        return status;
    }
  };

  const getProviderLabel = (provider: CalendarConnection['provider']) => {
    return provider === 'GOOGLE' ? 'Google Calendar' : 'Outlook Calendar';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h2 text-neutral-900">Calendar Connections</h1>
        <p className="text-neutral-500 mt-2">
          Connect your external calendars to sync appointments automatically and prevent double-bookings.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Google Calendar Card */}
        <div className="rounded-3xl border border-neutral-200 bg-white p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-h3 text-neutral-900">Google Calendar</h3>
              <p className="text-sm text-neutral-500">Sync with your Google Calendar</p>
            </div>
          </div>

          <button
            onClick={() => connectGoogleMutation.mutate(undefined)}
            disabled={connectGoogleMutation.isPending}
            className="w-full px-4 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 font-semibold transition disabled:opacity-60"
          >
            {connectGoogleMutation.isPending ? 'Connecting...' : 'Connect Google Calendar'}
          </button>

          <p className="text-xs text-neutral-500 mt-3">
            Your appointments will automatically sync to your Google Calendar. Changes in Google Calendar can be imported
            to prevent conflicts.
          </p>
        </div>

        {/* Outlook Calendar Card */}
        <div className="rounded-3xl border border-neutral-200 bg-white p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-h3 text-neutral-900">Outlook Calendar</h3>
              <p className="text-sm text-neutral-500">Sync with your Outlook Calendar</p>
            </div>
          </div>

          <button
            onClick={() => connectOutlookMutation.mutate(undefined)}
            disabled={connectOutlookMutation.isPending}
            className="w-full px-4 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 font-semibold transition disabled:opacity-60"
          >
            {connectOutlookMutation.isPending ? 'Connecting...' : 'Connect Outlook Calendar'}
          </button>

          <p className="text-xs text-neutral-500 mt-3">
            Your appointments will automatically sync to your Outlook Calendar. Changes in Outlook Calendar can be imported
            to prevent conflicts.
          </p>
        </div>
      </div>

      {/* Active Connections */}
      {isLoading ? (
        <div className="text-center py-8 text-neutral-500">Loading connections...</div>
      ) : data?.connections.length ? (
        <div className="space-y-4">
          <h2 className="text-h3 text-neutral-900">Active Connections</h2>
          {data.connections.map((connection) => (
            <div
              key={connection.id}
              className="rounded-3xl border border-neutral-200 bg-white p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getStatusIcon(connection.status)}
                    <div>
                      <h3 className="text-h3 text-neutral-900">{getProviderLabel(connection.provider)}</h3>
                      {connection.calendarName && (
                        <p className="text-sm text-neutral-500">{connection.calendarName}</p>
                      )}
                      {connection.staff && (
                        <p className="text-xs text-neutral-400 mt-1">Staff: {connection.staff.name}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-4 text-sm">
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                        connection.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700'
                          : connection.status === 'ERROR'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {getStatusLabel(connection.status)}
                    </span>

                    {connection.lastSyncAt && (
                      <span className="text-neutral-500">
                        Last synced {formatDistanceToNow(new Date(connection.lastSyncAt), { addSuffix: true })}
                      </span>
                    )}

                    {connection.lastSyncError && (
                      <span className="text-red-600 text-xs">Error: {connection.lastSyncError}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={connection.syncEnabled}
                      onChange={(e) =>
                        toggleSyncMutation.mutate({ id: connection.id, enabled: e.target.checked })
                      }
                      disabled={connection.status !== 'ACTIVE' || toggleSyncMutation.isPending}
                      className="rounded border-neutral-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-neutral-600">Sync enabled</span>
                  </label>

                  {connection.status === 'ACTIVE' && (
                    <button
                      onClick={() => syncNowMutation.mutate(connection.id)}
                      disabled={syncNowMutation.isPending}
                      className="p-2 rounded-full hover:bg-neutral-100 transition"
                      title="Sync now"
                    >
                      <RefreshCw
                        className={`w-4 h-4 text-neutral-600 ${syncNowMutation.isPending ? 'animate-spin' : ''}`}
                      />
                    </button>
                  )}

                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to disconnect this calendar?')) {
                        disconnectMutation.mutate(connection.id);
                      }
                    }}
                    disabled={disconnectMutation.isPending}
                    className="p-2 rounded-full hover:bg-red-50 transition text-red-600"
                    title="Disconnect"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-neutral-200 bg-white p-12 text-center">
          <Calendar className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
          <h3 className="text-h3 text-neutral-900 mb-2">No calendar connections</h3>
          <p className="text-neutral-500 mb-6">
            Connect your calendar to automatically sync appointments and prevent conflicts.
          </p>
        </div>
      )}
    </div>
  );
};

