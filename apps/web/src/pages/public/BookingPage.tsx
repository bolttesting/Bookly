import { zodResolver } from '@hookform/resolvers/zod';
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js';
import { useMutation, useQuery } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';
import { z } from 'zod';

import {
  createPaymentIntent,
  createPublicBooking,
  fetchAvailability,
  fetchBookingPage,
  type PublicBookingResponse,
  type Service,
  type StaffMember,
} from '../../api/booking';
import { stripePromise } from '../../lib/stripe';
import { trackBookingCreated, trackPaymentCompleted } from '../../utils/plausible';
import { useBookingStore } from '../../stores/bookingStore';

const customerSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  marketingConsent: z.boolean().default(true),
  notes: z.string().max(2000).optional(),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

type BookingPageProps = {
  embedded?: boolean;
};

const BookingPageForm = ({ embedded = false }: BookingPageProps = {}) => {
  const { slug = '' } = useParams();
  const { step, serviceId, staffId, date, slotStart, setService, setStaff, setDate, setSlot, setCustomer, customer, reset } =
    useBookingStore();
  const stripe = useStripe();
  const elements = useElements();
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const bookingPageQuery = useQuery({
    queryKey: ['booking-page', slug],
    queryFn: () => fetchBookingPage(slug),
    enabled: !!slug,
  });

  const days = useMemo(() => {
    return Array.from({ length: 5 }).map((_, idx) => addDays(new Date(), idx));
  }, []);

  const availabilityQuery = useQuery({
    queryKey: ['availability', slug, serviceId, staffId, date],
    queryFn: () =>
      fetchAvailability(slug, {
        serviceId: serviceId!,
        staffId: staffId || undefined,
        date: date!,
      }),
    enabled: Boolean(slug && serviceId && date),
  });

  const bookingMutation = useMutation<
    PublicBookingResponse,
    Error,
    CustomerFormValues & { paymentIntentId?: string }
  >({
    mutationFn: (payload) => {
      const { paymentIntentId, ...customerPayload } = payload;

      return createPublicBooking(
        slug,
        {
          serviceId: serviceId!,
          staffId: staffId,
          startTime: slotStart!,
          paymentIntentId,
          customer: {
            ...customerPayload,
          },
        },
        { embedded },
      );
    },
    onSuccess: (data) => {
      // Track booking creation
      trackBookingCreated({
        source: embedded ? 'embed' : 'public',
        serviceId: serviceId || undefined,
      });

      // Track payment if completed
      if (data.paymentStatus === 'PAID' && data.appointment) {
        const price = (data.appointment as any).service?.price;
        if (price) {
          trackPaymentCompleted({
            amount: typeof price === 'number' ? price.toString() : price,
            currency: 'AED',
          });
        }
      }

      if (embedded && typeof window !== 'undefined' && data?.portalSso) {
        window.parent?.postMessage(
          {
            type: 'bookly:portal-sso',
            token: data.portalSso.token,
            portalUrl: data.portalSso.portalUrl,
            expiresAt: data.portalSso.expiresAt,
          },
          '*',
        );
      }
      setPaymentError(null);
      reset();
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: customer,
  });

  useEffect(() => {
    if (!embedded) return;
    if (typeof window === 'undefined') return;

    const notify = () => {
      const height = document.body.scrollHeight;
      window.parent?.postMessage({ type: 'bookly:resize', height }, '*');
    };

    notify();

    const observer = new ResizeObserver(() => notify());
    observer.observe(document.body);

    window.addEventListener('resize', notify);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', notify);
    };
  }, [embedded, step]);

  if (bookingPageQuery.isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-neutral-500">Loading booking page…</div>;
  }

  if (!bookingPageQuery.data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-danger">
        Booking page not found or inactive.
      </div>
    );
  }

  const { bookingPage, business, services, staff } = bookingPageQuery.data;
  const selectedService = services.find((service) => service.id === serviceId);
  const servicePrice = selectedService ? Number(selectedService.price) : 0;
  const currency = business.currency ?? 'AED';
  const requiresPayment = Boolean(business.paymentsEnabled && servicePrice > 0);
  const paymentUnavailable = requiresPayment && !stripePromise;
  const priceLabel = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(servicePrice || 0);

  const onSubmit = handleSubmit(async (values) => {
    if (!serviceId || !slotStart) {
      return;
    }

    let paymentIntentId: string | undefined;

    if (requiresPayment) {
      if (paymentUnavailable) {
        setPaymentError('Online payments are temporarily unavailable.');
        return;
      }

      if (!stripe || !elements) {
        setPaymentError('Payment form is still loading. Please try again in a moment.');
        return;
      }

      const cardElement = elements.getElement(CardElement);

      if (!cardElement) {
        setPaymentError('Payment form is not ready yet.');
        return;
      }

      setIsProcessingPayment(true);

      try {
        const paymentIntent = await createPaymentIntent(
          slug,
          {
            serviceId,
            staffId: staffId || undefined,
            startTime: slotStart,
            customer: {
              firstName: values.firstName,
              lastName: values.lastName,
              email: values.email,
            },
          },
          { embedded },
        );

        const confirmation = await stripe.confirmCardPayment(paymentIntent.clientSecret, {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: `${values.firstName} ${values.lastName}`,
              email: values.email,
            },
          },
        });

        if (confirmation.error || confirmation.paymentIntent?.status !== 'succeeded') {
          throw new Error(confirmation.error?.message ?? 'Payment failed. Please try again.');
        }

        paymentIntentId = confirmation.paymentIntent?.id ?? paymentIntent.paymentIntentId;
        setPaymentError(null);
      } catch (error) {
        setPaymentError(error instanceof Error ? error.message : 'Payment failed. Please try again.');
        setIsProcessingPayment(false);
        return;
      }

      setIsProcessingPayment(false);
    }

    bookingMutation.mutate(
      { ...values, paymentIntentId },
      {
        onSuccess: () => {
          elements?.getElement(CardElement)?.clear();
        },
      },
    );
  });

  const isSubmitDisabled =
    !slotStart || bookingMutation.isPending || isProcessingPayment || (requiresPayment && paymentUnavailable);
  const submitLabel = isProcessingPayment
    ? 'Processing payment…'
    : bookingMutation.isPending
      ? 'Booking…'
      : 'Confirm Booking';

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <h2 className="text-h2 text-neutral-900">Select a service</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {services.map((service) => (
                <button
                  key={service.id}
                  onClick={() => setService(service.id)}
                  className={`text-left rounded-3xl border px-6 py-5 transition ${
                    serviceId === service.id ? 'border-primary bg-primary/5' : 'border-neutral-200 bg-white'
                  }`}
                >
                  <p className="text-h3 text-neutral-900">{service.name}</p>
                  <p className="text-sm text-neutral-500">{service.durationMinutes} min · AED {Number(service.price).toFixed(2)}</p>
                  {service.description && <p className="text-sm text-neutral-500 mt-2">{service.description}</p>}
                </button>
              ))}
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <h2 className="text-h2 text-neutral-900">Choose an instructor</h2>
            <div className="flex flex-wrap gap-3">
              <button
                className={`px-4 py-2 rounded-full border ${
                  !staffId ? 'border-primary text-primary' : 'border-neutral-200 text-neutral-600'
                }`}
                onClick={() => setStaff(undefined)}
              >
                Any instructor
              </button>
              {staff.map((member) => (
                <button
                  key={member.id}
                  className={`px-4 py-2 rounded-full border ${
                    staffId === member.id ? 'border-primary text-primary' : 'border-neutral-200 text-neutral-600'
                  }`}
                  onClick={() => setStaff(member.id)}
                >
                  {member.name}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button className="px-4 py-2 rounded-full border border-neutral-200" onClick={() => useBookingStore.setState({ step: 1 })}>
                Back
              </button>
              <button className="px-4 py-2 rounded-full bg-primary text-white" onClick={() => useBookingStore.setState({ step: 3 })}>
                Continue
              </button>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <h2 className="text-h2 text-neutral-900">Pick a time</h2>
            <div className="flex flex-wrap gap-3">
              {days.map((day) => (
                <button
                  key={day.toISOString()}
                  onClick={() => setDate(format(day, 'yyyy-MM-dd'))}
                  className={`px-4 py-2 rounded-2xl border ${
                    date === format(day, 'yyyy-MM-dd') ? 'border-primary text-primary' : 'border-neutral-200 text-neutral-600'
                  }`}
                >
                  {format(day, 'EEE dd')}
                </button>
              ))}
            </div>
            {date && (
              <div className="border rounded-3xl p-4">
                <p className="text-sm text-neutral-500 mb-3">Available slots</p>
                {availabilityQuery.isFetching && <p className="text-sm text-neutral-600">Loading slots…</p>}
                <div className="flex flex-wrap gap-3">
                  {availabilityQuery.data?.availability?.length ? (
                    availabilityQuery.data.availability.map((slot) => (
                      <button
                        key={slot.startTime + slot.staffId}
                        onClick={() => setSlot(slot.startTime)}
                        className={`px-4 py-2 rounded-full border ${
                          slotStart === slot.startTime ? 'border-primary text-primary' : 'border-neutral-200 text-neutral-600'
                        }`}
                      >
                        {format(new Date(slot.startTime), 'p')}
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-neutral-500">No slots left for this day.</p>
                  )}
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <button className="px-4 py-2 rounded-full border border-neutral-200" onClick={() => useBookingStore.setState({ step: 2 })}>
                Back
              </button>
              <button
                className="px-4 py-2 rounded-full bg-primary text-white disabled:opacity-60"
                disabled={!slotStart}
                onClick={() => useBookingStore.setState({ step: 4 })}
              >
                Continue
              </button>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-4">
            <h2 className="text-h2 text-neutral-900">Your details</h2>
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-neutral-500">First name</label>
                  <input className="mt-1 w-full rounded-2xl border px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none" {...register('firstName')} />
                  {errors.firstName && <p className="text-xs text-danger">{errors.firstName.message}</p>}
                </div>
                <div>
                  <label className="text-sm text-neutral-500">Last name</label>
                  <input className="mt-1 w-full rounded-2xl border px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none" {...register('lastName')} />
                  {errors.lastName && <p className="text-xs text-danger">{errors.lastName.message}</p>}
                </div>
              </div>
              <div>
                <label className="text-sm text-neutral-500">Email</label>
                <input className="mt-1 w-full rounded-2xl border px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none" {...register('email')} />
                {errors.email && <p className="text-xs text-danger">{errors.email.message}</p>}
              </div>
              <div>
                <label className="text-sm text-neutral-500">Phone</label>
                <input className="mt-1 w-full rounded-2xl border px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none" {...register('phone')} />
              </div>
              <div>
                <label className="text-sm text-neutral-500">Notes</label>
                <textarea className="mt-1 w-full rounded-2xl border px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none" rows={3} {...register('notes')} />
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" {...register('marketingConsent')} />
                <span className="text-sm text-neutral-500">Receive reminders and updates</span>
              </label>
              {requiresPayment && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-neutral-500">Card details</label>
                    <div className="mt-1 w-full rounded-2xl border px-4 py-3 bg-white">
                      <CardElement options={{ hidePostalCode: true }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
                    <span>Due now</span>
                    <span className="font-semibold">{priceLabel}</span>
                  </div>
                </div>
              )}
              {paymentUnavailable && (
                <div className="text-sm text-danger bg-danger/10 rounded-2xl px-4 py-3">
                  Online payments are not available right now. Please reach out to the studio to complete this booking.
                </div>
              )}
              {bookingMutation.isError && (
                <div className="text-sm text-danger">
                  {bookingMutation.error instanceof Error ? bookingMutation.error.message : 'Booking failed'}
                </div>
              )}
              {bookingMutation.isSuccess && (
                <div className="text-sm text-accent">Booking received! We&rsquo;ll confirm shortly.</div>
              )}
              {paymentError && <div className="text-sm text-danger">{paymentError}</div>}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="px-4 py-2 rounded-full border border-neutral-200"
                  onClick={() => useBookingStore.setState({ step: 3 })}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isSubmitDisabled}
                  className="px-6 py-3 rounded-full bg-primary text-white disabled:opacity-60"
                >
                  {submitLabel}
                </button>
              </div>
            </form>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={embedded ? 'bg-transparent' : 'min-h-screen bg-neutral-50'}>
      {!embedded && (
        <header className="max-w-4xl mx-auto px-6 py-10">
          <p className="text-sm uppercase tracking-wide text-primary font-semibold">{business.name}</p>
          <h1 className="text-display text-neutral-900">{bookingPage.name}</h1>
          <p className="text-neutral-500 max-w-2xl">
            Book your next session with real-time availability and instant confirmations.
          </p>
        </header>
      )}
      <main className={`${embedded ? 'max-w-3xl' : 'max-w-4xl'} mx-auto px-4 md:px-6 pb-10 md:pb-20`}>
        <div
          className={`rounded-3xl md:rounded-4xl shadow-card p-4 md:p-8 space-y-8 ${
            embedded ? 'bg-white/95 backdrop-blur' : 'bg-white'
          }`}
        >
          <div className="flex items-center gap-4">
            {[1, 2, 3, 4].map((idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    step >= idx ? 'bg-primary text-white' : 'bg-neutral-100 text-neutral-500'
                  }`}
                >
                  {idx}
                </div>
                {idx < 4 && <div className={`w-16 h-0.5 ${step > idx ? 'bg-primary' : 'bg-neutral-200'}`} />}
              </div>
            ))}
          </div>
          {renderStep()}
        </div>
      </main>
    </div>
  );
};

export const BookingPage = ({ embedded = false }: BookingPageProps = {}) => {
  if (stripePromise) {
    return (
      <Elements stripe={stripePromise}>
        <BookingPageForm embedded={embedded} />
      </Elements>
    );
  }

  return <BookingPageForm embedded={embedded} />;
};

export const BookingEmbedPage = () => <BookingPage embedded />;

