import { Router } from 'express';
import * as c from '../controllers/hotel.controller.js';
import { authenticate, optionalAuth, requireRole } from '../middlewares/auth.js';
import { validObjectId } from '../middlewares/objectId.js';
import { validate } from '../middlewares/validate.js';
import { hotelSchema } from '../validators/schemas.js';

const r = Router();
r.get('/', c.listHotels);
r.get('/:id', optionalAuth, c.getHotel);
r.get('/:id/availability', validObjectId(), c.availability);
r.post('/', authenticate, requireRole('ADMIN'), validate(hotelSchema), c.createHotel);
r.put('/:id', authenticate, requireRole('ADMIN'), validObjectId(), validate(hotelSchema.partial()), c.updateHotel);
r.delete('/:id', authenticate, requireRole('ADMIN'), validObjectId(), c.deleteHotel);
export default r;
