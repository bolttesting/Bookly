export const APPOINTMENT_STATUS_VALUES = [
  'PENDING',
  'CONFIRMED',
  'CANCELLED',
  'COMPLETED',
] as const;
export type AppointmentStatusValue = (typeof APPOINTMENT_STATUS_VALUES)[number];

export const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatusValue[] = ['PENDING', 'CONFIRMED'];

export const APPOINTMENT_SOURCE_VALUES = ['INTERNAL', 'PUBLIC', 'CLIENT_PORTAL'] as const;
export type AppointmentSourceValue = (typeof APPOINTMENT_SOURCE_VALUES)[number];

export const STAFF_ROLE_VALUES = ['OWNER', 'TEAM', 'ADMIN'] as const;
export type StaffRoleValue = (typeof STAFF_ROLE_VALUES)[number];

export const AUDIT_ACTIONS = {
  AUTH_LOGIN: 'AUTH_LOGIN',
  AUTH_LOGOUT: 'AUTH_LOGOUT',
  USER_CREATED: 'USER_CREATED',
  STAFF_CREATED: 'STAFF_CREATED',
  STAFF_UPDATED: 'STAFF_UPDATED',
  STAFF_DELETED: 'STAFF_DELETED',
  SERVICE_CREATED: 'SERVICE_CREATED',
  SERVICE_UPDATED: 'SERVICE_UPDATED',
  SERVICE_DELETED: 'SERVICE_DELETED',
  PAYMENT_SETTINGS_UPDATED: 'PAYMENT_SETTINGS_UPDATED',
} as const;
export type AuditActionValue = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
export const AUDIT_ACTION_VALUES = Object.values(AUDIT_ACTIONS) as AuditActionValue[];

export const CLASS_TYPE_VALUES = ['MAT', 'REFORMER', 'TOWER', 'PRIVATE'] as const;
export type ClassTypeValue = (typeof CLASS_TYPE_VALUES)[number];

export const SERVICE_CAPACITY_TYPE_VALUES = ['SINGLE', 'MULTI'] as const;
export type ServiceCapacityTypeValue = (typeof SERVICE_CAPACITY_TYPE_VALUES)[number];

export const CUSTOMER_PACKAGE_STATUS_VALUES = ['ACTIVE', 'PAUSED', 'EXPIRED'] as const;
export type CustomerPackageStatus = (typeof CUSTOMER_PACKAGE_STATUS_VALUES)[number];

