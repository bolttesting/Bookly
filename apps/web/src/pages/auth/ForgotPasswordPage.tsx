import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

import { apiRequest } from '../../api/client';

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type FormValues = z.infer<typeof schema>;

export const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify(values),
        auth: false,
      });

      setIsSubmitted(true);
      toast.success('If that email exists, we sent a password reset link.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send reset email');
    } finally {
      setIsSubmitting(false);
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
          to="/login"
          className="inline-flex items-center gap-2 rounded-full border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition w-fit"
          aria-label="Back to login"
        >
          <ArrowLeft size={18} />
          <span>Back to Login</span>
        </Link>
        <div className="bg-white rounded-3xl shadow-card p-8 space-y-6">
          {!isSubmitted ? (
            <>
              <div>
                <h1 className="text-h1 text-neutral-900">Forgot Password?</h1>
                <p className="text-sm text-neutral-500 mt-2">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
              </div>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                    />
                    <input
                      {...register('email')}
                      type="email"
                      id="email"
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-neutral-900 placeholder:text-neutral-400"
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-emerald-100 p-3">
                  <CheckCircle size={32} className="text-emerald-600" />
                </div>
              </div>
              <div>
                <h2 className="text-h2 text-neutral-900">Check Your Email</h2>
                <p className="text-sm text-neutral-500 mt-2">
                  We've sent a password reset link to your email address. Please check your inbox and follow the
                  instructions.
                </p>
              </div>
              <Link
                to="/login"
                className="inline-block text-primary hover:underline text-sm font-medium"
              >
                Back to Login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

