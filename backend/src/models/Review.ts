import { Schema, model } from 'mongoose';
import { toJSONOpts } from './shared.js';

const reviewSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    hotel: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, maxlength: 120 },
    comment: { type: String, required: true, trim: true, maxlength: 2000 },
    tripType: { type: String, enum: ['SOLO', 'COUPLE', 'FAMILY', 'FRIENDS', 'BUSINESS'], default: 'COUPLE' },
    isHidden: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: toJSONOpts },
);

reviewSchema.index({ user: 1, hotel: 1 }, { unique: true });

export const Review = model('Review', reviewSchema);
