import type { Request, Response } from 'express';
import type { Types } from 'mongoose';
import { Hotel, Room } from '../models/index.js';
import { notFound } from '../utils/AppError.js';

async function refreshPriceFrom(hotelId: Types.ObjectId) {
  const cheapest = await Room.findOne({ hotel: hotelId, isActive: true }).sort({ pricePerNight: 1 }).lean();
  await Hotel.updateOne({ _id: hotelId }, { priceFrom: cheapest?.pricePerNight ?? 0 });
}

export async function listRooms(req: Request, res: Response) {
  const rooms = await Room.find({ hotel: req.params.hotelId, ...(req.user?.role !== 'ADMIN' && { isActive: true }) }).sort({ pricePerNight: 1 });
  res.json({ rooms });
}

export async function createRoom(req: Request, res: Response) {
  if (!(await Hotel.exists({ _id: req.body.hotel }))) throw notFound('Hotel');
  const room = await Room.create(req.body);
  await refreshPriceFrom(room.hotel);
  res.status(201).json({ room });
}

export async function updateRoom(req: Request, res: Response) {
  const room = await Room.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!room) throw notFound('Room');
  await refreshPriceFrom(room.hotel);
  res.json({ room });
}

export async function deleteRoom(req: Request, res: Response) {
  const room = await Room.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!room) throw notFound('Room');
  await refreshPriceFrom(room.hotel);
  res.json({ message: 'Room archived' });
}
