Milestone 1 — Foundation & Design System
========================================

This document captures the concrete outputs for Milestone 1 so progress can be reviewed and referenced by the broader team.

1. UX Requirements & Responsive Strategy
----------------------------------------
- **Viewports**  
  - Desktop: ≥1440px primary target with generous spacing and multi-column analytics.  
  - Laptop: 1024–1439px collapses secondary panels but preserves two-column dashboards.  
  - Tablet: 768–1023px uses condensed sidebar (icon-only) and touch targets ≥44px.  
  - Mobile: ≤767px adopts an app-like layout with bottom navigation, sticky action buttons, and gesture-friendly cards.
- **Key UX Expectations**  
  - Home page hero with bold CTA, animated stats strip, and trust logos.  
  - Owner dashboard uses modular cards, animated KPI transitions, and draggable calendar panel.  
  - Booking wizard is step-based with progress indicator, swipable on mobile.  
  - Public booking page supports branded themes per business, high-contrast time-slot grid.  
  - Motion follows reduced-motion settings and prioritizes snappy 250–350ms transitions.

2. Design Tokens & Tailwind Setup
---------------------------------
Semantic palette (aligns with violet primary and Pilates-friendly neutrals):

| Token | Value | Usage |
|-------|-------|-------|
| `primary` | `#8b5cf6` | buttons, highlights |
| `primary-foreground` | `#ffffff` | text on primary |
| `secondary` | `#f3f4f6` | cards, backgrounds |
| `accent` | `#10b981` | success states |
| `warning` | `#f59e0b` | reminder alerts |
| `danger` | `#ef4444` | destructive |
| `info` | `#3b82f6` | informational |
| `neutral-900` | `#0f172a` | headings |
| `neutral-600` | `#475569` | body text |
| `neutral-200` | `#e2e8f0` | dividers |

Typography scale (Tailwind `fontSize` entries):

| Token | Size / Line-height | Usage |
|-------|--------------------|-------|
| `display` | `3rem / 1.1` | hero |
| `h1` | `2.25rem / 1.2` | page titles |
| `h2` | `1.5rem / 1.3` | section headings |
| `h3` | `1.25rem / 1.3` | card titles |
| `body-lg` | `1.125rem / 1.6` | lead copy |
| `body` | `1rem / 1.6` | default text |
| `small` | `0.875rem / 1.4` | helper text |

Tailwind base configuration snippet:

```ts
// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./apps/**/*.{ts,tsx}", "./packages/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#8b5cf6",
        "primary-foreground": "#ffffff",
        accent: "#10b981",
        warning: "#f59e0b",
        danger: "#ef4444",
        info: "#3b82f6",
        "neutral-900": "#0f172a",
        "neutral-600": "#475569",
        "neutral-200": "#e2e8f0",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        display: ["3rem", { lineHeight: "1.1", fontWeight: "600" }],
        h1: ["2.25rem", { lineHeight: "1.2", fontWeight: "600" }],
        h2: ["1.5rem", { lineHeight: "1.3", fontWeight: "600" }],
        h3: ["1.25rem", { lineHeight: "1.35", fontWeight: "600" }],
        "body-lg": ["1.125rem", { lineHeight: "1.6" }],
        body: ["1rem", { lineHeight: "1.6" }],
        small: ["0.875rem", { lineHeight: "1.4" }],
      },
      boxShadow: {
        card: "0 15px 35px -20px rgba(15, 23, 42, 0.55)",
      },
      borderRadius: {
        xl: "1.25rem",
      },
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/typography")],
};

export default config;
```

3. Wireframe Notes (Textual)
---------------------------
- **Marketing Home**  
  - Hero: Split layout with headline, CTA buttons (“Book a Demo”, “Start Free Test Drive”), animated stat cards.  
  - Social proof strip, features grid, animated booking preview, pricing teaser, footer with contact + compliance.
- **Owner Dashboard**  
  - Top row: KPI cards (Bookings Today, Revenue, No-Shows, Utilization) with framer-motion count-up.  
  - Middle: Calendar occupying 2/3 width, quick actions on the side (add appointment, block time, invite staff).  
  - Bottom: Staff performance list, upcoming appointments, reminders queue.
- **Booking Wizard**  
  - Stepper at top (Service → Staff → Date & Time → Details → Confirm).  
  - Mobile uses fullscreen cards with swipe; desktop shows card + summary sidebar.  
  - CTA buttons sticky to bottom with gradient background.
- **Public Booking Page**  
  - Business header with logo, rating, location, timezone.  
  - Service accordion, staff selector chips, calendar/time-slot grid, summary drawer.  
  - Floating action button for chat/support integration (future).

4. Tooling & Repo Prep
----------------------
- Monorepo layout using npm workspaces: `apps/web`, `apps/api`, `packages/ui`, `packages/config`.  
- Root tooling stack: TypeScript, ESLint (with React + Node configs), Prettier, Husky, lint-staged, Turbo for task orchestration.  
- Git hooks: `pre-commit` runs `lint-staged`; `pre-push` reserved for test suite once implemented.  
- Node version target: ≥18.18 (aligns with Vercel/Railway defaults).  
- Environment files: `.env.example` will be added once services are wired (Milestone 2).

Next Steps
----------
- Once stakeholders approve these foundations, begin implementing actual components and flows following Milestone 2 tasks.  
- Update `PLAN.md` checkboxes as each item ships; include completion dates for auditability.

