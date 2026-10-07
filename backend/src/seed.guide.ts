/**
 * Curated guide data — destinations, hand-picked places and bookable rental shops.
 * This is the keyless fallback the itinerary builder blends with live OpenStreetMap data.
 * Run standalone with `npm run seed:guide` (re-seeds only guide collections).
 */
import { pathToFileURL } from 'node:url';
import { Destination, Place, RentalShop } from './models/index.js';
import { slugify } from './utils/helpers.js';

const U = (id: string, w = 1600) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=75`;

type P = [name: string, category: string, lat: number, lng: number, indoor: boolean, description: string, durationMins?: number, priceLevel?: number, bestTime?: string];

export const DESTINATIONS: Array<{
  name: string; country: string; region: string; lat: number; lng: number; currency: string; image: string; summary: string;
  bestMonths: string[]; tags: string[]; avgDailyBudget: number; featured?: boolean; places: P[];
}> = [
  {
    name: 'Goa', country: 'India', region: 'West India', lat: 15.4909, lng: 73.8278, currency: 'INR', image: U('1512343879784-a960bf40e7f2'), featured: true,
    summary: 'Portuguese lanes, laterite forts and a hundred kilometres of coastline — Goa moves at the speed of the tide.',
    bestMonths: ['Nov', 'Dec', 'Jan', 'Feb', 'Mar'], tags: ['beaches', 'food', 'nightlife', 'history'], avgDailyBudget: 5500,
    places: [
      ['Fontainhas Latin Quarter', 'SIGHT', 15.498, 73.8327, false, 'Ochre and indigo Portuguese houses on Panaji’s oldest hillside.', 90, 0, 'MORNING'],
      ['Basilica of Bom Jesus', 'TEMPLE', 15.5009, 73.9116, false, 'UNESCO-listed baroque basilica holding the relics of St Francis Xavier.', 60, 0],
      ['Fort Aguada', 'SIGHT', 15.4925, 73.7737, false, '17th-century fort and lighthouse watching the Mandovi river mouth.', 75, 0, 'AFTERNOON'],
      ['Chapora Fort', 'VIEWPOINT', 15.606, 73.7365, false, 'Crumbling ramparts with the best sunset over Vagator beach.', 60, 0, 'EVENING'],
      ['Calangute Beach', 'BEACH', 15.5439, 73.7553, false, 'The busy, joyful heart of the north Goa coast.', 120, 0],
      ['Palolem Beach', 'BEACH', 15.01, 74.0232, false, 'A calm crescent bay in the south, framed by palms.', 180, 0, 'AFTERNOON'],
      ['Anjuna Flea Market', 'SHOPPING', 15.5733, 73.74, false, 'Wednesday market of textiles, spices and trance-era nostalgia.', 120, 1],
      ['Museum of Goa', 'MUSEUM', 15.528, 73.772, true, 'Contemporary art space in Pilerne that rewards a rainy afternoon.', 90, 1],
      ['Dudhsagar Falls', 'NATURE', 15.3144, 74.3143, false, 'Four-tiered milky waterfall in the Bhagwan Mahaveer sanctuary.', 240, 2],
      ['Gunpowder', 'FOOD', 15.5939, 73.7681, true, 'Peninsular home cooking in a leafy Assagao courtyard.', 90, 2],
      ['Viva Panjim', 'FOOD', 15.4977, 73.8318, true, 'Family-run Goan classics — xacuti, recheado, bebinca.', 75, 1],
      ['Ritz Classic', 'FOOD', 15.4983, 73.8257, true, 'Panaji institution for fish thali.', 60, 1],
      ['Thalassa', 'NIGHTLIFE', 15.6036, 73.7337, true, 'Greek tavern on the Vagator cliff with fire dancers at dusk.', 120, 3, 'EVENING'],
    ],
  },
  {
    name: 'Jaipur', country: 'India', region: 'Rajasthan', lat: 26.9124, lng: 75.7873, currency: 'INR', image: U('1477587458883-47145ed94245'), featured: true,
    summary: 'The Pink City: honeycomb palaces, hilltop forts and bazaars that have traded gems for three centuries.',
    bestMonths: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'], tags: ['history', 'culture', 'shopping', 'food'], avgDailyBudget: 4500,
    places: [
      ['Amber Fort', 'SIGHT', 26.9855, 75.8513, false, 'Sandstone fort-palace above Maota lake; arrive at opening to beat the heat.', 150, 1, 'MORNING'],
      ['Hawa Mahal', 'SIGHT', 26.9239, 75.8267, false, 'The Palace of Winds — 953 latticed windows facing Siredeori Bazaar.', 45, 1, 'MORNING'],
      ['City Palace', 'SIGHT', 26.9258, 75.8237, false, 'Still home to the royal family; the Peacock Gate is unmissable.', 120, 2],
      ['Jantar Mantar', 'SIGHT', 26.9248, 75.8246, false, 'Giant 18th-century astronomical instruments, UNESCO-listed.', 60, 1],
      ['Nahargarh Fort', 'VIEWPOINT', 26.9373, 75.8155, false, 'Ridge-top fort with the city’s finest sunset.', 90, 1, 'EVENING'],
      ['Albert Hall Museum', 'MUSEUM', 26.9116, 75.8195, true, 'Indo-Saracenic museum with an Egyptian mummy and miniature paintings.', 90, 1],
      ['Patrika Gate', 'SIGHT', 26.8418, 75.8016, false, 'Every surface painted — the most photogenic gate in Rajasthan.', 40, 0],
      ['Johari Bazaar', 'SHOPPING', 26.92, 75.827, false, 'Jewellers, block-printers and lassi stalls under pink arcades.', 90, 1, 'AFTERNOON'],
      ['Anokhi Museum of Hand Printing', 'MUSEUM', 26.9877, 75.8528, true, 'Restored haveli devoted to block printing, with live demonstrations.', 75, 1],
      ['Laxmi Misthan Bhandar', 'FOOD', 26.9213, 75.826, true, 'Since 1727 — ghewar, kachori and thali.', 60, 1],
      ['Rawat Mishtan Bhandar', 'FOOD', 26.9196, 75.7958, true, 'The pyaaz kachori pilgrimage.', 40, 0],
      ['Bar Palladio', 'NIGHTLIFE', 26.9037, 75.8126, true, 'Italian-Rajput fantasy in sapphire blue, inside Narain Niwas.', 120, 3, 'EVENING'],
      ['Tapri Central', 'CAFE', 26.9085, 75.803, true, 'Rooftop chai house overlooking Central Park.', 45, 1],
    ],
  },
  {
    name: 'Udaipur', country: 'India', region: 'Rajasthan', lat: 24.5854, lng: 73.7125, currency: 'INR', image: U('1615836245337-f5b9b2303f10'), featured: true,
    summary: 'Lakes, marble palaces and rooftop dinners — the most romantic city in Rajasthan.',
    bestMonths: ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'], tags: ['history', 'culture', 'romance', 'photography'], avgDailyBudget: 5000,
    places: [
      ['City Palace Udaipur', 'SIGHT', 24.5764, 73.6835, false, 'A 400-year accretion of palaces on the banks of Lake Pichola.', 150, 2, 'MORNING'],
      ['Lake Pichola Boat Ride', 'ACTIVITY', 24.572, 73.679, false, 'Sunset cruise past Jag Niwas and the ghats.', 60, 2, 'EVENING'],
      ['Jag Mandir', 'SIGHT', 24.5683, 73.6781, false, 'Island palace with elephant-lined terraces.', 75, 2],
      ['Monsoon Palace (Sajjangarh)', 'VIEWPOINT', 24.5932, 73.64, false, 'Hilltop palace built to watch the monsoon clouds roll in.', 90, 1, 'EVENING'],
      ['Bagore Ki Haveli', 'MUSEUM', 24.58, 73.6827, true, '138-room haveli museum with an evening folk dance show.', 90, 1],
      ['Saheliyon Ki Bari', 'NATURE', 24.6022, 73.6873, false, 'Garden of the maidens — fountains, lotus pools, marble elephants.', 60, 1],
      ['Fateh Sagar Lake', 'NATURE', 24.6012, 73.6743, false, 'Breezy promenade with island gardens and street food.', 75, 0],
      ['Ambrai Ghat', 'VIEWPOINT', 24.5778, 73.68, false, 'The postcard view of the City Palace across the water.', 45, 0, 'EVENING'],
      ['Crystal Gallery', 'MUSEUM', 24.5759, 73.6825, true, 'Osler crystal furniture, even a crystal bed — strange and dazzling.', 60, 2],
      ['Ambrai Restaurant', 'FOOD', 24.5781, 73.6797, true, 'Lakeside tables under a giant tree, lit palace opposite.', 90, 3],
      ['Upre by 1559 AD', 'FOOD', 24.5788, 73.6812, true, 'Rooftop Rajasthani with lake views.', 90, 3],
      ['Millets of Mewar', 'FOOD', 24.5799, 73.6822, true, 'Healthy local grains, great for vegans.', 60, 1],
    ],
  },
  {
    name: 'Manali', country: 'India', region: 'Himachal Pradesh', lat: 32.2432, lng: 77.1892, currency: 'INR', image: U('1626621341517-bbf3d9990a23'), featured: true,
    summary: 'Cedar forests, apple orchards and the gateway to the high Himalaya.',
    bestMonths: ['Mar', 'Apr', 'May', 'Jun', 'Oct', 'Nov'], tags: ['nature', 'adventure', 'cafes', 'mountains'], avgDailyBudget: 4000,
    places: [
      ['Hadimba Devi Temple', 'TEMPLE', 32.2482, 77.1806, false, 'Four-tiered pagoda temple in a deodar forest.', 60, 0, 'MORNING'],
      ['Old Manali', 'SIGHT', 32.258, 77.183, false, 'Slate-roofed village of cafés, guesthouses and orchards.', 120, 1],
      ['Solang Valley', 'ACTIVITY', 32.3166, 77.1586, false, 'Paragliding, ropeway and zorbing under snowy peaks.', 240, 3],
      ['Jogini Falls', 'NATURE', 32.2669, 77.1966, false, 'Easy forest hike from Vashisht to a 150 ft waterfall.', 180, 0, 'MORNING'],
      ['Vashisht Hot Springs', 'NATURE', 32.2622, 77.1883, false, 'Sulphur baths beside an old stone temple.', 60, 0],
      ['Manu Temple', 'TEMPLE', 32.2603, 77.1796, false, 'Hilltop shrine above Old Manali.', 45, 0],
      ['Rohtang Pass', 'VIEWPOINT', 32.3716, 77.2466, false, '3,980 m pass — permit required, open May–Nov.', 300, 3],
      ['Himachal Museum of Folk Art', 'MUSEUM', 32.2445, 77.1866, true, 'Small museum of costumes, masks and wooden crafts.', 60, 1],
      ['Mall Road', 'SHOPPING', 32.2432, 77.1892, false, 'Shawls, woollens and momos.', 75, 1, 'EVENING'],
      ['Johnson’s Cafe', 'FOOD', 32.2465, 77.185, true, 'Trout and apple crumble in a garden café.', 75, 2],
      ['Cafe 1947', 'CAFE', 32.2595, 77.1829, true, 'Riverside café with live music most nights.', 90, 2, 'EVENING'],
      ['Lazy Dog', 'FOOD', 32.2572, 77.1844, true, 'Riverside lounge with Israeli and Himachali plates.', 75, 2],
    ],
  },
  {
    name: 'Kochi', country: 'India', region: 'Kerala', lat: 9.9312, lng: 76.2673, currency: 'INR', image: U('1602216056096-3b40cc0c9944'), featured: true,
    summary: 'Chinese fishing nets, spice warehouses and the doorway to Kerala’s backwaters.',
    bestMonths: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'], tags: ['culture', 'food', 'history', 'nature'], avgDailyBudget: 4200,
    places: [
      ['Chinese Fishing Nets', 'SIGHT', 9.9682, 76.2422, false, 'Cantilevered nets lowered at dawn on the Fort Kochi shore.', 45, 0, 'MORNING'],
      ['St Francis Church', 'TEMPLE', 9.9659, 76.2422, false, 'India’s oldest European church, once Vasco da Gama’s resting place.', 30, 0],
      ['Mattancherry Palace', 'MUSEUM', 9.9583, 76.2593, true, 'Dutch Palace with extraordinary Ramayana murals.', 75, 1],
      ['Paradesi Synagogue', 'TEMPLE', 9.9573, 76.2595, true, '1568 synagogue with hand-painted Chinese tiles.', 40, 1],
      ['Jew Town Spice Market', 'SHOPPING', 9.9575, 76.26, false, 'Antique shops and pepper warehouses.', 90, 1, 'AFTERNOON'],
      ['Kerala Kathakali Centre', 'ACTIVITY', 9.9645, 76.243, true, 'Watch the make-up ritual, then the performance.', 120, 2, 'EVENING'],
      ['Kerala Folklore Museum', 'MUSEUM', 9.9425, 76.2899, true, 'Three floors of masks, costumes and carved wood.', 90, 1],
      ['Marine Drive Kochi', 'VIEWPOINT', 9.979, 76.277, false, 'Waterfront walkway for sunset over the harbour.', 60, 0, 'EVENING'],
      ['Backwater Canoe Trip', 'NATURE', 9.9, 76.35, false, 'Village canals by country boat — coir, toddy, kingfishers.', 240, 2],
      ['Kashi Art Cafe', 'CAFE', 9.9662, 76.2429, true, 'Gallery café — come for breakfast and the art.', 60, 1],
      ['Fort House', 'FOOD', 9.967, 76.244, true, 'Karimeen pollichathu by the water.', 75, 2],
      ['Dal Roti', 'FOOD', 9.9658, 76.244, true, 'Tiny, beloved North Indian kitchen in Fort Kochi.', 60, 1],
    ],
  },
  {
    name: 'Mumbai', country: 'India', region: 'Maharashtra', lat: 19.076, lng: 72.8777, currency: 'INR', image: U('1570168007204-dfb528c6958f'),
    summary: 'Art deco seafronts, Victorian gothic stations and the best street food in the country.',
    bestMonths: ['Nov', 'Dec', 'Jan', 'Feb'], tags: ['food', 'culture', 'nightlife', 'history'], avgDailyBudget: 6000,
    places: [
      ['Gateway of India', 'SIGHT', 18.922, 72.8347, false, 'Basalt arch on the Apollo Bunder waterfront.', 45, 0, 'MORNING'],
      ['Chhatrapati Shivaji Terminus', 'SIGHT', 18.9398, 72.8355, false, 'Victorian gothic railway cathedral, UNESCO-listed.', 45, 0],
      ['Marine Drive', 'VIEWPOINT', 18.944, 72.823, false, 'The Queen’s Necklace — walk it at dusk.', 60, 0, 'EVENING'],
      ['Elephanta Caves', 'SIGHT', 18.9633, 72.9315, false, 'Rock-cut Shiva temples an hour’s ferry from the Gateway.', 240, 2, 'MORNING'],
      ['CSMVS Museum', 'MUSEUM', 18.9269, 72.8327, true, 'The Prince of Wales museum — sculpture, miniatures, textiles.', 120, 1],
      ['Bandra Bandstand', 'VIEWPOINT', 19.044, 72.819, false, 'Sea-wall promenade under Bandra Fort.', 60, 0, 'EVENING'],
      ['Haji Ali Dargah', 'TEMPLE', 18.9827, 72.8089, false, 'Mosque reachable only by causeway at low tide.', 60, 0],
      ['Colaba Causeway', 'SHOPPING', 18.915, 72.8258, false, 'Street stalls, antiques and people-watching.', 90, 1],
      ['Dr. Bhau Daji Lad Museum', 'MUSEUM', 18.9793, 72.8342, true, 'Mumbai’s oldest museum in a restored Palladian hall.', 75, 1],
      ['Britannia & Co', 'FOOD', 18.9346, 72.8394, true, 'Berry pulao at a Parsi café since 1923.', 75, 1],
      ['Trishna', 'FOOD', 18.93, 72.8326, true, 'Butter-garlic crab — book ahead.', 90, 3],
      ['Leopold Cafe', 'FOOD', 18.9227, 72.8317, true, 'Colaba landmark since 1871.', 60, 2],
      ['Bademiya', 'FOOD', 18.9227, 72.8323, true, 'Late-night seekh kebab rolls from the street grill.', 40, 1, 'EVENING'],
    ],
  },
  {
    name: 'Paris', country: 'France', region: 'Île-de-France', lat: 48.8566, lng: 2.3522, currency: 'EUR', image: U('1502602898657-3e91760cbb34'), featured: true,
    summary: 'Boulevards, bistros and the world’s densest concentration of art per square metre.',
    bestMonths: ['Apr', 'May', 'Jun', 'Sep', 'Oct'], tags: ['culture', 'food', 'history', 'romance'], avgDailyBudget: 16000,
    places: [
      ['Musée du Louvre', 'MUSEUM', 48.8606, 2.3376, true, 'Book the first slot; go straight to the Denon wing.', 180, 2, 'MORNING'],
      ['Musée d’Orsay', 'MUSEUM', 48.86, 2.3266, true, 'Impressionists in a Beaux-Arts railway station.', 150, 2],
      ['Eiffel Tower', 'SIGHT', 48.8584, 2.2945, false, 'Climb the stairs to level two for the better view.', 120, 2, 'EVENING'],
      ['Sacré-Cœur & Montmartre', 'VIEWPOINT', 48.8867, 2.3431, false, 'Basilica steps above the whole city.', 120, 0, 'MORNING'],
      ['Le Marais', 'SIGHT', 48.859, 2.362, false, 'Medieval lanes, galleries and Place des Vosges.', 120, 1, 'AFTERNOON'],
      ['Jardin du Luxembourg', 'NATURE', 48.8462, 2.3372, false, 'Green chairs, palace lawns and pond sailboats.', 75, 0],
      ['Notre-Dame de Paris', 'TEMPLE', 48.853, 2.3499, false, 'Reopened cathedral on the Île de la Cité.', 60, 0],
      ['Seine Walk & Pont Alexandre III', 'VIEWPOINT', 48.8639, 2.3136, false, 'Gilded bridge, best at golden hour.', 60, 0, 'EVENING'],
      ['Centre Pompidou', 'MUSEUM', 48.8606, 2.3522, true, 'Modern art inside an inside-out building.', 120, 2],
      ['Breizh Café', 'FOOD', 48.8608, 2.3624, true, 'Buckwheat galettes and Breton cider.', 60, 2],
      ['Le Comptoir du Relais', 'FOOD', 48.8521, 2.3389, true, 'Classic Saint-Germain bistro.', 90, 3],
      ['Bouillon Chartier', 'FOOD', 48.872, 2.3434, true, 'Belle Époque dining hall, affordable classics.', 75, 1],
      ['Café de Flore', 'CAFE', 48.8541, 2.3326, true, 'Existentialist hangout, still the place for chocolat chaud.', 45, 2],
    ],
  },
  {
    name: 'Tokyo', country: 'Japan', region: 'Kantō', lat: 35.6762, lng: 139.6503, currency: 'JPY', image: U('1540959733332-eab4deabeeaf'), featured: true,
    summary: 'Neon canyons, quiet shrines and the best food city on earth — at every price point.',
    bestMonths: ['Mar', 'Apr', 'May', 'Oct', 'Nov'], tags: ['food', 'culture', 'nightlife', 'shopping'], avgDailyBudget: 14000,
    places: [
      ['Senso-ji', 'TEMPLE', 35.7148, 139.7967, false, 'Tokyo’s oldest temple — go at 7am before the crowds.', 75, 0, 'MORNING'],
      ['Meiji Jingu', 'TEMPLE', 35.6764, 139.6993, false, 'Forest shrine in the middle of the city.', 75, 0, 'MORNING'],
      ['Shibuya Crossing', 'SIGHT', 35.6595, 139.7005, false, 'The scramble — watch from Shibuya Sky above.', 45, 0, 'EVENING'],
      ['teamLab Planets', 'MUSEUM', 35.6491, 139.7898, true, 'Immersive digital art you wade through barefoot.', 120, 3],
      ['Tokyo National Museum', 'MUSEUM', 35.7188, 139.7765, true, 'Japan’s largest collection — samurai armour to scrolls.', 150, 1],
      ['Shinjuku Gyoen', 'NATURE', 35.6852, 139.71, false, 'French, English and Japanese gardens in one park.', 90, 1],
      ['Tokyo Skytree', 'VIEWPOINT', 35.7101, 139.8107, true, '450 m galleria with Fuji on clear days.', 90, 2, 'EVENING'],
      ['Golden Gai', 'NIGHTLIFE', 35.6938, 139.7046, true, 'Six alleys, 200 tiny bars.', 120, 2, 'EVENING'],
      ['Tsukiji Outer Market', 'SHOPPING', 35.6655, 139.7707, false, 'Tamagoyaki, oysters and knives for breakfast.', 90, 2, 'MORNING'],
      ['Ichiran Shibuya', 'FOOD', 35.661, 139.701, true, 'Solo-booth tonkotsu ramen.', 45, 1],
      ['Omoide Yokocho', 'FOOD', 35.6933, 139.6995, true, 'Smoky yakitori alley by Shinjuku station.', 75, 1, 'EVENING'],
      ['Afuri Ebisu', 'FOOD', 35.6467, 139.7101, true, 'Yuzu shio ramen, light and bright.', 45, 1],
    ],
  },
  {
    name: 'Kyoto', country: 'Japan', region: 'Kansai', lat: 35.0116, lng: 135.7681, currency: 'JPY', image: U('1493976040374-85c8e12f0c0e'),
    summary: 'Seventeen UNESCO sites, a thousand temples and the quiet art of the tea house.',
    bestMonths: ['Mar', 'Apr', 'Oct', 'Nov'], tags: ['culture', 'history', 'spiritual', 'food'], avgDailyBudget: 12000,
    places: [
      ['Fushimi Inari Taisha', 'TEMPLE', 34.9671, 135.7727, false, 'Ten thousand vermilion torii up Mount Inari — start at dawn.', 150, 0, 'MORNING'],
      ['Kinkaku-ji', 'TEMPLE', 35.0394, 135.7292, false, 'The Golden Pavilion reflected in its mirror pond.', 60, 1],
      ['Arashiyama Bamboo Grove', 'NATURE', 35.017, 135.6713, false, 'Towering bamboo, then Tenryu-ji’s garden.', 120, 0, 'MORNING'],
      ['Kiyomizu-dera', 'TEMPLE', 34.9949, 135.785, false, 'Wooden stage over the maple valley.', 90, 1],
      ['Gion', 'SIGHT', 35.0037, 135.7788, false, 'Machiya lanes of the geisha district at dusk.', 90, 0, 'EVENING'],
      ['Philosopher’s Path', 'NATURE', 35.027, 135.7948, false, 'Canal-side walk lined with cherry trees.', 75, 0],
      ['Kyoto National Museum', 'MUSEUM', 34.99, 135.773, true, 'Buddhist sculpture and national treasures.', 120, 1],
      ['Nishiki Market', 'SHOPPING', 35.005, 135.765, true, 'Kyoto’s kitchen — 400 m of pickles, tofu and knives.', 90, 1],
      ['Pontocho Alley', 'FOOD', 35.005, 135.771, true, 'Lantern-lit alley of riverside restaurants.', 90, 3, 'EVENING'],
      ['Gion Tea Ceremony', 'ACTIVITY', 35.0035, 135.7765, true, 'Matcha and wagashi in a traditional tearoom.', 60, 2],
    ],
  },
  {
    name: 'Bali', country: 'Indonesia', region: 'Ubud', lat: -8.5069, lng: 115.2625, currency: 'IDR', image: U('1537996194471-e657df975ab4'), featured: true,
    summary: 'Rice terraces, water temples and the gentle rhythm of Ubud’s offerings.',
    bestMonths: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'], tags: ['nature', 'spiritual', 'beaches', 'food'], avgDailyBudget: 6500,
    places: [
      ['Tegallalang Rice Terraces', 'NATURE', -8.4312, 115.2793, false, 'Subak-irrigated terraces — arrive before 8am.', 120, 1, 'MORNING'],
      ['Sacred Monkey Forest', 'NATURE', -8.5188, 115.2585, false, 'Moss-covered temples ruled by long-tailed macaques.', 90, 1],
      ['Tirta Empul', 'TEMPLE', -8.4155, 115.3153, false, 'Holy spring water temple for purification rituals.', 90, 1],
      ['Ubud Palace', 'SIGHT', -8.5069, 115.2625, false, 'Royal palace with nightly Legong dance.', 45, 0, 'EVENING'],
      ['Campuhan Ridge Walk', 'NATURE', -8.503, 115.2532, false, 'Easy ridge walk between two river valleys.', 75, 0, 'MORNING'],
      ['Uluwatu Temple', 'VIEWPOINT', -8.8291, 115.0849, false, 'Cliff temple with Kecak fire dance at sunset.', 150, 1, 'EVENING'],
      ['Tanah Lot', 'TEMPLE', -8.6212, 115.0868, false, 'Sea temple on a tidal rock.', 90, 1, 'EVENING'],
      ['ARMA Museum', 'MUSEUM', -8.5205, 115.2671, true, 'Agung Rai Museum of Art — Balinese painting through the ages.', 90, 1],
      ['Ubud Art Market', 'SHOPPING', -8.507, 115.263, true, 'Sarongs, baskets and woodcarving — bargain gently.', 75, 1],
      ['Locavore NXT', 'FOOD', -8.5085, 115.2636, true, 'Indonesian-ingredient tasting menu.', 150, 4],
      ['Warung Babi Guling Ibu Oka', 'FOOD', -8.5065, 115.262, true, 'Legendary spit-roast suckling pig.', 45, 1],
      ['Clear Cafe', 'CAFE', -8.5072, 115.2652, true, 'Smoothie bowls and shoes-off seating.', 60, 1],
    ],
  },
  {
    name: 'Lisbon', country: 'Portugal', region: 'Lisboa', lat: 38.7223, lng: -9.1393, currency: 'EUR', image: U('1585208798174-6cedd86e019a'), featured: true,
    summary: 'Seven hills, yellow trams, azulejo façades and the best custard tart you will ever eat.',
    bestMonths: ['Apr', 'May', 'Jun', 'Sep', 'Oct'], tags: ['culture', 'food', 'history', 'photography'], avgDailyBudget: 12000,
    places: [
      ['Alfama', 'SIGHT', 38.7114, -9.13, false, 'Moorish maze of stairways, laundry lines and fado.', 120, 0, 'MORNING'],
      ['Castelo de São Jorge', 'VIEWPOINT', 38.7139, -9.1335, false, 'Hilltop castle with peacocks and river views.', 90, 1],
      ['Tram 28', 'ACTIVITY', 38.7158, -9.136, false, 'The rattling yellow tram — ride early from Martim Moniz.', 60, 1, 'MORNING'],
      ['Mosteiro dos Jerónimos', 'SIGHT', 38.6979, -9.2068, false, 'Manueline monastery cloisters in Belém.', 90, 1],
      ['Torre de Belém', 'SIGHT', 38.6916, -9.216, false, 'Riverside fortress from the Age of Discovery.', 45, 1],
      ['Miradouro da Senhora do Monte', 'VIEWPOINT', 38.719, -9.1328, false, 'The highest miradouro — bring wine for sunset.', 45, 0, 'EVENING'],
      ['Calouste Gulbenkian Museum', 'MUSEUM', 38.7372, -9.1546, true, 'Lalique to Rembrandt in a modernist garden.', 120, 1],
      ['LX Factory', 'SHOPPING', 38.7037, -9.1785, true, 'Industrial complex of bookshops, studios and brunch.', 90, 1],
      ['National Tile Museum', 'MUSEUM', 38.7247, -9.1135, true, 'Five centuries of azulejos in a convent.', 90, 1],
      ['Time Out Market', 'FOOD', 38.7069, -9.1458, true, 'The city’s best kitchens under one roof.', 75, 2],
      ['Pastéis de Belém', 'CAFE', 38.6975, -9.2032, true, 'The original pastel de nata, since 1837.', 30, 0],
      ['Cervejaria Ramiro', 'FOOD', 38.7206, -9.136, true, 'Garlic prawns and a prego for dessert.', 90, 3],
      ['Tasca do Chico', 'NIGHTLIFE', 38.7115, -9.144, true, 'Tiny bar with spontaneous fado.', 90, 1, 'EVENING'],
    ],
  },
];

export const RENTAL_SHOPS = [
  { name: 'Anjuna Wheels', destination: 'Goa', lat: 15.5763, lng: 73.7428, address: 'Flea Market Rd, Anjuna', image: U('1558981403-c5f9899a28bc', 900), vehicles: [{ type: 'SCOOTER', model: 'Honda Activa 6G', pricePerDay: 350, available: 14 }, { type: 'MOTORBIKE', model: 'Royal Enfield Classic 350', pricePerDay: 900, available: 6 }, { type: 'CAR', model: 'Maruti Swift (self-drive)', pricePerDay: 2200, available: 3 }] },
  { name: 'Palolem Rides', destination: 'Goa', lat: 15.0098, lng: 74.0237, address: 'Palolem Beach Rd, Canacona', image: U('1609630875171-b1321377ee65', 900), vehicles: [{ type: 'SCOOTER', model: 'TVS Jupiter', pricePerDay: 300, available: 10 }, { type: 'BICYCLE', model: 'Hybrid city bike', pricePerDay: 150, available: 8 }] },
  { name: 'Pink City Rides', destination: 'Jaipur', lat: 26.9196, lng: 75.7878, address: 'MI Road, Jaipur', image: U('1558981403-c5f9899a28bc', 900), vehicles: [{ type: 'SCOOTER', model: 'Honda Dio', pricePerDay: 400, available: 8 }, { type: 'CAR', model: 'Toyota Innova with driver', pricePerDay: 3200, available: 4 }] },
  { name: 'Lakeside Scooters', destination: 'Udaipur', lat: 24.5793, lng: 73.6829, address: 'Gangaur Ghat Rd, Udaipur', image: U('1609630875171-b1321377ee65', 900), vehicles: [{ type: 'SCOOTER', model: 'Suzuki Access', pricePerDay: 380, available: 9 }, { type: 'BICYCLE', model: 'Vintage roadster', pricePerDay: 180, available: 6 }] },
  { name: 'Old Manali Moto', destination: 'Manali', lat: 32.2575, lng: 77.1836, address: 'Manu Temple Rd, Old Manali', image: U('1558981403-c5f9899a28bc', 900), vehicles: [{ type: 'MOTORBIKE', model: 'Royal Enfield Himalayan', pricePerDay: 1400, available: 8 }, { type: 'JEEP', model: 'Mahindra Thar 4x4', pricePerDay: 3800, available: 2 }, { type: 'SCOOTER', model: 'Honda Activa', pricePerDay: 500, available: 6 }] },
  { name: 'Fort Kochi Cycles', destination: 'Kochi', lat: 9.9658, lng: 76.2436, address: 'Princess St, Fort Kochi', image: U('1609630875171-b1321377ee65', 900), vehicles: [{ type: 'BICYCLE', model: 'Hero city bike', pricePerDay: 200, available: 12 }, { type: 'SCOOTER', model: 'TVS Ntorq', pricePerDay: 450, available: 6 }] },
  { name: 'Bombay Drive Co.', destination: 'Mumbai', lat: 18.92, lng: 72.831, address: 'Colaba, Mumbai', image: U('1558981403-c5f9899a28bc', 900), vehicles: [{ type: 'CAR', model: 'Sedan with chauffeur', pricePerDay: 3600, available: 5 }] },
  { name: 'Vélo Marais', destination: 'Paris', lat: 48.8575, lng: 2.3606, address: 'Rue de Rivoli, 4e', image: U('1609630875171-b1321377ee65', 900), vehicles: [{ type: 'BICYCLE', model: 'Dutch city bike', pricePerDay: 1500, available: 10 }, { type: 'EBIKE', model: 'Cargo e-bike', pricePerDay: 3200, available: 4 }] },
  { name: 'Tokyo Cycle Lab', destination: 'Tokyo', lat: 35.7108, lng: 139.7963, address: 'Asakusa, Taitō', image: U('1609630875171-b1321377ee65', 900), vehicles: [{ type: 'BICYCLE', model: 'Mamachari', pricePerDay: 900, available: 12 }, { type: 'EBIKE', model: 'Panasonic e-assist', pricePerDay: 1800, available: 6 }] },
  { name: 'Kamo River Bikes', destination: 'Kyoto', lat: 35.0045, lng: 135.7712, address: 'Kawaramachi, Kyoto', image: U('1609630875171-b1321377ee65', 900), vehicles: [{ type: 'BICYCLE', model: 'City bike', pricePerDay: 800, available: 15 }, { type: 'EBIKE', model: 'E-assist', pricePerDay: 1600, available: 5 }] },
  { name: 'Ubud Scoot', destination: 'Bali', lat: -8.5094, lng: 115.2638, address: 'Jl. Hanoman, Ubud', image: U('1558981403-c5f9899a28bc', 900), vehicles: [{ type: 'SCOOTER', model: 'Honda Scoopy', pricePerDay: 450, available: 20 }, { type: 'CAR', model: 'Toyota Avanza with driver', pricePerDay: 2800, available: 4 }] },
  { name: 'Alfama eBikes', destination: 'Lisbon', lat: 38.7118, lng: -9.1318, address: 'Largo do Chafariz de Dentro', image: U('1609630875171-b1321377ee65', 900), vehicles: [{ type: 'EBIKE', model: 'Hill-ready e-bike', pricePerDay: 2200, available: 8 }, { type: 'SCOOTER', model: 'Electric scooter 50cc', pricePerDay: 2600, available: 4 }] },
].map(({ lat, lng, ...s }) => ({ ...s, lat, lng }));

export async function seedGuide() {
  await Promise.all([Destination.deleteMany({}), Place.deleteMany({}), RentalShop.deleteMany({})]);
  await Destination.insertMany(
    DESTINATIONS.map(({ places: _p, lat, lng, ...d }) => ({ ...d, slug: slugify(d.name), location: { type: 'Point', coordinates: [lng, lat] } })),
  );
  await Place.insertMany(
    DESTINATIONS.flatMap((d) =>
      d.places.map(([name, category, lat, lng, indoor, description, durationMins = 90, priceLevel = 1, bestTime = 'ANY']) => ({
        name, category, indoor, description, durationMins, priceLevel, bestTime, destination: d.name, rating: 4.5,
        location: { type: 'Point', coordinates: [lng, lat] },
      })),
    ),
  );
  await RentalShop.insertMany(
    RENTAL_SHOPS.map(({ lat, lng, ...s }) => ({ ...s, rating: 4.3 + Math.round(Math.random() * 6) / 10, phone: '+91 98' + String(Math.floor(10_000_000 + Math.random() * 89_999_999)), location: { type: 'Point', coordinates: [lng, lat] } })),
  );
  return { destinations: DESTINATIONS.length, places: DESTINATIONS.reduce((s, d) => s + d.places.length, 0), shops: RENTAL_SHOPS.length };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { connectDB, disconnectDB } = await import('./config/db.js');
  await connectDB();
  console.log('◆ Guide seeded', await seedGuide());
  await disconnectDB();
}
