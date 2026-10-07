import type { Destination } from '../types';

const U = (id: string, w = 1600) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=75`;

export const IMAGES = {
  hero: U('1488646953014-85cb44e25828', 2400),
  void: U('1500835556837-99ac94a94552', 2000),
  road: U('1469854523086-cc02fe5d8800', 2000),
  lake: U('1476514525535-07fb3b4ae5f1', 2000),
  hiker: U('1503220317375-aaad61436b1b', 1600),
  tent: U('1504280390367-361c6d9f38f4', 1600),
  balloons: U('1530789253388-582c481c54b0', 1600),
  dining: U('1414235077428-338989a2e8c0', 1600),
  scooter: U('1558981403-c5f9899a28bc', 1600),
  moto: U('1609630875171-b1321377ee65', 1600),
  hotelNight: U('1517840901100-8179e982acb7', 1600),
  valley: U('1464822759023-fed622ff2c3b', 2000),
};

export const CURATED_DESTINATIONS: Destination[] = [
  { name: 'Goa', slug: 'goa', country: 'India', region: 'West India', image: U('1512343879784-a960bf40e7f2'), summary: 'Portuguese lanes, laterite forts and a hundred kilometres of coastline.', tags: ['beaches', 'food', 'nightlife'], bestMonths: ['Nov', 'Dec', 'Jan', 'Feb'] },
  { name: 'Jaipur', slug: 'jaipur', country: 'India', region: 'Rajasthan', image: U('1477587458883-47145ed94245'), summary: 'Honeycomb palaces, hilltop forts and three centuries of bazaars.', tags: ['history', 'culture'], bestMonths: ['Oct', 'Nov', 'Feb', 'Mar'] },
  { name: 'Udaipur', slug: 'udaipur', country: 'India', region: 'Rajasthan', image: U('1615836245337-f5b9b2303f10'), summary: 'Lakes, marble palaces and rooftop dinners.', tags: ['romance', 'history'], bestMonths: ['Sep', 'Oct', 'Nov'] },
  { name: 'Manali', slug: 'manali', country: 'India', region: 'Himachal', image: U('1626621341517-bbf3d9990a23'), summary: 'Cedar forests, orchards and the gateway to the high Himalaya.', tags: ['nature', 'adventure'], bestMonths: ['Apr', 'May', 'Oct'] },
  { name: 'Kochi', slug: 'kochi', country: 'India', region: 'Kerala', image: U('1602216056096-3b40cc0c9944'), summary: 'Fishing nets, spice warehouses and the doorway to the backwaters.', tags: ['culture', 'food'], bestMonths: ['Oct', 'Dec', 'Feb'] },
  { name: 'Mumbai', slug: 'mumbai', country: 'India', region: 'Maharashtra', image: U('1570168007204-dfb528c6958f'), summary: 'Art deco seafronts and the country’s best street food.', tags: ['food', 'city'], bestMonths: ['Nov', 'Jan'] },
  { name: 'Paris', slug: 'paris', country: 'France', region: 'Île-de-France', image: U('1502602898657-3e91760cbb34'), summary: 'Boulevards, bistros and art on every corner.', tags: ['culture', 'romance'], bestMonths: ['May', 'Jun', 'Sep'] },
  { name: 'Tokyo', slug: 'tokyo', country: 'Japan', region: 'Kantō', image: U('1540959733332-eab4deabeeaf'), summary: 'Neon canyons, quiet shrines, the best food city on earth.', tags: ['food', 'nightlife'], bestMonths: ['Apr', 'Nov'] },
  { name: 'Kyoto', slug: 'kyoto', country: 'Japan', region: 'Kansai', image: U('1493976040374-85c8e12f0c0e'), summary: 'A thousand temples and the quiet art of the tea house.', tags: ['spiritual', 'culture'], bestMonths: ['Apr', 'Nov'] },
  { name: 'Bali', slug: 'bali', country: 'Indonesia', region: 'Ubud', image: U('1537996194471-e657df975ab4'), summary: 'Rice terraces, water temples and Ubud’s gentle rhythm.', tags: ['nature', 'spiritual'], bestMonths: ['May', 'Jul', 'Sep'] },
  { name: 'Lisbon', slug: 'lisbon', country: 'Portugal', region: 'Lisboa', image: U('1585208798174-6cedd86e019a'), summary: 'Seven hills, yellow trams and the perfect custard tart.', tags: ['food', 'photography'], bestMonths: ['May', 'Jun', 'Sep'] },
];

export const PROMPT_IDEAS = [
  '5 relaxed days in Lisbon with my partner — food, tiles and sunsets',
  'A long weekend in Goa, budget, beaches and a scooter',
  'Family of 4 in Kyoto next April, temples and gardens',
  'Packed 3 days in Jaipur for history and shopping',
  'A week in Bali, slow pace, yoga and rice terraces',
  'Manali in May — waterfalls, cafés and a Royal Enfield',
];

export const INTERESTS = ['food', 'history', 'culture', 'nature', 'beaches', 'nightlife', 'spiritual', 'shopping', 'adventure', 'cafes', 'photography'];

export const SLOT_LABEL: Record<string, string> = {
  MORNING: 'Morning',
  LUNCH: 'Lunch',
  AFTERNOON: 'Afternoon',
  EVENING: 'Evening',
  DINNER: 'Dinner',
  TRANSIT: 'Transit',
  STAY: 'Stay',
};

export const VEHICLE_LABEL: Record<string, string> = {
  SCOOTER: 'Scooter',
  MOTORBIKE: 'Motorbike',
  BICYCLE: 'Bicycle',
  CAR: 'Car',
  EBIKE: 'E-bike',
  JEEP: 'Jeep 4×4',
  BOAT: 'Boat',
};

export const AMENITY_LABEL: Record<string, string> = {
  wifi: 'Fast Wi-Fi', pool: 'Pool', spa: 'Spa', gym: 'Gym', breakfast: 'Breakfast', parking: 'Parking', ac: 'Air conditioning',
  restaurant: 'Restaurant', bar: 'Bar', 'airport-shuttle': 'Airport shuttle', 'pet-friendly': 'Pet friendly', 'beach-access': 'Beach access',
  workspace: 'Workspace', kitchen: 'Kitchen', 'mountain-view': 'Mountain view', 'lake-view': 'Lake view', rooftop: 'Rooftop',
  bicycles: 'Bicycles', fireplace: 'Fireplace', 'ev-charging': 'EV charging',
};

/** The sample day used in the homepage weather-swap demo. */
export const DEMO_DAY = [
  { time: '09:00', slot: 'Morning', title: 'Alfama stairways walk', alt: 'National Tile Museum', outdoor: true },
  { time: '13:00', slot: 'Lunch', title: 'Time Out Market', alt: 'Time Out Market', outdoor: false },
  { time: '14:30', slot: 'Afternoon', title: 'Castelo de São Jorge', alt: 'Gulbenkian Museum', outdoor: true },
  { time: '17:30', slot: 'Evening', title: 'Miradouro sunset', alt: 'Fado at Tasca do Chico', outdoor: true },
  { time: '20:00', slot: 'Dinner', title: 'Cervejaria Ramiro', alt: 'Cervejaria Ramiro', outdoor: false },
];
