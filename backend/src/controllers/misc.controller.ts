import type { Request, Response } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { UPLOAD_DIR } from '../config/paths.js';
import { Addon, Amenity, Coupon, Hotel, Newsletter, Wishlist } from '../models/index.js';
import { resolveCoupon } from '../services/pricing.service.js';
import { badRequest, notFound } from '../utils/AppError.js';

/* Coupons */
export async function validateCoupon(req: Request, res: Response) {
  const { coupon, discount } = await resolveCoupon(req.body.code, req.body.amount);
  res.json({ valid: true, code: coupon!.code, description: coupon!.description, type: coupon!.type, value: coupon!.value, discount });
}
export async function publicCoupons(_req: Request, res: Response) {
  const now = new Date();
  const coupons = await Coupon.find({ isActive: true, $and: [{ $or: [{ validTo: null }, { validTo: { $gte: now } }] }] }).select('code description type value minAmount').limit(6);
  res.json({ coupons });
}
export const listCoupons = async (_req: Request, res: Response) => res.json({ coupons: await Coupon.find().sort({ createdAt: -1 }) });
export const createCoupon = async (req: Request, res: Response) => res.status(201).json({ coupon: await Coupon.create(req.body) });
export async function updateCoupon(req: Request, res: Response) {
  const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!coupon) throw notFound('Coupon');
  res.json({ coupon });
}
export async function deleteCoupon(req: Request, res: Response) {
  if (!(await Coupon.findByIdAndDelete(req.params.id))) throw notFound('Coupon');
  res.json({ message: 'Coupon deleted' });
}

/* Add-ons */
export const listAddons = async (req: Request, res: Response) =>
  res.json({ addons: await Addon.find(req.user?.role === 'ADMIN' && req.query.all ? {} : { isActive: true }).sort({ price: 1 }) });
export const createAddon = async (req: Request, res: Response) => res.status(201).json({ addon: await Addon.create(req.body) });
export async function updateAddon(req: Request, res: Response) {
  const addon = await Addon.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!addon) throw notFound('Add-on');
  res.json({ addon });
}
export async function deleteAddon(req: Request, res: Response) {
  if (!(await Addon.findByIdAndUpdate(req.params.id, { isActive: false }))) throw notFound('Add-on');
  res.json({ message: 'Add-on archived' });
}
export const listAmenities = async (_req: Request, res: Response) => res.json({ amenities: await Amenity.find().sort({ label: 1 }) });

/* Wishlist */
export async function getWishlist(req: Request, res: Response) {
  const w = await Wishlist.findOne({ user: req.user!.id }).populate({ path: 'hotels', match: { isActive: true } });
  res.json({ hotels: w?.hotels ?? [], destinations: w?.destinations ?? [] });
}
export async function toggleWishlist(req: Request, res: Response) {
  const { hotelId } = req.body;
  if (!(await Hotel.exists({ _id: hotelId }))) throw notFound('Hotel');
  const w = (await Wishlist.findOne({ user: req.user!.id })) ?? new Wishlist({ user: req.user!.id, hotels: [] });
  const idx = w.hotels.findIndex((h) => String(h) === hotelId);
  if (idx >= 0) w.hotels.splice(idx, 1);
  else w.hotels.push(hotelId);
  await w.save();
  res.json({ saved: idx < 0, ids: w.hotels.map(String) });
}
export async function wishlistIds(req: Request, res: Response) {
  const w = await Wishlist.findOne({ user: req.user!.id }).lean();
  res.json({ ids: (w?.hotels ?? []).map(String) });
}

/* Newsletter */
export async function subscribe(req: Request, res: Response) {
  await Newsletter.updateOne({ email: req.body.email }, { $set: { isActive: true, source: req.body.source ?? 'footer' } }, { upsert: true });
  res.status(201).json({ message: 'You are on the list. Expect one good letter a month.' });
}

/* Upload */
export async function upload(req: Request, res: Response) {
  const files = (req.files as Express.Multer.File[] | undefined) ?? (req.file ? [req.file] : []);
  if (!files.length) throw badRequest('No file received');
  const base = `${req.protocol}://${req.get('host')}`;
  res.status(201).json({ files: files.map((f) => ({ url: `${base}/uploads/${f.filename}`, name: f.originalname, size: f.size, mimeType: f.mimetype })) });
}
export async function removeUpload(filename: string) {
  const safe = path.basename(filename);
  await fs.rm(path.join(UPLOAD_DIR, safe), { force: true });
}
