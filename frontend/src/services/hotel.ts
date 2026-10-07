import type { Addon, Hotel, Paged, Review, Room } from '../types';
import { api, cachedGet } from './api';

export interface SearchParams {
  location?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  minPrice?: number;
  maxPrice?: number;
  stars?: number;
  category?: string;
  amenities?: string;
  sort?: string;
}

const clean = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && v !== null));

export const hotelService = {
  list: (params: Record<string, unknown> = {}) => api.get<Paged<Hotel>>('/hotels', { params: clean(params) }).then((r) => r.data),
  search: (params: SearchParams) => api.get<{ items: Hotel[]; total: number }>('/search', { params: clean(params) }).then((r) => r.data),
  suggest: (q: string) => api.get<{ suggestions: { type: string; label: string; sub?: string; slug?: string }[] }>('/search/suggest', { params: { q } }).then((r) => r.data.suggestions),
  get: (idOrSlug: string, params: { checkIn?: string; checkOut?: string } = {}) =>
    api.get<{ hotel: Hotel; rooms: Room[]; ratingBreakdown: Record<string, number>; nearby: Hotel[] }>(`/hotels/${idOrSlug}`, { params: clean(params) }).then((r) => r.data),
  reviews: (hotelId: string, params: { page?: number; sort?: string } = {}) =>
    api.get<Paged<Review> & { reviews: Review[]; canReview: boolean }>(`/reviews/hotel/${hotelId}`, { params: clean(params) }).then((r) => r.data),
  latestReviews: () => cachedGet('latest-reviews', 5 * 60_000, () => api.get<{ reviews: Review[] }>('/reviews/latest').then((r) => r.data.reviews)),
  addReview: (body: { hotelId: string; rating: number; title?: string; comment: string; tripType?: string }) =>
    api.post<{ review: Review }>('/reviews', body).then((r) => r.data.review),
  deleteReview: (id: string) => api.delete(`/reviews/${id}`),
  addons: () => cachedGet('addons', 5 * 60_000, () => api.get<{ addons: Addon[] }>('/addons').then((r) => r.data.addons)),
  amenities: () => api.get<{ amenities: { key: string; label: string }[] }>('/addons/amenities').then((r) => r.data.amenities),
  wishlistIds: () => api.get<{ ids: string[] }>('/wishlist/ids').then((r) => r.data.ids),
  wishlist: () => api.get<{ hotels: Hotel[] }>('/wishlist').then((r) => r.data.hotels),
  toggleWishlist: (hotelId: string) => api.post<{ saved: boolean; ids: string[] }>('/wishlist/toggle', { hotelId }).then((r) => r.data),
  subscribe: (email: string, source = 'footer') => api.post<{ message: string }>('/newsletter/subscribe', { email, source }).then((r) => r.data),
};
