import { Schema, model } from 'mongoose';
import { toJSONOpts } from './shared.js';

export const BOOKING_STATUS = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'] as const;
export const PAYMENT_STATUS = ['UNPAID', 'PAID', 'REFUNDED', 'PAY_AT_HOTEL'] as const;

const bookingSchema = new Schema(
  {
    reference: { type: String, required: true, unique: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    hotel: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
    room: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    itinerary: { type: Schema.Types.ObjectId, ref: 'Itinerary' },
    checkIn: { type: Date, required: true, index: true },
    checkOut: { type: Date, required: true },
    nights: { type: Number, required: true },
    guests: { adults: { type: Number, default: 2 }, children: { type: Number, default: 0 } },
    roomsCount: { type: Number, default: 1, min: 1 },
    guestName: { type: String, required: true },
    guestEmail: { type: String, required: true },
    guestPhone: String,
    specialRequests: String,
    addons: [
      {
        _id: false,
        addon: { type: Schema.Types.ObjectId, ref: 'Addon' },
        name: String,
        unit: String,
        unitPrice: Number,
        quantity: Number,
        total: Number,
      },
    ],
    couponCode: String,
    pricing: {
      roomRate: Number,
      roomTotal: Number,
      addonsTotal: Number,
      discount: Number,
      taxes: Number,
      total: Number,
      currency: { type: String, default: 'INR' },
    },
    status: { type: String, enum: BOOKING_STATUS, default: 'PENDING', index: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUS, default: 'UNPAID' },
    checkedInAt: Date,
    checkedOutAt: Date,
    handledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelledAt: Date,
    cancelReason: String,
  },
  { timestamps: true, toJSON: toJSONOpts },
);

export const Booking = model('Booking', bookingSchema);
