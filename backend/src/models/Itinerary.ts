import { Schema, model } from 'mongoose';
import { toJSONOpts } from './shared.js';

const placeRef = {
  _id: false,
  name: String,
  lat: Number,
  lng: Number,
  address: String,
};

const itemSchema = new Schema(
  {
    slot: { type: String, enum: ['MORNING', 'LUNCH', 'AFTERNOON', 'EVENING', 'DINNER', 'TRANSIT', 'STAY'], required: true },
    time: String,
    title: { type: String, required: true },
    category: String,
    description: String,
    place: placeRef,
    durationMins: Number,
    estCost: { type: Number, default: 0 },
    indoor: Boolean,
    alternative: {
      _id: false,
      title: String,
      category: String,
      description: String,
      place: placeRef,
      indoor: Boolean,
    },
    swapped: { type: Boolean, default: false },
    done: { type: Boolean, default: false },
  },
  { _id: true },
);

const daySchema = new Schema(
  {
    dayNumber: Number,
    date: Date,
    theme: String,
    weather: {
      _id: false,
      code: Number,
      summary: String,
      tMax: Number,
      tMin: Number,
      precipProb: Number,
      wet: Boolean,
      source: String,
    },
    items: [itemSchema],
    notes: String,
  },
  { _id: true },
);

const itinerarySchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    title: { type: String, required: true },
    prompt: String,
    destination: {
      name: { type: String, required: true },
      country: String,
      lat: Number,
      lng: Number,
      displayName: String,
    },
    startDate: Date,
    endDate: Date,
    travelers: { adults: { type: Number, default: 2 }, children: { type: Number, default: 0 } },
    budget: { type: String, enum: ['SHOESTRING', 'MODERATE', 'LUXURY'], default: 'MODERATE' },
    pace: { type: String, enum: ['relaxed', 'balanced', 'packed'], default: 'balanced' },
    interests: { type: [String], default: [] },
    summary: String,
    overview: { _id: false, extract: String, thumbnail: String, url: String },
    days: [daySchema],
    stays: [
      {
        _id: false,
        hotel: { type: Schema.Types.ObjectId, ref: 'Hotel' },
        room: { type: Schema.Types.ObjectId, ref: 'Room' },
        name: String,
        pricePerNight: Number,
        rating: Number,
        lat: Number,
        lng: Number,
        image: String,
        source: { type: String, default: 'voyara' },
        bookable: Boolean,
        city: String,
        stopIndex: Number,
      },
    ],
    rentals: [
      {
        _id: false,
        shop: { type: Schema.Types.ObjectId, ref: 'RentalShop' },
        name: String,
        vehicleType: String,
        pricePerDay: Number,
        lat: Number,
        lng: Number,
        source: { type: String, default: 'voyara' },
        bookable: Boolean,
        city: String,
        stopIndex: Number,
      },
    ],
    stops: [
      { _id: false, name: String, country: String, lat: Number, lng: Number, days: Number, startDate: Date },
    ],
    legs: [
      { _id: false, from: String, to: String, km: Number, minutes: Number, co2kg: Number, mode: String },
    ],
    estimate: {
      _id: false,
      stay: Number,
      food: Number,
      activities: Number,
      transport: Number,
      total: Number,
      currency: { type: String, default: 'INR' },
    },
    fx: { _id: false, base: String, quote: String, rate: Number },
    engine: { type: String, default: 'rules' },
    status: { type: String, enum: ['DRAFT', 'SAVED', 'BOOKED'], default: 'SAVED' },
    bookings: [{ type: Schema.Types.ObjectId, ref: 'Booking' }],
    rentalBookings: [{ type: Schema.Types.ObjectId, ref: 'RentalBooking' }],
    isPublic: { type: Boolean, default: false },
    shareToken: { type: String, index: true, sparse: true },
    likes: { type: Number, default: 0 },
    coverImage: String,
  },
  { timestamps: true, toJSON: toJSONOpts },
);

export const Itinerary = model('Itinerary', itinerarySchema);
