import { apiRequest } from './client';

export type TestDriveSnapshot = {
  testDriveStatus: string;
  testDriveActivatedAt?: string | null;
  testDriveEndsAt?: string | null;
  appointmentCount?: number;
  appointmentLimit?: number;
};

export const fetchTestDrive = () =>
  apiRequest<{ testDrive: TestDriveSnapshot | null }>('/test-drive');

export const updateTestDrive = (action: 'START' | 'COMPLETE', feedback?: string) =>
  apiRequest<{ testDrive: TestDriveSnapshot | null }>('/test-drive', {
    method: 'POST',
    body: JSON.stringify({ action, feedback }),
  });

