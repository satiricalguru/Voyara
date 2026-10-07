import { Schema, model } from 'mongoose';
import { toJSONOpts } from './shared.js';

const couponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: String,
    type: { type: String, enum: ['PERCENT', 'FLAT'], required: true },
    value: { type: Number, required: true, min: 0 },
    minAmount: { type: Number, default: 0 },
    maxDiscount: Number,
    validFrom: Date,
    validTo: Date,
    usageLimit: Number,
    usedCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: toJSONOpts },
);

export const Coupon = model('Coupon', couponSchema);
