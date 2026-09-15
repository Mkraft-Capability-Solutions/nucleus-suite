'use client';
import React, { type ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';

export interface PermissionGateProps {
  children: ReactNode;
  /** Granular permission string to check, e.g. 'users:delete', 'leave:approve' */
  permission?: string;
  /** Required role, e.g. 'SUPER_ADMIN', 'HR_MANAGER' */
  role?: string;
  /** Fallback UI rendered when access is denied. Defaults to null (hidden). */
  fallback?: ReactNode;
}

/**
 * Universal PermissionGate component.
 * Wraps conditional UI elements, actions, and buttons.
 * Enforces Fail-Closed behavior with Universal Super Admin Bypass.
 *
 * Usage:
 * <PermissionGate permission="users:delete" fallback={<FallbackUI />}>
 *   <DeleteButton />
 * </PermissionGate>
 */
export function PermissionGate({
  children,
  permission,
  role,
  fallback = null,
}: PermissionGateProps) {
  const { hasPermission, hasRole, isSuperAdmin } = usePermissions();

  // 1. Universal Super Admin Bypass
  if (isSuperAdmin) {
    return <>{children}</>;
  }

  // 2. Role Check (if role specified)
  if (role && !hasRole(role)) {
    return <>{fallback}</>;
  }

  // 3. Granular Permission Check (if permission specified)
  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

export default PermissionGate;
