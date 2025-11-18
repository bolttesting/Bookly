import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays, startOfWeek } from 'date-fns';
import { X, Calendar, Clock } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

import { reschedulePortalAppointment, fetchPortalAppointments } from '../api/portal';

type Appointment = {
  id: string;
  startTime: string;
  endTime: string;
  service: { name: string } | null;
  staff: { name: string } | null;
};

type RescheduleModalProps = {
  appointment: Appointment;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
};

export const RescheduleModal = ({ appointment, token, onClose, onSuccess }: RescheduleModalProps) => {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<string>(
    format(new Date(appointment.startTime), 'yyyy-MM-dd'),
  );
  const [selectedTime, setSelectedTime] = useState<string>('');

  // Fetch availability for the selected date
  const availabilityQuery = useQuery({
    queryKey: ['portal-availability', appointment.id, selectedDate],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/client-portal/appointments/${appointment.id}/availability?date=${selectedDate}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (!response.ok) throw new Error('Failed to fetch availability');
      return response.json();
    },
    enabled: Boolean(selectedDate),
  });

  const rescheduleMutation = useMutation({
    mutationFn: ({ newStartTime, newEndTime }: { newStartTime: string; newEndTime?: string }) =>
      reschedulePortalAppointment(token, appointment.id, newStartTime, newEndTime),
    onSuccess: () => {
      toast.success('Appointment rescheduled successfully!');
      queryClient.invalidateQueries({ queryKey: ['portal-appointments'] });
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to reschedule appointment');
    },
  });

  const slots = availabilityQuery.data?.availability || [];
  const availableSlots = slots.filter((slot: any) => slot.available);

  // Generate date options (next 14 days)
  const dateOptions = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(new Date(), i);
    return {
      value: format(date, 'yyyy-MM-dd'),
      label: format(date, 'EEE, MMM d'),
      isToday: i === 0,
    };
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTime) {
      toast.error('Please select a time slot');
      return;
    }

    const [hours, minutes] = selectedTime.split(':').map(Number);
    const newStartTime = new Date(selectedDate);
    newStartTime.setHours(hours, minutes, 0, 0);
    const newEndTime = new Date(newStartTime.getTime() + 60 * 60 * 1000); // Default 1 hour, should use service duration

    rescheduleMutation.mutate({
      newStartTime: newStartTime.toISOString(),
      newEndTime: newEndTime.toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-neutral-900">Reschedule Appointment</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-neutral-100 transition"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <p className="text-sm text-neutral-500 mb-2">Current appointment</p>
            <div className="rounded-2xl border border-neutral-200 p-4">
              <p className="font-semibold text-neutral-900">{appointment.service?.name}</p>
              <p className="text-sm text-neutral-500 mt-1">
                {format(new Date(appointment.startTime), 'EEE, MMM d, yyyy')} at{' '}
                {format(new Date(appointment.startTime), 'h:mm a')}
              </p>
              {appointment.staff && (
                <p className="text-sm text-neutral-500">with {appointment.staff.name}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              <Calendar size={16} className="inline mr-2" />
              Select Date
            </label>
            <select
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setSelectedTime('');
              }}
              className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-neutral-900 focus:border-primary focus:ring-primary focus:outline-none"
            >
              {dateOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} {option.isToday && '(Today)'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              <Clock size={16} className="inline mr-2" />
              Select Time
            </label>
            {availabilityQuery.isLoading ? (
              <div className="text-center py-8 text-neutral-500">Loading available times...</div>
            ) : availabilityQuery.error ? (
              <div className="text-center py-8 text-red-500">
                Failed to load availability. Please try again.
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">
                No available time slots for this date. Please select another date.
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {availableSlots.map((slot: any) => {
                  const timeStr = format(new Date(slot.startTime), 'HH:mm');
                  const isSelected = selectedTime === timeStr;
                  return (
                    <button
                      key={slot.startTime}
                      type="button"
                      onClick={() => setSelectedTime(timeStr)}
                      className={`px-4 py-2 rounded-xl border text-sm font-medium transition ${
                        isSelected
                          ? 'border-primary bg-primary text-white'
                          : 'border-neutral-200 text-neutral-700 hover:border-primary hover:bg-primary/5'
                      }`}
                    >
                      {format(new Date(slot.startTime), 'h:mm a')}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t border-neutral-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-2xl border border-neutral-200 text-neutral-700 font-semibold hover:bg-neutral-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedTime || rescheduleMutation.isPending}
              className="flex-1 px-4 py-3 rounded-2xl bg-primary text-white font-semibold hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {rescheduleMutation.isPending ? 'Rescheduling...' : 'Confirm Reschedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

