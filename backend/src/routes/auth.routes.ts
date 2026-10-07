import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as c from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { changePasswordSchema, loginSchema, registerSchema, updateProfileSchema } from '../validators/schemas.js';

const limiter = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many attempts — try again in a few minutes' } });
const r = Router();
r.post('/register', limiter, validate(registerSchema), c.register);
r.post('/login', limiter, validate(loginSchema), c.login);
r.get('/me', authenticate, c.me);
r.patch('/me', authenticate, validate(updateProfileSchema), c.updateMe);
r.post('/change-password', authenticate, validate(changePasswordSchema), c.changePassword);
export default r;
