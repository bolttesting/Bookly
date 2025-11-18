import { create } from 'zustand';

type BookingState = {
  step: number;
  serviceId?: string;
  staffId?: string;
  date?: string;
  slotStart?: string;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    marketingConsent: boolean;
    notes?: string;
  };
};

type BookingStore = BookingState & {
  setService: (serviceId: string) => void;
  setStaff: (staffId?: string) => void;
  setDate: (date: string) => void;
  setSlot: (slotStart: string) => void;
  setCustomer: (data: Partial<BookingState['customer']>) => void;
  nextStep: () => void;
  previousStep: () => void;
  reset: () => void;
};

const defaultCustomer = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  marketingConsent: true,
  notes: '',
};

export const useBookingStore = create<BookingStore>((set) => ({
  step: 1,
  customer: defaultCustomer,
  setService: (serviceId) => set({ serviceId, step: 2, staffId: undefined, date: undefined, slotStart: undefined }),
  setStaff: (staffId) => set({ staffId, date: undefined, slotStart: undefined }),
  setDate: (date) => set({ date, slotStart: undefined }),
  setSlot: (slotStart) => set({ slotStart }),
  setCustomer: (data) => set((state) => ({ customer: { ...state.customer, ...data } })),
  nextStep: () => set((state) => ({ step: Math.min(state.step + 1, 4) })),
  previousStep: () => set((state) => ({ step: Math.max(state.step - 1, 1) })),
  reset: () =>
    set({
      step: 1,
      serviceId: undefined,
      staffId: undefined,
      date: undefined,
      slotStart: undefined,
      customer: defaultCustomer,
    }),
}));

