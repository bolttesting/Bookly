import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useState } from 'react';

import {
  createCampaign,
  fetchCampaigns,
  updateCampaignStatus,
  type MarketingCampaign,
} from '../../api/marketing';

const triggerOptions = [
  { value: 'MANUAL', label: 'Manual send' },
  { value: 'NEW_CUSTOMER', label: 'New customer joins' },
  { value: 'CLASS_BOOKED', label: 'Class booked' },
];

const channelOptions = [
  { value: 'EMAIL', label: 'Email' },
  { value: 'SMS', label: 'SMS' },
];

type DraftStep = {
  delayMinutes: number;
  channel: string;
  subject?: string;
  body: string;
};

export const MarketingAutomationPage = () => {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState({
    name: '',
    description: '',
    triggerType: 'NEW_CUSTOMER',
    steps: [
      {
        delayMinutes: 0,
        channel: 'EMAIL',
        subject: 'Welcome to our studio',
        body: 'Thanks for joining us! Here is how to get started.',
      } satisfies DraftStep,
    ],
  });

  const campaignsQuery = useQuery({
    queryKey: ['marketing', 'campaigns'],
    queryFn: fetchCampaigns,
  });

  const createMutation = useMutation({
    mutationFn: createCampaign,
    onSuccess: () => {
      setDraft({
        name: '',
        description: '',
        triggerType: 'NEW_CUSTOMER',
        steps: [
          {
            delayMinutes: 0,
            channel: 'EMAIL',
            subject: 'Welcome to our studio',
            body: 'Thanks for joining us! Here is how to get started.',
          },
        ],
      });
      void queryClient.invalidateQueries({ queryKey: ['marketing', 'campaigns'] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateCampaignStatus(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['marketing', 'campaigns'] });
    },
  });

  const campaigns = campaignsQuery.data?.campaigns ?? [];

  const updateDraftStep = (index: number, changes: Partial<DraftStep>) => {
    setDraft((prev) => ({
      ...prev,
      steps: prev.steps.map((step, idx) => (idx === index ? { ...step, ...changes } : step)),
    }));
  };

  const addStep = () => {
    setDraft((prev) => ({
      ...prev,
      steps: [
        ...prev.steps,
        {
          delayMinutes: 60,
          channel: 'EMAIL',
          subject: 'Another touchpoint',
          body: 'Share more value or reminders here.',
        },
      ],
    }));
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim() || !draft.steps.length) {
      return;
    }
    createMutation.mutate({
      name: draft.name.trim(),
      description: draft.description,
      triggerType: draft.triggerType,
      steps: draft.steps,
    });
  };

  const renderStatusBadge = (campaign: MarketingCampaign) => {
    const color =
      campaign.status === 'ACTIVE'
        ? 'bg-emerald-50 text-emerald-700'
        : campaign.status === 'PAUSED'
          ? 'bg-amber-50 text-amber-700'
          : 'bg-neutral-100 text-neutral-600';

    return (
      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${color}`}>
        {campaign.status}
      </span>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-wide text-primary font-semibold">Marketing automation</p>
        <h1 className="text-h2 text-neutral-900">Build simple drips</h1>
        <p className="text-neutral-500 max-w-2xl">
          Trigger welcome emails or reminder nudges automatically. We only send messages to customers who opted in.
        </p>
      </div>

      <form onSubmit={handleCreate} className="rounded-3xl border border-neutral-200 bg-white p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm text-neutral-500">Campaign name</label>
            <input
              className="mt-1 w-full rounded-2xl border px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
              value={draft.name}
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Welcome drip"
            />
          </div>
          <div>
            <label className="text-sm text-neutral-500">Trigger</label>
            <select
              className="mt-1 w-full rounded-2xl border px-4 py-3 bg-white text-neutral-900 focus:border-primary focus:ring-primary focus:outline-none"
              value={draft.triggerType}
              onChange={(e) => setDraft((prev) => ({ ...prev, triggerType: e.target.value }))}
            >
              {triggerOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="text-sm text-neutral-500">Description</label>
          <textarea
            className="mt-1 w-full rounded-2xl border px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
            rows={2}
            value={draft.description}
            onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Send a welcome email immediately, then a tips email 24 hours later."
          />
        </div>

        <div className="space-y-4">
          <p className="text-sm font-medium text-neutral-900">Steps</p>
          {draft.steps.map((step, idx) => (
            <div key={idx} className="rounded-2xl border border-neutral-200 p-4 space-y-3">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-xs text-neutral-500">Delay (minutes)</label>
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-full rounded-2xl border px-3 py-2 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
                    value={step.delayMinutes}
                    onChange={(e) =>
                      updateDraftStep(idx, { delayMinutes: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-500">Channel</label>
                  <select
                    className="mt-1 w-full rounded-2xl border px-3 py-2 bg-white text-neutral-900 focus:border-primary focus:ring-primary focus:outline-none"
                    value={step.channel}
                    onChange={(e) => updateDraftStep(idx, { channel: e.target.value })}
                  >
                    {channelOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-neutral-500">Subject (optional)</label>
                  <input
                    className="mt-1 w-full rounded-2xl border px-3 py-2 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
                    value={step.subject ?? ''}
                    onChange={(e) => updateDraftStep(idx, { subject: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-neutral-500">Message</label>
                <textarea
                  className="mt-1 w-full rounded-2xl border px-3 py-2 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
                  rows={3}
                  value={step.body}
                  onChange={(e) => updateDraftStep(idx, { body: e.target.value })}
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            className="text-sm text-primary font-medium"
            onClick={addStep}
            disabled={createMutation.isPending}
          >
            + Add another touchpoint
          </button>
        </div>

        <button
          type="submit"
          className="rounded-full bg-primary text-white px-6 py-3 text-sm font-semibold disabled:opacity-60"
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? 'Creating…' : 'Create campaign'}
        </button>
      </form>

      <div className="space-y-4">
        <h2 className="text-h3 text-neutral-900">Existing campaigns</h2>
        {campaignsQuery.isLoading && <p className="text-neutral-500">Loading campaigns…</p>}
        {!campaignsQuery.isLoading && !campaigns.length && (
          <p className="text-neutral-500 text-sm">No campaigns yet. Create your first automation above.</p>
        )}

        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="rounded-3xl border border-neutral-200 bg-white p-6 space-y-4">
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <div>
                  <p className="text-h4 text-neutral-900">{campaign.name}</p>
                  <p className="text-sm text-neutral-500">
                    {campaign.description || 'No description'} · Trigger: {campaign.triggerType}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {renderStatusBadge(campaign)}
                  <select
                    className="rounded-full border border-neutral-200 px-3 py-1 text-sm"
                    value={campaign.status}
                    onChange={(e) =>
                      statusMutation.mutate({ id: campaign.id, status: e.target.value })
                    }
                    disabled={statusMutation.isPending}
                  >
                    {['DRAFT', 'ACTIVE', 'PAUSED'].map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-3">
                {campaign.steps.map((step) => (
                  <div
                    key={step.id}
                    className="rounded-2xl border border-neutral-100 bg-neutral-50 px-4 py-3 text-sm text-neutral-700"
                  >
                    <div className="flex items-center justify-between text-xs text-neutral-500">
                      <span>
                        Delay {step.delayMinutes}m · {step.channel}
                      </span>
                      <span>{format(new Date(campaign.createdAt), 'MMM d, yyyy')}</span>
                    </div>
                    {step.subject && <p className="font-medium text-neutral-900 mt-1">{step.subject}</p>}
                    <p>{step.body}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

