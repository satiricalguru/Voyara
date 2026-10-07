import type { Addon, Booking, Coupon, Hotel, Paged, Payment, Review, Room, User } from '../types';
import { api } from './api';

export interface AdminStats {
  totals: {
    users: number; hotels: number; rooms: number; bookings: number; checkedIn: number; itineraries: number; rentals: number;
    subscribers: number; revenue: number; revenueThisMonth: number; occupancy: number;
  };
  byStatus: Record<string, number>;
  monthly: { _id: string; bookings: number; revenue: number }[];
  topHotels: { _id: string; name: string; city: string; bookings: number; revenue: number }[];
  recent: Booking[];
}

type Q = Record<string, string | number | undefined>;

export const adminService = {
  stats: () => api.get<AdminStats>('/admin/stats').then((r) => r.data),
  bookings: (params: Q = {}) => api.get<Paged<Booking>>('/admin/bookings', { params }).then((r) => r.data),
  users: (params: Q = {}) => api.get<Paged<User>>('/admin/users', { params }).then((r) => r.data),
  updateUser: (id: string, patch: { role?: string; isActive?: boolean }) => api.patch<{ user: User }>(`/admin/users/${id}`, patch).then((r) => r.data.user),
  payments: (params: Q = {}) => api.get<Paged<Payment>>('/admin/payments', { params }).then((r) => r.data),
  reviews: (params: Q = {}) => api.get<Paged<Review>>('/admin/reviews', { params }).then((r) => r.data),
  moderateReview: (id: string, isHidden: boolean) => api.patch(`/admin/reviews/${id}`, { isHidden }),
  hotels: (params: Q = {}) => api.get<Paged<Hotel>>('/hotels', { params: { limit: 100, ...params } }).then((r) => r.data),
  createHotel: (body: Record<string, unknown>) => api.post<{ hotel: Hotel }>('/hotels', body).then((r) => r.data.hotel),
  updateHotel: (id: string, body: Record<string, unknown>) => api.put<{ hotel: Hotel }>(`/hotels/${id}`, body).then((r) => r.data.hotel),
  archiveHotel: (id: string) => api.delete(`/hotels/${id}`),
  rooms: (hotelId: string) => api.get<{ rooms: Room[] }>(`/rooms/hotel/${hotelId}`).then((r) => r.data.rooms),
  createRoom: (body: Record<string, unknown>) => api.post<{ room: Room }>('/rooms', body).then((r) => r.data.room),
  updateRoom: (id: string, body: Record<string, unknown>) => api.put<{ room: Room }>(`/rooms/${id}`, body).then((r) => r.data.room),
  archiveRoom: (id: string) => api.delete(`/rooms/${id}`),
  coupons: () => api.get<{ coupons: Coupon[] }>('/coupons').then((r) => r.data.coupons),
  createCoupon: (body: Partial<Coupon>) => api.post<{ coupon: Coupon }>('/coupons', body).then((r) => r.data.coupon),
  updateCoupon: (id: string, body: Partial<Coupon>) => api.patch<{ coupon: Coupon }>(`/coupons/${id}`, body).then((r) => r.data.coupon),
  deleteCoupon: (id: string) => api.delete(`/coupons/${id}`),
  addons: () => api.get<{ addons: Addon[] }>('/addons', { params: { all: 1 } }).then((r) => r.data.addons),
  createAddon: (body: Partial<Addon>) => api.post<{ addon: Addon }>('/addons', body).then((r) => r.data.addon),
  updateAddon: (id: string, body: Partial<Addon>) => api.patch<{ addon: Addon }>(`/addons/${id}`, body).then((r) => r.data.addon),
  upload: (files: File[]) => {
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    return api.post<{ files: { url: string; name: string }[] }>('/upload', fd).then((r) => r.data.files);
  },
};
