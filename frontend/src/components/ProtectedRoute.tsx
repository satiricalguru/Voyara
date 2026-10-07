import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../types';
import { PageLoader } from './ui';

export function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="page wrap-narrow stack-lg">
        <span className="tag">403 · Restricted</span>
        <h1 className="display">This room is staff only.</h1>
        <p className="voice dim">Your account ({user.role.toLowerCase()}) doesn’t have access to this area.</p>
      </div>
    );
  }
  return <>{children}</>;
}
