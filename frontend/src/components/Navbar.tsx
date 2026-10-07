import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { initials } from '../utils/format';
import { Icon } from './Icon';

const LINKS = [
  { to: '/architect', label: 'Architect' },
  { to: '/globe', label: 'Globe' },
  { to: '/explore', label: 'Stays' },
  { to: '/guide', label: 'Guide' },
  { to: '/rentals', label: 'Rentals' },
  { to: '/community', label: 'Community' },
];

export function Navbar() {
  const { user, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const loc0 = useLocation();
  // Pages that open on a photo/sky hero get a white nav until the page scrolls.
  const overHero = /^\/($|trip\/|guide\/.+|shared\/)/.test(loc0.pathname);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
    setMenu(false);
  }, [loc.pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
  }, [open]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  const accountLinks = user
    ? [
        ...(user.role === 'ADMIN' ? [{ to: '/admin', label: 'Admin console' }] : []),
        ...(user.role !== 'CUSTOMER' ? [{ to: '/staff', label: 'Front desk' }] : []),
        { to: '/trips', label: 'My trips' },
        { to: '/bookings', label: 'My bookings' },
        { to: '/wishlist', label: 'Wishlist' },
      ]
    : [];

  const signOut = () => {
    logout();
    nav('/');
  };

  return (
    <>
      <header className={`nav ${scrolled ? 'is-scrolled' : ''} ${overHero && !scrolled ? 'inverse' : ''}`}>
        <Link to="/" className="nav-mark label" aria-label="Voyara home">
          VOYARA<span className="nav-mark-sup">®</span>
        </Link>
        <nav className="nav-links hide-sm" aria-label="Primary">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => `nav-link label ${isActive ? 'is-active' : ''}`}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="nav-right">
          {user ? (
            <div className="nav-account" ref={menuRef}>
              <button className="nav-avatar" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="menu">
                <span className="nav-avatar-dot micro">{initials(user.name)}</span>
                <span className="label hide-sm">{user.name.split(' ')[0]}</span>
              </button>
              {menu && (
                <div className="nav-menu" role="menu">
                  <div className="nav-menu-head">
                    <span className="label">{user.name}</span>
                    <span className="micro dim">{user.role} · {user.email}</span>
                  </div>
                  <hr className="rule" />
                  {accountLinks.map((l) => (
                    <Link key={l.to} to={l.to} className="nav-menu-item label" role="menuitem">
                      {l.label} <span className="arrow">→</span>
                    </Link>
                  ))}
                  <hr className="rule" />
                  <button className="nav-menu-item label" onClick={signOut} role="menuitem">
                    Sign out <Icon name="logout" size={14} />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" state={{ from: loc.pathname }} className="btn-ghost hide-sm">
              Sign in
            </Link>
          )}
          <button className="nav-burger show-sm label" onClick={() => setOpen(true)} aria-label="Open menu">
            Menu
          </button>
        </div>
      </header>

      {open && (
        <div className="nav-sheet" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="row-between">
            <Link to="/" className="label">VOYARA®</Link>
            <button className="btn-ghost" onClick={() => setOpen(false)}>Close</button>
          </div>
          <nav className="nav-sheet-links">
            {LINKS.map((l, i) => (
              <NavLink key={l.to} to={l.to} className="display" style={{ animationDelay: `${i * 40}ms` }}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <hr className="rule" />
          <div className="stack-sm">
            {user ? (
              <>
                {accountLinks.map((l) => (
                  <Link key={l.to} to={l.to} className="label">{l.label}</Link>
                ))}
                <button className="label" style={{ textAlign: 'left' }} onClick={signOut}>Sign out</button>
              </>
            ) : (
              <>
                <Link to="/login" className="label">Sign in</Link>
                <Link to="/register" className="label">Create account</Link>
              </>
            )}
          </div>
          <span className="legal dimmer" style={{ marginTop: 'auto' }}>* Voyara whole-trip architect</span>
        </div>
      )}
    </>
  );
}
