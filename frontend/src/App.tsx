import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes } from 'react-router';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Shell } from './components/Shell';
import { PageLoader } from './components/ui';
import Home from './pages/Home';

const Architect = lazy(() => import('./pages/Architect'));
const GlobePlanner = lazy(() => import('./pages/GlobePlanner'));
const LiveItinerary = lazy(() => import('./pages/LiveItinerary'));
const SharedTrip = lazy(() => import('./pages/SharedTrip'));
const Explore = lazy(() => import('./pages/Explore'));
const HotelDetails = lazy(() => import('./pages/HotelDetails'));
const AiGuide = lazy(() => import('./pages/AiGuide'));
const Rentals = lazy(() => import('./pages/Rentals'));
const Community = lazy(() => import('./pages/Community'));
const MyTrips = lazy(() => import('./pages/MyTrips'));
const MyBookings = lazy(() => import('./pages/MyBookings'));
const BookingConfirmation = lazy(() => import('./pages/BookingConfirmation'));
const Payment = lazy(() => import('./pages/Payment'));
const Wishlist = lazy(() => import('./pages/Wishlist'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Staff = lazy(() => import('./pages/Staff'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminHotelForm = lazy(() => import('./pages/AdminHotelForm'));
const NotFound = lazy(() => import('./pages/NotFound'));

/** Warm the most likely next pages (and the 3D earth) once the browser is idle. */
function usePrefetch() {
  useEffect(() => {
    const idle = (cb: () => void) => ('requestIdleCallback' in window ? window.requestIdleCallback(cb, { timeout: 3000 }) : setTimeout(cb, 1500));
    idle(() => {
      void import('./components/Earth');
      void import('./pages/Architect');
      void import('./pages/GlobePlanner');
      void import('./pages/Explore');
      void import('./pages/HotelDetails');
      void import('./pages/LiveItinerary');
      void import('./pages/AiGuide');
      ['/textures/earth-day.jpg', '/textures/earth-water.jpg'].forEach((href) => {
        const l = document.createElement('link');
        l.rel = 'prefetch';
        l.href = href;
        document.head.appendChild(l);
      });
    });
  }, []);
}

export default function App() {
  usePrefetch();
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Home />} />
          <Route path="architect" element={<Architect />} />
          <Route path="globe" element={<GlobePlanner />} />
          <Route path="trip/:id" element={<LiveItinerary />} />
          <Route path="shared/:token" element={<SharedTrip />} />
          <Route path="explore" element={<Explore />} />
          <Route path="hotels/:slug" element={<HotelDetails />} />
          <Route path="guide" element={<AiGuide />} />
          <Route path="guide/:name" element={<AiGuide />} />
          <Route path="rentals" element={<Rentals />} />
          <Route path="community" element={<Community />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="trips" element={<ProtectedRoute><MyTrips /></ProtectedRoute>} />
          <Route path="bookings" element={<ProtectedRoute><MyBookings /></ProtectedRoute>} />
          <Route path="bookings/:id" element={<ProtectedRoute><BookingConfirmation /></ProtectedRoute>} />
          <Route path="pay/:id" element={<ProtectedRoute><Payment /></ProtectedRoute>} />
          <Route path="wishlist" element={<ProtectedRoute><Wishlist /></ProtectedRoute>} />
          <Route path="staff" element={<ProtectedRoute roles={['STAFF', 'ADMIN']}><Staff /></ProtectedRoute>} />
          <Route path="admin" element={<ProtectedRoute roles={['ADMIN']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="admin/hotels/new" element={<ProtectedRoute roles={['ADMIN']}><AdminHotelForm /></ProtectedRoute>} />
          <Route path="admin/hotels/:id" element={<ProtectedRoute roles={['ADMIN']}><AdminHotelForm /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
