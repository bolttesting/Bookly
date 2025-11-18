import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { apiRequest } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';

type FormValues = {
  businessName?: string;
  industry?: string;
  timezone?: string;
  currency?: string;
  defaultHours?: string;
  serviceName?: string;
  duration?: number;
  price?: number;
  staffName?: string;
  staffEmail?: string;
};

const INDUSTRY_OPTIONS = [
  {
    id: 'pilates_fitness',
    title: 'Studios & Fitness',
    description: 'Pilates, yoga, boutique gyms, personal trainers.',
    accent: '#8b5cf6',
    service: {
      name: 'Intro Reformer Session',
      duration: 55,
      price: 320,
    },
  },
  {
    id: 'salon_spa',
    title: 'Salons & Spas',
    description: 'Hair, nails, massage, cosmetic studios.',
    accent: '#f97316',
    service: {
      name: 'Signature Spa Package',
      duration: 90,
      price: 550,
    },
  },
  {
    id: 'medical_wellness',
    title: 'Medical & Wellness',
    description: 'Clinics, physiotherapy, wellness retreats.',
    accent: '#0ea5e9',
    service: {
      name: 'Wellness Consult',
      duration: 60,
      price: 450,
    },
  },
  {
    id: 'agency_consultancy',
    title: 'Agencies & Consultancies',
    description: 'Marketing, creative, professional services.',
    accent: '#14b8a6',
    service: {
      name: 'Strategy Intensive',
      duration: 75,
      price: 850,
    },
  },
  {
    id: 'coworking_memberships',
    title: 'Coworking & Communities',
    description: 'Membership clubs, coworking, learning hubs.',
    accent: '#f43f5e',
    service: {
      name: 'Workspace Day Pass',
      duration: 480,
      price: 150,
    },
  },
] as const;

const industryMap = INDUSTRY_OPTIONS.reduce<Record<string, (typeof INDUSTRY_OPTIONS)[number]>>(
  (acc, option) => {
    acc[option.id] = option;
    return acc;
  },
  {},
);

const steps = [
  { id: 1, title: 'Business basics', description: 'Name, industry, timezone, and currency.' },
  { id: 2, title: 'Hours & first service', description: 'Default hours and first service setup.' },
  { id: 3, title: 'Invite staff', description: 'Confirm owner profile and invite staff.' },
];

