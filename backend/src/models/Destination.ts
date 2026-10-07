import { Schema, model } from 'mongoose';
import { pointSchema, toJSONOpts } from './shared.js';

const destinationSchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    country: { type: String, required: true },
    region: String,
    summary: String,
    image: String,
    location: { type: pointSchema, index: '2dsphere' },
    currency: { type: String, default: 'INR' },
    bestMonths: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    avgDailyBudget: Number,
    featured: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: toJSONOpts },
);

export const Destination = model('Destination', destinationSchema);
