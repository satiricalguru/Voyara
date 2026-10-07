import { Schema, model, type InferSchemaType } from 'mongoose';
import { toJSONOpts } from './shared.js';

export const ROLES = ['CUSTOMER', 'STAFF', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'CUSTOMER' },
    phone: { type: String, trim: true },
    avatar: String,
    homeCity: String,
    preferences: {
      currency: { type: String, default: 'INR' },
      interests: { type: [String], default: [] },
      pace: { type: String, enum: ['relaxed', 'balanced', 'packed'], default: 'balanced' },
    },
    isActive: { type: Boolean, default: true },
    lastLoginAt: Date,
  },
  { timestamps: true, toJSON: toJSONOpts },
);

userSchema.set('toJSON', {
  ...toJSONOpts,
  transform: (doc: unknown, ret: Record<string, unknown>) => {
    delete ret.password;
    return toJSONOpts.transform(doc, ret);
  },
});

export type UserDoc = InferSchemaType<typeof userSchema>;
export const User = model('User', userSchema);
