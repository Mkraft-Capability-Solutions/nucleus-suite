'use client';
import { useAuth } from '../../context/AuthContext';

export default function PermissionProtected({ children, permission, fallback = null }) {
    const { user, hasPermission, isLoading } = useAuth();

    if (isLoading) return null;

    // 1. Universal Super Admin Bypass
    if (user?.role === 'SUPER_ADMIN') {
        return children;
    }

    // 2. Fail-Closed Permission check
    if (!user || !hasPermission(permission)) {
        return fallback || null;
    }

    return children;
}
