import { Schema, model } from 'mongoose';
import { toJSONOpts } from './shared.js';

const addonSchema = new Schema(
  {
    name: { type: String, required: true },
    description: String,
    price: { type: Number, required: true, min: 0 },
    unit: { type: String, enum: ['PER_STAY', 'PER_NIGHT', 'PER_GUEST'], default: 'PER_STAY' },
    icon: { type: String, default: 'spark' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: toJSONOpts },
);

export const Addon = model('Addon', addonSchema);
