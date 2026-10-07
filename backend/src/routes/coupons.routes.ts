import { Router } from 'express';
import * as c from '../controllers/misc.controller.js';
import { authenticate, requireRole } from '../middlewares/auth.js';
import { validObjectId } from '../middlewares/objectId.js';
import { validate } from '../middlewares/validate.js';
import { couponSchema, couponValidateSchema } from '../validators/schemas.js';

const r = Router();
r.post('/validate', validate(couponValidateSchema), c.validateCoupon);
r.get('/public', c.publicCoupons);
r.get('/', authenticate, requireRole('ADMIN'), c.listCoupons);
r.post('/', authenticate, requireRole('ADMIN'), validate(couponSchema), c.createCoupon);
r.patch('/:id', authenticate, requireRole('ADMIN'), validObjectId(), validate(couponSchema.partial()), c.updateCoupon);
r.delete('/:id', authenticate, requireRole('ADMIN'), validObjectId(), c.deleteCoupon);
export default r;
