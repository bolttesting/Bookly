import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { apiRequest } from '../../api/client';

type ServiceStaffAssignment = {
  id: string;
  staffId: string;
  isPrimary: boolean;
  displayOrder: number;
  staff: {
    id: string;
    name: string;
    email?: string | null;
  };
};

type Service = {
  id: string;
  name: string;
  description?: string | null;
  durationMinutes: number;
  price: string;
  color?: string | null;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  isActive: boolean;
  capacityType: 'SINGLE' | 'MULTI';
  maxClientsPerSlot: number;
  allowAnyStaff: boolean;
  serviceStaff: ServiceStaffAssignment[];
};

type StaffOption = {
  id: string;
  name: string;
  email?: string | null;
};

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  durationMinutes: z.coerce.number().min(5).max(480),
  price: z.coerce.number().min(0),
  color: z.string().optional(),
  bufferBeforeMinutes: z.coerce.number().min(0).max(240).default(0),
  bufferAfterMinutes: z.coerce.number().min(0).max(240).default(0),
  isActive: z.boolean().default(true),
  capacityType: z.enum(['SINGLE', 'MULTI']).default('SINGLE'),
  maxClientsPerSlot: z.coerce.number().min(1).max(50).default(1),
  allowAnyStaff: z.boolean().default(true),
  staffIds: z.array(z.string()).default([]),
});

type FormValues = z.infer<typeof schema>;

