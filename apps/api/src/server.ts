import { app } from './app.js';
import { env } from './config/env.js';
import { startMarketingEventProcessor } from './services/marketingEventProcessor.js';
import { logger } from './utils/logger.js';

const port = env.API_PORT ?? 4000;

app.listen(port, () => {
  logger.info(`API server started`, { port, environment: process.env.NODE_ENV || 'development' });
  
  // Start background processors
  startMarketingEventProcessor();
});

