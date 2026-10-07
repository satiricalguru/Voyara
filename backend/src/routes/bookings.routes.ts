import { Router } from 'express';
import * as c from '../controllers/booking.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { cancelBookingSchema, createBookingSchema, quoteSchema } from '../validators/schemas.js';

const r = Router();
r.post('/quote', validate(quoteSchema), c.getQuote);
r.use(authenticate);
r.post('/', validate(createBookingSchema), c.createBooking);
r.get('/my', c.myBookings);
r.get('/:id', c.getBooking);
r.patch('/:id/cancel', validate(cancelBookingSchema), c.cancelBooking);
r.get('/:id/invoice', c.invoice);
export default r;
