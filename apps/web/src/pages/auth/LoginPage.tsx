import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { Location } from 'react-router-dom';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { z } from 'zod';

import { apiRequest } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import type { AuthBusiness, AuthUser } from '../../stores/authStore';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type FormValues = z.infer<typeof schema>;

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const setSession = useAuthStore((state) => state.setSession);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (searchParams.get('verified') === 'true') {
      toast.success('Email verified successfully! You can now sign in.');
    }
  }, [searchParams]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const data = await apiRequest<{
        accessToken: string;
        user: AuthUser;
        business?: AuthBusiness;
        featureFlags?: Record<string, boolean>;
      }>('/auth/login', {
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

      toast.success(`Welcome back, ${data.user.firstName || data.user.email}!`);

      const state = location.state as { from?: Location } | null;
      const redirectTo = state?.from?.pathname ?? (data.user.role === 'SUPERADMIN' ? '/super-admin' : '/dashboard');
      navigate(redirectTo, { replace: true });
    } catch (error: any) {
      // Handle email verification requirement
      if (error?.status === 403 && error?.data?.requiresVerification) {
        toast.error('Please verify your email address before logging in.');
        // Could redirect to a verification page or show resend option
        return;
      }
      
      const errorMessage = error?.message || 'Failed to sign in. Please check your credentials.';
      toast.error(errorMessage);
      console.error('Login error:', error);
    }
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
      <div className="w-full max-w-md space-y-4 relative z-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition w-fit"
          aria-label="Back to home"
        >
          <ArrowLeft size={18} />
          <span>Home</span>
        </Link>
        <div className="bg-white rounded-3xl shadow-card p-8 space-y-6">
          <div>
            <p className="text-sm uppercase tracking-wide text-primary font-semibold">Bookly</p>
            <h1 className="text-h2 text-neutral-900 mt-2">Welcome back</h1>
            <p className="text-sm text-neutral-500">
              Sign in to manage your business, staff, and Pilates studio.
            </p>
          </div>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="text-sm text-neutral-600">Email</label>
            <input
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
              type="email"
              {...register('email')}
            />
            {errors.email && <p className="text-xs text-danger mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="text-sm text-neutral-600">Password</label>
            <div className="relative">
              <input
                className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 pr-12 text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-primary focus:outline-none"
                type={showPassword ? 'text' : 'password'}
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
          <div className="flex items-center justify-end">
            <Link
              to="/forgot-password"
              className="text-sm text-primary hover:underline font-medium"
            >
              Forgot password?
            </Link>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-primary text-white py-3 font-semibold hover:bg-primary/90 transition disabled:opacity-60"
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="text-sm text-neutral-500 text-center">
          Need an account?{' '}
          <Link className="text-primary font-semibold" to="/register">
            Create one
          </Link>
        </p>
        </div>
      </div>
    </div>
  );
};

