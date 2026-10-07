import type { Booking } from '../types';
import { api } from './api';

export type StaffView = 'arrivals' | 'departures' | 'in-house' | 'all';

export const staffService = {
  bookings: (view: StaffView, q?: string, date?: string) =>
    api
      .get<{ bookings: Booking[]; counts: { arrivals: number; departures: number; inHouse: number } }>('/staff/bookings', { params: { view: view === 'all' ? undefined : view, q: q || undefined, date } })
      .then((r) => r.data),
  checkIn: (bookingId: string) => api.post<{ booking: Booking }>('/staff/check-in', { bookingId }).then((r) => r.data.booking),
  checkOut: (bookingId: string) => api.post<{ booking: Booking }>('/staff/check-out', { bookingId }).then((r) => r.data.booking),
};
