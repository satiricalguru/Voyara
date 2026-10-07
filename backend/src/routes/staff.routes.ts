import { Router } from 'express';
import * as c from '../controllers/staff.controller.js';
import { authenticate, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { staffActionSchema } from '../validators/schemas.js';

const r = Router();
r.use(authenticate, requireRole('STAFF', 'ADMIN'));
r.get('/bookings', c.staffBookings);
r.post('/check-in', validate(staffActionSchema), c.checkIn);
r.post('/check-out', validate(staffActionSchema), c.checkOut);
export default r;
