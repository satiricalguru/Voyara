import { Router } from 'express';
import * as c from '../controllers/admin.controller.js';
import { authenticate, requireRole } from '../middlewares/auth.js';
import { validObjectId } from '../middlewares/objectId.js';

const r = Router();
r.use(authenticate, requireRole('ADMIN'));
r.get('/stats', c.stats);
r.get('/bookings', c.bookings);
r.get('/users', c.users);
r.patch('/users/:id', validObjectId(), c.updateUser);
r.get('/payments', c.payments);
r.get('/reviews', c.reviews);
r.patch('/reviews/:id', validObjectId(), c.moderateReview);
export default r;
