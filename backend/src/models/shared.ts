import { Schema } from 'mongoose';

/** GeoJSON point: coordinates are [lng, lat]. */
export const pointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: undefined },
  },
  { _id: false },
);

export const toJSONOpts = {
  virtuals: true,
  versionKey: false,
  transform: (_doc: unknown, ret: Record<string, unknown>) => {
    ret.id = String(ret._id);
    return ret;
  },
};