export const ServicesPage = () => {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['services'],
    queryFn: () => apiRequest<{ services: Service[] }>('/services'),
  });

  const staffQuery = useQuery({
    queryKey: ['staff-mini'],
    queryFn: () => apiRequest<{ staff: StaffOption[] }>('/staff'),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      durationMinutes: 60,
      price: 250,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
      isActive: true,
      capacityType: 'SINGLE',
      maxClientsPerSlot: 1,
      allowAnyStaff: true,
      staffIds: [],
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = form;

  const { watch, setValue } = form;
  const selectedStaffIds = watch('staffIds');
  const capacityType = watch('capacityType');

  const toggleStaff = (id: string) => {
    const current = selectedStaffIds ?? [];
    if (current.includes(id)) {
      setValue(
        'staffIds',
        current.filter((staffId) => staffId !== id),
      );
    } else {
      setValue('staffIds', [...current, id]);
    }
  };

  const alignCapacityDefaults = () => {
    if (capacityType === 'SINGLE' && watch('maxClientsPerSlot') !== 1) {
      setValue('maxClientsPerSlot', 1);
    }
  };

  const createService = useMutation({
    mutationFn: (values: FormValues) =>
      apiRequest<{ service: Service }>('/services', {
        method: 'POST',
        body: JSON.stringify(values),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      reset();
    },
  });

  const deleteService = useMutation({
    mutationFn: (serviceId: string) =>
      apiRequest(`/services/${serviceId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });

  const onSubmit = (values: FormValues) => {
    return createService.mutateAsync(values);
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <section className="bg-white rounded-2xl lg:rounded-3xl shadow-card p-4 lg:p-6">
        <h2 className="text-lg lg:text-h2 text-neutral-900 mb-1">Add a service</h2>
        <p className="text-sm text-neutral-500 mb-6">
          Capture Pilates classes, spa packages, consultations, and more with custom buffers.
        </p>
        <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="md:col-span-2">
            <label className="text-sm text-neutral-600">Name</label>
            <input
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
              {...register('name')}
            />
            {errors.name && <p className="text-xs text-danger mt-1">{errors.name.message}</p>}
          </div>
          <div className="md:col-span-2">
            <label className="text-sm text-neutral-600">Description</label>
            <textarea
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
              rows={3}
              {...register('description')}
            />
          </div>
          <div>
            <label className="text-sm text-neutral-600">Duration (minutes)</label>
            <input
              type="number"
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
              {...register('durationMinutes', { valueAsNumber: true })}
            />
            {errors.durationMinutes && (
              <p className="text-xs text-danger mt-1">{errors.durationMinutes.message}</p>
            )}
          </div>
          <div>
            <label className="text-sm text-neutral-600">Price (AED)</label>
            <input
              type="number"
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
              {...register('price', { valueAsNumber: true })}
            />
            {errors.price && <p className="text-xs text-danger mt-1">{errors.price.message}</p>}
          </div>
          <div>
            <label className="text-sm text-neutral-600">Buffer before (min)</label>
            <input
              type="number"
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
              {...register('bufferBeforeMinutes', { valueAsNumber: true })}
            />
          </div>
          <div>
            <label className="text-sm text-neutral-600">Buffer after (min)</label>
            <input
              type="number"
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
              {...register('bufferAfterMinutes', { valueAsNumber: true })}
            />
          </div>
          <div>
            <label className="text-sm text-neutral-600">Theme color</label>
            <input
              type="text"
              placeholder="#8b5cf6"
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
              {...register('color')}
            />
          </div>
          <div>
            <label className="text-sm text-neutral-600">Capacity type</label>
            <select
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 bg-white text-neutral-900 focus:border-primary focus:ring-primary focus:outline-none"
              {...register('capacityType', {
                onChange: () => alignCapacityDefaults(),
              })}
            >
              <option value="SINGLE">Single (1 client per slot)</option>
              <option value="MULTI">Multi-seat</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-neutral-600">Max clients per slot</label>
            <input
              type="number"
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
              {...register('maxClientsPerSlot', {
                valueAsNumber: true,
                onBlur: () => alignCapacityDefaults(),
              })}
              disabled={capacityType === 'SINGLE'}
            />
            {errors.maxClientsPerSlot && (
              <p className="text-xs text-danger mt-1">{errors.maxClientsPerSlot.message}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" className="rounded" {...register('allowAnyStaff')} />
            <span className="text-sm text-neutral-600">Allow clients to pick “any staff”</span>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" className="rounded" {...register('isActive')} />
            <span className="text-sm text-neutral-600">Active</span>
          </div>
          <div className="md:col-span-2">
            <label className="text-sm text-neutral-600">Assign staff (optional)</label>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {staffQuery.data?.staff?.map((staff) => {
                const isChecked = selectedStaffIds?.includes(staff.id);
                return (
                  <button
                    key={staff.id}
                    type="button"
                    onClick={() => toggleStaff(staff.id)}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                      isChecked
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-neutral-200 text-neutral-700'
                    }`}
                  >
                    <span>
                      <span className="font-semibold">{staff.name}</span>
                      <span className="block text-xs text-neutral-500">{staff.email ?? 'No email'}</span>
                    </span>
                    <input type="checkbox" className="rounded" readOnly checked={isChecked} />
                  </button>
                );
              })}
              {!staffQuery.data?.staff?.length && (
                <p className="text-sm text-neutral-500">Invite staff first to assign them to services.</p>
              )}
            </div>
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={isSubmitting || createService.isPending}
              className="px-6 py-3 rounded-2xl bg-primary text-white font-semibold disabled:opacity-60"
            >
              {createService.isPending ? 'Saving...' : 'Save service'}
            </button>
          </div>
        </form>
      </section>
      <section className="bg-white rounded-2xl lg:rounded-3xl shadow-card p-4 lg:p-6">
        <h3 className="text-h3 text-neutral-900 mb-4">Service catalog</h3>
        {isLoading && <p>Loading services…</p>}
        {error instanceof Error && <p className="text-danger">{error.message}</p>}
        <div className="space-y-3">
          {data?.services?.map((service) => (
            <div
              key={service.id}
              className="flex flex-col md:flex-row md:items-center justify-between border border-neutral-100 rounded-2xl p-4"
            >
              <div>
                <p className="font-semibold text-neutral-900">{service.name}</p>
                <p className="text-sm text-neutral-500">
                  {service.durationMinutes} mins · AED {Number(service.price).toFixed(2)} ·{' '}
                  {service.capacityType === 'SINGLE'
                    ? 'Single seat'
                    : `${service.maxClientsPerSlot} seats per slot`}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {service.serviceStaff.length ? (
                    service.serviceStaff.map((assignment) => (
                      <span
                        key={assignment.id}
                        className={`rounded-full border px-3 py-1 text-xs ${
                          assignment.isPrimary
                            ? 'border-primary text-primary'
                            : 'border-neutral-200 text-neutral-600'
                        }`}
                      >
                        {assignment.staff.name}
                        {assignment.isPrimary ? ' · primary' : ''}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-neutral-500">No staff assigned</span>
                  )}
                </div>
              </div>
              <button
                className="mt-3 md:mt-0 px-4 py-2 rounded-full border border-danger text-danger disabled:opacity-60"
                onClick={() => deleteService.mutate(service.id)}
                disabled={deleteService.isPending && deleteService.variables === service.id}
              >
                {deleteService.isPending && deleteService.variables === service.id
                  ? 'Removing...'
                  : 'Remove'}
              </button>
            </div>
          ))}
          {!data?.services?.length && !isLoading && (
            <p className="text-sm text-neutral-500">No services yet. Start by adding one above.</p>
          )}
        </div>
      </section>
    </div>
  );
};

