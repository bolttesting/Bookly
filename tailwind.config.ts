import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./apps/web/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#8b5cf6',
        'primary-foreground': '#ffffff',
        accent: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#3b82f6',
        'neutral-900': '#0f172a',
        'neutral-600': '#475569',
        'neutral-200': '#e2e8f0',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        display: ['3rem', { lineHeight: '1.1', fontWeight: '600' }],
        h1: ['2.25rem', { lineHeight: '1.2', fontWeight: '600' }],
        h2: ['1.5rem', { lineHeight: '1.3', fontWeight: '600' }],
        h3: ['1.25rem', { lineHeight: '1.35', fontWeight: '600' }],
        'body-lg': ['1.125rem', { lineHeight: '1.6' }],
        body: ['1rem', { lineHeight: '1.6' }],
        small: ['0.875rem', { lineHeight: '1.4' }],
      },
      boxShadow: {
        card: '0 15px 35px -20px rgba(15, 23, 42, 0.55)',
      },
      borderRadius: {
        xl: '1.25rem',
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography')],
};

export default config;

