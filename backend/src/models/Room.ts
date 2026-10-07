import { Schema, model } from 'mongoose';
import { toJSONOpts } from './shared.js';

const roomSchema = new Schema(
  {
    hotel: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['STANDARD', 'DELUXE', 'SUITE', 'FAMILY', 'VILLA', 'DORM'], default: 'STANDARD' },
    description: String,
    pricePerNight: { type: Number, required: true, min: 0 },
    capacity: { type: Number, required: true, min: 1 },
    beds: { type: String, default: '1 King bed' },
    size: { type: Number, default: 28 },
    quantity: { type: Number, required: true, min: 0, default: 5 },
    images: { type: [String], default: [] },
    amenities: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: toJSONOpts },
);

export const Room = model('Room', roomSchema);
