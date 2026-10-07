import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getToken, setToken } from '../services/api';
import { authService } from '../services/auth';
import { hotelService } from '../services/hotel';
import type { Role, User } from '../types';

interface AuthState {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (body: { name: string; email: string; password: string; phone?: string }) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<void>;
  setUser: (u: User) => void;
  hasRole: (...roles: Role[]) => boolean;
  wishlist: Set<string>;
  toggleWish: (hotelId: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());

  const loadWishlist = useCallback(async () => {
    try {
      setWishlist(new Set(await hotelService.wishlistIds()));
    } catch {
      setWishlist(new Set());
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setReady(true);
      return;
    }
    try {
      const me = await authService.me();
      setUser(me);
      void loadWishlist();
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setReady(true);
    }
  }, [loadWishlist]);

  useEffect(() => {
    void refresh();
    const onLogout = () => {
      setUser(null);
      setWishlist(new Set());
    };
    window.addEventListener('voyara:logout', onLogout);
    return () => window.removeEventListener('voyara:logout', onLogout);
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { token, user: u } = await authService.login(email, password);
      setToken(token);
      setUser(u);
      void loadWishlist();
      return u;
    },
    [loadWishlist],
  );

  const register = useCallback(async (body: { name: string; email: string; password: string; phone?: string }) => {
    const { token, user: u } = await authService.register(body);
    setToken(token);
    setUser(u);
    setWishlist(new Set());
    return u;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setWishlist(new Set());
  }, []);

  const toggleWish = useCallback(async (hotelId: string) => {
    const r = await hotelService.toggleWishlist(hotelId);
    setWishlist(new Set(r.ids));
    return r.saved;
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user, ready, login, register, logout, refresh, setUser,
      hasRole: (...roles) => !!user && roles.includes(user.role),
      wishlist, toggleWish,
    }),
    [user, ready, login, register, logout, refresh, wishlist, toggleWish],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function homeFor(role?: Role) {
  if (role === 'ADMIN') return '/admin';
  if (role === 'STAFF') return '/staff';
  return '/trips';
}
