import { Router } from 'express';
import * as c from '../controllers/misc.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { wishlistToggleSchema } from '../validators/schemas.js';

const r = Router();
r.use(authenticate);
r.get('/', c.getWishlist);
r.get('/ids', c.wishlistIds);
r.post('/toggle', validate(wishlistToggleSchema), c.toggleWishlist);
export default r;
