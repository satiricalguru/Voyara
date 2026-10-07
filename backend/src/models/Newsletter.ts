import { Schema, model } from 'mongoose';
import { toJSONOpts } from './shared.js';

const newsletterSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    source: { type: String, default: 'footer' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: toJSONOpts },
);

export const Newsletter = model('Newsletter', newsletterSchema);
