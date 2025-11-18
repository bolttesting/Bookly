import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useTheme } from '../../context/ThemeContext';

const metrics = [
  { label: 'Bookings coordinated each month', value: '18K+' },
  { label: 'Service brands launched on Bookly', value: '320+' },
  { label: 'Average time saved per team member', value: '6 hrs/wk' },
];

const automations = [
  {
    title: 'Smart reminders',
    description: 'Layer email, SMS, and push nudges triggered by audience, service, or team member.',
  },
  {
    title: 'Capacity intelligence',
    description: 'Auto open or block inventory when utilization crosses thresholds you define.',
  },
  {
    title: 'Billing safeguards',
    description: 'Hold cards on file, retry failed payments, and sync payouts automatically.',
  },
];

const features = [
  {
    title: 'Scheduling that adapts',
    description:
      'Layer appointments, classes, and resources in one visual timeline with instant conflict detection.',
    stat: '82% avg. utilization',
    icon: 'calendar-days',
    bullets: ['Stack classes, privates, and rentals in one view.', 'Flag overlaps before clients ever notice.'],
  },
  {
    title: 'Payments & packages',
    description:
      'Sell passes, track credits, and reconcile payouts without jumping between tools.',
    stat: '36% faster payouts',
    icon: 'credit-card',
    bullets: ['Cards on file, ACH, and terminals in sync.', 'Packages auto-replenish when credit is low.'],
  },
  {
    title: 'Client experiences',
    description:
      'Client portal, branded booking links, and automated reminders that work across industries.',
    stat: '4.9★ portal rating',
    icon: 'sparkles',
    bullets: ['Magic links for instant, secure access.', 'Dynamic forms capture preferences and consents.'],
  },
  {
    title: 'Team operations',
    description:
      'Role-based workspaces, activity logs, and analytics to keep owners, managers, and staff aligned.',
    stat: '5 hrs saved / wk',
    icon: 'users',
    bullets: ['Permission sets for HQ, managers, and staff.', 'Live audit trails keep everyone accountable.'],
  },
];

const journeySteps = [
  {
    title: 'Launch in under an hour',
    detail: 'Import services, resources, and staff with guided templates. No complex setup wizard.',
    accent: '01',
  },
  {
    title: 'Automate the busywork',
    detail: 'Connect booking pages, payment rails, and reminders so clients always know what’s next.',
    accent: '02',
  },
  {
    title: 'Scale with insights',
    detail: 'Dashboards surface utilization, retention, and revenue pacing for every location.',
    accent: '03',
  },
];

const industries = [
  'Studios & gyms',
  'Salons & spas',
  'Medical & wellness',
  'Agencies & consultancies',
  'Communities & coworking',
];

const industriesDetails = [
  {
    title: 'Studios & gyms',
    description: 'Manage class packs, reformer resources, and multi-instructor schedules in one view.',
  },
  {
    title: 'Salons & spas',
    description: 'Offer tiered service menus, room assignments, and automated retail upsells.',
  },
  {
    title: 'Medical & wellness',
    description: 'HIPAA-ready messaging, recurring treatment plans, and practitioner availability.',
  },
  {
    title: 'Agencies & consultancies',
    description: 'Run strategy sessions, retainer packages, and cross-office booking links.',
  },
  {
    title: 'Communities & coworking',
    description: 'Reserve rooms, track credits, and send instant notifications to members.',
  },
];

const clientLogos = ['Northside Wellness', 'Align Collective', 'Maven Ops', 'Pulse Labs', 'Bridge Studio', 'Forma Agency'];

const testimonials = [
  {
    name: 'Amelia Rhodes',
    role: 'Director, Align Collective',
    quote:
      'Bookly replaced four tools for booking, billing, and messaging. Our team finally works from the same source of truth.',
  },
  {
    name: 'Dev Patel',
    role: 'Founder, Maven Operations',
    quote:
      'Dashboard insights tell me exactly where capacity sits across locations so I can grow without guesswork.',
  },
  {
    name: 'Lucia Moreno',
    role: 'CX Lead, Northside Wellness',
    quote:
      'Clients love the portal. They manage their memberships and pay online, while our staff keeps focus on service.',
  },
];

const sectionVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

