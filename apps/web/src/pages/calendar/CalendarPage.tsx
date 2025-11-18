import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { Calendar, Views, type View } from 'react-big-calendar';
import { addDays, startOfDay, endOfDay } from 'date-fns';
import { RotateCcw, X } from 'lucide-react';

import { apiRequest } from '../../api/client';
import { useAppointmentStream } from '../../hooks/useAppointmentStream';
import { localizer } from '../../utils/calendarLocalizer';
import { RefundModal } from '../../components/RefundModal';

type Appointment = {
  id: string;
  startTime: string;
  endTime: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  paymentStatus?: string;
  stripePaymentIntentId?: string | null;
  service?: {
    name: string;
    color?: string | null;
    price?: any;
  };
  staff?: {
    name: string;
  };
  customer?: {
    firstName: string;
    lastName: string;
  };
};

const viewRangeMap: Record<View, number> = {
  day: 1,
  week: 7,
  work_week: 5,
  month: 30,
  agenda: 30,
};

const DnDCalendar = withDragAndDrop<CalendarEvent>(Calendar);

type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Appointment;
};

export const CalendarPage = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<View>(Views.WEEK);
  const queryClient = useQueryClient();
  const [banner, setBanner] = useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [refundAppointment, setRefundAppointment] = useState<Appointment | null>(null);
  const [showRefundModal, setShowRefundModal] = useState(false);

  useAppointmentStream();

  const range = useMemo(() => {
    const days = viewRangeMap[view] ?? 7;
    return {
      start: startOfDay(addDays(currentDate, -1)),
      end: endOfDay(addDays(currentDate, days)),
    };
  }, [currentDate, view]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['appointments', range.start.toISOString(), range.end.toISOString()],
    queryFn: () =>
      apiRequest<{ appointments: Appointment[] }>(
        `/appointments?rangeStart=${range.start.toISOString()}&rangeEnd=${range.end.toISOString()}`,
      ),
  });

  const events = useMemo(() => {
    return (
      data?.appointments?.map((appointment) => ({
        id: appointment.id,
        title: `${appointment.service?.name ?? 'Appointment'} ${
          appointment.customer ? `· ${appointment.customer.firstName} ${appointment.customer.lastName}` : ''
        }`,
        start: new Date(appointment.startTime),
        end: new Date(appointment.endTime),
        resource: appointment,
      })) ?? []
    );
  }, [data]);

  const updateAppointment = useMutation({
    mutationFn: ({ id, start, end }: { id: string; start: Date; end: Date }) =>
      apiRequest(`/appointments/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        }),
      }),
    onSuccess: async () => {
      setBanner(null);
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
    onError: (mutationError: unknown) => {
      const message = mutationError instanceof Error ? mutationError.message : 'Failed to update appointment';
      setBanner(message);
    },
  });

  const handleEventDrop = (args: any) => {
    const { event, start, end } = args;
    if (start instanceof Date && end instanceof Date) {
      updateAppointment.mutate({ id: event.id, start, end });
    }
  };

  const handleEventResize = (args: any) => {
    const { event, start, end } = args;
    if (start instanceof Date && end instanceof Date) {
      updateAppointment.mutate({ id: event.id, start, end });
    }
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedAppointment(event.resource);
  };

  const canRefund = (appointment: Appointment) => {
    return (
      appointment.paymentStatus === 'PAID' &&
      appointment.stripePaymentIntentId &&
      appointment.service?.price
    );
  };

  const eventStyleGetter = (event: typeof events[number]) => {
    const appointment = event.resource as Appointment;
    const bg = appointment.service?.color ?? '#8b5cf6';

    return {
      style: {
        backgroundColor: bg,
        borderRadius: '18px',
        border: 'none',
        color: '#fff',
        boxShadow: '0 10px 25px -10px rgba(15,23,42,0.35)',
        opacity: appointment.status === 'CANCELLED' ? 0.6 : 1,
      },
    };
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-h1 text-neutral-900">Calendar</h1>
          <p className="text-neutral-500">
            Drag-and-drop to reschedule, watch real-time updates, and stay on top of bookings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-4 py-2 rounded-full border border-neutral-200"
            onClick={() => setCurrentDate(new Date())}
          >
            Today
          </button>
        </div>
      </header>
      {banner && (
        <div className="rounded-3xl bg-warning/10 text-warning px-4 py-3 flex items-center justify-between">
          <span>{banner}</span>
          <button className="text-sm underline" onClick={() => setBanner(null)}>
            Dismiss
          </button>
        </div>
      )}
      {error instanceof Error && (
        <div className="rounded-3xl bg-danger/10 text-danger px-4 py-3">Failed to load: {error.message}</div>
      )}
      <div className="bg-white rounded-3xl shadow-card p-2">
        <DnDCalendar
          culture="en"
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 720 }}
          date={currentDate}
          view={view}
          onNavigate={(date) => setCurrentDate(date)}
          onView={(nextView) => setView(nextView)}
          views={[Views.DAY, Views.WEEK, Views.MONTH, Views.AGENDA]}
          onEventDrop={handleEventDrop}
          onEventResize={handleEventResize}
          onSelectEvent={handleEventClick}
          popup
          eventPropGetter={eventStyleGetter}
          messages={{
            today: 'Today',
            previous: 'Back',
            next: 'Next',
          }}
        />
        {isLoading && <div className="mt-2 text-sm text-neutral-500">Loading appointments…</div>}
      </div>

      {/* Appointment Details Modal */}
      {selectedAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-h3 text-neutral-900">Appointment Details</h3>
              <button
                onClick={() => setSelectedAppointment(null)}
                className="p-2 rounded-full hover:bg-neutral-100 transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm text-neutral-500">Service</p>
                <p className="font-semibold text-neutral-900">{selectedAppointment.service?.name || 'N/A'}</p>
              </div>

              {selectedAppointment.customer && (
                <div>
                  <p className="text-sm text-neutral-500">Customer</p>
                  <p className="font-semibold text-neutral-900">
                    {selectedAppointment.customer.firstName} {selectedAppointment.customer.lastName}
                  </p>
                </div>
              )}

              {selectedAppointment.staff && (
                <div>
                  <p className="text-sm text-neutral-500">Staff</p>
                  <p className="font-semibold text-neutral-900">{selectedAppointment.staff.name}</p>
                </div>
              )}

              <div>
                <p className="text-sm text-neutral-500">Date & Time</p>
                <p className="font-semibold text-neutral-900">
                  {new Date(selectedAppointment.startTime).toLocaleString()}
                </p>
              </div>

              <div>
                <p className="text-sm text-neutral-500">Status</p>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                    selectedAppointment.status === 'CONFIRMED'
                      ? 'bg-emerald-100 text-emerald-700'
                      : selectedAppointment.status === 'CANCELLED'
                        ? 'bg-red-100 text-red-700'
                        : selectedAppointment.status === 'COMPLETED'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-neutral-100 text-neutral-700'
                  }`}
                >
                  {selectedAppointment.status}
                </span>
              </div>

              {selectedAppointment.paymentStatus && (
                <div>
                  <p className="text-sm text-neutral-500">Payment Status</p>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      selectedAppointment.paymentStatus === 'PAID'
                        ? 'bg-emerald-100 text-emerald-700'
                        : selectedAppointment.paymentStatus === 'REFUNDED'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-neutral-100 text-neutral-700'
                    }`}
                  >
                    {selectedAppointment.paymentStatus}
                  </span>
                </div>
              )}

              {selectedAppointment.service?.price && (
                <div>
                  <p className="text-sm text-neutral-500">Amount</p>
                  <p className="font-semibold text-neutral-900">
                    {new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' }).format(
                      Number(selectedAppointment.service.price),
                    )}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              {canRefund(selectedAppointment) && (
                <button
                  onClick={() => {
                    setRefundAppointment(selectedAppointment);
                    setShowRefundModal(true);
                    setSelectedAppointment(null);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-red-600 text-white hover:bg-red-700 font-medium transition"
                >
                  <RotateCcw size={18} />
                  <span>Refund</span>
                </button>
              )}
              <button
                onClick={() => setSelectedAppointment(null)}
                className="flex-1 px-4 py-2 rounded-full bg-neutral-100 hover:bg-neutral-200 font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {showRefundModal && refundAppointment && (
        <RefundModal
          appointment={{
            id: refundAppointment.id,
            serviceName: refundAppointment.service?.name || 'Service',
            servicePrice: refundAppointment.service?.price ? Number(refundAppointment.service.price) : 0,
            paymentStatus: refundAppointment.paymentStatus || 'UNPAID',
            stripePaymentIntentId: refundAppointment.stripePaymentIntentId || null,
            customerName: refundAppointment.customer
              ? `${refundAppointment.customer.firstName} ${refundAppointment.customer.lastName}`
              : undefined,
          }}
          isOpen={showRefundModal}
          onClose={() => {
            setShowRefundModal(false);
            setRefundAppointment(null);
          }}
        />
      )}
    </div>
  );
};

