'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import AppWorkspace from '@/components/AppWorkspace';
import LoginView from '@/components/Workspace/LoginView';

function WorkspaceRoute() {
    const { user, isSigningOut } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (isSigningOut) return;
        if (!user && pathname === '/workspace') {
            router.replace('/login');
        } else if (user && pathname === '/login') {
            router.replace('/workspace');
        }
    }, [user, pathname, router, isSigningOut]);

    if (!user) {
        return <LoginView />;
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
