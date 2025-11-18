import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  cancelPortalAppointment,
  fetchPortalAppointments,
  fetchPortalMe,
  fetchPortalPackages,
  fetchPortalReceipts,
  updatePortalProfile,
} from '../../api/portal';
import { usePortalStore } from '../../stores/portalStore';
import { RescheduleModal } from '../../components/RescheduleModal';

export const PortalDashboardPage = () => {
  const token = usePortalStore((state) => state.token);
  const customer = usePortalStore((state) => state.customer);
  const clearSession = usePortalStore((state) => state.clearSession);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [rescheduleAppointment, setRescheduleAppointment] = useState<any>(null);

  const enabled = Boolean(token);

  const meQuery = useQuery({
    queryKey: ['portal-me'],
    queryFn: () => fetchPortalMe(token!),
    enabled,
  });

  const appointmentsQuery = useQuery({
    queryKey: ['portal-appointments'],
    queryFn: () => fetchPortalAppointments(token!),
    enabled,
  });

  const packagesQuery = useQuery({
    queryKey: ['portal-packages'],
    queryFn: () => fetchPortalPackages(token!),
    enabled,
  });

  const receiptsQuery = useQuery({
    queryKey: ['portal-receipts'],
    queryFn: () => fetchPortalReceipts(token!),
    enabled,
  });

  const cancelMutation = useMutation({
    mutationFn: (appointmentId: string) => cancelPortalAppointment(token!, appointmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-appointments'] });
    },
  });

  const profileMutation = useMutation({
    mutationFn: (payload: { firstName: string; lastName: string; phone?: string }) =>
      updatePortalProfile(token!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-me'] });
    },
  });

  const upcomingAppointments = useMemo(() => appointmentsQuery.data?.appointments ?? [], [appointmentsQuery.data]);
  const packages = packagesQuery.data?.packages ?? [];

  if (!token) {
    navigate('/portal/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-primary/70">Client portal</p>
            <h1 className="text-2xl font-semibold text-neutral-900">Welcome back{customer?.firstName ? `, ${customer.firstName}` : ''}</h1>
          </div>
          <button
            className="text-sm text-rose-500 font-semibold"
            onClick={() => {
              clearSession();
              navigate('/portal/login');
            }}
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <section className="grid gap-6 md:grid-cols-3">
          <div className="rounded-3xl bg-white p-5 shadow-card">
            <p className="text-xs text-neutral-500 uppercase tracking-[0.3em]">Profile</p>
            <p className="text-lg font-semibold text-neutral-900">
              {meQuery.data?.customer?.firstName} {meQuery.data?.customer?.lastName}
            </p>
            <p className="text-sm text-neutral-500">{meQuery.data?.customer?.email}</p>
          </div>
          <div className="rounded-3xl bg-white p-5 shadow-card">
            <p className="text-xs text-neutral-500 uppercase tracking-[0.3em]">Upcoming visits</p>
            <p className="text-3xl font-semibold text-neutral-900">{upcomingAppointments.length}</p>
          </div>
          <div className="rounded-3xl bg-white p-5 shadow-card">
            <p className="text-xs text-neutral-500 uppercase tracking-[0.3em]">Active packages</p>
            <p className="text-3xl font-semibold text-neutral-900">
              {packages.filter((pkg) => pkg.status === 'ACTIVE').length}
            </p>
          </div>
        </section>
        <section className="rounded-3xl bg-white shadow-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-neutral-900">Upcoming appointments</h2>
              <p className="text-sm text-neutral-500">Reschedule or cancel directly from here.</p>
            </div>
          </div>
          <div className="space-y-3">
            {upcomingAppointments.length ? (
              upcomingAppointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex flex-col md:flex-row md:items-center md:justify-between rounded-2xl border border-neutral-100 p-4"
                >
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-neutral-400">
                      {format(new Date(appointment.startTime), 'EEE, MMM d')}
                    </p>
                    <p className="text-lg font-semibold text-neutral-900">{appointment.service?.name}</p>
                    <p className="text-sm text-neutral-500">
                      {format(new Date(appointment.startTime), 'p')} ·{' '}
                      {appointment.staff?.name ? `with ${appointment.staff.name}` : 'Any staff'}
                    </p>
                  </div>
                  <div className="mt-3 md:mt-0 flex gap-2">
                    <button
                      className="px-4 py-2 rounded-full border border-primary text-primary text-sm font-semibold hover:bg-primary/5 transition disabled:opacity-60"
                      onClick={() => setRescheduleAppointment(appointment)}
                      disabled={cancelMutation.isPending}
                    >
                      Reschedule
                    </button>
                    <button
                      className="px-4 py-2 rounded-full border border-rose-200 text-rose-500 text-sm font-semibold hover:bg-rose-50 transition disabled:opacity-60"
                      onClick={() => cancelMutation.mutate(appointment.id)}
                      disabled={cancelMutation.isPending}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-neutral-500">No upcoming appointments yet.</p>
            )}
          </div>
        </section>
        <section className="rounded-3xl bg-white shadow-card p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900">Packages & credits</h2>
            <p className="text-sm text-neutral-500">Track remaining credits and expiry dates.</p>
          </div>
          <div className="space-y-3">
            {packages.length ? (
              packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="rounded-2xl border border-neutral-100 p-4 flex flex-col gap-1 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="text-base font-semibold text-neutral-900">{pkg.package?.name}</p>
                    <p className="text-sm text-neutral-500">Credits left: {pkg.remainingCredits}</p>
                  </div>
                  <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">{pkg.status}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-neutral-500">No packages yet.</p>
            )}
          </div>
        </section>
        <section className="rounded-3xl bg-white shadow-card p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900">Update profile</h2>
            <p className="text-sm text-neutral-500">Keep your contact info current.</p>
          </div>
          <form
            className="grid md:grid-cols-3 gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              profileMutation.mutate({
                firstName: (formData.get('firstName') as string) ?? '',
                lastName: (formData.get('lastName') as string) ?? '',
                phone: (formData.get('phone') as string) ?? undefined,
              });
            }}
          >
            <input
              name="firstName"
              defaultValue={meQuery.data?.customer?.firstName ?? ''}
              className="rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
              placeholder="First name"
            />
            <input
              name="lastName"
              defaultValue={meQuery.data?.customer?.lastName ?? ''}
              className="rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
              placeholder="Last name"
            />
            <input
              name="phone"
              defaultValue={meQuery.data?.customer?.phone ?? ''}
              className="rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
              placeholder="Phone"
            />
            <div className="md:col-span-3">
              <button
                type="submit"
                className="px-5 py-3 rounded-2xl bg-neutral-900 text-white text-sm font-semibold disabled:opacity-60"
                disabled={profileMutation.isPending}
              >
                {profileMutation.isPending ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </section>

        {/* Receipts Section */}
        <section className="rounded-3xl bg-white shadow-card p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900">Payment History</h2>
            <p className="text-sm text-neutral-500">View your receipts and payment history.</p>
          </div>
          <div className="space-y-3">
            {receiptsQuery.data?.receipts?.length ? (
              receiptsQuery.data.receipts.map((receipt: any) => (
                <div
                  key={receipt.id}
                  className="rounded-2xl border border-neutral-100 p-4 flex flex-col gap-1 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="text-base font-semibold text-neutral-900">{receipt.serviceName}</p>
                    <p className="text-sm text-neutral-500">
                      {receipt.appointmentDate
                        ? format(new Date(receipt.appointmentDate), 'MMM d, yyyy')
                        : 'N/A'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-semibold text-neutral-900">
                      {receipt.currency} {((receipt.amount || 0) / 100).toFixed(2)}
                    </p>
                    <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">
                      {receipt.status}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-neutral-500">No payment history yet.</p>
            )}
          </div>
        </section>
      </main>

      {/* Reschedule Modal */}
      {rescheduleAppointment && (
        <RescheduleModal
          appointment={rescheduleAppointment}
          token={token!}
          onClose={() => setRescheduleAppointment(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['portal-appointments'] });
          }}
        />
      )}
    </div>
  );
};

