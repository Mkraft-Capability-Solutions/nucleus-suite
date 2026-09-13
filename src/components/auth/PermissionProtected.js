'use client';
import { useAuth } from '../../context/AuthContext';

export default function PermissionProtected({ children, permission, fallback = null }) {
    const { hasPermission, isLoading } = useAuth();

    if (isLoading) return null; // or spinner

    if (!hasPermission(permission)) {
        return fallback || null; // Hide by default if no permission
    }

    return children;
}
