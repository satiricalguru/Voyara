// @ts-nocheck — seed data uses loose literal types; runtime validation is done by Mongoose.
/**
 * Full demo seed. `npm run seed` wipes and repopulates every collection.
 * Logins: admin@hrms.com/admin123 · staff@hrms.com/staff123 · customer@hrms.com/customer123
 */
import bcrypt from 'bcryptjs';
import { pathToFileURL } from 'node:url';
import { env } from './config/env.js';
import {
  Addon, Amenity, Booking, Coupon, Destination, Hotel, Itinerary, Newsletter, Payment, Place, RentalBooking, Review, Room,
  TripDocument, User, Wishlist,
} from './models/index.js';
import { seedGuide, DESTINATIONS } from './seed.guide.js';
import { addDays, code, nightsBetween, round2, slugify, startOfDay, token } from './utils/helpers.js';

const U = (id: string, w = 1600) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=75`;

const AMENITIES: Array<[string, string]> = [
  ['wifi', 'Fast Wi-Fi'], ['pool', 'Pool'], ['spa', 'Spa'], ['gym', 'Gym'], ['breakfast', 'Breakfast'], ['parking', 'Parking'],
  ['ac', 'Air conditioning'], ['restaurant', 'Restaurant'], ['bar', 'Bar'], ['airport-shuttle', 'Airport shuttle'], ['pet-friendly', 'Pet friendly'],
  ['beach-access', 'Beach access'], ['workspace', 'Workspace'], ['kitchen', 'Kitchen'], ['mountain-view', 'Mountain view'], ['lake-view', 'Lake view'],
  ['rooftop', 'Rooftop'], ['bicycles', 'Bicycles'], ['fireplace', 'Fireplace'], ['ev-charging', 'EV charging'],
];

type RoomSeed = { name: string; type: string; mult: number; capacity: number; beds: string; size: number; quantity: number; img: string };
const ROOMS = (base: number, imgs: string[], villa = false): RoomSeed[] => [
  { name: villa ? 'Garden Room' : 'Classic Room', type: 'STANDARD', mult: 1, capacity: 2, beds: '1 Queen bed', size: 26, quantity: 8, img: imgs[0] },
  { name: villa ? 'Pool Suite' : 'Deluxe Room', type: 'DELUXE', mult: 1.45, capacity: 3, beds: '1 King bed + daybed', size: 36, quantity: 5, img: imgs[1] },
  { name: villa ? 'Private Pool Villa' : 'Signature Suite', type: villa ? 'VILLA' : 'SUITE', mult: 2.3, capacity: 4, beds: '2 King beds', size: 62, quantity: 2, img: imgs[2] },
];

const HOTELS = [
  { name: 'Casa Sal', city: 'Goa', country: 'India', address: 'Assagao, North Goa', lat: 15.5952, lng: 73.7696, stars: 4, category: 'BOUTIQUE', base: 7800, featured: true,
    tagline: 'A whitewashed Portuguese villa among cashew groves.', amenities: ['wifi', 'pool', 'breakfast', 'restaurant', 'bar', 'parking', 'ac', 'bicycles'], tags: ['beaches', 'food', 'boutique', 'couples'],
    images: ['1566073771259-6a8506099945', '1520250497591-112f2f40a3f4', '1611892440504-42a792e24d32', '1584132967334-10e028bd69f7'] },
  { name: 'Salt Line Beach Resort', city: 'Goa', country: 'India', address: 'Palolem Beach, Canacona', lat: 15.0115, lng: 74.0221, stars: 5, category: 'RESORT', base: 12500, featured: true,
    tagline: 'Thirty cottages on the quietest crescent in South Goa.', amenities: ['wifi', 'pool', 'spa', 'breakfast', 'restaurant', 'bar', 'beach-access', 'airport-shuttle', 'ac'], tags: ['beaches', 'luxury', 'family'],
    images: ['1600011689032-8b628b8a8747', '1571896349842-33c89424de2d', '1507525428034-b723cf961d3e', '1590490360182-c33d57733427'], villa: true },
  { name: 'Amber Haveli', city: 'Jaipur', country: 'India', address: 'Near Chandpole Gate, Old City', lat: 26.9268, lng: 75.8135, stars: 4, category: 'HERITAGE', base: 6900, featured: true,
    tagline: 'A 1790 merchant’s haveli, frescoed and restored.', amenities: ['wifi', 'pool', 'breakfast', 'restaurant', 'rooftop', 'ac', 'parking'], tags: ['history', 'culture', 'heritage'],
    images: ['1551882547-ff40c63fe5fa', '1590490360182-c33d57733427', '1578683010236-d716f9a3f461', '1477587458883-47145ed94245'] },
  { name: 'Pink City Bunkhouse', city: 'Jaipur', country: 'India', address: 'Bani Park, Jaipur', lat: 26.9285, lng: 75.7963, stars: 2, category: 'HOSTEL', base: 1400,
    tagline: 'Social rooftop hostel with private rooms and chai on tap.', amenities: ['wifi', 'breakfast', 'rooftop', 'ac', 'workspace'], tags: ['budget', 'solo', 'social'],
    images: ['1595576508898-0ad5c879a061', '1582719478250-c89cae4dc85b', '1631049307264-da0ec9d70304'] },
  { name: 'Pichola Lake Retreat', city: 'Udaipur', country: 'India', address: 'Lal Ghat, Udaipur', lat: 24.5786, lng: 73.6818, stars: 5, category: 'HERITAGE', base: 14500, featured: true,
    tagline: 'Marble balconies hanging over the lake, palace lights opposite.', amenities: ['wifi', 'pool', 'spa', 'breakfast', 'restaurant', 'bar', 'lake-view', 'rooftop', 'ac'], tags: ['romance', 'luxury', 'history'],
    images: ['1615836245337-f5b9b2303f10', '1540541338287-41700207dee6', '1618773928121-c32242e63f39', '1564501049412-61c2a3083791'] },
  { name: 'Pinewood Cabins', city: 'Manali', country: 'India', address: 'Log Huts Area, Manali', lat: 32.2488, lng: 77.1845, stars: 4, category: 'VILLA', base: 5600, featured: true,
    tagline: 'Deodar-timber cabins with fireplaces and orchard views.', amenities: ['wifi', 'breakfast', 'fireplace', 'mountain-view', 'parking', 'kitchen', 'pet-friendly'], tags: ['nature', 'mountains', 'family'],
    images: ['1596394516093-501ba68a0ba6', '1445019980597-93fa8acb246c', '1504280390367-361c6d9f38f4', '1611892440504-42a792e24d32'] },
  { name: 'Backwater House', city: 'Kochi', country: 'India', address: 'Burgher St, Fort Kochi', lat: 9.9664, lng: 76.2437, stars: 4, category: 'BOUTIQUE', base: 6200,
    tagline: 'Dutch-era bungalow with a hammock courtyard and spice garden.', amenities: ['wifi', 'pool', 'breakfast', 'restaurant', 'bicycles', 'ac'], tags: ['culture', 'food', 'heritage'],
    images: ['1506461883276-594a12b11cf3', '1549294413-26f195200c16', '1631049307264-da0ec9d70304', '1602216056096-3b40cc0c9944'] },
  { name: 'The Colaba Deco', city: 'Mumbai', country: 'India', address: 'Wodehouse Rd, Colaba', lat: 18.9165, lng: 72.8296, stars: 5, category: 'HOTEL', base: 11800,
    tagline: 'Art deco seafront hotel a short walk from the Gateway.', amenities: ['wifi', 'pool', 'spa', 'gym', 'restaurant', 'bar', 'airport-shuttle', 'ac', 'workspace'], tags: ['city', 'business', 'food'],
    images: ['1517840901100-8179e982acb7', '1564501049412-61c2a3083791', '1582719478250-c89cae4dc85b', '1570168007204-dfb528c6958f'] },
  { name: 'Maison Lumière', city: 'Paris', country: 'France', address: 'Rue de Turenne, Le Marais', lat: 48.8589, lng: 2.3637, stars: 4, category: 'BOUTIQUE', base: 21500, featured: true,
    tagline: 'Seventeenth-century hôtel particulier, quietly modern inside.', amenities: ['wifi', 'breakfast', 'bar', 'ac', 'workspace', 'bicycles'], tags: ['culture', 'romance', 'city'],
    images: ['1455587734955-081b22074882', '1522708323590-d24dbb6b0267', '1578683010236-d716f9a3f461', '1499856871958-5b9627545d1a'] },
  { name: 'Hotel Kumo', city: 'Tokyo', country: 'Japan', address: 'Udagawacho, Shibuya', lat: 35.6614, lng: 139.6982, stars: 4, category: 'HOTEL', base: 16800, featured: true,
    tagline: 'Cedar-and-concrete rooms above the Shibuya scramble.', amenities: ['wifi', 'gym', 'restaurant', 'bar', 'ac', 'workspace', 'rooftop'], tags: ['city', 'food', 'nightlife'],
    images: ['1542314831-068cd1dbfeeb', '1595576508898-0ad5c879a061', '1631049307264-da0ec9d70304', '1540959733332-eab4deabeeaf'] },
  { name: 'Ryokan Hanami', city: 'Kyoto', country: 'Japan', address: 'Higashiyama, Kyoto', lat: 35.0012, lng: 135.7805, stars: 5, category: 'HERITAGE', base: 24000,
    tagline: 'Twelve tatami rooms, a cypress onsen and kaiseki dinners.', amenities: ['wifi', 'spa', 'breakfast', 'restaurant', 'ac'], tags: ['culture', 'spiritual', 'luxury'],
    images: ['1568605114967-8130f3a36994', '1611892440504-42a792e24d32', '1618773928121-c32242e63f39', '1493976040374-85c8e12f0c0e'] },
  { name: 'Sawah Ubud Retreat', city: 'Bali', country: 'Indonesia', address: 'Jl. Raya Sayan, Ubud', lat: -8.5005, lng: 115.2468, stars: 5, category: 'RESORT', base: 13200, featured: true,
    tagline: 'Jungle villas with infinity pools over the Ayung river valley.', amenities: ['wifi', 'pool', 'spa', 'breakfast', 'restaurant', 'airport-shuttle', 'ac'], tags: ['nature', 'romance', 'spiritual'],
    images: ['1571003123894-1f0594d2b5d9', '1520250497591-112f2f40a3f4', '1584132967334-10e028bd69f7', '1537996194471-e657df975ab4'], villa: true },
  { name: 'Casa do Miradouro', city: 'Lisbon', country: 'Portugal', address: 'Rua de São Tomé, Alfama', lat: 38.7128, lng: -9.1309, stars: 4, category: 'BOUTIQUE', base: 15400,
    tagline: 'Azulejo townhouse with a terrace above the Tagus.', amenities: ['wifi', 'breakfast', 'rooftop', 'ac', 'workspace', 'kitchen'], tags: ['culture', 'food', 'photography'],
    images: ['1501117716987-c8c394bb29df', '1512917774080-9991f1c4c750', '1590490360182-c33d57733427', '1585208798174-6cedd86e019a'] },
];

const REVIEWERS = [
  { name: 'Ananya Rao', email: 'ananya@example.com', homeCity: 'Bengaluru' },
  { name: 'Kabir Mehta', email: 'kabir@example.com', homeCity: 'Delhi' },
  { name: 'Lena Fischer', email: 'lena@example.com', homeCity: 'Berlin' },
  { name: 'Sora Tanaka', email: 'sora@example.com', homeCity: 'Osaka' },
  { name: 'Priya Nair', email: 'priya@example.com', homeCity: 'Kochi' },
  { name: 'Marco Silva', email: 'marco@example.com', homeCity: 'Porto' },
];

const REVIEW_TEXT: Array<[number, string, string]> = [
  [5, 'Felt like staying with friends', 'The staff remembered our coffee order by day two. Rooms were spotless and the breakfast alone is worth the trip.'],
  [5, 'Quietly perfect', 'Beautifully designed, calm, and right where we wanted to be. The Voyara itinerary paired perfectly with the location.'],
  [4, 'Great base, small quibbles', 'Lovely room and a superb location. Wi-Fi dipped in the evenings but the team moved us without fuss.'],
  [5, 'We extended twice', 'Came for three nights, stayed six. The terrace at golden hour is something else.'],
  [4, 'Excellent value', 'Thoughtful touches everywhere — local snacks, handwritten notes, umbrellas when the rain came in.'],
  [3, 'Good, not great', 'Comfortable and clean but the street noise was more than expected. Ask for a courtyard room.'],
  [5, 'Best stay of our trip', 'Every recommendation from the front desk was spot on. Already planning to come back in winter.'],
];

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

export async function runSeed({ quiet = false } = {}) {
  const log = (...a: unknown[]) => !quiet && console.log(...a);
  const rand = rng(42);

  await Promise.all(
    [User, Hotel, Room, Booking, Payment, Review, Coupon, Addon, Amenity, Itinerary, RentalBooking, TripDocument, Wishlist, Newsletter, Destination, Place].map((m) =>
      (m as unknown as { deleteMany: (f: object) => Promise<unknown> }).deleteMany({}),
    ),
  );
  const guide = await seedGuide();
  log('  guide', guide);

  await Amenity.insertMany(AMENITIES.map(([key, label]) => ({ key, label, icon: key })));

  const hash = (p: string) => bcrypt.hash(p, 10);
  const [admin, staff, customer] = await User.create([
    { name: 'Vedant Sharma', email: 'admin@hrms.com', password: await hash('admin123'), role: 'ADMIN', homeCity: 'Mumbai' },
    { name: 'Rohan Das', email: 'staff@hrms.com', password: await hash('staff123'), role: 'STAFF', homeCity: 'Goa' },
    { name: 'Meera Kapoor', email: 'customer@hrms.com', password: await hash('customer123'), role: 'CUSTOMER', homeCity: 'Pune', phone: '+91 98200 11223', preferences: { currency: 'INR', interests: ['food', 'history', 'beaches'], pace: 'balanced' } },
  ]);
  const reviewerPw = await hash('traveller123');
  const reviewers = await User.create(REVIEWERS.map((r) => ({ ...r, password: reviewerPw, role: 'CUSTOMER' })));
  log('  users', 3 + reviewers.length);

  const addons = await Addon.insertMany([
    { name: 'Airport transfer', description: 'Private car on arrival, name board included.', price: 1800, unit: 'PER_STAY', icon: 'car' },
    { name: 'Daily breakfast', description: 'Full breakfast for the room, every morning.', price: 900, unit: 'PER_NIGHT', icon: 'cup' },
    { name: 'Late check-out', description: 'Keep the room until 4 pm on departure day.', price: 1200, unit: 'PER_STAY', icon: 'clock' },
    { name: 'Spa ritual', description: '60-minute signature massage.', price: 3500, unit: 'PER_GUEST', icon: 'leaf' },
    { name: 'Candlelight dinner', description: 'Private set-menu dinner for two.', price: 4500, unit: 'PER_STAY', icon: 'flame' },
    { name: 'Guided city walk', description: 'Three hours with a local storyteller.', price: 1500, unit: 'PER_GUEST', icon: 'map' },
  ]);

  const now = new Date();
  await Coupon.insertMany([
    { code: 'VOYARA10', description: '10% off any stay (up to ₹3,000)', type: 'PERCENT', value: 10, maxDiscount: 3000, minAmount: 0, validTo: addDays(now, 365) },
    { code: 'WELCOME500', description: '₹500 off your first booking over ₹3,000', type: 'FLAT', value: 500, minAmount: 3000, validTo: addDays(now, 365) },
    { code: 'MONSOON25', description: '25% off stays over ₹8,000 (up to ₹5,000)', type: 'PERCENT', value: 25, minAmount: 8000, maxDiscount: 5000, validTo: addDays(now, 120), usageLimit: 200 },
    { code: 'SUMMER2024', description: 'Expired summer promo', type: 'PERCENT', value: 20, validTo: new Date('2024-09-01'), isActive: true },
  ]);

  const hotels = [];
  const roomsByHotel = new Map<string, InstanceType<typeof Room>[]>();
  for (const h of HOTELS) {
    const { lat, lng, base, images, villa, ...rest } = h as typeof h & { villa?: boolean };
    const imgUrls = images.map((id) => U(id));
    const desc = `${rest.name} sits in ${rest.address}, minutes from the places that make ${rest.city} worth the journey. Expect generous rooms, a kitchen that cooks with the season, and a team who will happily rearrange your day when the weather changes. Every booking includes Voyara’s flexible cancellation and live trip support.`;
    const hotel = await Hotel.create({
      ...rest,
      slug: slugify(`${rest.name}-${rest.city}`),
      description: desc,
      location: { type: 'Point', coordinates: [lng, lat] },
      images: imgUrls,
      priceFrom: base,
      currency: 'INR',
      contact: { phone: '+91 22 4000 ' + Math.floor(1000 + rand() * 8999), email: `stay@${slugify(rest.name)}.voyara.travel` },
    });
    const rooms = await Room.insertMany(
      ROOMS(base, [imgUrls[2] ?? imgUrls[0], imgUrls[1] ?? imgUrls[0], imgUrls[0]], villa).map((r) => ({
        hotel: hotel._id,
        name: r.name,
        type: r.type,
        description: `${r.size} m² with ${r.beds.toLowerCase()}, rain shower and blackout drapes.`,
        pricePerNight: Math.round((base * r.mult) / 100) * 100,
        capacity: r.capacity,
        beds: r.beds,
        size: r.size,
        quantity: r.quantity,
        images: [r.img],
        amenities: rest.amenities.slice(0, 5),
      })),
    );
    roomsByHotel.set(String(hotel._id), rooms as never);
    hotels.push(hotel);
  }
  log('  hotels', hotels.length);

  // ── Bookings & payments ─────────────────────────────────────────────
  const today = startOfDay(now);
  const mkBooking = async (o: {
    user: InstanceType<typeof User>; hotelIdx: number; roomIdx: number; checkIn: Date; nights: number; status: string; paymentStatus: string; createdAt?: Date; addonIdx?: number[]; method?: string;
  }) => {
    const hotel = hotels[o.hotelIdx];
    const room = roomsByHotel.get(String(hotel._id))![o.roomIdx];
    const checkOut = addDays(o.checkIn, o.nights);
    const addonsSel = (o.addonIdx ?? []).map((i) => {
      const a = addons[i];
      const mult = a.unit === 'PER_NIGHT' ? o.nights : a.unit === 'PER_GUEST' ? 2 : 1;
      return { addon: a._id, name: a.name, unit: a.unit, unitPrice: a.price, quantity: 1, total: a.price * mult };
    });
    const roomTotal = room.pricePerNight * o.nights;
    const addonsTotal = addonsSel.reduce((s, a) => s + a.total, 0);
    const taxes = round2((roomTotal + addonsTotal) * env.TAX_RATE);
    const total = round2(roomTotal + addonsTotal + taxes);
    const b = await Booking.create({
      reference: code('VYR'),
      user: o.user._id, hotel: hotel._id, room: room._id,
      checkIn: o.checkIn, checkOut, nights: nightsBetween(o.checkIn, checkOut),
      guests: { adults: 2, children: 0 }, roomsCount: 1,
      guestName: o.user.name, guestEmail: o.user.email, guestPhone: o.user.phone,
      addons: addonsSel,
      pricing: { roomRate: room.pricePerNight, roomTotal, addonsTotal, discount: 0, taxes, total, currency: 'INR' },
      status: o.status, paymentStatus: o.paymentStatus,
      ...(o.status === 'CHECKED_IN' || o.status === 'CHECKED_OUT' ? { checkedInAt: o.checkIn, handledBy: staff._id } : {}),
      ...(o.status === 'CHECKED_OUT' ? { checkedOutAt: checkOut } : {}),
      ...(o.status === 'CANCELLED' ? { cancelledAt: addDays(o.createdAt ?? now, 1), cancelReason: 'Change of plans' } : {}),
    });
    if (o.createdAt) await Booking.collection.updateOne({ _id: b._id }, { $set: { createdAt: o.createdAt } });
    if (o.paymentStatus === 'PAID' || o.paymentStatus === 'REFUNDED') {
      const p = await Payment.create({
        booking: b._id, user: o.user._id, amount: total, currency: 'INR', method: o.method ?? 'CARD',
        status: o.paymentStatus === 'REFUNDED' ? 'REFUNDED' : 'SUCCEEDED', transactionId: code('TXN', 10), last4: '4242',
      });
      if (o.createdAt) await Payment.collection.updateOne({ _id: p._id }, { $set: { createdAt: o.createdAt } });
    } else if (o.paymentStatus === 'PAY_AT_HOTEL') {
      await Payment.create({ booking: b._id, user: o.user._id, amount: total, currency: 'INR', method: 'PAY_AT_HOTEL', status: 'PENDING', note: 'To be collected at check-in' });
    }
    return b;
  };

  // Customer's own bookings — one of each state for the demo.
  await mkBooking({ user: customer, hotelIdx: 0, roomIdx: 1, checkIn: addDays(today, 12), nights: 4, status: 'CONFIRMED', paymentStatus: 'PAID', addonIdx: [0, 1] });
  await mkBooking({ user: customer, hotelIdx: 2, roomIdx: 0, checkIn: addDays(today, -40), nights: 3, status: 'CHECKED_OUT', paymentStatus: 'PAID', createdAt: addDays(today, -70) });
  await mkBooking({ user: customer, hotelIdx: 8, roomIdx: 0, checkIn: addDays(today, 50), nights: 3, status: 'CANCELLED', paymentStatus: 'REFUNDED', createdAt: addDays(today, -10) });
  // Front-desk demo: arriving today (pay at hotel) + in-house guest departing today.
  await mkBooking({ user: customer, hotelIdx: 0, roomIdx: 0, checkIn: today, nights: 2, status: 'CONFIRMED', paymentStatus: 'PAY_AT_HOTEL' });
  await mkBooking({ user: reviewers[0], hotelIdx: 1, roomIdx: 1, checkIn: addDays(today, -3), nights: 3, status: 'CHECKED_IN', paymentStatus: 'PAID' });
  await mkBooking({ user: reviewers[1], hotelIdx: 0, roomIdx: 2, checkIn: today, nights: 3, status: 'CONFIRMED', paymentStatus: 'PAID', addonIdx: [0] });
  await mkBooking({ user: reviewers[2], hotelIdx: 4, roomIdx: 1, checkIn: addDays(today, -1), nights: 4, status: 'CHECKED_IN', paymentStatus: 'PAID' });

  // Six months of history for the admin charts + reviewer eligibility.
  let historical = 0;
  for (let i = 0; i < 46; i++) {
    const u = reviewers[i % reviewers.length];
    const daysAgo = Math.floor(rand() * 175) + 5;
    const createdAt = addDays(today, -daysAgo - 20);
    const checkIn = addDays(today, -daysAgo);
    const cancelled = rand() < 0.08;
    await mkBooking({
      user: u, hotelIdx: Math.floor(rand() * hotels.length), roomIdx: Math.floor(rand() * 3), checkIn, nights: 1 + Math.floor(rand() * 5),
      status: cancelled ? 'CANCELLED' : 'CHECKED_OUT', paymentStatus: cancelled ? 'REFUNDED' : 'PAID', createdAt,
      method: ['CARD', 'UPI', 'UPI', 'NETBANKING'][Math.floor(rand() * 4)], addonIdx: rand() < 0.4 ? [1] : [],
    });
    historical++;
  }
  log('  bookings', historical + 7);

  // ── Reviews ─────────────────────────────────────────────────────────
  const reviewDocs = [];
  for (const [hi, hotel] of hotels.entries()) {
    const pool = [...reviewers].sort(() => rand() - 0.5).slice(0, 3 + (hi % 3));
    for (const [ri, u] of pool.entries()) {
      const [rating, title, comment] = REVIEW_TEXT[(hi + ri) % REVIEW_TEXT.length];
      reviewDocs.push({ user: u._id, hotel: hotel._id, rating, title, comment, tripType: ['COUPLE', 'SOLO', 'FAMILY', 'FRIENDS', 'BUSINESS'][(hi + ri) % 5], createdAt: addDays(today, -Math.floor(rand() * 120)) });
    }
  }
  await Review.insertMany(reviewDocs);
  for (const h of hotels) {
    const rs = reviewDocs.filter((r) => String(r.hotel) === String(h._id));
    await Hotel.updateOne({ _id: h._id }, { rating: Math.round((rs.reduce((s, r) => s + r.rating, 0) / rs.length) * 10) / 10, reviewCount: rs.length });
  }
  log('  reviews', reviewDocs.length);

  await Wishlist.create({ user: customer._id, hotels: [hotels[4]._id, hotels[8]._id, hotels[11]._id] });
  await Newsletter.insertMany(['ananya@example.com', 'lena@example.com', 'marco@example.com'].map((email) => ({ email })));

  // ── Community itineraries (built offline from curated places) ───────
  const community = [
    { dest: 'Lisbon', user: reviewers[5], days: 4, interests: ['food', 'history', 'photography'], pace: 'balanced', title: 'Four slow days on seven hills', likes: 214 },
    { dest: 'Kyoto', user: reviewers[3], days: 3, interests: ['spiritual', 'culture'], pace: 'relaxed', title: 'Temples before breakfast', likes: 188 },
    { dest: 'Goa', user: reviewers[0], days: 5, interests: ['beaches', 'food', 'nightlife'], pace: 'balanced', title: 'North to south, beach to beach', likes: 341 },
    { dest: 'Jaipur', user: reviewers[1], days: 3, interests: ['history', 'shopping'], pace: 'packed', title: 'Forts, block prints & kachori', likes: 126 },
    { dest: 'Bali', user: reviewers[2], days: 5, interests: ['nature', 'spiritual'], pace: 'relaxed', title: 'Ubud in the rain (and loving it)', likes: 97 },
    { dest: 'Manali', user: customer, days: 4, interests: ['nature', 'adventure', 'cafes'], pace: 'balanced', title: 'Orchards, waterfalls & a Thar', likes: 64 },
  ];
  for (const c of community) {
    const d = DESTINATIONS.find((x) => x.name === c.dest)!;
    const food = d.places.filter((p) => ['FOOD', 'CAFE'].includes(p.at(1) as string));
    const sights = d.places.filter((p) => !['FOOD', 'CAFE', 'NIGHTLIFE'].includes(p.at(1) as string));
    const start = addDays(today, -Math.floor(rand() * 60) - 30);
    const pl = (p: (typeof d.places)[number]) => ({ name: p[0], lat: p[2], lng: p[3] });
    const days = Array.from({ length: c.days }, (_, i) => {
      const s = sights.slice((i * 2) % sights.length).concat(sights).slice(0, 3);
      const f = food.slice(i % food.length).concat(food).slice(0, 2);
      const item = (slot: string, time: string, p: (typeof d.places)[number], cost: number) => ({ slot, time, title: p[0], category: p[1], description: p[5], place: pl(p), indoor: p[4], estCost: cost, durationMins: p[6] ?? 90 });
      return {
        dayNumber: i + 1, date: addDays(start, i), theme: ['Arrive & wander', 'Old town & markets', 'Big views', 'Slow day', 'Last light'][i % 5],
        weather: { code: 1, summary: 'Mainly clear', tMax: 27, tMin: 19, precipProb: 10, wet: false, source: 'estimate' },
        items: [item('MORNING', '09:00', s[0], 400), item('LUNCH', '13:00', f[0], 900), item('AFTERNOON', '14:30', s[1], 600), item('EVENING', '17:30', s[2], 300), item('DINNER', '20:00', f[1], 1400)],
      };
    });
    const hotel = hotels.find((h) => h.city === c.dest);
    await Itinerary.create({
      user: c.user._id, title: c.title, prompt: `${c.days} ${c.pace} days in ${c.dest} — ${c.interests.join(', ')}`,
      destination: { name: d.name, country: d.country, lat: d.lat, lng: d.lng, displayName: `${d.name}, ${d.country}` },
      startDate: start, endDate: addDays(start, c.days - 1), travelers: { adults: 2, children: 0 }, budget: 'MODERATE', pace: c.pace,
      interests: c.interests, summary: d.summary, overview: { extract: d.summary, thumbnail: d.image }, coverImage: d.image, days,
      stays: hotel ? [{ hotel: hotel._id, name: hotel.name, pricePerNight: hotel.priceFrom, rating: hotel.rating, lat: hotel.location?.coordinates?.[1], lng: hotel.location?.coordinates?.[0], image: hotel.images[0], source: 'voyara', bookable: true }] : [],
      rentals: [], estimate: { stay: (hotel?.priceFrom ?? 5000) * (c.days - 1), food: 2300 * c.days * 2, activities: 1300 * c.days * 2, transport: 1200 * c.days, total: 0, currency: 'INR' },
      engine: 'rules', status: 'SAVED', isPublic: true, shareToken: token(9), likes: c.likes,
    });
  }
  log('  community trips', community.length);
  return { admin: admin.email, staff: staff.email, customer: customer.email };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { connectDB, disconnectDB } = await import('./config/db.js');
  await connectDB();
  console.log('◆ Seeding Voyara…');
  const r = await runSeed();
  console.log('◆ Done. Logins:', `${r.admin}/admin123`, `${r.staff}/staff123`, `${r.customer}/customer123`);
  await disconnectDB();
}
