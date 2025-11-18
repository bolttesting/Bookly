import { Link } from 'react-router-dom';

import { useAuthStore } from '../../stores/authStore';

export const DashboardHome = () => {
  const { business, user } = useAuthStore();

  const kpis = [
    { label: 'Bookings today', value: '12', trend: '+8%' },
    { label: 'Projected revenue', value: 'AED 4,320', trend: '+12%' },
    { label: 'No-shows', value: '1', trend: '-3%' },
    { label: 'Staff utilization', value: '82%', trend: '+5%' },
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl bg-gradient-to-br from-primary to-primary/70 text-white p-6 shadow-card">
          <p className="text-sm uppercase tracking-wide">All-in-one hub</p>
          <h2 className="text-display mt-2">
            {user?.role === 'SUPERADMIN' ? 'Bookly HQ Console' : business?.name ?? 'Your business'}, streamlined for Pilates, salons, and more.
          </h2>
          <p className="text-sm text-white/80 mt-4 max-w-md">
            Track bookings, manage staff, and deliver premium customer journeys across every device.
          </p>
          <div className="flex gap-4 mt-6">
            <Link
              to="/onboarding"
              className="px-4 py-2 rounded-full bg-white/20 hover:bg-white/30 transition"
            >
              Finish onboarding
            </Link>
            <Link to="/sessions" className="px-4 py-2 rounded-full bg-white text-primary font-medium">
              Manage sessions
            </Link>
          </div>
        </div>
        <div className="rounded-3xl bg-white shadow-card p-6">
          <p className="text-sm text-neutral-500">{user?.role === 'SUPERADMIN' ? 'Super Admin' : 'Owner'}</p>
          <h3 className="text-h2 text-neutral-900">
            {user?.firstName || 'Super'} {user?.lastName || 'Admin'}
          </h3>
          <p className="text-neutral-500 text-sm">{user?.email}</p>
          {business && (
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-500">Onboarding status</span>
                <span className="font-semibold text-primary">
                  {business.onboardingState ?? 'IN_PROGRESS'}
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: '66%' }} />
              </div>
            </div>
          )}
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-3xl shadow-card p-5">
            <p className="text-sm text-neutral-500">{kpi.label}</p>
            <p className="text-h2 text-neutral-900">{kpi.value}</p>
            <p className="text-xs text-accent">{kpi.trend} vs last week</p>
          </div>
        ))}
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        <div className="bg-white rounded-3xl shadow-card p-6">
          <h4 className="text-h3 text-neutral-900">Upcoming appointments</h4>
          <p className="text-sm text-neutral-500 mb-4">
            Real-time calendar sync keeps teams aligned.
          </p>
          <div className="space-y-4">
            {[1, 2, 3].map((slot) => (
              <div key={slot} className="rounded-2xl border border-neutral-100 p-4 flex justify-between">
                <div>
                  <p className="font-semibold text-neutral-900">Reformer Flow #{slot}</p>
                  <p className="text-sm text-neutral-500">11:00 AM · Studio A</p>
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-primary/10 text-primary">
                  Confirmed
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-3xl shadow-card p-6">
          <h4 className="text-h3 text-neutral-900">Staff pulses</h4>
          <p className="text-sm text-neutral-500 mb-4">Monitor utilization, hours, and time-off.</p>
          <div className="space-y-3">
            {['Layla · Lead Instructor', 'Omar · Therapist', 'Maya · Stylist'].map((person) => (
              <div key={person} className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-neutral-900">{person}</p>
                  <p className="text-xs text-neutral-500">Next session in 2h</p>
                </div>
                <span className="text-xs text-accent font-semibold">82% capacity</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

