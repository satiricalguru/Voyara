import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Img } from '../components/ui';
import { homeFor, useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { IMAGES } from '../data/voyara';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { errorMessage } from '../services/api';

const DEMO = [
  { role: 'Customer', email: 'customer@hrms.com', password: 'customer123' },
  { role: 'Staff', email: 'staff@hrms.com', password: 'staff123' },
  { role: 'Admin', email: 'admin@hrms.com', password: 'admin123' },
];

export function AuthLayout({ children, title, kicker }: { children: React.ReactNode; title: string[]; kicker: string }) {
  return (
    <div className="auth">
      <div className="auth-media inverse" aria-hidden="true">
        <Img src={IMAGES.lake} alt="" eager />
        <div className="auth-media-copy bleed">
          <span className="label">Describe it once. Travel all of it.</span>
          <span className="mega">VOYARA</span>
        </div>
      </div>
      <div className="auth-panel">
        <div className="auth-inner">
          <span className="micro dim">{kicker}</span>
          <h1 className="display">{title.map((t, i) => <span key={i} style={{ display: 'block' }}>{t}</span>)}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  useDocumentTitle('Sign in');
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const from = (loc.state as { from?: string } | null)?.from;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const u = await login(email, password);
      toast(`Welcome back, ${u.name.split(' ')[0]}`);
      nav(from && from !== '/login' ? from : homeFor(u.role), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title={['Welcome', 'back.']} kicker="(Account) · Sign in">
      <form className="stack-lg" onSubmit={submit}>
        <label className="field">
          <span className="label">Email</span>
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span className="label">Password</span>
          <div className="input-action">
            <input className="input" type={show ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="micro" onClick={() => setShow((s) => !s)}>{show ? 'Hide' : 'Show'}</button>
          </div>
        </label>
        {error && <p className="field-error" role="alert">{error}</p>}
        <button className="btn btn-lg" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <span className="arrow">→</span></button>
        <p className="copy-sm dim">New to Voyara? <Link to="/register" state={loc.state} className="link">Create an account</Link></p>
      </form>
      <div className="stack-sm">
        <span className="divider-label micro">Demo accounts</span>
        <div className="chips">
          {DEMO.map((d) => (
            <button key={d.role} type="button" className="chip" onClick={() => { setEmail(d.email); setPassword(d.password); }}>
              {d.role}
            </button>
          ))}
        </div>
        <span className="legal dimmer">Seeded by `npm run seed` — fills the form, you press sign in.</span>
      </div>
    </AuthLayout>
  );
}
