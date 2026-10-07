import { Schema, model } from 'mongoose';
import { pointSchema, toJSONOpts } from './shared.js';

const hotelSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    tagline: String,
    description: { type: String, required: true },
    city: { type: String, required: true, index: true },
    country: { type: String, required: true },
    address: String,
    location: { type: pointSchema, index: '2dsphere' },
    stars: { type: Number, min: 1, max: 5, default: 4 },
    category: { type: String, enum: ['HOTEL', 'RESORT', 'BOUTIQUE', 'VILLA', 'HOSTEL', 'HERITAGE'], default: 'HOTEL' },
    images: { type: [String], default: [] },
    amenities: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    priceFrom: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    checkInTime: { type: String, default: '14:00' },
    checkOutTime: { type: String, default: '11:00' },
    policies: {
      cancellation: { type: String, default: 'Free cancellation up to 48 hours before check-in.' },
      children: { type: String, default: 'Children of all ages are welcome.' },
      pets: { type: String, default: 'Pets are not allowed.' },
    },
    contact: { phone: String, email: String },
    featured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: toJSONOpts, toObject: { virtuals: true } },
);

hotelSchema.index({ name: 'text', city: 'text', country: 'text', description: 'text', tags: 'text' });

export const Hotel = model('Hotel', hotelSchema);
