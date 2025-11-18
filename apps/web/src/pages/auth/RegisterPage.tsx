import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Eye, EyeOff, Info } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { apiRequest } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import type { AuthBusiness, AuthUser } from '../../stores/authStore';
import { trackUserRegistered } from '../../utils/plausible';

const INDUSTRY_VALUES = [
  'pilates_fitness',
  'salon_spa',
  'medical_wellness',
  'agency_consultancy',
  'coworking_memberships',
] as const;

const INDUSTRY_OPTIONS: { id: (typeof INDUSTRY_VALUES)[number]; label: string; description: string }[] = [
  {
    id: 'pilates_fitness',
    label: 'Studios & Fitness',
    description: 'Pilates, yoga, gyms, boutique fitness',
  },
  {
    id: 'salon_spa',
    label: 'Salons & Spas',
    description: 'Hair, nails, spa, cosmetic studios',
  },
  {
    id: 'medical_wellness',
    label: 'Medical & Wellness',
    description: 'Clinics, therapy, wellness centers',
  },
  {
    id: 'agency_consultancy',
    label: 'Agencies & Consultancies',
    description: 'Professional services & agencies',
  },
  {
    id: 'coworking_memberships',
    label: 'Coworking & Communities',
    description: 'Membership clubs, learning hubs',
  },
];

const schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  businessName: z.string().min(2),
  industry: z.enum(INDUSTRY_VALUES),
});

type FormValues = z.infer<typeof schema>;

export const RegisterPage = () => {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [showPassword, setShowPassword] = useState(false);
  const [hoveredIndustry, setHoveredIndustry] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      industry: INDUSTRY_VALUES[0],
    },
  });


  const onSubmit = async (values: FormValues) => {
    const data = await apiRequest<{
      accessToken: string;
      user: AuthUser;
      business?: AuthBusiness;
      featureFlags?: Record<string, boolean>;
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(values),
      auth: false,
    });

    setSession({
      user: data.user,
      business: data.business,
      accessToken: data.accessToken,
      featureFlags: data.featureFlags,
    });

    // Track user registration
    trackUserRegistered({
      industry: values.industry,
    });

    navigate('/onboarding');
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 transition-[background] duration-700 relative overflow-hidden"
      style={{
        background:
          'radial-gradient(circle at top,#fffdf6 0%,transparent 45%),linear-gradient(135deg,#fefefe,#f4f7ff 60%,#e6f5ff)',
      }}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.35),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(16,185,129,0.25),transparent_65%)]" />
      </div>
      <div className="w-full max-w-2xl space-y-4 relative z-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition w-fit"
          aria-label="Back to home"
        >
          <ArrowLeft size={18} />
          <span>Home</span>
        </Link>
        <div className="bg-white rounded-3xl shadow-card p-10 space-y-6">
          <div>
            <p className="text-sm uppercase tracking-wide text-primary font-semibold">Start free</p>
            <h1 className="text-display text-neutral-900">Create your Bookly hub</h1>
            <p className="text-sm text-neutral-500">
              One workspace to run salons, spas, Pilates studios, healthcare clinics, and more.
            </p>
          </div>
        <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="text-sm text-neutral-600">First name</label>
            <input
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
              {...register('firstName')}
            />
            {errors.firstName && (
              <p className="text-xs text-danger mt-1">{errors.firstName.message}</p>
            )}
          </div>
          <div>
            <label className="text-sm text-neutral-600">Last name</label>
            <input
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
              {...register('lastName')}
            />
            {errors.lastName && (
              <p className="text-xs text-danger mt-1">{errors.lastName.message}</p>
            )}
          </div>
          <div>
            <label className="text-sm text-neutral-600">Work email</label>
            <input
              type="email"
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
              {...register('email')}
            />
            {errors.email && <p className="text-xs text-danger mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="text-sm text-neutral-600">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 pr-12 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-neutral-500 hover:text-neutral-700 transition"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-danger mt-1">{errors.password.message}</p>
            )}
          </div>
          <div>
            <label className="text-sm text-neutral-600">Business / Studio name</label>
            <input
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
              {...register('businessName')}
            />
            {errors.businessName && (
              <p className="text-xs text-danger mt-1">{errors.businessName.message}</p>
            )}
          </div>
          <div>
            <label className="text-sm text-neutral-600">Industry</label>
            <div className="mt-1 relative">
              <div className="relative">
                <select
                  className="w-full rounded-2xl border border-neutral-200 px-4 py-3 pr-14 bg-white text-neutral-900 focus:border-primary focus:ring-primary focus:outline-none appearance-none"
                  style={{ backgroundImage: 'none' }}
                  {...register('industry')}
                >
                  {INDUSTRY_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex items-center gap-2">
                  <div
                    className="relative"
                    onMouseEnter={() => setHoveredIndustry('all')}
                    onMouseLeave={() => setHoveredIndustry(null)}
                  >
                    <Info
                      size={18}
                      className="text-neutral-400 hover:text-neutral-600 cursor-help transition-colors"
                    />
                    {hoveredIndustry === 'all' && (
                      <div className="absolute right-0 top-6 w-72 p-4 bg-neutral-900 text-white text-xs rounded-lg shadow-xl z-[100] pointer-events-none">
                        <div className="space-y-3">
                          {INDUSTRY_OPTIONS.map((option) => (
                            <div key={option.id}>
                              <div className="font-semibold mb-0.5 text-white">{option.label}</div>
                              <div className="text-neutral-300">{option.description}</div>
                            </div>
                          ))}
                        </div>
                        <div className="absolute -top-1 right-4 w-2 h-2 bg-neutral-900 rotate-45" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {errors.industry && (
              <p className="text-xs text-danger mt-1">{errors.industry.message}</p>
            )}
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-2xl bg-primary text-white py-4 font-semibold hover:bg-primary/90 transition disabled:opacity-60"
            >
              {isSubmitting ? 'Creating workspace...' : 'Create my workspace'}
            </button>
          </div>
        </form>
        <p className="text-sm text-neutral-500 text-center">
          Already using Bookly?{' '}
          <Link className="text-primary font-semibold" to="/login">
            Sign in
          </Link>
        </p>
        </div>
      </div>
    </div>
  );
};

