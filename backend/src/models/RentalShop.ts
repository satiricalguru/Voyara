import { Schema, model } from 'mongoose';
import { pointSchema, toJSONOpts } from './shared.js';

export const VEHICLE_TYPES = ['SCOOTER', 'MOTORBIKE', 'BICYCLE', 'CAR', 'EBIKE', 'JEEP'] as const;

const rentalShopSchema = new Schema(
  {
    name: { type: String, required: true },
    destination: { type: String, required: true, index: true },
    address: String,
    location: { type: pointSchema, index: '2dsphere' },
    vehicles: [
      {
        _id: false,
        type: { type: String, enum: VEHICLE_TYPES, required: true },
        model: String,
        pricePerDay: { type: Number, required: true },
        available: { type: Number, default: 5 },
      },
    ],
    rating: { type: Number, default: 4.4 },
    phone: String,
    image: String,
    source: { type: String, default: 'voyara' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: toJSONOpts },
);

export const RentalShop = model('RentalShop', rentalShopSchema);
