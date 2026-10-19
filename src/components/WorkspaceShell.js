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
        if (!user && pathname !== '/login') {
            router.replace('/login');
        } else if (user && pathname === '/login') {
            router.replace('/workspace');
        }
    }, [user, pathname, router, isSigningOut]);

    // Signed out: the effect above sends the visitor to /login (the landing-themed log in screen).
    if (!user) {
        return null;
    }

    return <AppWorkspace />;
}

export default function WorkspaceShell() {
    return (
        <AuthProvider>
            <WorkspaceRoute />
        </AuthProvider>
    );
}
