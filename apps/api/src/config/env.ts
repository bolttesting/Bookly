import { config } from 'dotenv';
import { z } from 'zod';

config({ path: process.env.NODE_ENV === 'test' ? '.env.test' : undefined });

const envSchema = z.object({
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/bookly'),
  JWT_ACCESS_SECRET: z.string().min(32).default('dev-access-secret-change-me-1234567890'),
  JWT_REFRESH_SECRET: z.string().min(32).default('dev-refresh-secret-change-me-1234567890'),
  REDIS_URL: z.string().optional(),
  APP_BASE_URL: z.string().default('http://localhost:5173,http://127.0.0.1:5173'),
  API_PORT: z.coerce.number().default(4000),
  EMAIL_HOST: z.string().optional(),
  EMAIL_PORT: z.coerce.number().optional(),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  EMAIL_SECURE: z.coerce.boolean().optional(),
  CLIENT_PORTAL_URL: z.string().url().optional(),
  RESEND_API_KEY: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_MESSAGING_SERVICE_SID: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_CONNECT_CLIENT_ID: z.string().optional(),
  BOOKLY_STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  GOOGLE_CALENDAR_WEBHOOK_URL: z.string().url().optional(),
  OUTLOOK_CLIENT_ID: z.string().optional(),
  OUTLOOK_CLIENT_SECRET: z.string().optional(),
  OUTLOOK_REDIRECT_URI: z.string().url().optional(),
  OUTLOOK_CALENDAR_WEBHOOK_URL: z.string().url().optional(),
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_ENVIRONMENT: z.string().default('development'),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().default(0.1),
  PLAUSIBLE_DOMAIN: z.string().optional(),
});

type EnvVars = z.infer<typeof envSchema> & {
  APP_BASE_URLS: string[];
};

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

const appOrigins = parsed.data.APP_BASE_URL.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
  .map((origin) => {
    try {
      const url = new URL(origin);
      return url.origin;
    } catch (error) {
      console.error(`❌ Invalid APP_BASE_URL entry: ${origin}`);
      throw error;
    }
  });

if (appOrigins.length === 0) {
  appOrigins.push('http://localhost:5173');
}

export const env: EnvVars = {
  ...parsed.data,
  APP_BASE_URL: appOrigins[0],
  APP_BASE_URLS: appOrigins,
};

