'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import AppWorkspace from '@/components/AppWorkspace';

function WorkspaceRoute() {
    const { user, isSigningOut } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    useEffect(() => {
        if (isSigningOut) return;
        if (user && pathname === '/login') router.replace('/workspace');
        else if (!user && pathname === '/workspace') router.replace('/login');
    }, [user, pathname, router, isSigningOut]);
    return <AppWorkspace />;
}
export default function WorkspaceShell() {
    return <AuthProvider><WorkspaceRoute /></AuthProvider>;
}
