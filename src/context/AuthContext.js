'use client';

import { createContext, useContext, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut as betterAuthSignOut, signIn } from '@/lib/auth-client';

const AuthContext = createContext({
    user: null,
    isLoading: true,
    isSigningOut: false,
    login: async () => { },
    logout: () => { },
    hasPermission: (permission) => false,
    isModuleAllowed: (...args) => true,
    isConsoleAllowed: (...args) => true,
});

export const AuthProvider = ({ children }) => {
    const router = useRouter();
    const [isSigningOut, setIsSigningOut] = useState(false);
    const { data: session, isPending: isLoading } = useSession();
    
    const user = session?.user || null;

    const login = async (email, password) => {
        try {
            const { data, error } = await signIn.email({ email, password });
            if (error || !data) return false;
            return true;
        } catch {
            return false;
        }
    };

    const logout = async () => {
        setIsSigningOut(true);
        try {
            await betterAuthSignOut();
        } catch {}
        router.replace('/');
    };

    const hasPermission = (permission) => {
        if (!user || !user.role || !permission) return false;
        if (user.role === 'SUPER_ADMIN') return true;
        return true; // Simplified for now since permissions are moving to backend
    };

    const isModuleAllowed = (...args) => true;
    const isConsoleAllowed = (...args) => true;

    return (
        <AuthContext.Provider value={{
            user,
            login,
            logout,
            hasPermission,
            isModuleAllowed,
            isConsoleAllowed,
            isLoading,
            isSigningOut,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);

export const DEFAULT_MODULE_PERMISSIONS = {};
export const DEFAULT_CONSOLE_PERMISSIONS = {};
