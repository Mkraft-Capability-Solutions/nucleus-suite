'use client';
import { type ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

export interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermission?: string;
  requiredRole?: string;
  fallback?: ReactNode;
}

/**
 * Route/Page security guard enforcing fail-closed protection.
 * - Redirects unauthenticated requests to /login.
 * - Redirects authenticated but unauthorized requests to /403.
 * - Grants immediate full access if user is SUPER_ADMIN.
 */
export function ProtectedRoute({
  children,
  requiredPermission,
  requiredRole,
  fallback = null,
}: ProtectedRouteProps) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { hasPermission, hasRole, isSuperAdmin } = usePermissions();

  useEffect(() => {
    if (isLoading) return;

    // 1. Unauthenticated -> redirect to login
    if (!user) {
      router.replace('/login');
      return;
    }

    // 2. Super Admin bypass
    if (isSuperAdmin) return;

    // 3. Role check
    if (requiredRole && !hasRole(requiredRole)) {
      router.replace('/403');
      return;
    }

    // 4. Permission check
    if (requiredPermission && !hasPermission(requiredPermission)) {
      router.replace('/403');
      return;
    }
  }, [user, isLoading, isSuperAdmin, requiredRole, requiredPermission, hasRole, hasPermission, router]);

  if (isLoading) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-2, #94a3b8)' }}>
        Authenticating clearance…
      </div>
    );
  }

  if (!user) {
    return fallback;
  }

  if (!isSuperAdmin) {
    if (requiredRole && !hasRole(requiredRole)) {
      return fallback;
    }
    if (requiredPermission && !hasPermission(requiredPermission)) {
      return fallback;
    }
  }

  return <>{children}</>;
}

export default ProtectedRoute;
