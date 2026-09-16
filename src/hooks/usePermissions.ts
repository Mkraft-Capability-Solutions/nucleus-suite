'use client';
import { useAuth } from '@/context/AuthContext';

export interface UsePermissionsReturn {
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  role: string | null;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
}

/**
 * Global usePermissions hook enforcing strict fail-closed access control
 * with Universal Super Admin Bypass (SUPER_ADMIN gets unconditional full access).
 */
export function usePermissions(): UsePermissionsReturn {
  const { user, hasPermission: contextHasPermission } = useAuth();

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const hasRole = (role: string): boolean => {
    if (!user || !user.role) return false;
    // Universal Super Admin Bypass
    if (isSuperAdmin) return true;
    return user.role.toUpperCase() === role.toUpperCase();
  };

  const hasPermission = (permission: string): boolean => {
    // Fail-Closed: deny access if user, role, or permission is null/empty
    if (!user || !user.role || !permission) return false;
    // Universal Super Admin Bypass
    if (isSuperAdmin) return true;
    if (typeof contextHasPermission === 'function') {
      return Boolean(contextHasPermission(permission));
    }
    return false;
  };

  return {
    hasPermission,
    hasRole,
    role: user?.role ?? null,
    isAuthenticated: Boolean(user),
    isSuperAdmin,
  };
}

export default usePermissions;
