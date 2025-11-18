import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

import { apiRequest } from '../../api/client';

const schema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Password must be at least 8 characters'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!token) {
      toast.error('Invalid reset link');
      navigate('/forgot-password');
    }
  }, [token, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    if (!token) return;

    setIsSubmitting(true);
    try {
      await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          token,
          password: values.password,
        }),
        auth: false,
      });

      setIsSubmitted(true);
      toast.success('Password reset successfully!');
      
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return null;
  }

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
                <h1 className="text-h1 text-neutral-900">Reset Your Password</h1>
                <p className="text-sm text-neutral-500 mt-2">Enter your new password below.</p>
              </div>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-neutral-700 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                    />
                    <input
                      {...register('password')}
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      placeholder="Enter new password"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-neutral-900 placeholder:text-neutral-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-neutral-700 mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                    />
                    <input
                      {...register('confirmPassword')}
                      type={showConfirmPassword ? 'text' : 'password'}
                      id="confirmPassword"
                      placeholder="Confirm new password"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-neutral-900 placeholder:text-neutral-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Resetting...' : 'Reset Password'}
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
                <h2 className="text-h2 text-neutral-900">Password Reset Successful!</h2>
                <p className="text-sm text-neutral-500 mt-2">Redirecting to login...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

