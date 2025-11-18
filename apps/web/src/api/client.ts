import { useAuthStore } from '../stores/authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

type RequestOptions = RequestInit & { auth?: boolean };

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const CONNECTION_ERROR_MESSAGE = `Cannot connect to API server at ${API_BASE_URL}. Please make sure the API server is running on port 4000.`;

const refreshAccessToken = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data?.accessToken) {
      const { updateAccessToken } = useAuthStore.getState();
      updateAccessToken(data.accessToken);
      return data.accessToken as string;
    }

    return null;
  } catch {
    return null;
  }
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true, ...requestOptions } = options;

  const performRequest = async (): Promise<T> => {
    try {
      const { accessToken } = useAuthStore.getState();
      const { headers: inputHeaders, ...restOptions } = requestOptions;
      const headers = new Headers({
        'Content-Type': 'application/json',
      });

      if (inputHeaders) {
        new Headers(inputHeaders).forEach((value, key) => {
          headers.set(key, value);
        });
      }

      if (auth && accessToken) {
        headers.set('Authorization', `Bearer ${accessToken}`);
      }

      const response = await fetch(`${API_BASE_URL}${path}`, {
        ...restOptions,
        headers,
        credentials: 'include',
      });

      if (!response.ok) {
        let message = 'Request failed';
        try {
          const raw = await response.text();
          if (raw) {
            try {
              const data = JSON.parse(raw);
              message = data.message ?? message;
            } catch {
              message = raw;
            }
          }
        } catch {
          // ignore parsing issues
        }
        throw new ApiError(message, response.status);
      }

      if (response.status === 204) {
        return {} as T;
      }

      return (await response.json()) as T;
    } catch (error: any) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error(CONNECTION_ERROR_MESSAGE);
      }
      throw error;
    }
  };

  try {
    return await performRequest();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && auth) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return performRequest();
      }
      const { clearSession } = useAuthStore.getState();
      clearSession();
      throw new Error('Session expired. Please sign in again.');
    }

    throw error;
  }
}

