import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { signToken } from '../middlewares/auth.js';
import { User } from '../models/index.js';
import { badRequest, conflict, notFound, unauthorized } from '../utils/AppError.js';

const session = (user: InstanceType<typeof User>) => ({ token: signToken({ id: String(user._id), role: user.role }), user: user.toJSON() });

export async function register(req: Request, res: Response) {
  const { name, email, password, phone } = req.body;
  if (await User.exists({ email })) throw conflict('An account with that email already exists');
  const user = await User.create({ name, email, phone, password: await bcrypt.hash(password, 10), role: 'CUSTOMER' });
  res.status(201).json(session(user));
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await bcrypt.compare(password, user.password))) throw unauthorized('Email or password is incorrect');
  if (!user.isActive) throw unauthorized('This account has been deactivated');
  user.lastLoginAt = new Date();
  await user.save();
  res.json(session(user));
}

export async function me(req: Request, res: Response) {
  const user = await User.findById(req.user!.id);
  if (!user) throw notFound('User');
  res.json({ user });
}

export async function updateMe(req: Request, res: Response) {
  const user = await User.findById(req.user!.id);
  if (!user) throw notFound('User');
  const { preferences, ...rest } = req.body;
  Object.assign(user, rest);
  if (preferences) user.preferences = { ...(user.preferences ?? {}), ...preferences };
  await user.save();
  res.json({ user });
}

export async function changePassword(req: Request, res: Response) {
  const user = await User.findById(req.user!.id).select('+password');
  if (!user) throw notFound('User');
  if (!(await bcrypt.compare(req.body.currentPassword, user.password))) throw badRequest('Current password is incorrect');
  user.password = await bcrypt.hash(req.body.newPassword, 10);
  await user.save();
  res.json({ message: 'Password updated' });
}
