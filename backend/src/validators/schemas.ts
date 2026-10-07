import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const isoDate = z.coerce.date();
const email = z.string().trim().toLowerCase().email('Enter a valid email');

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(80),
  email,
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
  phone: z.string().trim().max(20).optional(),
});

export const loginSchema = z.object({ email, password: z.string().min(1, 'Password is required') });

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().max(20).optional(),
  homeCity: z.string().trim().max(80).optional(),
  avatar: z.string().optional(),
  preferences: z
    .object({
      currency: z.string().length(3).optional(),
      interests: z.array(z.string()).max(20).optional(),
      pace: z.enum(['relaxed', 'balanced', 'packed']).optional(),
    })
    .optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(128),
});

export const hotelSchema = z.object({
  name: z.string().trim().min(2),
  tagline: z.string().optional(),
  description: z.string().min(10),
  city: z.string().trim().min(2),
  country: z.string().trim().min(2),
  address: z.string().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  stars: z.coerce.number().int().min(1).max(5).default(4),
  category: z.enum(['HOTEL', 'RESORT', 'BOUTIQUE', 'VILLA', 'HOSTEL', 'HERITAGE']).default('HOTEL'),
  images: z.array(z.string()).default([]),
  amenities: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
  featured: z.boolean().optional(),
  isActive: z.boolean().optional(),
  policies: z
    .object({ cancellation: z.string().optional(), children: z.string().optional(), pets: z.string().optional() })
    .optional(),
  contact: z.object({ phone: z.string().optional(), email: z.string().optional() }).optional(),
});

export const roomSchema = z.object({
  hotel: objectId,
  name: z.string().trim().min(2),
  type: z.enum(['STANDARD', 'DELUXE', 'SUITE', 'FAMILY', 'VILLA', 'DORM']).default('STANDARD'),
  description: z.string().optional(),
  pricePerNight: z.coerce.number().min(0),
  capacity: z.coerce.number().int().min(1),
  beds: z.string().optional(),
  size: z.coerce.number().optional(),
  quantity: z.coerce.number().int().min(0),
  images: z.array(z.string()).default([]),
  amenities: z.array(z.string()).default([]),
  isActive: z.boolean().optional(),
});

const guests = z.object({
  adults: z.coerce.number().int().min(1).max(12).default(2),
  children: z.coerce.number().int().min(0).max(10).default(0),
});

const stayDates = {
  checkIn: isoDate,
  checkOut: isoDate,
};

export const quoteSchema = z
  .object({
    roomId: objectId,
    ...stayDates,
    guests: guests.default({ adults: 2, children: 0 }),
    roomsCount: z.coerce.number().int().min(1).max(5).default(1),
    addons: z.array(z.object({ addonId: objectId, quantity: z.coerce.number().int().min(1).max(20).default(1) })).default([]),
    couponCode: z.string().trim().toUpperCase().optional(),
  })
  .refine((d) => d.checkOut > d.checkIn, { message: 'Check-out must be after check-in', path: ['checkOut'] });

export const createBookingSchema = z
  .object({
    roomId: objectId,
    ...stayDates,
    guests: guests.default({ adults: 2, children: 0 }),
    roomsCount: z.coerce.number().int().min(1).max(5).default(1),
    addons: z.array(z.object({ addonId: objectId, quantity: z.coerce.number().int().min(1).max(20).default(1) })).default([]),
    couponCode: z.string().trim().toUpperCase().optional(),
    guestName: z.string().trim().min(2).optional(),
    guestEmail: email.optional(),
    guestPhone: z.string().trim().max(20).optional(),
    specialRequests: z.string().max(500).optional(),
    itineraryId: objectId.optional(),
  })
  .refine((d) => d.checkOut > d.checkIn, { message: 'Check-out must be after check-in', path: ['checkOut'] });

export const cancelBookingSchema = z.object({ reason: z.string().max(300).optional() });

export const paymentSchema = z.object({
  bookingId: objectId,
  method: z.enum(['CARD', 'UPI', 'NETBANKING', 'WALLET', 'PAY_AT_HOTEL']),
  // Simulated gateway — only non-sensitive hints are accepted, never full card numbers.
  last4: z.string().regex(/^\d{4}$/).optional(),
  simulateFailure: z.boolean().optional(),
});

