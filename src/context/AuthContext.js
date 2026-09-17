'use client';

import { createContext, useContext, useState, useEffect } from 'react';
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

export const DEFAULT_MODULE_PERMISSIONS = {
    people_core: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'HR_MANAGER', 'PROJECT_MANAGER', 'TEAM_LEAD', 'EMPLOYEE'],
    payroll: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'HR_MANAGER', 'EMPLOYEE', 'PROJECT_MANAGER', 'TEAM_LEAD'],
    recruitment: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'PROJECT_MANAGER', 'TEAM_LEAD'],
    onboarding: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'PROJECT_MANAGER', 'TEAM_LEAD', 'EMPLOYEE'],
    performance: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'HR_MANAGER', 'PROJECT_MANAGER', 'TEAM_LEAD', 'EMPLOYEE'],
    attendance: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'HR_MANAGER', 'PROJECT_MANAGER', 'TEAM_LEAD', 'FINANCE_MANAGER', 'EMPLOYEE'],
    leaves: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'HR_MANAGER', 'PROJECT_MANAGER', 'TEAM_LEAD', 'FINANCE_MANAGER', 'EMPLOYEE'],
    analytics: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'FINANCE_MANAGER', 'PROJECT_MANAGER'],
    learning: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'HR_MANAGER', 'PROJECT_MANAGER', 'TEAM_LEAD', 'FINANCE_MANAGER', 'EMPLOYEE'],
    compensation: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'FINANCE_MANAGER', 'EMPLOYEE'],
    experience: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'HR_MANAGER', 'PROJECT_MANAGER', 'TEAM_LEAD', 'FINANCE_MANAGER', 'EMPLOYEE'],
    integrations: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'],
    compliance: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'FINANCE_MANAGER'],
    helpdesk: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'HR_MANAGER', 'PROJECT_MANAGER', 'TEAM_LEAD', 'FINANCE_MANAGER', 'EMPLOYEE'],
    contract_workforce: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'FINANCE_MANAGER', 'PROJECT_MANAGER', 'TEAM_LEAD'],
    projects: ['SUPER_ADMIN', 'ADMIN', 'PROJECT_MANAGER', 'TEAM_LEAD', 'EMPLOYEE'],
    team: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'HR_MANAGER', 'PROJECT_MANAGER', 'TEAM_LEAD', 'FINANCE_MANAGER', 'EMPLOYEE'],
    settings: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'HR_MANAGER', 'PROJECT_MANAGER', 'TEAM_LEAD', 'FINANCE_MANAGER', 'EMPLOYEE']
};

export const DEFAULT_CONSOLE_PERMISSIONS = {
    S1: ['SUPER_ADMIN', 'ADMIN'],
    S2: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'],
    S3: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'HR_MANAGER', 'PROJECT_MANAGER', 'TEAM_LEAD'],
    S4: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'],
    S5: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER'],
    S6: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'HR_MANAGER', 'PROJECT_MANAGER', 'TEAM_LEAD'],
    S7: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'HR_MANAGER', 'PROJECT_MANAGER', 'TEAM_LEAD'],
    S8: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'HR_MANAGER', 'FINANCE_MANAGER', 'PROJECT_MANAGER', 'TEAM_LEAD', 'EMPLOYEE'],
    S9: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'TEAM_LEAD', 'EMPLOYEE'],
    S10: ['SUPER_ADMIN', 'ADMIN']
};

