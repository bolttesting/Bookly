import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { apiRequest } from '../../api/client';

type ServiceAssignment = {
  id: string;
  serviceId: string;
  isPrimary: boolean;
  displayOrder: number;
  service: {
    id: string;
    name: string;
    capacityType: 'SINGLE' | 'MULTI';
    maxClientsPerSlot: number;
  };
};

type AvailabilityBlock = {
  id: string;
  staffId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isOverride: boolean;
  date?: string | null;
};

type StaffMember = {
  id: string;
  name: string;
  email?: string | null;
  role: 'OWNER' | 'TEAM' | 'ADMIN';
  isActive: boolean;
  availability: AvailabilityBlock[];
  serviceAssignments: ServiceAssignment[];
};

const staffSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email().optional(),
  role: z.enum(['OWNER', 'TEAM', 'ADMIN']).default('TEAM'),
  isActive: z.boolean().default(true),
});

type StaffFormValues = z.infer<typeof staffSchema>;

const availabilitySchema = z.object({
  staffId: z.string().min(1, 'Select a staff member'),
  dayOfWeek: z.coerce.number().min(0).max(6),
  startTime: z.string().min(1, 'Start time required'),
  endTime: z.string().min(1, 'End time required'),
  isOverride: z.boolean().default(false),
  date: z.string().optional(),
});

type AvailabilityFormValues = z.infer<typeof availabilitySchema>;

