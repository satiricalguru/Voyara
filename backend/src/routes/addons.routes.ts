import { Router } from 'express';
import * as c from '../controllers/misc.controller.js';
import { authenticate, optionalAuth, requireRole } from '../middlewares/auth.js';
import { validObjectId } from '../middlewares/objectId.js';
import { validate } from '../middlewares/validate.js';
import { addonSchema } from '../validators/schemas.js';

const r = Router();
r.get('/', optionalAuth, c.listAddons);
r.get('/amenities', c.listAmenities);
r.post('/', authenticate, requireRole('ADMIN'), validate(addonSchema), c.createAddon);
r.patch('/:id', authenticate, requireRole('ADMIN'), validObjectId(), validate(addonSchema.partial()), c.updateAddon);
r.delete('/:id', authenticate, requireRole('ADMIN'), validObjectId(), c.deleteAddon);
export default r;
