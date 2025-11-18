import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, AlertCircle, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';

import { createRefund } from '../api/payments';

type RefundModalProps = {
  appointment: {
    id: string;
    serviceName: string;
    servicePrice: number;
    paymentStatus: string;
    stripePaymentIntentId: string | null;
    customerName?: string;
  };
  isOpen: boolean;
  onClose: () => void;
};

export const RefundModal = ({ appointment, isOpen, onClose }: RefundModalProps) => {
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
  const [partialAmount, setPartialAmount] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const queryClient = useQueryClient();

  const refundMutation = useMutation({
    mutationFn: createRefund,
    onSuccess: (data) => {
      toast.success(`Refund of AED ${data.amount.toFixed(2)} processed successfully!`);
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      onClose();
    },
    onError: (error: Error) => {
      toast.error(`Refund failed: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (refundType === 'partial' && (!partialAmount || Number(partialAmount) <= 0)) {
      toast.error('Please enter a valid partial refund amount');
      return;
    }

    const amount = refundType === 'full' ? undefined : Number(partialAmount);

    if (amount && amount > appointment.servicePrice) {
      toast.error('Refund amount cannot exceed the original payment');
      return;
    }

    refundMutation.mutate({
      appointmentId: appointment.id,
      amount,
      reason: reason || undefined,
    });
  };

  if (!isOpen) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' }).format(amount);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-h3 text-neutral-900">Process Refund</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-neutral-100 transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-4 p-4 rounded-2xl bg-neutral-50">
          <p className="text-sm text-neutral-500 mb-1">Appointment</p>
          <p className="font-semibold text-neutral-900">{appointment.serviceName}</p>
          {appointment.customerName && (
            <p className="text-sm text-neutral-600 mt-1">Customer: {appointment.customerName}</p>
          )}
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-neutral-500">Original Amount</span>
            <span className="font-semibold text-neutral-900">{formatCurrency(appointment.servicePrice)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Refund Type
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRefundType('full')}
                className={`flex-1 px-4 py-2 rounded-full font-medium transition ${
                  refundType === 'full'
                    ? 'bg-primary text-white'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                Full Refund
              </button>
              <button
                type="button"
                onClick={() => setRefundType('partial')}
                className={`flex-1 px-4 py-2 rounded-full font-medium transition ${
                  refundType === 'partial'
                    ? 'bg-primary text-white'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                Partial Refund
              </button>
            </div>
          </div>

          {refundType === 'partial' && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Refund Amount
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" size={20} />
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={appointment.servicePrice}
                  value={partialAmount}
                  onChange={(e) => setPartialAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-full text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                Maximum: {formatCurrency(appointment.servicePrice)}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Reason (Optional)
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-2 border border-neutral-300 rounded-full focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select a reason</option>
              <option value="requested_by_customer">Requested by Customer</option>
              <option value="duplicate">Duplicate</option>
              <option value="fraudulent">Fraudulent</option>
              <option value="cancelled">Cancelled Appointment</option>
            </select>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-2xl bg-amber-50 border border-amber-200">
            <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />
            <p className="text-xs text-amber-800">
              This action cannot be undone. The refund will be processed immediately and the customer will be notified.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-full bg-neutral-100 hover:bg-neutral-200 font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={refundMutation.isPending}
              className="flex-1 px-4 py-2 rounded-full bg-red-600 text-white hover:bg-red-700 font-medium transition disabled:opacity-60"
            >
              {refundMutation.isPending ? 'Processing...' : 'Process Refund'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