const dayOptions = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const StaffPage = () => {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['staff'],
    queryFn: () => apiRequest<{ staff: StaffMember[] }>('/staff'),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StaffFormValues>({
    resolver: zodResolver(staffSchema),
    defaultValues: { role: 'TEAM', isActive: true },
  });

  const availabilityForm = useForm<AvailabilityFormValues>({
    resolver: zodResolver(availabilitySchema),
    defaultValues: {
      staffId: '',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '17:00',
      isOverride: false,
      date: '',
    },
  });

  const availabilityWatchOverride = availabilityForm.watch('isOverride');

  useEffect(() => {
    const existing = availabilityForm.getValues('staffId');
    if (!existing && data?.staff?.length) {
      availabilityForm.setValue('staffId', data.staff[0].id);
    }
  }, [availabilityForm, data?.staff]);

  const createStaff = useMutation({
    mutationFn: (values: StaffFormValues) =>
      apiRequest<{ staff: StaffMember }>('/staff', {
        method: 'POST',
        body: JSON.stringify(values),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      reset({ role: 'TEAM', isActive: true });
    },
  });

  const deleteStaff = useMutation({
    mutationFn: (staffId: string) =>
      apiRequest(`/staff/${staffId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });

  const createAvailability = useMutation({
    mutationFn: (values: AvailabilityFormValues) =>
      apiRequest<{ availability: AvailabilityBlock }>('/availability', {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          date: values.date ? new Date(values.date).toISOString() : undefined,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      availabilityForm.reset((current) => ({
        ...current,
        startTime: '09:00',
        endTime: '17:00',
        date: '',
      }));
    },
  });

  const deleteAvailability = useMutation({
    mutationFn: (availabilityId: string) =>
      apiRequest(`/availability/${availabilityId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });

  const onSubmit = (values: StaffFormValues) => createStaff.mutateAsync(values);
  const onAvailabilitySubmit = (values: AvailabilityFormValues) => createAvailability.mutateAsync(values);

  const formatAvailabilityLabel = (block: AvailabilityBlock) => {
    const dayLabel = block.isOverride
      ? `Override · ${block.date ? new Date(block.date).toLocaleDateString() : ''}`
      : dayOptions[block.dayOfWeek];
    return `${dayLabel}: ${block.startTime} → ${block.endTime}`;
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <section className="bg-white rounded-2xl lg:rounded-3xl shadow-card p-4 lg:p-6">
        <h2 className="text-lg lg:text-h2 text-neutral-900 mb-1">Invite staff</h2>
        <p className="text-sm text-neutral-500 mb-6">
          Capture instructors, stylists, therapists, and admins with the right access.
        </p>
        <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="text-sm text-neutral-600">Name</label>
            <input
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
              {...register('name')}
            />
            {errors.name && <p className="text-xs text-danger mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="text-sm text-neutral-600">Email</label>
            <input
              type="email"
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
              {...register('email')}
            />
            {errors.email && <p className="text-xs text-danger mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="text-sm text-neutral-600">Role</label>
            <select
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 bg-white text-neutral-900 focus:border-primary focus:ring-primary focus:outline-none"
              {...register('role')}
            >
              <option value="OWNER">Owner</option>
              <option value="TEAM">Team</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" className="rounded" {...register('isActive')} />
            <span className="text-sm text-neutral-600">Active</span>
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={isSubmitting || createStaff.isPending}
              className="px-6 py-3 rounded-2xl bg-primary text-white font-semibold disabled:opacity-60"
            >
              {createStaff.isPending ? 'Saving...' : 'Save staff member'}
            </button>
          </div>
        </form>
      </section>
      <section className="bg-white rounded-2xl lg:rounded-3xl shadow-card p-4 lg:p-6">
        <h3 className="text-h3 text-neutral-900 mb-4">Team roster</h3>
        {isLoading && <p>Loading staff…</p>}
        {error instanceof Error && <p className="text-danger">{error.message}</p>}
        <div className="space-y-3">
          {data?.staff?.map((member) => (
            <div
              key={member.id}
              className="flex flex-col md:flex-row md:items-center justify-between border border-neutral-100 rounded-2xl p-4"
            >
              <div className="flex-1">
                <p className="font-semibold text-neutral-900">{member.name}</p>
                <p className="text-sm text-neutral-500">
                  {member.role} · {member.email ?? 'No email'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {member.serviceAssignments.length ? (
                    member.serviceAssignments.map((assignment) => (
                      <span
                        key={assignment.id}
                        className={`rounded-full border px-3 py-1 text-xs ${
                          assignment.isPrimary
                            ? 'border-primary text-primary'
                            : 'border-neutral-200 text-neutral-600'
                        }`}
                      >
                        {assignment.service.name}
                        {assignment.service.capacityType === 'MULTI'
                          ? ` · ${assignment.service.maxClientsPerSlot} seats`
                          : ''}
                        {assignment.isPrimary ? ' · primary' : ''}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-neutral-500">No services assigned</span>
                  )}
                </div>
                <div className="mt-4 space-y-2">
                  {member.availability.length ? (
                    member.availability.map((block) => (
                      <div
                        key={block.id}
                        className="flex items-center justify-between rounded-2xl bg-neutral-50 px-3 py-2 text-xs text-neutral-700"
                      >
                        <span>{formatAvailabilityLabel(block)}</span>
                        <button
                          className="text-danger"
                          onClick={() => deleteAvailability.mutate(block.id)}
                          disabled={
                            deleteAvailability.isPending && deleteAvailability.variables === block.id
                          }
                        >
                          ×
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-neutral-500">No availability set</p>
                  )}
                </div>
              </div>
              <div className="mt-3 md:mt-0 flex items-center gap-2">
                <button
                  className="px-4 py-2 rounded-full border border-danger text-danger disabled:opacity-60"
                  onClick={() => deleteStaff.mutate(member.id)}
                  disabled={deleteStaff.isPending && deleteStaff.variables === member.id}
                >
                  {deleteStaff.isPending && deleteStaff.variables === member.id
                    ? 'Removing...'
                    : 'Remove'}
                </button>
              </div>
            </div>
          ))}
          {!data?.staff?.length && !isLoading && (
            <p className="text-sm text-neutral-500">No staff yet. Invite your first teammate above.</p>
          )}
        </div>
      </section>
      <section className="bg-white rounded-2xl lg:rounded-3xl shadow-card p-4 lg:p-6">
        <h3 className="text-h3 text-neutral-900 mb-1">Add availability block</h3>
        <p className="text-sm text-neutral-500 mb-6">
          Define weekly templates or specific overrides for staff schedules.
        </p>
        <form
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
          onSubmit={availabilityForm.handleSubmit(onAvailabilitySubmit)}
        >
          <div>
            <label className="text-sm text-neutral-600">Staff member</label>
            <select
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 bg-white text-neutral-900 focus:border-primary focus:ring-primary focus:outline-none"
              {...availabilityForm.register('staffId')}
            >
              {data?.staff?.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name}
                </option>
              ))}
            </select>
            {availabilityForm.formState.errors.staffId && (
              <p className="text-xs text-danger mt-1">
                {availabilityForm.formState.errors.staffId.message}
              </p>
            )}
          </div>
          <div>
            <label className="text-sm text-neutral-600">Day of week</label>
            <select
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 bg-white text-neutral-900 focus:border-primary focus:ring-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              {...availabilityForm.register('dayOfWeek', { valueAsNumber: true })}
              disabled={availabilityWatchOverride}
            >
              {dayOptions.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-neutral-600">Start time</label>
            <input
              type="time"
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
              {...availabilityForm.register('startTime')}
            />
          </div>
          <div>
            <label className="text-sm text-neutral-600">End time</label>
            <input
              type="time"
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
              {...availabilityForm.register('endTime')}
            />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" className="rounded" {...availabilityForm.register('isOverride')} />
            <span className="text-sm text-neutral-600">Override for a specific date</span>
          </div>
          {availabilityWatchOverride && (
            <div>
              <label className="text-sm text-neutral-600">Override date</label>
              <input
                type="date"
                className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
                {...availabilityForm.register('date')}
              />
            </div>
          )}
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={availabilityForm.formState.isSubmitting || createAvailability.isPending}
              className="px-6 py-3 rounded-2xl bg-primary text-white font-semibold disabled:opacity-60"
            >
              {createAvailability.isPending ? 'Saving...' : 'Save block'}
            </button>
            {availabilityForm.formState.errors.date && (
              <p className="text-xs text-danger mt-2">
                {availabilityForm.formState.errors.date.message}
              </p>
            )}
          </div>
        </form>
      </section>
    </div>
  );
};

