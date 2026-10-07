import type { Booking, Itinerary, Payment, RentalBooking, RentalShop, TripDocument } from '../types';
import { api } from './api';
import type { PayMethod } from './booking';

export const tripService = {
  mine: () => api.get<{ trips: Itinerary[] }>('/trip/my').then((r) => r.data.trips),
  community: (destination?: string) => api.get<{ trips: Itinerary[] }>('/trip/community', { params: { destination } }).then((r) => r.data.trips),
  get: (id: string) => api.get<{ trip: Itinerary; isOwner: boolean; documents: TripDocument[] }>(`/trip/${id}`).then((r) => r.data),
  shared: (token: string) => api.get<{ trip: Itinerary }>(`/trip/shared/${token}`).then((r) => r.data.trip),
  update: (id: string, body: Partial<Pick<Itinerary, 'title' | 'isPublic' | 'status'>>) => api.patch<{ trip: Itinerary }>(`/trip/${id}`, body).then((r) => r.data.trip),
  remove: (id: string) => api.delete(`/trip/${id}`),
  claim: (id: string) => api.post<{ trip: Itinerary }>(`/trip/${id}/claim`).then((r) => r.data.trip),
  share: (id: string, isPublic?: boolean) => api.post<{ shareToken: string; isPublic: boolean }>(`/trip/${id}/share`, { isPublic }).then((r) => r.data),
  like: (id: string) => api.post<{ likes: number }>(`/trip/${id}/like`).then((r) => r.data.likes),
  swap: (id: string, dayId: string, itemId: string) => api.post<{ trip: Itinerary }>(`/trip/${id}/swap`, { dayId, itemId }).then((r) => r.data.trip),
  refreshWeather: (id: string) => api.post<{ trip: Itinerary; swaps: number }>(`/trip/${id}/refresh-weather`, {}, { timeout: 60_000 }).then((r) => r.data),
  book: (id: string, body: { stayIndex: number; roomId?: string; includeRental: boolean; rentalIndex?: number; couponCode?: string; method: PayMethod; allStops?: boolean }) =>
    api.post<{ booking: Booking; bookings?: Booking[]; skipped?: string[]; payment?: Payment; rentalBooking: RentalBooking | null; trip: Itinerary }>(`/trip/${id}/book`, body).then((r) => r.data),
  addDocument: (id: string, file: File, kind: string, name?: string) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('kind', kind);
    if (name) fd.append('name', name);
    return api.post<{ document: TripDocument }>(`/trip/${id}/documents`, fd).then((r) => r.data.document);
  },
  removeDocument: (id: string, docId: string) => api.delete(`/trip/${id}/documents/${docId}`),
  shops: (destination?: string, type?: string) => api.get<{ shops: RentalShop[] }>('/trip/rentals/shops', { params: { destination, type } }).then((r) => r.data.shops),
  bookRental: (body: { shopId: string; vehicleType: string; quantity: number; startDate: string; endDate: string; itineraryId?: string }) =>
    api.post<{ rentalBooking: RentalBooking }>('/trip/rentals/book', body).then((r) => r.data.rentalBooking),
  myRentals: () => api.get<{ rentals: RentalBooking[] }>('/trip/rentals/my').then((r) => r.data.rentals),
  cancelRental: (id: string) => api.patch<{ rentalBooking: RentalBooking }>(`/trip/rentals/${id}/cancel`).then((r) => r.data.rentalBooking),
};
