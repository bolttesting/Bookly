import { prisma } from '../config/prisma.js';

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export type HealthCheck = {
  name: string;
  status: HealthStatus;
  message?: string;
  latency?: number;
};

export type HealthResponse = {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  version: string;
  checks: HealthCheck[];
};

const startTime = Date.now();

/**
 * Check database connectivity
 */
const checkDatabase = async (): Promise<HealthCheck> => {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;
    return {
      name: 'database',
      status: 'healthy',
      latency,
    };
  } catch (error) {
    return {
      name: 'database',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Database connection failed',
    };
  }
};

/**
 * Check Redis connectivity (if configured)
 */
const checkRedis = async (): Promise<HealthCheck> => {
  // TODO: Implement Redis check when Redis is added
  return {
    name: 'redis',
    status: 'healthy',
    message: 'Redis not configured',
  };
};

/**
 * Check environment configuration
 */
const checkEnvironment = (): HealthCheck => {
  const requiredVars = [
    'DATABASE_URL',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
  ];

  const missing = requiredVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    return {
      name: 'environment',
      status: 'degraded',
      message: `Missing environment variables: ${missing.join(', ')}`,
    };
  }

  return {
    name: 'environment',
    status: 'healthy',
  };
};

/**
 * Get overall health status
 */
export const getHealthStatus = async (): Promise<HealthResponse> => {
  const checks = await Promise.all([
    checkDatabase(),
    checkRedis(),
    Promise.resolve(checkEnvironment()),
  ]);

  // Determine overall status
  const hasUnhealthy = checks.some((check) => check.status === 'unhealthy');
  const hasDegraded = checks.some((check) => check.status === 'degraded');

  const overallStatus: HealthStatus = hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy';

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: process.env.npm_package_version || '1.0.0',
    checks,
  };
};

/**
 * Get readiness status (for Kubernetes/load balancers)
 */
export const getReadinessStatus = async (): Promise<{ ready: boolean; checks: HealthCheck[] }> => {
  const checks = await Promise.all([
    checkDatabase(),
    checkEnvironment(),
  ]);

  const ready = checks.every((check) => check.status === 'healthy');

  return { ready, checks };
};

/**
 * Get liveness status (for Kubernetes)
 */
export const getLivenessStatus = (): { alive: boolean } => {
  return { alive: true };
};

