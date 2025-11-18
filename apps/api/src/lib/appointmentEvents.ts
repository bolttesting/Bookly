import EventEmitter from 'node:events';

type AppointmentEventType = 'appointment.created' | 'appointment.updated' | 'appointment.deleted';

export type AppointmentEventPayload = {
  id: string;
  businessId: string;
  type: AppointmentEventType;
  data?: Record<string, unknown>;
};

const emitter = new EventEmitter();

export const publishAppointmentEvent = (event: AppointmentEventPayload) => {
  emitter.emit('appointment-event', event);
};

export const subscribeToAppointmentEvents = (
  listener: (event: AppointmentEventPayload) => void,
) => {
  emitter.on('appointment-event', listener);
  return () => emitter.off('appointment-event', listener);
};

