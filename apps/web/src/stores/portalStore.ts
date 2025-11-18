import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type PortalCustomer = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
};

type PortalBusiness = {
  id?: string;
  name?: string | null;
};

type PortalState = {
  token?: string;
  customer?: PortalCustomer;
  business?: PortalBusiness;
  setSession: (payload: { token: string; customer: PortalCustomer; business?: PortalBusiness }) => void;
  clearSession: () => void;
};

export const usePortalStore = create<PortalState>()(
  persist(
    (set) => ({
      token: undefined,
      customer: undefined,
      business: undefined,
      setSession: ({ token, customer, business }) =>
        set({
          token,
          customer,
          business,
        }),
      clearSession: () =>
        set({
          token: undefined,
          customer: undefined,
          business: undefined,
        }),
    }),
    {
      name: 'bookly-portal-session',
      partialize: (state) => ({
        token: state.token,
        customer: state.customer,
        business: state.business,
      }),
    },
  ),
);

