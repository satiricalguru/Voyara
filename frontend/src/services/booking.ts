import type { Booking, Payment, Pricing } from '../types';
import { api } from './api';

export interface BookingInput {
  roomId: string;
  checkIn: string;
  checkOut: string;
  guests: { adults: number; children: number };
  roomsCount: number;
  addons: { addonId: string; quantity: number }[];
  couponCode?: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  specialRequests?: string;
}

export type PayMethod = 'CARD' | 'UPI' | 'NETBANKING' | 'WALLET' | 'PAY_AT_HOTEL';

export const bookingService = {
  quote: (body: Omit<BookingInput, 'guestName' | 'guestEmail' | 'guestPhone' | 'specialRequests'>) =>
    api
      .post<{ nights: number; available: number; pricing: Pricing; addons: Booking['addons']; coupon?: { code: string; description?: string } }>('/bookings/quote', body)
      .then((r) => r.data),
  create: (body: BookingInput) => api.post<{ booking: Booking }>('/bookings', body).then((r) => r.data.booking),
  mine: (scope?: 'upcoming' | 'past' | 'cancelled') => api.get<{ bookings: Booking[] }>('/bookings/my', { params: { scope } }).then((r) => r.data.bookings),
  get: (id: string) => api.get<{ booking: Booking; payments: Payment[] }>(`/bookings/${id}`).then((r) => r.data),
  cancel: (id: string, reason?: string) => api.patch<{ booking: Booking }>(`/bookings/${id}/cancel`, { reason }).then((r) => r.data.booking),
  pay: (bookingId: string, method: PayMethod, extra: { last4?: string; simulateFailure?: boolean } = {}) =>
    api.post<{ booking: Booking; payment: Payment }>('/payments', { bookingId, method, ...extra }).then((r) => r.data),
  validateCoupon: (code: string, amount: number) =>
    api.post<{ valid: boolean; code: string; description?: string; discount: number }>('/coupons/validate', { code, amount }).then((r) => r.data),
  publicCoupons: () => api.get<{ coupons: { code: string; description?: string }[] }>('/coupons/public').then((r) => r.data.coupons),
  invoicePath: (id: string) => `/bookings/${id}/invoice`,
};
