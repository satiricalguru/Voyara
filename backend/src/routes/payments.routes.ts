import { Router } from 'express';
import * as c from '../controllers/payment.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { paymentSchema } from '../validators/schemas.js';

const r = Router();
r.use(authenticate);
r.post('/', validate(paymentSchema), c.createPayment);
r.get('/my', c.myPayments);
export default r;
