type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  service: string;
  [key: string]: unknown;
}

class Logger {
  private service: string;

  constructor(service: string = 'api') {
    this.service = service;
  }

  private formatLog(level: LogLevel, message: string, meta?: Record<string, unknown>): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      service: this.service,
      ...meta,
    };
  }

  private output(entry: LogEntry) {
    const { level, message, timestamp, service, ...meta } = entry;
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    
    if (process.env.NODE_ENV === 'production') {
      // In production, output as JSON for log aggregation
      console.log(JSON.stringify(entry));
    } else {
      // In development, use readable format
      const emoji = {
        info: 'ℹ️',
        warn: '⚠️',
        error: '❌',
        debug: '🔍',
      }[level];

      console.log(
        `${emoji} [${timestamp}] [${service.toUpperCase()}] ${level.toUpperCase()}: ${message}${metaStr}`,
      );
    }
  }

  info(message: string, meta?: Record<string, unknown>) {
    this.output(this.formatLog('info', message, meta));
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.output(this.formatLog('warn', message, meta));
  }

  error(message: string, error?: Error | unknown, meta?: Record<string, unknown>) {
    const errorMeta: Record<string, unknown> = { ...meta };

    if (error instanceof Error) {
      errorMeta.error = {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      };
    } else if (error) {
      errorMeta.error = error;
    }

    this.output(this.formatLog('error', message, errorMeta));
  }

  debug(message: string, meta?: Record<string, unknown>) {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
      this.output(this.formatLog('debug', message, meta));
    }
  }
}

export const logger = new Logger('bookly-api');

export { Logger };

