import * as Sentry from '@sentry/node';
import { Express } from 'express';
import { env } from './env.js';

export const initSentry = (app: Express) => {
  if (!env.SENTRY_DSN) {
    return; // Sentry disabled if no DSN
  }

  const integrations = [
    Sentry.httpIntegration({ tracing: true }),
    Sentry.expressIntegration({ app }),
  ];

  // Add profiling integration if available
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ProfilingIntegration } = require('@sentry/profiling-node');
    integrations.push(new ProfilingIntegration());
  } catch (error) {
    // Profiling integration not available, skip it
    console.warn('Profiling integration not available, skipping...');
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT,
    integrations,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    profilesSampleRate: env.SENTRY_ENVIRONMENT === 'production' ? 0.1 : 1.0,
    beforeSend(event, hint) {
      // Filter out sensitive data
      if (event.request) {
        // Remove sensitive headers
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
      }
      return event;
    },
  });
};

export { Sentry };

