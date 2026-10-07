export type Role = 'CUSTOMER' | 'STAFF' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string;
  homeCity?: string;
  avatar?: string;
  preferences?: { currency?: string; interests?: string[]; pace?: Pace };
  isActive?: boolean;
  createdAt?: string;
  lastLoginAt?: string;
}

export type Pace = 'relaxed' | 'balanced' | 'packed';
export type Budget = 'SHOESTRING' | 'MODERATE' | 'LUXURY';

export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number];
}

export interface Hotel {
  id: string;
  name: string;
  slug: string;
  tagline?: string;
  description: string;
  city: string;
  country: string;
  address?: string;
  location?: GeoPoint;
  stars: number;
  category: 'HOTEL' | 'RESORT' | 'BOUTIQUE' | 'VILLA' | 'HOSTEL' | 'HERITAGE';
  images: string[];
  amenities: string[];
  tags: string[];
  priceFrom: number;
  currency: string;
  rating: number;
  reviewCount: number;
  checkInTime?: string;
  checkOutTime?: string;
  policies?: { cancellation?: string; children?: string; pets?: string };
  contact?: { phone?: string; email?: string };
  featured?: boolean;
  isActive?: boolean;
  roomsLeft?: number;
  nights?: number | null;
}

export interface Room {
  id: string;
  hotel: string;
  name: string;
  type: string;
  description?: string;
  pricePerNight: number;
  capacity: number;
  beds?: string;
  size?: number;
  quantity: number;
  images: string[];
  amenities: string[];
  available?: number;
  isActive?: boolean;
}

export interface Addon {
  id: string;
  name: string;
  description?: string;
  price: number;
  unit: 'PER_STAY' | 'PER_NIGHT' | 'PER_GUEST';
  icon?: string;
  isActive?: boolean;
}

export interface Pricing {
  roomRate: number;
  roomTotal: number;
  addonsTotal: number;
  discount: number;
  taxes: number;
  taxRate?: number;
  total: number;
  currency: string;
}

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';
export type PaymentStatus = 'UNPAID' | 'PAID' | 'REFUNDED' | 'PAY_AT_HOTEL';

export interface Booking {
  id: string;
  reference: string;
  user: string | Pick<User, 'id' | 'name' | 'email'>;
  hotel: Hotel;
  room: Room;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: { adults: number; children: number };
  roomsCount: number;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  specialRequests?: string;
  addons: { name: string; unit: string; unitPrice: number; quantity: number; total: number }[];
  couponCode?: string;
  pricing: Pricing;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  checkedInAt?: string;
  checkedOutAt?: string;
  createdAt: string;
  itinerary?: string;
}

export interface Payment {
  id: string;
  booking?: { id: string; reference: string } | string;
  user?: Pick<User, 'id' | 'name' | 'email'>;
  amount: number;
  currency: string;
  method: 'CARD' | 'UPI' | 'NETBANKING' | 'WALLET' | 'PAY_AT_HOTEL';
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
  transactionId?: string;
  last4?: string;
  createdAt: string;
}

export interface Review {
  id: string;
  user: { id: string; name: string; homeCity?: string } | null;
  hotel: string | Pick<Hotel, 'id' | 'name' | 'city' | 'slug' | 'images'>;
  rating: number;
  title?: string;
  comment: string;
  tripType?: string;
  isHidden?: boolean;
  createdAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  description?: string;
  type: 'PERCENT' | 'FLAT';
  value: number;
  minAmount?: number;
  maxDiscount?: number;
  validFrom?: string;
  validTo?: string;
  usageLimit?: number;
  usedCount?: number;
  isActive: boolean;
}

export interface Destination {
  id?: string;
  name: string;
  slug: string;
  country: string;
  region?: string;
  summary?: string;
  image?: string;
  location?: GeoPoint;
  currency?: string;
  bestMonths?: string[];
  tags?: string[];
  avgDailyBudget?: number;
  featured?: boolean;
}

export interface PlaceRef {
  name: string;
  lat: number;
  lng: number;
}

