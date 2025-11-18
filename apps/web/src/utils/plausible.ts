/**
 * Plausible Analytics helper functions
 * Only works if Plausible script is loaded in index.html
 */

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Record<string, string> }) => void;
  }
}

export const trackEvent = (eventName: string, props?: Record<string, string>) => {
  if (typeof window !== 'undefined' && window.plausible) {
    window.plausible(eventName, { props });
  }
};

// Common events
export const trackBookingCreated = (props?: { source?: string; serviceId?: string }) => {
  trackEvent('Booking Created', props);
};

export const trackAppointmentCancelled = (props?: { reason?: string }) => {
  trackEvent('Appointment Cancelled', props);
};

export const trackPaymentCompleted = (props?: { amount?: string; currency?: string }) => {
  trackEvent('Payment Completed', props);
};

export const trackUserRegistered = (props?: { industry?: string }) => {
  trackEvent('User Registered', props);
};

export const trackTestDriveStarted = () => {
  trackEvent('Test Drive Started');
};

export const trackTestDriveCompleted = (props?: { feedback?: string }) => {
  trackEvent('Test Drive Completed', props);
};

