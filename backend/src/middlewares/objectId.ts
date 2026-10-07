import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { badRequest } from '../utils/AppError.js';

export const validObjectId =
  (...params: string[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    for (const p of params.length ? params : ['id']) {
      const v = req.params[p];
      if (v && !mongoose.isValidObjectId(v)) throw badRequest(`Invalid ${p}`);
    }
    next();
  };