export const OnboardingWizard = () => {
  const queryClient = useQueryClient();
  const business = useAuthStore((state) => state.business);
  const [activeStep, setActiveStep] = useState(1);

  const { data: onboardingData, isLoading } = useQuery({
    queryKey: ['onboarding-state'],
    queryFn: () => apiRequest<{ onboardingState: string; onboardingContext?: { step: number } }>(
      '/onboarding/state',
    ),
  });

  useEffect(() => {
    if (onboardingData?.onboardingContext?.step) {
      setActiveStep(onboardingData.onboardingContext.step);
    }
  }, [onboardingData]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      apiRequest('/onboarding/step', {
        method: 'POST',
        body: JSON.stringify({
          step: activeStep,
          data: values,
          complete: activeStep === steps.length,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-state'] });
      if (activeStep < steps.length) {
        setActiveStep((prev) => prev + 1);
      }
    },
  });

  const defaultValues = useMemo<FormValues>(
    () => ({
      businessName: business?.name,
      industry: (business?.industry as (typeof INDUSTRY_OPTIONS)[number]['id']) ?? INDUSTRY_OPTIONS[0].id,
      timezone: 'Asia/Dubai',
      currency: 'AED',
      defaultHours: 'Mon-Fri 9am-6pm',
      duration: 60,
      price: 250,
    }),
    [business],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
    watch,
    setValue,
  } = useForm<FormValues>({
    defaultValues,
  });

  const industryValue = watch('industry');

  useEffect(() => {
    if (!industryValue) {
      setValue('industry', defaultValues.industry ?? INDUSTRY_OPTIONS[0].id);
    }
    if (business?.industry) {
      setValue('industry', business.industry as (typeof INDUSTRY_OPTIONS)[number]['id']);
    }
  }, [industryValue, defaultValues.industry, setValue, business?.industry]);

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const onSubmit = async (values: FormValues) => {
    await mutation.mutateAsync(values);
    reset(defaultValues);
  };

  if (isLoading) {
    return <div>Loading onboarding...</div>;
  }

  return (
    <div className="space-y-4 lg:space-y-8">
      <header className="rounded-2xl lg:rounded-3xl bg-white shadow-card p-4 lg:p-8 flex flex-col gap-2">
        <p className="text-xs lg:text-sm text-primary font-semibold uppercase tracking-wide">
          Guided onboarding
        </p>
        <h2 className="text-xl lg:text-h1 text-neutral-900">Complete your workspace setup</h2>
        <p className="text-sm lg:text-base text-neutral-600 max-w-2xl">
          We&apos;ll walk you through business details, Pilates-ready services, and staff invites so
          you can publish a booking page in minutes.
        </p>
        <div className="flex gap-2 mt-3 lg:mt-4">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`h-2 flex-1 rounded-full ${
                activeStep >= step.id ? 'bg-primary' : 'bg-neutral-200'
              }`}
            />
          ))}
        </div>
      </header>
      <div className="grid gap-4 lg:gap-6 lg:grid-cols-[250px,1fr]">
        <aside className="hidden lg:block bg-white rounded-2xl lg:rounded-3xl shadow-card p-4 lg:p-6 space-y-3 lg:space-y-4">
          {steps.map((step) => (
            <button
              key={step.id}
              className={`w-full text-left p-4 rounded-2xl border ${
                activeStep === step.id
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-transparent text-neutral-500'
              }`}
              onClick={() => setActiveStep(step.id)}
            >
              <p className="text-sm font-semibold">Step {step.id}</p>
              <p className="text-base">{step.title}</p>
            </button>
          ))}
        </aside>
        <section className="bg-white rounded-2xl lg:rounded-3xl shadow-card p-4 lg:p-8">
          <h3 className="text-lg lg:text-h2 text-neutral-900 mb-2">{steps[activeStep - 1]?.title}</h3>
          <p className="text-sm lg:text-base text-neutral-500 mb-4 lg:mb-6">{steps[activeStep - 1]?.description}</p>
          <form className="space-y-4 lg:space-y-5" onSubmit={handleSubmit(onSubmit)}>
            {activeStep === 1 && (
              <>
                <div>
                  <label className="text-sm text-neutral-600">Business name</label>
                  <input
                    className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
                    {...register('businessName')}
                  />
                </div>
                <div className="space-y-4">
                  <label className="text-sm text-neutral-600">Industry</label>
                  {business?.industry ? (
                    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
                      <p className="text-sm font-semibold text-primary">
                        {industryMap[business.industry]?.title ?? 'Studios & Fitness'}
                      </p>
                      <p className="text-xs text-neutral-500 mt-1">
                        {industryMap[business.industry]?.description ||
                          'Your workspace is pre-configured for studios & fitness.'}
                      </p>
                      <p className="text-xs text-neutral-500 mt-3">
                        Need to switch industries? Contact support to update your presets.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {INDUSTRY_OPTIONS.map((option) => (
                        <button
                          type="button"
                          key={option.id}
                          onClick={() => setValue('industry', option.id)}
                          className={`text-left rounded-2xl border px-4 py-4 transition ${
                            industryValue === option.id
                              ? 'border-primary bg-primary/5 text-primary'
                              : 'border-neutral-200 text-neutral-600'
                          }`}
                        >
                          <p className="text-sm font-semibold" style={{ color: option.accent }}>
                            {option.title}
                          </p>
                          <p className="text-xs text-neutral-500 mt-1">{option.description}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  <input type="hidden" {...register('industry')} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-neutral-600">Timezone</label>
                    <input
                      className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
                      {...register('timezone')}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-neutral-600">Currency</label>
                    <input
                      className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
                      {...register('currency')}
                    />
                  </div>
                </div>
              </>
            )}
            {activeStep === 2 && (
              <>
                <div>
                  <label className="text-sm text-neutral-600">Default hours</label>
                  <input
                    className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
                    {...register('defaultHours')}
                  />
                </div>
                {industryValue && industryMap[industryValue] && (
                  <div className="rounded-3xl border border-primary/30 bg-primary/5 p-4 flex flex-col gap-2">
                    <p className="text-sm font-semibold text-primary">
                      Recommended for {industryMap[industryValue].title}
                    </p>
                    <p className="text-xs text-neutral-600">
                      {industryMap[industryValue].service.name} · {industryMap[industryValue].service.duration}
                      min · AED {industryMap[industryValue].service.price}
                    </p>
                    <button
                      type="button"
                      className="self-start rounded-full px-4 py-2 text-xs font-semibold bg-primary text-white"
                      onClick={() => {
                        const preset = industryMap[industryValue];
                        setValue('serviceName', preset.service.name);
                        setValue('duration', preset.service.duration);
                        setValue('price', preset.service.price);
                      }}
                    >
                      Use this preset
                    </button>
                  </div>
                )}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-neutral-600">Service name</label>
                    <input
                      className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
                      {...register('serviceName')}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-neutral-600">Duration (minutes)</label>
                    <input
                      type="number"
                      className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
                      {...register('duration', { valueAsNumber: true })}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-neutral-600">Price (AED)</label>
                    <input
                      type="number"
                      className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
                      {...register('price', { valueAsNumber: true })}
                    />
                  </div>
                </div>
              </>
            )}
            {activeStep === 3 && (
              <>
                <div>
                  <label className="text-sm text-neutral-600">Staff name</label>
                  <input
                    className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
                    {...register('staffName')}
                  />
                </div>
                <div>
                  <label className="text-sm text-neutral-600">Staff email</label>
                  <input
                    type="email"
                    className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
                    {...register('staffEmail')}
                  />
                </div>
              </>
            )}
            <div className="flex justify-between items-center pt-4">
              <p className="text-sm text-neutral-500">
                Step {activeStep} of {steps.length}
              </p>
              <button
                type="submit"
                className="px-6 py-3 rounded-2xl bg-primary text-white font-semibold"
                disabled={isSubmitting || mutation.isPending}
              >
                {activeStep === steps.length ? 'Finish setup' : 'Save & continue'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