export const HomePage = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const [navOpen, setNavOpen] = useState(false);

  const palette = isDark
    ? {
        baseBackground: 'bg-[linear-gradient(135deg,#020617,#0b1120_45%,#111827_100%)] text-white',
        textPrimary: 'text-white',
        textSecondary: 'text-white/80',
        textMuted: 'text-white/70',
        textSubtle: 'text-white/60',
        textFaint: 'text-white/40',
        navColor: 'text-white/80',
        navHover: 'hover:text-white',
        chipText: 'text-white/70',
        buttonPrimary: 'bg-white text-neutral-900',
        buttonSecondary: 'border-white/40 text-white hover:border-white',
        cardStrong: 'bg-neutral-900/70',
        cardSoft: 'bg-white/5',
        borderSoft: 'border-white/10',
        borderSofter: 'border-white/15',
        statCardBg: 'bg-white/5',
        statCardBorder: 'border-white/10',
        statShadow: 'shadow-[0_40px_120px_rgba(0,0,0,0.45)]',
        automationBg: 'bg-neutral-900/60',
        automationShadow: 'shadow-[0_15px_40px_rgba(0,0,0,0.45)]',
        gradientCard: 'bg-gradient-to-br from-white/10 to-transparent',
        cardShadow: 'shadow-[0_40px_120px_rgba(0,0,0,0.45)]',
        ctaGradient: 'bg-gradient-to-r from-primary/80 to-accent/80 text-white',
        ctaBorder: 'border-white/10',
        ctaBulletColor: 'bg-white',
        navToggleTrack: 'bg-indigo-500/70',
      }
    : {
        baseBackground:
          'bg-[radial-gradient(circle_at_top,#fffdf6,transparent_45%),linear-gradient(135deg,#fefefe,#f4f7ff_60%,#e6f5ff)] text-slate-900',
        textPrimary: 'text-slate-900',
        textSecondary: 'text-slate-600',
        textMuted: 'text-slate-500',
        textSubtle: 'text-slate-400',
        textFaint: 'text-slate-400/80',
        navColor: 'text-slate-700',
        navHover: 'hover:text-slate-900',
        chipText: 'text-slate-500',
        buttonPrimary: 'bg-slate-900 text-white',
        buttonSecondary: 'border-slate-400 text-slate-700 hover:border-slate-600',
        cardStrong: 'bg-white',
        cardSoft: 'bg-slate-50',
        borderSoft: 'border-slate-200',
        borderSofter: 'border-slate-200/80',
        statCardBg: 'bg-white',
        statCardBorder: 'border-slate-100',
        statShadow: 'shadow-[0_20px_60px_rgba(15,23,42,0.12)]',
        automationBg: 'bg-white',
        automationShadow: 'shadow-[0_25px_60px_rgba(15,23,42,0.15)]',
        gradientCard: 'bg-gradient-to-br from-white to-slate-100/70',
        cardShadow: 'shadow-[0_25px_80px_rgba(15,23,42,0.12)]',
        ctaGradient: 'bg-gradient-to-r from-rose-100 via-amber-50 to-sky-100 text-slate-900',
        ctaBorder: 'border-slate-200',
        ctaBulletColor: 'bg-slate-700',
        navToggleTrack: 'bg-slate-300',
      };

  const {
    baseBackground,
    textPrimary,
    textSecondary,
    textMuted,
    textSubtle,
    textFaint,
    navColor,
    navHover,
    chipText,
    buttonPrimary,
    buttonSecondary,
    cardStrong,
    cardSoft,
    borderSoft,
    borderSofter,
    statCardBg,
    statCardBorder,
    statShadow,
    automationBg,
    automationShadow,
    gradientCard,
    cardShadow,
    ctaGradient,
    ctaBorder,
    ctaBulletColor,
    navToggleTrack,
  } = palette;

  const heroBackground = isDark
    ? 'linear-gradient(135deg,#020617,#0b1120 45%,#111827 100%)'
    : 'radial-gradient(circle at top,#fffdf6 0%,transparent 45%),linear-gradient(135deg,#fefefe,#f4f7ff 60%,#e6f5ff)';

  const featureSectionBg = isDark
    ? 'bg-neutral-900/40'
    : 'bg-[radial-gradient(circle_at_top,#f8fbff,transparent_55%),linear-gradient(180deg,#f6f8ff,#e7efff)]';

  const industriesSectionBg = isDark
    ? 'bg-neutral-900/40'
    : 'bg-[radial-gradient(circle_at_top,#eef4ff,transparent_60%),linear-gradient(180deg,#f3f5fb,#e4ebff)]';

  const ctaGlow = isDark ? 'bg-white/20' : 'bg-[#c9d8ff]/50';

  return (
    <div
      className="min-h-screen transition-[background] duration-700"
      style={{ background: heroBackground, color: isDark ? '#fff' : '#0f172a' }}
    >
      <div className={`relative overflow-hidden border-b ${borderSoft}`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.35),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(16,185,129,0.25),transparent_65%)]" />
        <nav
          className="relative mx-auto flex w-full max-w-[1760px] items-center gap-6 px-4 pt-6 pb-5 sm:px-8 lg:px-20"
        >
          <div className="flex flex-1 items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-lg font-extrabold text-neutral-900 shadow-lg shadow-black/10">
              B
            </div>
            <div>
              <p className={`text-base font-semibold tracking-[0.4em] uppercase ${textMuted}`}>Bookly</p>
              <p className={`text-sm ${textMuted}`}>Run every booking-led business</p>
            </div>
          </div>
          <div
            className={`hidden items-center gap-5 rounded-full border ${borderSoft} px-8 py-3 text-lg font-semibold ${navColor} sm:flex`}
          >
            {['Platform', 'Features', 'Industries', 'Voices', 'Contact'].map((item) => (
              <a key={item} href={`#${item.toLowerCase()}`} className={`text-xl ${navHover}`}>
                {item}
              </a>
            ))}
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <button
              type="button"
              onClick={toggleTheme}
              className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold uppercase tracking-[0.3em] transition ${buttonSecondary}`}
            >
              <span className={`relative flex h-7 w-14 items-center rounded-full transition ${navToggleTrack}`}>
                <span
                  className={`absolute h-6 w-6 rounded-full bg-white shadow transition-all ${
                    isDark ? 'left-1.5' : 'left-7'
                  }`}
                />
              </span>
              {isDark ? 'Night' : 'Day'}
            </button>
            <Link
              to="/login"
              className={`rounded-full border px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.25em] ${buttonSecondary}`}
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className={`rounded-full px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.25em] ${buttonPrimary}`}
            >
              Start free
            </Link>
          </div>
          <div className="flex items-center gap-2 sm:hidden">
            <button
              type="button"
              onClick={toggleTheme}
              className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.35em] transition ${buttonSecondary}`}
            >
              {isDark ? 'Night' : 'Day'}
            </button>
            <button
              type="button"
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 text-base transition"
              onClick={() => setNavOpen((prev) => !prev)}
              aria-label="Toggle navigation"
              aria-expanded={navOpen}
            >
              <span className="relative block h-0.5 w-6 bg-current before:absolute before:-top-2 before:h-0.5 before:w-6 before:bg-current after:absolute after:top-2 after:h-0.5 after:w-6 after:bg-current" />
            </button>
          </div>
          <AnimatePresence>
            {navOpen && (
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className={`sm:hidden absolute left-4 right-4 top-full z-30 mt-4 rounded-[28px] border ${borderSoft} ${
                  isDark ? 'bg-neutral-950/95 text-white' : 'bg-white/95 text-slate-900'
                } p-6 shadow-[0_40px_80px_rgba(15,23,42,0.35)] backdrop-blur-xl transition-colors duration-500`}
              >
                <div className="flex flex-col gap-4 text-lg font-semibold">
                  {['Platform', 'Features', 'Industries', 'Voices', 'Contact'].map((item) => (
                    <a
                      key={`mobile-${item}`}
                      href={`#${item.toLowerCase()}`}
                      className={`rounded-2xl px-4 py-3 ${navHover}`}
                      onClick={() => setNavOpen(false)}
                    >
                      {item}
                    </a>
                  ))}
                </div>
                <div className="mt-6 grid gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      toggleTheme();
                      setNavOpen(false);
                    }}
                    className={`rounded-full border px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] ${buttonSecondary}`}
                  >
                    {isDark ? 'Switch to Day' : 'Switch to Night'}
                  </button>
                  <Link
                    to="/login"
                    className={`rounded-full border px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.3em] ${buttonSecondary}`}
                    onClick={() => setNavOpen(false)}
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    className={`rounded-full px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.3em] ${buttonPrimary}`}
                    onClick={() => setNavOpen(false)}
                  >
                    Start free
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </nav>
        <motion.section
          className="relative mx-auto flex w-full max-w-[1760px] flex-col gap-12 px-4 pb-16 pt-10 sm:px-8 md:pb-24 lg:px-20"
          id="platform"
          variants={sectionVariants}
          initial="visible"
          animate="visible"
        >
          <div className={`relative z-10 inline-flex items-center gap-2 self-start rounded-full border ${borderSoft} px-4 py-1 text-xs uppercase tracking-[0.3em] ${textMuted}`}>
            <span className="h-2 w-2 rounded-full bg-primary" />
            Operating system for service businesses
          </div>
          <div className="relative z-10 grid gap-10 lg:grid-cols-[1.05fr,0.95fr] lg:items-center">
            <div className="space-y-6">
              <h1 className={`text-4xl font-semibold leading-tight ${textPrimary} sm:text-5xl lg:text-6xl`}>
                Smart, simple, modern booking infrastructure.
              </h1>
              <p className={`text-lg ${textSecondary}`}>
                Bookly unifies scheduling, payments, automations, and client experiences so you can move like a polished SaaS product—no matter the size of your studio or team.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  to="/register"
                  className={`rounded-full px-8 py-3 text-base font-semibold shadow-lg transition ${
                    isDark ? 'shadow-white/40' : 'shadow-[0_20px_45px_rgba(15,23,42,0.15)]'
                  } ${buttonPrimary}`}
                >
                  Get started
                </Link>
                <Link
                  to="/login"
                  className={`rounded-full border px-8 py-3 text-base font-semibold transition ${buttonSecondary}`}
                >
                  Sign in
                </Link>
              </div>
            </div>
            <div className="flex w-full justify-center lg:justify-end">
              <div
                className={`relative w-full max-w-[420px] overflow-hidden rounded-[48px] border ${borderSofter} ${gradientCard} ${cardShadow} p-6 sm:p-8`}
              >
                <div className={`flex items-center justify-between text-[11px] uppercase tracking-[0.35em] ${textMuted}`}>
                  <span>Bookly OS</span>
                  <span>{isDark ? 'Live' : 'Preview'}</span>
                </div>
                <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 px-5 py-4 text-xs font-semibold uppercase tracking-[0.4em] text-white/70">
                  Status · Up to date
                </div>
                <div className="mt-6 space-y-4">
                  <div className={`rounded-3xl border ${borderSoft} ${cardSoft} p-4`}>
                    <p className={`text-sm uppercase tracking-[0.35em] ${textMuted}`}>Operations snapshot</p>
                    {['Utilization', 'Revenue pace', 'Engagement'].map((label, index) => (
                      <div key={label} className="pt-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className={textPrimary}>{label}</span>
                          <span className={textSecondary}>{index === 0 ? '82%' : index === 1 ? '$148K' : '94%'}</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                            style={{
                              width: index === 0 ? '82%' : index === 1 ? '68%' : '94%',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className={`rounded-3xl border ${borderSoft} ${cardSoft} p-4`}>
                    <p className={`text-sm uppercase tracking-[0.35em] ${textMuted}`}>Upcoming</p>
                    <div className="mt-3 space-y-3 text-sm">
                      {['7:00 AM · Private session', '9:30 AM · Class drop-in', '12:00 PM · New lead tour'].map((event) => (
                        <div key={event} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                          <p className={textPrimary}>{event}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex items-center justify-between rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/80">
                  <span>Notification center</span>
                  <span>3 new</span>
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {metrics.map((metric, idx) => (
              <motion.div
                key={metric.label}
                className={`rounded-2xl border ${statCardBorder} ${statCardBg} p-6 text-center ${statShadow}`}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                whileHover={{ scale: 1.02 }}
              >
                <p className={`text-4xl font-semibold ${textPrimary}`}>{metric.value}</p>
                <p className={`mt-3 text-base ${textMuted}`}>{metric.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>
      </div>

    <motion.section
        className={`relative border-b ${borderSoft} ${featureSectionBg} py-20 min-h-screen flex items-center overflow-hidden transition-[background] duration-700`}
        id="features"
        variants={sectionVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
      >
        <div className="pointer-events-none absolute inset-0">
          <div
            className={`absolute -left-20 top-10 h-64 w-64 rounded-full blur-[120px] ${
              isDark ? 'bg-primary/20' : 'bg-rose-200'
            } animate-pulse`}
          />
          <div
            className={`absolute right-0 bottom-10 h-80 w-80 rounded-full blur-[140px] ${
              isDark ? 'bg-accent/20' : 'bg-sky-200'
            } animate-spin`}
            style={{ animationDuration: '18s' }}
          />
        </div>
        <div className="relative mx-auto w-full max-w-[1760px] px-4 sm:px-12">
          <p className={`text-lg uppercase tracking-[0.4em] ${textMuted}`}>Why teams choose Bookly</p>
          <h2 className={`mt-6 text-6xl font-semibold sm:text-7xl ${textPrimary}`}>
            Centralize the moving pieces of any service business.
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {features.map((feature, idx) => (
              <motion.div
                key={feature.title}
                className={`rounded-3xl border ${borderSoft} ${gradientCard} ${cardShadow} p-8 transition-colors duration-700`}
                whileHover={{ y: -6, scale: 1.02 }}
                transition={{ duration: 0.35, delay: idx * 0.05 }}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-base font-semibold text-white/90`}
                    >
                      {feature.icon === 'calendar-days'
                        ? '📅'
                        : feature.icon === 'credit-card'
                        ? '💳'
                        : feature.icon === 'sparkles'
                        ? '✨'
                        : '👥'}
                    </span>
                    <div>
                      <p className={`text-xs uppercase tracking-[0.4em] ${textMuted}`}>Capability</p>
                      <p className={`text-base font-semibold ${textPrimary}`}>{feature.stat}</p>
                    </div>
                  </div>
                  <motion.span
                    className={`rounded-full border px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] ${textMuted}`}
                    animate={{ opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  >
                    Live
                  </motion.span>
                </div>
                <h3 className={`mt-6 text-2xl font-semibold ${textPrimary}`}>{feature.title}</h3>
                <p className={`mt-3 text-base ${textSecondary}`}>{feature.description}</p>
                <ul className={`mt-6 space-y-3 text-sm ${isDark ? 'text-white/80' : textSecondary}`}>
                  {feature.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-3 text-base">
                      <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                      <span className={textSecondary}>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {automations.map((automation, idx) => (
              <motion.div
                key={automation.title}
                className={`rounded-3xl border ${borderSoft} ${automationBg} ${automationShadow} p-6 transition-colors duration-700`}
                whileHover={{ y: -4, scale: 1.01 }}
                transition={{ duration: 0.3, delay: idx * 0.08 }}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
              >
                <p className={`text-sm uppercase tracking-[0.4em] ${isDark ? 'text-primary/70' : 'text-primary/80'}`}>
                  {automation.title}
                </p>
                <p className={`mt-3 text-base ${textMuted}`}>{automation.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      <motion.section
        className="relative border-b border-white/10 py-16 sm:py-20 min-h-screen flex items-center overflow-hidden"
        variants={sectionVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/3 top-8 h-72 w-72 rounded-full bg-white/5 blur-[180px] animate-pulse" />
        </div>
        <div className="relative mx-auto flex w-full max-w-[1500px] flex-col gap-12 px-4 sm:px-12">
          <div className="grid gap-10 lg:grid-cols-[1.1fr,0.9fr]">
            <div className="space-y-6 lg:pr-12">
                <p className={`text-base uppercase tracking-[0.35em] ${textMuted}`}>Platform walkthrough</p>
                <h2 className={`mt-5 text-5xl font-semibold sm:text-6xl ${textPrimary}`}>
                  See the dashboard in action.
                </h2>
                <p className={`mt-6 text-xl ${textSecondary}`}>
                Drag-and-drop scheduling, resource allocation, and notification rules all live inside a
                single, beautifully organized console.
              </p>
              <ul className={`mt-8 space-y-4 text-lg ${textSecondary}`}>
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-accent" />
                  Multi-location calendar with filters for services, rooms, and team members.
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                  Revenue, utilization, and retention analytics surface trends instantly.
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-white" />
                  Client portal activity tiles show upcoming visits, unpaid invoices, and waitlist moves.
                </li>
              </ul>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  to="/register"
                  className={`rounded-full px-6 py-2.5 text-sm font-semibold shadow-primary/40 ${buttonPrimary}`}
                >
                  Launch my workspace
                </Link>
                <Link
                  to="/login"
                  className={`rounded-full border px-6 py-2.5 text-sm font-semibold ${buttonSecondary}`}
                >
                  View demo
                </Link>
              </div>
            </div>
            <div className="space-y-8">
              <div
                className={`mx-auto w-full max-w-md rounded-[36px] border ${borderSoft} ${cardStrong} p-4 sm:p-6 shadow-[0_40px_80px_rgba(0,0,0,0.25)] transition-colors duration-700`}
              >
                <div className={`rounded-[28px] border ${borderSofter} ${cardSoft} p-4 sm:p-5 shadow-inner shadow-black/10 transition-colors duration-700`}>
                  <div className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-lg ${textSecondary}`}>
                    <span>Global calendar</span>
                    <span className="text-sm">Week view</span>
                  </div>
                  <div className={`mt-6 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 sm:gap-4 ${textSecondary}`}>
                    {['Mon', 'Tue', 'Wed', 'Thu'].map((day) => (
                      <div key={day} className="space-y-3">
                        <p className={`text-xs uppercase tracking-[0.3em] ${textFaint}`}>
                          {day}
                        </p>
                        <div className="space-y-3">
                          {[1, 2, 3].map((slot) => (
                            <div
                              key={`${day}-${slot}`}
                              className={`rounded-xl border ${borderSoft} p-3 text-xs ${
                                isDark ? 'bg-gradient-to-r from-primary/40 to-accent/40' : 'bg-white'
                              }`}
                            >
                              <p className={`font-semibold ${textPrimary}`}>Strategy session</p>
                              <p className={textMuted}>Team {slot}</p>
                              <p className={textSubtle}>10:00 — 11:00</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {journeySteps.map((step) => (
              <motion.div
                key={step.title}
                className={`rounded-3xl border ${borderSoft} ${cardStrong} p-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)] transition-colors duration-700`}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.4 }}
              >
                <div className={`text-sm font-semibold tracking-[0.5em] ${textFaint}`}>{step.accent}</div>
                <h3 className={`mt-4 text-2xl font-semibold ${textPrimary}`}>{step.title}</h3>
                <p className={`mt-3 text-base ${textMuted}`}>{step.detail}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      <motion.section
        className={`relative border-b ${borderSoft} ${industriesSectionBg} py-20 min-h-screen flex items-center overflow-hidden transition-[background] duration-700`}
        id="industries"
        variants={sectionVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
      >
        <div className="pointer-events-none absolute inset-0">
          <div
            className={`absolute left-10 bottom-6 h-64 w-64 rounded-full blur-[130px] ${
              isDark ? 'bg-primary/15' : 'bg-indigo-200/70'
            } animate-pulse`}
          />
          <div
            className={`absolute right-16 top-6 h-80 w-80 rounded-full blur-[150px] ${
              isDark ? 'bg-accent/15' : 'bg-emerald-200/60'
            } animate-spin`}
            style={{ animationDuration: '18s' }}
          />
        </div>
        <div className="relative mx-auto w-full max-w-[1760px] px-4 sm:px-12">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className={`text-base uppercase tracking-[0.35em] ${textMuted}`}>built for every team</p>
              <h2 className={`mt-5 text-5xl font-semibold sm:text-6xl ${textPrimary}`}>
                Flexible enough for any service model.
              </h2>
              <p className={`mt-4 text-lg ${textSecondary}`}>
                Bookly adapts to hybrid offerings—private sessions, local workshops, memberships, or enterprise
                programs—with role-based controls, shared resources, and branded client journeys.
              </p>
            </div>
            <div className={`rounded-full border ${borderSoft} px-4 py-2 text-sm ${textMuted}`}>
              API & integrations ready
            </div>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {industriesDetails.map((detail) => (
              <motion.div
                key={detail.title}
                className={`rounded-3xl border ${borderSoft} ${cardStrong} p-6 shadow-[0_25px_70px_rgba(0,0,0,0.2)] transition-colors duration-700`}
                whileHover={{ y: -6, scale: 1.02 }}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.35 }}
              >
                <div className={`text-sm uppercase tracking-[0.4em] ${textFaint}`}>{detail.title}</div>
                <p className={`mt-3 text-base ${textSecondary}`}>{detail.description}</p>
              </motion.div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap gap-3">
            {industries.map((industry) => (
              <motion.span
                key={industry}
                className={`rounded-full border ${borderSofter} px-5 py-2 text-xs tracking-[0.3em] ${chipText}`}
                whileHover={{ y: -3, borderColor: 'rgba(255,255,255,0.6)' }}
              >
                {industry}
              </motion.span>
            ))}
          </div>
          <div className={`mt-10 flex flex-wrap items-center gap-6 ${textFaint}`}>
            {clientLogos.map((logo) => (
              <motion.span
                key={logo}
                className="text-sm uppercase tracking-[0.4em]"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 0.6, y: 0 }}
                whileHover={{ opacity: 1 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.3 }}
              >
                {logo}
              </motion.span>
            ))}
          </div>
        </div>
      </motion.section>

      <motion.section
        className={`relative border-b ${borderSoft} py-20 min-h-screen flex items-center overflow-hidden transition-[background] duration-700`}
        id="testimonials"
        variants={sectionVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-white/10 to-transparent" />
        </div>
        <div className="relative mx-auto w-full max-w-[1760px] px-4 sm:px-12">
          <p className={`text-base uppercase tracking-[0.35em] ${textMuted}`}>Testimonials</p>
          <h2 className={`mt-4 text-5xl font-semibold sm:text-6xl ${textPrimary}`}>Teams growing with Bookly.</h2>
          <div className="mt-10 grid gap-8 lg:grid-cols-[1.2fr,0.8fr]">
            <motion.div
              className={`rounded-[40px] border ${borderSoft} ${
                isDark ? 'bg-gradient-to-br from-white/10 to-transparent' : 'bg-white'
              } p-8 shadow-[0_40px_120px_rgba(0,0,0,0.2)] transition-colors duration-700`}
              whileHover={{ scale: 1.01 }}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
            >
              <p className={`text-lg uppercase tracking-[0.5em] ${textSecondary}`}>Featured</p>
              <p className={`mt-4 text-3xl font-semibold ${textPrimary}`}>
                “Bookly replaced four tools for booking, billing, and messaging. Our team finally works from
                the same source of truth.”
              </p>
              <div className="mt-6 text-lg">
                <p className={`font-semibold ${textPrimary}`}>Amelia Rhodes</p>
                <p className={textSubtle}>Director, Align Collective</p>
              </div>
              <div className={`mt-8 grid gap-4 md:grid-cols-3 ${textMuted}`}>
                <div>
                  <p className={`text-3xl font-semibold ${textPrimary}`}>42%</p>
                  <p className="text-sm">Increase in retained clients</p>
                </div>
                <div>
                  <p className={`text-3xl font-semibold ${textPrimary}`}>3 apps</p>
                  <p className="text-sm">Tools replaced</p>
                </div>
                <div>
                  <p className={`text-3xl font-semibold ${textPrimary}`}>1 week</p>
                  <p className="text-sm">Deployment time</p>
                </div>
              </div>
            </motion.div>
            <div className="grid gap-6">
              {testimonials.slice(1).map((testimonial, idx) => (
                <motion.div
                  key={testimonial.name}
                  className={`rounded-3xl border ${borderSoft} ${cardStrong} p-6 shadow-[0_20px_60px_rgba(0,0,0,0.2)] transition-colors duration-700`}
                  whileHover={{ x: 4 }}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.35, delay: idx * 0.08 }}
                >
                  <p className={`text-base leading-relaxed ${textSecondary}`}>“{testimonial.quote}”</p>
                  <div className="mt-5 text-sm">
                    <p className={`font-semibold ${textPrimary}`}>{testimonial.name}</p>
                    <p className={textSubtle}>{testimonial.role}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section
        className="relative py-20 min-h-screen flex items-center overflow-hidden transition-[background] duration-700"
        id="contact"
        variants={sectionVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className={`absolute -top-10 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full blur-[160px] ${ctaGlow}`} />
        </div>
        <div
          className={`relative mx-auto grid max-w-6xl gap-10 rounded-[40px] border px-12 py-16 shadow-[0_40px_120px_rgba(80,51,255,0.25)] lg:grid-cols-[1.1fr,0.9fr] ${ctaBorder} ${ctaGradient} transition-[background] duration-700`}
        >
          <div>
            <p className={`text-sm uppercase tracking-[0.5em] ${textMuted}`}>Ready in minutes</p>
            <h2 className={`mt-4 text-5xl font-semibold leading-tight sm:text-6xl ${textPrimary}`}>
              Launch a modern operations hub for your entire service business.
            </h2>
            <p className={`mt-6 max-w-2xl text-xl ${textSecondary}`}>
              Create your workspace, invite your team, and connect your booking pages in under ten
              minutes. No credit card required to explore. Our concierge crew walks you through onboarding live.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                to="/register"
                className={`rounded-full px-6 py-3 text-sm font-semibold ${buttonPrimary}`}
              >
                Start for free
              </Link>
              <Link
                to="/login"
                className={`rounded-full border px-6 py-3 text-sm font-semibold ${buttonSecondary}`}
              >
                View product tour
              </Link>
            </div>
          </div>
          <div
            className={`rounded-[32px] border p-6 backdrop-blur ${
              isDark ? 'border-white/20 bg-white/10' : 'border-white/70 bg-white/80 text-slate-800'
            }`}
          >
            <p className={`text-sm uppercase tracking-[0.4em] ${textMuted}`}>What’s included</p>
            <ul className={`mt-4 space-y-4 ${textSecondary}`}>
              {[
                'Guided setup session with our onboarding team.',
                'Migration templates for services, customers, and resources.',
                'Branded booking page and client portal starter kit.',
                'Slack channel with our success engineers.',
              ].map((item) => (
                <motion.li key={item} className="flex gap-3" whileHover={{ x: 6 }}>
                  <span className={`mt-1 h-2 w-2 rounded-full ${ctaBulletColor}`} />
                  {item}
                </motion.li>
              ))}
            </ul>
            <div
              className={`mt-6 rounded-2xl p-5 text-sm ${
                isDark ? 'bg-white/5 text-white/85' : 'bg-white text-slate-700 shadow-inner'
              }`}
            >
              <p className="font-semibold">Need help?</p>
              <p>Drop us a note at hello@booklyHQ.com and we’ll reply within one business day.</p>
            </div>
          </div>
        </div>
      </motion.section>

      <footer
        className={`border-t py-12 ${
          isDark ? 'border-white/10 bg-neutral-950' : 'border-slate-200 bg-slate-50 text-slate-800'
        }`}
      >
        <div className="mx-auto flex w-full max-w-[1760px] flex-col gap-6 px-4 sm:px-12 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-full text-base font-extrabold ${
                isDark ? 'bg-white text-neutral-900' : 'bg-slate-900 text-white'
              }`}
            >
              B
            </div>
            <div>
              <p className={`text-base font-semibold tracking-[0.35em] uppercase ${textMuted}`}>Bookly</p>
              <p className={`text-sm ${textSubtle}`}>Booking Management System © {new Date().getFullYear()}</p>
            </div>
          </div>
          <div className={`flex flex-wrap items-center gap-6 text-base ${textMuted}`}>
            <a href="#platform" className={`transition ${navHover}`}>Platform</a>
            <a href="#features" className={`transition ${navHover}`}>Features</a>
            <a href="#industries" className={`transition ${navHover}`}>Industries</a>
            <a href="#testimonials" className={`transition ${navHover}`}>Testimonials</a>
            <a href="#contact" className={`transition ${navHover}`}>Contact</a>
            <Link to="/login" className={`transition ${navHover}`}>Sign in</Link>
            <Link to="/register" className={`transition ${navHover}`}>Start free</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};


