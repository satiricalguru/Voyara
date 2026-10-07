import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { errorMessage } from '../services/api';
import { AuthLayout } from './Login';

export default function Register() {
  useDocumentTitle('Create account');
  const { register } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const from = (loc.state as { from?: string } | null)?.from;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.password.length < 6) return setError('Password must be at least 6 characters');
    setBusy(true);
    setError(null);
    try {
      const u = await register({ ...form, phone: form.phone || undefined });
      toast(`Welcome to Voyara, ${u.name.split(' ')[0]}`);
      nav(from ?? '/architect', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <AuthLayout title={['Start', 'travelling.']} kicker="(Account) · Create">
      <form className="stack-lg" onSubmit={submit}>
        <label className="field"><span className="label">Full name</span><input className="input" required minLength={2} autoComplete="name" value={form.name} onChange={set('name')} /></label>
        <label className="field"><span className="label">Email</span><input className="input" type="email" required autoComplete="email" value={form.email} onChange={set('email')} /></label>
        <label className="field"><span className="label">Phone (optional)</span><input className="input" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} /></label>
        <label className="field"><span className="label">Password</span><input className="input" type="password" required minLength={6} autoComplete="new-password" value={form.password} onChange={set('password')} /></label>
        {error && <p className="field-error" role="alert">{error}</p>}
        <button className="btn btn-lg" disabled={busy}>{busy ? 'Creating…' : 'Create account'} <span className="arrow">→</span></button>
        <p className="copy-sm dim">Already have one? <Link to="/login" state={loc.state} className="link">Sign in</Link></p>
      </form>
    </AuthLayout>
  );
}
