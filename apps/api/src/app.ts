import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';

import { env } from './config/env.js';
import { initSentry, Sentry } from './config/sentry.js';
import { errorHandler } from './middleware/errorHandler.js';
import { router } from './routes/index.js';

const app = express();

// Initialize Sentry with app instance
initSentry(app);

const allowedOrigins = new Set(env.APP_BASE_URLS ?? [env.APP_BASE_URL]);
const allowAllOriginsInDev = env.SENTRY_ENVIRONMENT !== 'production';

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      if (allowAllOriginsInDev) {
        return callback(null, true);
      }

      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  }),
);
app.use(helmet());

// Stripe webhooks need raw body for signature verification
app.use(
  '/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    // Store raw body for webhook handler
    (req as any).rawBody = req.body;
    next();
  },
);

app.use(express.json());
app.use(cookieParser());

// Sentry expressIntegration automatically handles request/error tracking
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 100,
  }),
);
import { logger } from './utils/logger.js';

// Structured HTTP logging
if (process.env.NODE_ENV === 'production') {
  app.use(
    morgan('combined', {
      stream: {
        write: (message: string) => {
          logger.info('HTTP Request', { message: message.trim() });
        },
      },
    }),
  );
} else {
  app.use(morgan('dev'));
}

app.use('/api', router);

// Sentry error handler is handled by expressIntegration
// Custom error handler will capture exceptions manually

app.use(errorHandler);

export { app };

