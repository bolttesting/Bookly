import * as Sentry from '@sentry/react';

export const initSentry = (dsn?: string, environment?: string) => {
  if (!dsn) {
    return; // Sentry disabled if no DSN
  }

  Sentry.init({
    dsn,
    environment: environment || 'development',
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    replaysSessionSampleRate: environment === 'production' ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0,
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

