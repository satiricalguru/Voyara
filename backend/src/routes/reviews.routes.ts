import { Router } from 'express';
import * as c from '../controllers/review.controller.js';
import { authenticate, optionalAuth } from '../middlewares/auth.js';
import { validObjectId } from '../middlewares/objectId.js';
import { validate } from '../middlewares/validate.js';
import { reviewSchema } from '../validators/schemas.js';

const r = Router();
r.get('/latest', c.latestReviews);
r.get('/hotel/:hotelId', optionalAuth, validObjectId('hotelId'), c.hotelReviews);
r.post('/', authenticate, validate(reviewSchema), c.createReview);
r.delete('/:id', authenticate, validObjectId(), c.deleteReview);
export default r;
