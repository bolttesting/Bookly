import type { LucideIcon } from 'lucide-react';

import {
  LayoutDashboard,
  Calendar,
  BarChart3,
  Settings,
  Users,
  UserCog,
  FileText,
  Flag,
  Megaphone,
  TestTube,
  CalendarCheck,
  CalendarClock,
  Clock,
  Building2,
  LogOut,
  Menu,
  X,
  CreditCard,
} from 'lucide-react';
import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { apiRequest } from '../api/client';
import { NotificationBell } from '../components/NotificationBell';
import { useAuthStore } from '../stores/authStore';

type NavLink = {
  to: string;
  label: string;
  icon: LucideIcon;
  flag?: string;
};

export const PrivateLayout = () => {
  const { user, business, clearSession, isImpersonating, featureFlags } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const regularNavLinks: NavLink[] = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/calendar', label: 'Calendar', icon: Calendar },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/onboarding', label: 'Onboarding', icon: Settings },
    { to: '/services', label: 'Services', icon: FileText },
    { to: '/staff', label: 'Staff', icon: UserCog },
    { to: '/customers', label: 'Customers', icon: Users },
    { to: '/booking-pages', label: 'Booking Pages', icon: CalendarCheck },
    { to: '/feature-flags', label: 'Feature Flags', icon: Flag },
    { to: '/marketing/automation', label: 'Marketing', icon: Megaphone, flag: 'MARKETING_AUTOMATION' },
    { to: '/test-drive', label: 'Test Drive', icon: TestTube },
    { to: '/settings/calendars', label: 'Calendars', icon: CalendarClock },
    { to: '/settings/billing', label: 'Billing', icon: CreditCard },
    { to: '/sessions', label: 'Sessions', icon: Clock },
  ];

  const isSuperAdmin = user?.role === 'SUPERADMIN';

  const handleLogout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error(error);
    } finally {
      clearSession();
    }
  };

  const handleReturnToHQ = () => {
    // Clear impersonation session and redirect to login
    // Super-admin can log back in and navigate to /super-admin
    clearSession();
    navigate('/login', { state: { returnTo: '/super-admin' } });
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`w-64 bg-white border-r border-neutral-200 flex flex-col fixed h-screen z-50 transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        {/* Logo/Brand */}
        <div className="px-4 lg:px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-primary">Bookly</h2>
          <button
            className="lg:hidden p-2 hover:bg-neutral-100 rounded-lg"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 lg:px-4 py-4 overflow-y-auto">
          <div className="space-y-1">
            {regularNavLinks
              .filter((link) => !link.flag || featureFlags?.[link.flag])
              .map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname.startsWith(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm lg:text-base font-medium transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                  }`}
                >
                  <Icon size={20} className="lg:w-[22px] lg:h-[22px]" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
            {isSuperAdmin && (
              <>
                <div className="h-px bg-neutral-200 my-2" />
                <Link
                  to="/super-admin"
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm lg:text-base font-medium transition-colors ${
                    location.pathname.startsWith('/super-admin')
                      ? 'bg-primary text-white'
                      : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                  }`}
                >
                  <Building2 size={20} className="lg:w-[22px] lg:h-[22px]" />
                  <span>Super Admin</span>
                </Link>
              </>
            )}
          </div>
        </nav>

        {/* User Section */}
        <div className="px-2 lg:px-4 py-4 border-t border-neutral-200">
          <div className="flex items-center gap-2 lg:gap-3 px-2 lg:px-3 py-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-primary">
                {user?.firstName?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm lg:text-base font-medium text-neutral-900 truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs lg:text-sm text-neutral-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm lg:text-base font-medium text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
            onClick={() => void handleLogout()}
          >
            <LogOut size={20} className="lg:w-[22px] lg:h-[22px]" />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:ml-64">
        {isImpersonating && business && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 lg:px-6 py-2 lg:py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 lg:gap-3 flex-1 min-w-0">
              <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
              <p className="text-xs lg:text-sm font-medium text-amber-900 truncate">
                You're browsing as <span className="font-semibold">{business.name}</span>
              </p>
            </div>
            <button
              className="px-3 lg:px-4 py-1.5 lg:py-2 text-xs lg:text-sm rounded-full bg-amber-600 text-white hover:bg-amber-700 font-semibold transition flex-shrink-0 ml-2"
              onClick={() => void handleReturnToHQ()}
            >
              Return to HQ
            </button>
          </div>
        )}
        <header className="border-b border-neutral-200 px-4 lg:px-6 py-2 lg:py-3 flex items-center justify-between bg-white relative z-30">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              className="lg:hidden p-2.5 hover:bg-neutral-100 active:bg-neutral-200 rounded-lg flex-shrink-0 bg-white border-2 border-neutral-300 shadow-sm"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              type="button"
            >
              <Menu size={24} className="text-neutral-900" strokeWidth={2.5} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-xs lg:text-base text-neutral-500">Welcome back</p>
              <h1 className="text-lg lg:text-h2 font-semibold text-neutral-900 truncate">
                {business?.name ?? (isSuperAdmin ? 'Bookly HQ Console' : 'Bookly Dashboard')}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 lg:gap-4 flex-shrink-0">
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1 bg-neutral-50 overflow-y-auto">
          <div className="max-w-full lg:max-w-[95%] mx-auto p-3 lg:p-4">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

