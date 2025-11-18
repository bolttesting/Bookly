# Monitoring & Observability

## Overview

Bookly uses Sentry for error tracking and Plausible for privacy-friendly analytics.

## Sentry Integration

### Backend (API)

Sentry is integrated at the application level and automatically captures:
- Unhandled exceptions
- API errors with full request context
- Performance traces (10% sample rate in production)
- User context (userId, businessId, role)

**Configuration:**
- `SENTRY_DSN`: Your Sentry project DSN
- `SENTRY_ENVIRONMENT`: Environment name (development, staging, production)
- `SENTRY_TRACES_SAMPLE_RATE`: Performance tracing sample rate (0.0-1.0)

**Alert Thresholds:**
- **Critical**: 5+ errors in 5 minutes
- **Warning**: 10+ errors in 15 minutes
- **Info**: New error types

### Frontend (Web)

Sentry React integration captures:
- JavaScript errors
- Unhandled promise rejections
- User interactions (replay on errors)
- Performance metrics

**Configuration:**
- `VITE_SENTRY_DSN`: Your Sentry project DSN
- `VITE_SENTRY_ENVIRONMENT`: Environment name

## Plausible Analytics

Plausible provides privacy-friendly analytics without cookies or personal data collection.

**Configuration:**
- `VITE_PLAUSIBLE_DOMAIN`: Your domain (e.g., `bookly.app`)

**Tracked Events:**
- `Booking Created` - When a booking is successfully created
- `Appointment Cancelled` - When an appointment is cancelled
- `Payment Completed` - When a payment is processed
- `User Registered` - When a new user signs up
- `Test Drive Started` - When a test drive begins
- `Test Drive Completed` - When a test drive ends

**Usage:**
```typescript
import { trackEvent, trackBookingCreated } from './utils/plausible';

// Custom event
trackEvent('Custom Event', { prop1: 'value1' });

// Predefined events
trackBookingCreated({ source: 'embed', serviceId: 'xxx' });
```

## Health Monitoring

### Health Endpoints

- `GET /api/health` - Overall system health
- `GET /api/health/ready` - Readiness probe (for Kubernetes)
- `GET /api/health/live` - Liveness probe (for Kubernetes)

### Metrics Endpoint

- `GET /api/metrics` - Business-level metrics (authenticated)

## Alert Configuration

### Sentry Alerts

Configure in Sentry dashboard:

1. **Error Rate Alert**
   - Condition: Error rate > 5 errors/minute
   - Action: Email/Slack notification

2. **New Issue Alert**
   - Condition: New error type detected
   - Action: Email notification

3. **Performance Degradation**
   - Condition: P95 latency > 2s
   - Action: Email notification

### Plausible Goals

Set up goals in Plausible dashboard:
- Booking conversion rate
- Test Drive completion rate
- User registration rate

## Best Practices

1. **Error Context**: Always include relevant context when logging errors
2. **Sample Rates**: Adjust trace sample rates based on traffic
3. **Privacy**: Never log sensitive data (passwords, tokens, PII)
4. **Performance**: Monitor slow queries and API endpoints
5. **Uptime**: Set up external monitoring (e.g., UptimeRobot) for health endpoints

## Troubleshooting

### Sentry not capturing errors
- Check `SENTRY_DSN` is set correctly
- Verify Sentry project is active
- Check network connectivity to Sentry

### Plausible not tracking
- Verify script is loaded in `index.html`
- Check `VITE_PLAUSIBLE_DOMAIN` matches your domain
- Ensure domain is verified in Plausible dashboard

