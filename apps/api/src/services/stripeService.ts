import Stripe from 'stripe';

import { env } from '../config/env.js';

const API_VERSION: Stripe.LatestApiVersion = '2024-06-20';

const tenantStripeClient = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: API_VERSION,
    })
  : null;

const booklyStripeClient = env.BOOKLY_STRIPE_SECRET_KEY
  ? new Stripe(env.BOOKLY_STRIPE_SECRET_KEY, {
      apiVersion: API_VERSION,
    })
  : null;

export const getTenantStripe = () => {
  if (!tenantStripeClient) {
    throw new Error('Stripe not configured for tenant payments');
  }

  return tenantStripeClient;
};

export const getBooklyStripe = () => booklyStripeClient;

export const isTenantStripeConfigured = () => Boolean(tenantStripeClient);

