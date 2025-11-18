import { AnimatePresence } from 'framer-motion';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { RequireAuth } from './components/RequireAuth';
import { PageTransition } from './components/PageTransition';
import { PrivateLayout } from './layouts/PrivateLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { DashboardHome } from './pages/dashboard/DashboardHome';
import { OnboardingWizard } from './pages/onboarding/OnboardingWizard';
import { SessionList } from './pages/sessions/SessionList';
import { BookingPagesPage } from './pages/management/BookingPagesPage';
import { CustomersPage } from './pages/management/CustomersPage';
import { ServicesPage } from './pages/management/ServicesPage';
import { StaffPage } from './pages/management/StaffPage';
import { CalendarPage } from './pages/calendar/CalendarPage';
import { BookingPage, BookingEmbedPage } from './pages/public/BookingPage';
import { HomePage } from './pages/marketing/HomePage';
import { PortalLoginPage } from './pages/portal/PortalLoginPage';
import { PortalVerifyPage } from './pages/portal/PortalVerifyPage';
import { PortalDashboardPage } from './pages/portal/PortalDashboardPage';
import { PortalGuard } from './components/PortalGuard';
import { SuperAdminDashboard } from './pages/admin/SuperAdminDashboard';
import { FeatureFlagsPage } from './pages/settings/FeatureFlagsPage';
import { MarketingAutomationPage } from './pages/marketing/MarketingAutomationPage';
import { TestDrivePage } from './pages/settings/TestDrivePage';
import { CalendarConnectionsPage } from './pages/settings/CalendarConnectionsPage';
import { BillingPage } from './pages/settings/BillingPage';
import { AnalyticsPage } from './pages/analytics/AnalyticsPage';
import { FeatureGate } from './components/FeatureGate';

function App() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><HomePage /></PageTransition>} />
        <Route path="/login" element={<PageTransition><LoginPage /></PageTransition>} />
        <Route path="/register" element={<PageTransition><RegisterPage /></PageTransition>} />
        <Route path="/forgot-password" element={<PageTransition><ForgotPasswordPage /></PageTransition>} />
        <Route path="/reset-password" element={<PageTransition><ResetPasswordPage /></PageTransition>} />

        <Route path="/booking/:slug" element={<PageTransition><BookingPage /></PageTransition>} />
        <Route path="/embed/:slug" element={<BookingEmbedPage />} />
        <Route path="/portal/login" element={<PortalLoginPage />} />
        <Route path="/portal/verify" element={<PortalVerifyPage />} />
        <Route
          path="/portal"
          element={
            <PortalGuard>
              <PortalDashboardPage />
            </PortalGuard>
          }
        />

        <Route element={<RequireAuth />}>
          <Route element={<PrivateLayout />}>
            <Route path="/dashboard" element={<PageTransition><DashboardHome /></PageTransition>} />
            <Route path="/calendar" element={<PageTransition><CalendarPage /></PageTransition>} />
            <Route path="/onboarding" element={<PageTransition><OnboardingWizard /></PageTransition>} />
            <Route path="/sessions" element={<PageTransition><SessionList /></PageTransition>} />
            <Route path="/services" element={<PageTransition><ServicesPage /></PageTransition>} />
            <Route path="/staff" element={<PageTransition><StaffPage /></PageTransition>} />
            <Route path="/customers" element={<PageTransition><CustomersPage /></PageTransition>} />
            <Route path="/booking-pages" element={<PageTransition><BookingPagesPage /></PageTransition>} />
            <Route path="/feature-flags" element={<PageTransition><FeatureFlagsPage /></PageTransition>} />
            <Route
              path="/marketing/automation"
              element={
                <PageTransition>
                  <FeatureGate flag="MARKETING_AUTOMATION">
                    <MarketingAutomationPage />
                  </FeatureGate>
                </PageTransition>
              }
            />
            <Route path="/test-drive" element={<PageTransition><TestDrivePage /></PageTransition>} />
            <Route path="/settings/calendars" element={<PageTransition><CalendarConnectionsPage /></PageTransition>} />
            <Route path="/settings/billing" element={<PageTransition><BillingPage /></PageTransition>} />
            <Route path="/analytics" element={<PageTransition><AnalyticsPage /></PageTransition>} />
            <Route path="/super-admin" element={<PageTransition><SuperAdminDashboard /></PageTransition>} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default App;

