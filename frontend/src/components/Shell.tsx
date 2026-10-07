import { useEffect, useState, type FormEvent } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { useToast } from '../context/ToastContext';
import { errorMessage } from '../services/api';
import { hotelService } from '../services/hotel';
import { Navbar } from './Navbar';

export function Shell() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  const bare = pathname === '/login' || pathname === '/register';
  return (
    <>
      <Navbar />
      <SideLabel />
      <main id="main">
        <Outlet />
      </main>
      {!bare && <Footer />}
    </>
  );
}

function SideLabel() {
  return (
    <div className="side-label micro hide-sm" aria-hidden="true">
      VOYARA 1-ARCHITECT &nbsp;·&nbsp; WHOLE-TRIP SYSTEM
    </div>
  );
}

function Footer() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    try {
      const r = await hotelService.subscribe(email);
      toast(r.message);
      setEmail('');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  const year = new Date().getFullYear();
  return (
    <footer className="footer inverse">
      <div className="footer-top bleed">
        <form className="footer-news" onSubmit={submit}>
          <span className="label">One good letter a month</span>
          <p className="voice dim" style={{ maxWidth: 520 }}>
            Under-the-radar places, honest hotel notes, and the occasional fare drop.
          </p>
          <label className="input-action" style={{ maxWidth: 520 }}>
            <span className="sr-only">Email address</span>
            <input className="input" type="email" required placeholder="YOUR EMAIL" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button type="submit" className="label" disabled={busy}>
              {busy ? '…' : 'Join →'}
            </button>
          </label>
        </form>
        <div className="footer-cols">
          <div className="stack-sm">
            <span className="micro dim">Plan</span>
            <Link to="/architect" className="label">Trip architect</Link>
            <Link to="/guide" className="label">Destination guide</Link>
            <Link to="/community" className="label">Community trips</Link>
          </div>
          <div className="stack-sm">
            <span className="micro dim">Book</span>
            <Link to="/explore" className="label">Stays</Link>
            <Link to="/rentals" className="label">Rentals</Link>
            <Link to="/bookings" className="label">Manage booking</Link>
          </div>
          <div className="stack-sm">
            <span className="micro dim">Voyara</span>
            <Link to="/login" className="label">Sign in</Link>
            <Link to="/staff" className="label">Front desk</Link>
            <Link to="/admin" className="label">Admin</Link>
          </div>
        </div>
      </div>
      <div className="footer-mark bleed" aria-hidden="true">
        <span className="mega">VOYARA</span>
      </div>
      <div className="footer-base bleed">
        <span className="legal dimmer">© {year} Voyara Travel. Live data © OpenStreetMap contributors, Open-Meteo, met.no, Wikipedia.</span>
        <span className="label accent-text">* Built by Voyara Studio</span>
      </div>
    </footer>
  );
}