export const reviewSchema = z.object({
  hotelId: objectId,
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  comment: z.string().trim().min(10, 'Tell us a little more (10+ characters)').max(2000),
  tripType: z.enum(['SOLO', 'COUPLE', 'FAMILY', 'FRIENDS', 'BUSINESS']).optional(),
});

export const couponValidateSchema = z.object({
  code: z.string().trim().toUpperCase().min(2),
  amount: z.coerce.number().min(0),
});

export const couponSchema = z.object({
  code: z.string().trim().toUpperCase().min(3).max(24),
  description: z.string().optional(),
  type: z.enum(['PERCENT', 'FLAT']),
  value: z.coerce.number().min(0),
  minAmount: z.coerce.number().min(0).default(0),
  maxDiscount: z.coerce.number().min(0).optional(),
  validFrom: isoDate.optional(),
  validTo: isoDate.optional(),
  usageLimit: z.coerce.number().int().min(1).optional(),
  isActive: z.boolean().default(true),
});

export const addonSchema = z.object({
  name: z.string().trim().min(2),
  description: z.string().optional(),
  price: z.coerce.number().min(0),
  unit: z.enum(['PER_STAY', 'PER_NIGHT', 'PER_GUEST']).default('PER_STAY'),
  icon: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const itineraryRequestSchema = z.object({
  prompt: z.string().trim().max(1200).optional(),
  destination: z.string().trim().max(120).optional(),
  startDate: isoDate.optional(),
  days: z.coerce.number().int().min(1).max(14).optional(),
  travelers: guests.optional(),
  budget: z.enum(['SHOESTRING', 'MODERATE', 'LUXURY']).optional(),
  pace: z.enum(['relaxed', 'balanced', 'packed']).optional(),
  interests: z.array(z.string().trim().max(30)).max(12).optional(),
  save: z.boolean().default(true),
}).refine((d) => d.prompt || d.destination, { message: 'Describe your trip or pick a destination' });

export const itineraryUpdateSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  isPublic: z.boolean().optional(),
  days: z.array(z.any()).optional(),
  status: z.enum(['DRAFT', 'SAVED', 'BOOKED']).optional(),
});

export const swapSchema = z.object({ dayId: z.string(), itemId: z.string() });

export const bookTripSchema = z.object({
  stayIndex: z.coerce.number().int().min(0).default(0),
  roomId: objectId.optional(),
  rentalIndex: z.coerce.number().int().min(0).optional(),
  includeRental: z.boolean().default(true),
  couponCode: z.string().trim().toUpperCase().optional(),
  method: z.enum(['CARD', 'UPI', 'NETBANKING', 'WALLET', 'PAY_AT_HOTEL']).default('PAY_AT_HOTEL'),
  allStops: z.boolean().optional(),
});

export const rentalBookingSchema = z
  .object({
    shopId: objectId,
    vehicleType: z.string(),
    quantity: z.coerce.number().int().min(1).max(6).default(1),
    startDate: isoDate,
    endDate: isoDate,
    itineraryId: objectId.optional(),
  })
  .refine((d) => d.endDate > d.startDate, { message: 'Return date must be after pick-up', path: ['endDate'] });

export const staffActionSchema = z.object({ bookingId: objectId });

export const newsletterSchema = z.object({ email, source: z.string().max(40).optional() });

export const wishlistToggleSchema = z.object({ hotelId: objectId });

export const roleSchema = z.object({ role: z.enum(['CUSTOMER', 'STAFF', 'ADMIN']) });

export const documentSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  kind: z.enum(['TICKET', 'VISA', 'PASSPORT', 'INSURANCE', 'VOUCHER', 'OTHER']).default('OTHER'),
});

const stopSchema = z.object({
  name: z.string().trim().min(1).max(120),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  country: z.string().max(80).optional(),
  days: z.coerce.number().int().min(1).max(10).default(3),
});

export const routeRequestSchema = z.object({
  stops: z.array(stopSchema).min(2, 'Pick at least two places').max(6, 'Up to six stops per route'),
  startDate: isoDate.optional(),
  travelers: guests.optional(),
  budget: z.enum(['SHOESTRING', 'MODERATE', 'LUXURY']).optional(),
  pace: z.enum(['relaxed', 'balanced', 'packed']).optional(),
  interests: z.array(z.string().trim().max(30)).max(12).optional(),
}).refine((d) => d.stops.reduce((s, x) => s + x.days, 0) <= 21, { message: 'Routes are limited to 21 days' });
