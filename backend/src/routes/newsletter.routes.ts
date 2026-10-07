import { Router } from 'express';
import * as c from '../controllers/misc.controller.js';
import { validate } from '../middlewares/validate.js';
import { newsletterSchema } from '../validators/schemas.js';

const r = Router();
r.post('/subscribe', validate(newsletterSchema), c.subscribe);
export default r;
