import { Router, type NextFunction, type Request, type Response } from 'express';
import addons from './addons.routes.js';
import admin from './admin.routes.js';
import auth from './auth.routes.js';
import bookings from './bookings.routes.js';
import coupons from './coupons.routes.js';
import guide from './guide.routes.js';
import hotels from './hotels.routes.js';
import newsletter from './newsletter.routes.js';
import payments from './payments.routes.js';
import reviews from './reviews.routes.js';
import rooms from './rooms.routes.js';
import search from './search.routes.js';
import staff from './staff.routes.js';
import trip from './trip.routes.js';
import upload from './upload.routes.js';
import wishlist from './wishlist.routes.js';

const api = Router();

/** Short shared caching for public GETs that change rarely. */
const publicCache = (seconds: number) => (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${seconds * 5}`);
  next();
};
api.get(['/guide/destinations', '/reviews/latest', '/coupons/public', '/addons', '/addons/amenities'], publicCache(120));
api.get('/guide/destination', publicCache(600));
api.get('/health', (_req, res) => res.json({ ok: true, service: 'voyara-api', time: new Date().toISOString() }));
api.use('/auth', auth);
api.use('/hotels', hotels);
api.use('/rooms', rooms);
api.use('/bookings', bookings);
api.use('/payments', payments);
api.use('/reviews', reviews);
api.use('/search', search);
api.use('/admin', admin);
api.use('/staff', staff);
api.use('/coupons', coupons);
api.use('/addons', addons);
api.use('/guide', guide);
api.use('/trip', trip);
api.use('/wishlist', wishlist);
api.use('/upload', upload);
api.use('/newsletter', newsletter);
export default api;
