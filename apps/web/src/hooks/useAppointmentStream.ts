import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { EventSourcePolyfill } from 'event-source-polyfill';

import { useAuthStore } from '../stores/authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

export const useAppointmentStream = () => {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);

  useEffect(() => {
    if (!accessToken) return;

    const eventSource = new EventSourcePolyfill(`${API_BASE_URL}/appointments/stream`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      withCredentials: true,
    });

    eventSource.onmessage = (event) => {
      if (!event.data) return;
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [accessToken, queryClient]);
};

