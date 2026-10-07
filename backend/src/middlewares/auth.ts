import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User, type Role } from '../models/User.js';
import { forbidden, unauthorized } from '../utils/AppError.js';

export interface AuthUser {
  id: string;
  role: Role;
  email: string;
  name: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: { id: string; role: Role }) {
  return jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

async function resolveUser(req: Request): Promise<AuthUser | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as { sub: string };
    const user = await User.findById(payload.sub).select('name email role isActive').lean();
    if (!user || user.isActive === false) return null;
    return { id: String(user._id), role: user.role, email: user.email, name: user.name };
  } catch {
    return null;
  }
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const user = await resolveUser(req);
  if (!user) throw unauthorized('Please sign in to continue');
  req.user = user;
  next();
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const user = await resolveUser(req);
  if (user) req.user = user;
  next();
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) throw forbidden();
    next();
  };
