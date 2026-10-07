import { Schema, model } from 'mongoose';
import { toJSONOpts } from './shared.js';

const rentalBookingSchema = new Schema(
  {
    reference: { type: String, required: true, unique: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    shop: { type: Schema.Types.ObjectId, ref: 'RentalShop', required: true },
    itinerary: { type: Schema.Types.ObjectId, ref: 'Itinerary' },
    vehicleType: { type: String, required: true },
    model: String,
    quantity: { type: Number, default: 1 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    days: Number,
    pricePerDay: Number,
    total: Number,
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: ['CONFIRMED', 'CANCELLED', 'COMPLETED'], default: 'CONFIRMED' },
  },
  { timestamps: true, toJSON: toJSONOpts },
);

export const RentalBooking = model('RentalBooking', rentalBookingSchema);
