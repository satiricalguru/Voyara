import { Schema, model } from 'mongoose';
import { toJSONOpts } from './shared.js';

const tripDocumentSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    itinerary: { type: Schema.Types.ObjectId, ref: 'Itinerary', index: true },
    name: { type: String, required: true },
    kind: { type: String, enum: ['TICKET', 'VISA', 'PASSPORT', 'INSURANCE', 'VOUCHER', 'OTHER'], default: 'OTHER' },
    url: { type: String, required: true },
    mimeType: String,
    size: Number,
  },
  { timestamps: true, toJSON: toJSONOpts },
);

export const TripDocument = model('TripDocument', tripDocumentSchema);
