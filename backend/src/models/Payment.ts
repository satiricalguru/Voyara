import { Schema, model } from 'mongoose';
import { toJSONOpts } from './shared.js';

const paymentSchema = new Schema(
  {
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', index: true },
    rentalBooking: { type: Schema.Types.ObjectId, ref: 'RentalBooking' },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    method: { type: String, enum: ['CARD', 'UPI', 'NETBANKING', 'WALLET', 'PAY_AT_HOTEL'], required: true },
    status: { type: String, enum: ['PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED'], default: 'PENDING' },
    transactionId: { type: String, unique: true, sparse: true },
    last4: String,
    note: String,
  },
  { timestamps: true, toJSON: toJSONOpts },
);

export const Payment = model('Payment', paymentSchema);