export type Slot = 'MORNING' | 'LUNCH' | 'AFTERNOON' | 'EVENING' | 'DINNER' | 'TRANSIT' | 'STAY';

export interface ItineraryItem {
  _id: string;
  slot: Slot;
  time?: string;
  title: string;
  category?: string;
  description?: string;
  place?: PlaceRef;
  durationMins?: number;
  estCost?: number;
  indoor?: boolean;
  alternative?: { title: string; category?: string; description?: string; place?: PlaceRef; indoor?: boolean };
  swapped?: boolean;
  done?: boolean;
}

export interface DayWeather {
  code: number;
  summary: string;
  tMax: number;
  tMin: number;
  precipProb: number;
  wet: boolean;
  source: string;
}

export interface ItineraryDay {
  _id: string;
  dayNumber: number;
  date: string;
  theme?: string;
  weather?: DayWeather;
  items: ItineraryItem[];
  notes?: string;
}

export interface TripStay {
  city?: string;
  stopIndex?: number;
  hotel?: string;
  room?: string;
  name: string;
  pricePerNight?: number;
  rating?: number;
  lat?: number;
  lng?: number;
  image?: string;
  source: string;
  bookable?: boolean;
}

export interface TripRental {
  shop?: string;
  name: string;
  vehicleType?: string;
  pricePerDay?: number;
  lat?: number;
  lng?: number;
  source: string;
  bookable?: boolean;
}

export interface Itinerary {
  id: string;
  stops?: { name: string; country?: string; lat: number; lng: number; days: number; startDate: string }[];
  legs?: { from: string; to: string; km: number; minutes: number; co2kg: number; mode: string }[];
  user?: string | { id: string; name: string; homeCity?: string };
  title: string;
  prompt?: string;
  destination: { name: string; country?: string; lat: number; lng: number; displayName?: string };
  startDate: string;
  endDate: string;
  travelers: { adults: number; children: number };
  budget: Budget;
  pace: Pace;
  interests: string[];
  summary?: string;
  overview?: { extract?: string; thumbnail?: string; url?: string };
  days: ItineraryDay[];
  stays: TripStay[];
  rentals: TripRental[];
  estimate?: { stay: number; food: number; activities: number; transport: number; total: number; currency: string };
  fx?: { base: string; quote: string; rate: number };
  engine?: string;
  status: 'DRAFT' | 'SAVED' | 'BOOKED';
  bookings?: Booking[];
  rentalBookings?: RentalBooking[];
  isPublic: boolean;
  shareToken?: string;
  likes?: number;
  coverImage?: string;
  sources?: { places: number; weather: string; geocoder: string };
  createdAt: string;
  updatedAt: string;
}

export interface RentalShop {
  id: string;
  name: string;
  destination: string;
  address?: string;
  location?: GeoPoint;
  vehicles: { type: string; model?: string; pricePerDay: number; available: number }[];
  rating?: number;
  phone?: string;
  image?: string;
  distanceKm?: number | null;
}

export interface LiveRental {
  id: string;
  name: string;
  lat: number;
  lng: number;
  vehicleTypes: string[];
  phone?: string;
  website?: string;
  distanceKm?: number;
}

export interface RentalBooking {
  id: string;
  reference: string;
  shop: Pick<RentalShop, 'id' | 'name' | 'address' | 'destination' | 'phone' | 'image'>;
  vehicleType: string;
  model?: string;
  quantity: number;
  startDate: string;
  endDate: string;
  days: number;
  pricePerDay: number;
  total: number;
  currency: string;
  status: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
}

export interface TripDocument {
  id: string;
  name: string;
  kind: string;
  url: string;
  mimeType?: string;
  size?: number;
  createdAt: string;
}

export interface LivePoi {
  id?: string;
  name: string;
  kind: string;
  lat: number;
  lng: number;
  indoor?: boolean;
  description?: string;
  image?: string;
  source: string;
}

export interface WeatherDay {
  date: string;
  code: number;
  summary: string;
  tMax: number;
  tMin: number;
  precipProb: number;
  wet: boolean;
  source: string;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}
