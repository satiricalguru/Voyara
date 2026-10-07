import { Router } from 'express';
import * as c from '../controllers/trip.controller.js';
import { authenticate, optionalAuth } from '../middlewares/auth.js';
import { validObjectId } from '../middlewares/objectId.js';
import { validate } from '../middlewares/validate.js';
import { bookTripSchema, documentSchema, itineraryUpdateSchema, rentalBookingSchema, swapSchema } from '../validators/schemas.js';
import { uploader } from './upload.routes.js';

const r = Router();
// Rentals
r.get('/rentals/shops', c.rentalShops);
r.post('/rentals/book', authenticate, validate(rentalBookingSchema), c.bookRental);
r.get('/rentals/my', authenticate, c.myRentals);
r.patch('/rentals/:id/cancel', authenticate, validObjectId(), c.cancelRental);
// Trips
r.get('/my', authenticate, c.myTrips);
r.get('/community', c.community);
r.get('/shared/:token', c.sharedTrip);
r.get('/:id', optionalAuth, validObjectId(), c.getTrip);
r.patch('/:id', optionalAuth, validObjectId(), validate(itineraryUpdateSchema), c.updateTrip);
r.delete('/:id', authenticate, validObjectId(), c.deleteTrip);
r.post('/:id/claim', authenticate, validObjectId(), c.claimTrip);
r.post('/:id/share', authenticate, validObjectId(), c.shareTrip);
r.post('/:id/like', validObjectId(), c.likeTrip);
r.post('/:id/swap', optionalAuth, validObjectId(), validate(swapSchema), c.swapItem);
r.post('/:id/refresh-weather', optionalAuth, validObjectId(), c.refreshWeather);
r.post('/:id/book', authenticate, validObjectId(), validate(bookTripSchema), c.bookTrip);
r.post('/:id/documents', authenticate, validObjectId(), uploader.single('file'), validate(documentSchema), c.addDocument);
r.delete('/:id/documents/:docId', authenticate, validObjectId('id', 'docId'), c.deleteDocument);
export default r;