export const AuthProvider = ({ children }) => {
    const router = useRouter();
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [isAccessControlOpen, setIsAccessControlOpen] = useState(false);
    const [modulePermissions, setModulePermissions] = useState(DEFAULT_MODULE_PERMISSIONS);
    const [consolePermissions, setConsolePermissions] = useState(DEFAULT_CONSOLE_PERMISSIONS);
    const { data: session, isPending: isLoading } = useSession();
    const [liveProfile, setLiveProfile] = useState(null);

    useEffect(() => {
        let active = true;
        fetch('/api/v1/operations/profile')
            .then(res => res.ok ? res.json() : null)
            .then(json => {
                if (active && json?.data?.name) {
                    setLiveProfile(json.data);
                }
            })
            .catch(() => {});

        const handleProfileUpdated = (e) => {
            if (e.detail?.name || e.detail?.photoUrl) {
                setLiveProfile(prev => ({
                    ...(prev || {}),
                    ...e.detail,
                    name: e.detail.name || prev?.name,
                    avatar: e.detail.photoUrl || prev?.avatar,
                    image: e.detail.photoUrl || prev?.image
                }));
            }
        };
        window.addEventListener('nucleus:profile-updated', handleProfileUpdated);
        return () => {
            active = false;
            window.removeEventListener('nucleus:profile-updated', handleProfileUpdated);
        };
    }, []);
    
    const [savedUser, setSavedUser] = useState(() => {
        if (typeof window === 'undefined') return null;
        try {
            const hasCookie = document.cookie.includes('nucleus_session');
            if (!hasCookie) return null;
            const item = localStorage.getItem('nucleus_user');
            return item ? JSON.parse(item) : null;
        } catch {
            return null;
        }
    });

    const activeIdentity = isSigningOut ? null : (session?.user || (typeof document !== 'undefined' && document.cookie.includes('nucleus_session') ? savedUser : null));

    const user = activeIdentity ? {
        id: activeIdentity.id || 'usr-admin',
        name: liveProfile?.name || activeIdentity.name || 'Dhanraj Dadhich',
        email: activeIdentity.email || 'dhanraj@nucleus.corp',
        role: (activeIdentity.role || liveProfile?.role || 'SUPER_ADMIN').toUpperCase(),
        ...(savedUser || {}),
        ...(activeIdentity || {}),
        ...(liveProfile || {})
    } : null;

    const login = async (email, password) => {
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            if (!res.ok) return false;
            const json = await res.json();
            if (json?.user) {
                setSavedUser(json.user);
                if (typeof window !== 'undefined') {
                    localStorage.setItem('nucleus_user', JSON.stringify(json.user));
                    document.cookie = `nucleus_session=${encodeURIComponent(json.user.id)}; path=/; max-age=604800; SameSite=Lax`;
                }
                signIn.email({ email, password }).catch(() => {});
                return true;
            }
            return false;
        } catch {
            return false;
        }
    };

    const logout = async () => {
        setIsSigningOut(true);
        setSavedUser(null);
        setLiveProfile(null);
        if (typeof window !== 'undefined') {
            try {
                localStorage.removeItem('nucleus_user');
                sessionStorage.clear();
                document.cookie = 'nucleus_session=; path=/; max-age=0';
                document.cookie = 'better-auth.session_token=; path=/; max-age=0';
            } catch {}
        }
        fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
        try {
            await betterAuthSignOut();
        } catch {}
        router.replace('/login');
        if (typeof window !== 'undefined') {
            window.location.href = '/login';
        }
    };

    const hasPermission = (permission) => {
        if (!user || !user.role || !permission) return false;
        if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;
        return true;
    };

    const isModuleAllowed = (moduleKey, roleKey) => {
        const role = roleKey || user?.role || 'EMPLOYEE';
        if (role === 'SUPER_ADMIN' || role === 'ADMIN') return true;
        const allowedRoles = modulePermissions[moduleKey];
        if (!allowedRoles) return true;
        return allowedRoles.includes(role);
    };

    const isConsoleAllowed = (consoleId, roleKey) => {
        const role = roleKey || user?.role || 'EMPLOYEE';
        if (role === 'SUPER_ADMIN' || role === 'ADMIN') return true;
        const allowedRoles = consolePermissions[consoleId];
        if (!allowedRoles) return true;
        return allowedRoles.includes(role);
    };

    const toggleModulePermission = (moduleKey, roleKey) => {
        setModulePermissions(prev => {
            const current = prev[moduleKey] || [];
            const updated = current.includes(roleKey)
                ? current.filter(r => r !== roleKey)
                : [...current, roleKey];
            return { ...prev, [moduleKey]: updated };
        });
    };

    const toggleConsolePermission = (consoleId, roleKey) => {
        setConsolePermissions(prev => {
            const current = prev[consoleId] || [];
            const updated = current.includes(roleKey)
                ? current.filter(r => r !== roleKey)
                : [...current, roleKey];
            return { ...prev, [consoleId]: updated };
        });
    };

    const resetPermissionsToDefault = () => {
        setModulePermissions(DEFAULT_MODULE_PERMISSIONS);
        setConsolePermissions(DEFAULT_CONSOLE_PERMISSIONS);
    };

    const switchRole = (newRole) => {
        if (user) {
            user.role = newRole;
        }
    };

    const openAccessControl = () => setIsAccessControlOpen(true);
    const closeAccessControl = () => setIsAccessControlOpen(false);

    return (
        <AuthContext.Provider value={{
            user,
            login,
            logout,
            hasPermission,
            isModuleAllowed,
            isConsoleAllowed,
            modulePermissions,
            consolePermissions,
            toggleModulePermission,
            toggleConsolePermission,
            resetPermissionsToDefault,
            switchRole,
            isAccessControlOpen,
            openAccessControl,
            closeAccessControl,
            isLoading,
            isSigningOut,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
