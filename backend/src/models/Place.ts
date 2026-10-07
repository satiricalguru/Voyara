import { Schema, model } from 'mongoose';
import { pointSchema, toJSONOpts } from './shared.js';

export const PLACE_CATEGORIES = ['SIGHT', 'MUSEUM', 'NATURE', 'FOOD', 'CAFE', 'NIGHTLIFE', 'SHOPPING', 'ACTIVITY', 'VIEWPOINT', 'BEACH', 'TEMPLE'] as const;

const placeSchema = new Schema(
  {
    name: { type: String, required: true },
    destination: { type: String, required: true, index: true },
    category: { type: String, enum: PLACE_CATEGORIES, required: true },
    description: String,
    image: String,
    location: { type: pointSchema, index: '2dsphere' },
    rating: Number,
    priceLevel: { type: Number, min: 0, max: 4, default: 1 },
    durationMins: { type: Number, default: 90 },
    indoor: { type: Boolean, default: false },
    bestTime: { type: String, enum: ['MORNING', 'AFTERNOON', 'EVENING', 'ANY'], default: 'ANY' },
    source: { type: String, default: 'curated' },
  },
  { timestamps: true, toJSON: toJSONOpts },
);

export const Place = model('Place', placeSchema);
