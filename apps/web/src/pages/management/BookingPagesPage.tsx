import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { apiRequest } from '../../api/client';

type BookingPage = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
};

const schema = z.object({
  name: z.string().min(2, 'Name is required'),
  slug: z
    .string()
    .min(3)
    .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers, and dashes'),
  isActive: z.boolean().default(true),
});

type FormValues = z.infer<typeof schema>;

export const BookingPagesPage = () => {
  const queryClient = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['booking-pages'],
    queryFn: () => apiRequest<{ bookingPages: BookingPage[] }>('/booking-pages'),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { isActive: true },
  });

  const createBookingPage = useMutation({
    mutationFn: (values: FormValues) =>
      apiRequest<{ bookingPage: BookingPage }>('/booking-pages', {
        method: 'POST',
        body: JSON.stringify({ ...values, settings: { theme: 'modern' } }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-pages'] });
      reset({ isActive: true });
    },
  });

  const deleteBookingPage = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/booking-pages/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-pages'] });
    },
  });

  const onSubmit = (values: FormValues) => createBookingPage.mutateAsync(values);

  const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';
  const embedBase = API_BASE_URL.replace(/\/$/, '');

  const buildSnippet = (slug: string) => {
    const widgetId = `bookly-widget-${slug}`;
    return `<div id="${widgetId}"></div>
<script async src="${embedBase}/public/booking/${slug}/embed.js" data-bookly-target="#${widgetId}"></script>`;
  };

  const handleCopy = (slug: string) => {
    const snippet = buildSnippet(slug);
    navigator.clipboard.writeText(snippet).then(() => {
      setCopiedId(slug);
      setTimeout(() => setCopiedId((prev) => (prev === slug ? null : prev)), 2000);
    });
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <section className="bg-white rounded-2xl lg:rounded-3xl shadow-card p-4 lg:p-6">
        <h2 className="text-lg lg:text-h2 text-neutral-900 mb-1">Create a booking page</h2>
        <p className="text-sm text-neutral-500 mb-6">
          Spin up branded public pages for salons, Pilates studios, or consultants.
        </p>
        <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="text-sm text-neutral-600">Page name</label>
            <input
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
              {...register('name')}
            />
            {errors.name && <p className="text-xs text-danger mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="text-sm text-neutral-600">Slug</label>
            <div className="mt-1 flex items-center gap-2 rounded-2xl border border-neutral-200 px-4 py-3">
              <span className="text-sm text-neutral-500">bookly.app/</span>
              <input className="flex-1 outline-none text-neutral-900 placeholder:text-neutral-400" {...register('slug')} />
            </div>
            {errors.slug && <p className="text-xs text-danger mt-1">{errors.slug.message}</p>}
          </div>
          <label className="flex items-center gap-2 md:col-span-2">
            <input type="checkbox" className="rounded" {...register('isActive')} />
            <span className="text-sm text-neutral-600">Published</span>
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={isSubmitting || createBookingPage.isPending}
              className="px-6 py-3 rounded-2xl bg-primary text-white font-semibold disabled:opacity-60"
            >
              {createBookingPage.isPending ? 'Saving...' : 'Save booking page'}
            </button>
          </div>
        </form>
      </section>
      <section className="bg-white rounded-2xl lg:rounded-3xl shadow-card p-4 lg:p-6">
        <h3 className="text-h3 text-neutral-900 mb-4">Live pages</h3>
        {isLoading && <p>Loading booking pages…</p>}
        {error instanceof Error && <p className="text-danger">{error.message}</p>}
        <div className="space-y-3">
          {data?.bookingPages?.map((page) => (
            <div
              key={page.id}
              className="flex flex-col gap-4 md:flex-row md:items-center justify-between border border-neutral-100 rounded-2xl p-4"
            >
              <div className="flex-1 space-y-3">
                <p className="font-semibold text-neutral-900">{page.name}</p>
                <p className="text-sm text-neutral-500">
                  bookly.app/{page.slug} · {page.isActive ? 'Active' : 'Draft'}
                </p>
                <div className="rounded-2xl bg-neutral-50 border border-neutral-100 p-3 text-[13px] text-neutral-600 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-neutral-700 text-sm">Embed snippet</p>
                    <button
                      type="button"
                      className="text-primary text-xs font-semibold"
                      onClick={() => handleCopy(page.slug)}
                    >
                      {copiedId === page.slug ? 'Copied ✓' : 'Copy'}
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap break-words text-xs text-neutral-500">
                    {buildSnippet(page.slug)}
                  </pre>
                </div>
              </div>
              <button
                className="mt-3 md:mt-0 px-4 py-2 rounded-full border border-danger text-danger disabled:opacity-60"
                onClick={() => deleteBookingPage.mutate(page.id)}
                disabled={deleteBookingPage.isPending && deleteBookingPage.variables === page.id}
              >
                {deleteBookingPage.isPending && deleteBookingPage.variables === page.id
                  ? 'Removing...'
                  : 'Remove'}
              </button>
            </div>
          ))}
          {!data?.bookingPages?.length && !isLoading && (
            <p className="text-sm text-neutral-500">
              No booking pages yet. Create one to share with clients.
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

