import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { apiRequest } from '../../api/client';

type Customer = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  marketingConsent: boolean;
};

const schema = z.object({
  firstName: z.string().min(1, 'First name required'),
  lastName: z.string().min(1, 'Last name required'),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  notes: z.string().max(2000).optional(),
  marketingConsent: z.boolean().default(false),
});

type FormValues = z.infer<typeof schema>;

export const CustomersPage = () => {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['customers'],
    queryFn: () => apiRequest<{ customers: Customer[] }>('/customers'),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { marketingConsent: false },
  });

  const createCustomer = useMutation({
    mutationFn: (values: FormValues) =>
      apiRequest<{ customer: Customer }>('/customers', {
        method: 'POST',
        body: JSON.stringify(values),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      reset({ marketingConsent: false });
    },
  });

  const deleteCustomer = useMutation({
    mutationFn: (customerId: string) =>
      apiRequest(`/customers/${customerId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const onSubmit = (values: FormValues) => createCustomer.mutateAsync(values);

  return (
    <div className="space-y-4 lg:space-y-6">
      <section className="bg-white rounded-2xl lg:rounded-3xl shadow-card p-4 lg:p-6">
        <h2 className="text-lg lg:text-h2 text-neutral-900 mb-1">Add a customer</h2>
        <p className="text-xs lg:text-sm text-neutral-500 mb-4 lg:mb-6">
          Store Pilates members, salon clients, or wellness patients in one secure place.
        </p>
        <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="text-sm text-neutral-600">First name</label>
            <input
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
              {...register('firstName')}
            />
            {errors.firstName && (
              <p className="text-xs text-danger mt-1">{errors.firstName.message}</p>
            )}
          </div>
          <div>
            <label className="text-sm text-neutral-600">Last name</label>
            <input
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
              {...register('lastName')}
            />
            {errors.lastName && (
              <p className="text-xs text-danger mt-1">{errors.lastName.message}</p>
            )}
          </div>
          <div>
            <label className="text-sm text-neutral-600">Email</label>
            <input
              type="email"
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
              {...register('email')}
            />
          </div>
          <div>
            <label className="text-sm text-neutral-600">Phone</label>
            <input
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
              {...register('phone')}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm text-neutral-600">Notes</label>
            <textarea
              rows={3}
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
              {...register('notes')}
            />
          </div>
          <label className="flex items-center gap-2 md:col-span-2">
            <input type="checkbox" className="rounded" {...register('marketingConsent')} />
            <span className="text-sm text-neutral-600">
              Customer opted into SMS/email reminders
            </span>
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={isSubmitting || createCustomer.isPending}
              className="px-6 py-3 rounded-2xl bg-primary text-white font-semibold disabled:opacity-60"
            >
              {createCustomer.isPending ? 'Saving...' : 'Save customer'}
            </button>
          </div>
        </form>
      </section>
      <section className="bg-white rounded-2xl lg:rounded-3xl shadow-card p-4 lg:p-6">
        <h3 className="text-h3 text-neutral-900 mb-4">Customer list</h3>
        {isLoading && <p>Loading customers…</p>}
        {error instanceof Error && <p className="text-danger">{error.message}</p>}
        <div className="space-y-3">
          {data?.customers?.map((customer) => (
            <div
              key={customer.id}
              className="flex flex-col md:flex-row md:items-center justify-between border border-neutral-100 rounded-2xl p-4"
            >
              <div>
                <p className="font-semibold text-neutral-900">
                  {customer.firstName} {customer.lastName}
                </p>
                <p className="text-sm text-neutral-500">
                  {customer.email ?? 'No email'} · {customer.phone ?? 'No phone'}
                </p>
              </div>
              <button
                className="mt-3 md:mt-0 px-4 py-2 rounded-full border border-danger text-danger disabled:opacity-60"
                onClick={() => deleteCustomer.mutate(customer.id)}
                disabled={deleteCustomer.isPending && deleteCustomer.variables === customer.id}
              >
                {deleteCustomer.isPending && deleteCustomer.variables === customer.id
                  ? 'Removing...'
                  : 'Remove'}
              </button>
            </div>
          ))}
          {!data?.customers?.length && !isLoading && (
            <p className="text-sm text-neutral-500">
              No customers yet. Add your first client or import later.
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

