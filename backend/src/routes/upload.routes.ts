import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import * as c from '../controllers/misc.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { badRequest } from '../utils/AppError.js';

const ALLOWED = /^(image\/(jpeg|png|webp|gif|avif)|application\/pdf)$/;

export const uploader = multer({
  storage: multer.diskStorage({
    destination: 'uploads',
    filename: (_req, file, cb) => cb(null, `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname).toLowerCase().slice(0, 6)}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 8 },
  fileFilter: (_req, file, cb) => (ALLOWED.test(file.mimetype) ? cb(null, true) : cb(badRequest('Only images or PDFs up to 8 MB'))),
});

const r = Router();
r.post('/', authenticate, uploader.array('files', 8), c.upload);
export default r;
