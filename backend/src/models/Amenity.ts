import { Schema, model } from 'mongoose';
import { toJSONOpts } from './shared.js';

const amenitySchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    icon: { type: String, default: 'dot' },
  },
  { toJSON: toJSONOpts },
);

export const Amenity = model('Amenity', amenitySchema);
