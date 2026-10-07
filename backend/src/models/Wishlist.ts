import { Schema, model } from 'mongoose';
import { toJSONOpts } from './shared.js';

const wishlistSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    hotels: [{ type: Schema.Types.ObjectId, ref: 'Hotel' }],
    destinations: { type: [String], default: [] },
  },
  { timestamps: true, toJSON: toJSONOpts },
);

export const Wishlist = model('Wishlist', wishlistSchema);
