import { Router } from 'express';
import * as c from '../controllers/room.controller.js';
import { authenticate, optionalAuth, requireRole } from '../middlewares/auth.js';
import { validObjectId } from '../middlewares/objectId.js';
import { validate } from '../middlewares/validate.js';
import { roomSchema } from '../validators/schemas.js';

const r = Router();
r.get('/hotel/:hotelId', optionalAuth, validObjectId('hotelId'), c.listRooms);
r.post('/', authenticate, requireRole('ADMIN'), validate(roomSchema), c.createRoom);
r.put('/:id', authenticate, requireRole('ADMIN'), validObjectId(), validate(roomSchema.partial()), c.updateRoom);
r.delete('/:id', authenticate, requireRole('ADMIN'), validObjectId(), c.deleteRoom);
export default r;
