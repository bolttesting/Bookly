import { useState } from 'react';
import { differenceInDays, differenceInHours, format } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { fetchTestDrive, updateTestDrive } from '../../api/testDrive';
import { trackTestDriveStarted, trackTestDriveCompleted } from '../../utils/plausible';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  EXPIRED: 'bg-rose-50 text-rose-700',
  COMPLETED: 'bg-neutral-100 text-neutral-600',
  NONE: 'bg-neutral-100 text-neutral-600',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Test Drive active',
  EXPIRED: 'Test Drive expired',
  COMPLETED: 'Converted',
  NONE: 'Not enabled',
};

const formatCountdown = (endsAt?: string | null) => {
  if (!endsAt) return 'No deadline';
  const end = new Date(endsAt);
  const now = new Date();
  const days = differenceInDays(end, now);
  const hours = differenceInHours(end, now) % 24;
  if (days < 0) return 'Expired';
  return `${days}d ${hours}h left`;
};

export const TestDrivePage = () => {
  const queryClient = useQueryClient();
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedback, setFeedback] = useState('');

  const testDriveQuery = useQuery({
    queryKey: ['test-drive'],
    queryFn: fetchTestDrive,
  });

  const mutation = useMutation({
    mutationFn: ({ action, feedback }: { action: 'START' | 'COMPLETE'; feedback?: string }) =>
      updateTestDrive(action, feedback),
    onSuccess: (_, variables) => {
      if (variables.action === 'START') {
        trackTestDriveStarted();
      } else if (variables.action === 'COMPLETE') {
        trackTestDriveCompleted({ feedback: variables.feedback });
      }
      void queryClient.invalidateQueries({ queryKey: ['test-drive'] });
      setShowFeedbackModal(false);
      setFeedback('');
      toast.success('Test Drive updated successfully');
    },
  });

  const snapshot = testDriveQuery.data?.testDrive;
  const status = snapshot?.testDriveStatus ?? 'NONE';
  const appointmentCount = snapshot?.appointmentCount ?? 0;
  const appointmentLimit = snapshot?.appointmentLimit ?? 50;
  const usagePercentage = (appointmentCount / appointmentLimit) * 100;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-wide text-primary font-semibold">Test Drive</p>
        <h1 className="text-h2 text-neutral-900">Beta “Test Drive” mode</h1>
        <p className="text-neutral-500 max-w-2xl">
          Spin up a time-boxed sandbox for new studios. Track when the trial ends and convert when they are ready.
        </p>
      </div>

      <div className="rounded-3xl border border-neutral-200 bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-neutral-500">Current status</p>
            <div className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-medium ${STATUS_COLORS[status] ?? STATUS_COLORS.NONE}`}>
              {STATUS_LABELS[status] ?? status}
            </div>
          </div>
          <div className="text-right text-sm text-neutral-500">
            <p>Activated: {snapshot?.testDriveActivatedAt ? format(new Date(snapshot.testDriveActivatedAt), 'PP') : '—'}</p>
            <p>Ends: {snapshot?.testDriveEndsAt ? format(new Date(snapshot.testDriveEndsAt), 'PPpp') : '—'}</p>
            {status === 'ACTIVE' && (
              <p className="text-primary font-semibold">{formatCountdown(snapshot?.testDriveEndsAt)}</p>
            )}
          </div>
        </div>

        {status === 'ACTIVE' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-600">Appointments used</span>
              <span className="font-semibold text-neutral-900">
                {appointmentCount} / {appointmentLimit}
              </span>
            </div>
            <div className="w-full bg-neutral-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  usagePercentage >= 90 ? 'bg-red-500' : usagePercentage >= 70 ? 'bg-amber-500' : 'bg-primary'
                }`}
                style={{ width: `${Math.min(usagePercentage, 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {(status === 'NONE' || status === 'EXPIRED') && (
            <button
              className="rounded-full bg-primary text-white px-6 py-2 text-sm font-semibold disabled:opacity-60"
              onClick={() => mutation.mutate({ action: 'START' })}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Starting…' : 'Start Test Drive'}
            </button>
          )}

          {status === 'ACTIVE' && (
            <button
              className="rounded-full bg-neutral-900 text-white px-6 py-2 text-sm font-semibold disabled:opacity-60"
              onClick={() => setShowFeedbackModal(true)}
              disabled={mutation.isPending}
            >
              <MessageSquare size={16} className="inline mr-2" />
              Mark as Converted
            </button>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-semibold">Limits during Test Drive</p>
        <ul className="list-disc ml-5 mt-2 space-y-1">
          <li>Up to {appointmentLimit} appointments across the studio.</li>
          <li>Access to embeds, feature flags, and marketing automations is included.</li>
          <li>Stripe onboarding is optional; convert to full account anytime.</li>
        </ul>
      </div>

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-h3 text-neutral-900">Complete Test Drive</h3>
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="p-2 rounded-full hover:bg-neutral-100 transition"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-neutral-600 mb-4">
              We'd love to hear about your experience! Your feedback helps us improve Bookly.
            </p>

            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Tell us about your experience with Bookly..."
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 placeholder:text-neutral-400 focus:ring-primary-500 focus:border-primary-500 mb-4 min-h-[120px]"
              maxLength={2000}
            />
            <div className="text-xs text-neutral-500 mb-4 text-right">{feedback.length} / 2000</div>

            <div className="flex gap-3">
              <button
                onClick={() => mutation.mutate({ action: 'COMPLETE', feedback })}
                disabled={mutation.isPending}
                className="flex-1 rounded-full bg-primary text-white px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {mutation.isPending ? 'Submitting…' : 'Submit & Complete'}
              </button>
              <button
                onClick={() => mutation.mutate({ action: 'COMPLETE' })}
                disabled={mutation.isPending}
                className="px-4 py-2 rounded-full bg-neutral-100 hover:bg-neutral-200 text-sm font-medium disabled:opacity-60"
              >
                Skip Feedback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

