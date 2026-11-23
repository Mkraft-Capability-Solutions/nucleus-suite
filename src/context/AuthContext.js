'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut as betterAuthSignOut } from '@/lib/auth-client';
import { PASSWORD_LOGIN_PATH, storeSignedInUser } from '@/lib/auth/password-login';
import { entitlementForNavItem, entitlementForTab, snapshotAllows } from '@/lib/entitlements/routes';

const TENANT_ACCESS_PATH = '/api/v1/tenant/entitlements';
/** localStorage keys that hold organisation records; cleared when the user or organisation changes. */
const TENANT_CACHE_KEYS = ['nucleus_custom_employees'];
const DATA_SCOPE_KEY = 'nucleus_data_scope';

const AuthContext = createContext({
    user: null,
    isLoading: true,
    isSigningOut: false,
    login: async () => { },
    logout: () => { },
    hasPermission: (permission) => false,
    isModuleAllowed: (...args) => true,
    isConsoleAllowed: (...args) => true,
    tenantAccess: null,
    isEntitled: () => true,
    isNavItemEnabled: () => true,
    isTabEnabled: () => true,
    entitlementConfig: () => ({}),
    refreshTenantAccess: async () => {},
    switchTenant: async () => false,
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
    // The active organisation's plan and the member's persona, from the server (never from client state).
    const [tenantAccess, setTenantAccess] = useState(null);
    
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

    useEffect(() => {
        if (!activeIdentity?.email) return;
        let active = true;
        fetch('/api/v1/operations/profile', { cache: 'no-store' })
            .then(res => res.ok ? res.json() : null)
            .then(json => {
                if (active && json?.data?.name) {
                    if (!json.data.email || json.data.email.toLowerCase() === activeIdentity.email.toLowerCase()) {
                        setLiveProfile(json.data);
                    }
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
    }, [activeIdentity?.email]);

    const user = activeIdentity ? {
        id: activeIdentity.id,
        name: (liveProfile?.email?.toLowerCase() === activeIdentity.email?.toLowerCase() && liveProfile?.name) ? liveProfile.name : (activeIdentity.name || 'User'),
        email: activeIdentity.email,
        role: (activeIdentity.role || 'EMPLOYEE').toUpperCase(),
        ...(savedUser || {}),
        ...(activeIdentity || {}),
        ...(liveProfile && (!liveProfile.email || liveProfile.email.toLowerCase() === activeIdentity.email?.toLowerCase()) ? {
            avatar: liveProfile.photoUrl || liveProfile.avatar || activeIdentity.avatar,
            image: liveProfile.photoUrl || liveProfile.image || activeIdentity.image,
            phone: liveProfile.phone || activeIdentity.phone,
            designation: liveProfile.jobTitle || activeIdentity.designation,
            dept: liveProfile.dept || activeIdentity.dept,
            location: liveProfile.location || activeIdentity.location,
            name: liveProfile.name || activeIdentity.name
        } : {})
    } : null;

    const userWithTenant = user && tenantAccess && activeIdentity ? {
        ...user,
        role: tenantAccess.persona,
        defaultConsole: tenantAccess.defaultConsole,
        tenantId: tenantAccess.tenant?.id ?? user.tenantId,
        tenantName: tenantAccess.tenant?.name ?? user.tenantName,
        tenantSlug: tenantAccess.tenant?.slug ?? user.tenantSlug,
        platformAdmin: tenantAccess.platformAdmin,
    } : user;

    const loadTenantAccess = async () => {
        try {
            const res = await fetch(TENANT_ACCESS_PATH, { cache: 'no-store', credentials: 'same-origin' });
            if (!res.ok) {
                setTenantAccess(null);
                return null;
            }
            const json = await res.json();
            setTenantAccess(json?.data ?? null);
            return json?.data ?? null;
        } catch {
            return null;
        }
    };

    useEffect(() => {
        if (!activeIdentity?.id) return;
        let active = true;
        const refresh = () => fetch(TENANT_ACCESS_PATH, { cache: 'no-store', credentials: 'same-origin' })
            .then((res) => (res.ok ? res.json() : null))
            .then((json) => { if (active) setTenantAccess(json?.data ?? null); })
            .catch(() => {});
        refresh();
        window.addEventListener('nucleus:entitlements-changed', refresh);
        return () => {
            active = false;
            window.removeEventListener('nucleus:entitlements-changed', refresh);
        };
    }, [activeIdentity?.id]);

    // Browser-cached organisation data (employees created in the workspace) belongs to one user in one
    // organisation. When a different user or organisation becomes active in this browser, drop it and
    // reload so no screen starts from another organisation's records.
    const dataScope = activeIdentity?.id && tenantAccess?.tenant?.id ? `${activeIdentity.id}:${tenantAccess.tenant.id}` : null;
    useEffect(() => {
        if (!dataScope || typeof window === 'undefined') return;
        try {
            const previous = localStorage.getItem(DATA_SCOPE_KEY);
            if (previous === dataScope) return;
            localStorage.setItem(DATA_SCOPE_KEY, dataScope);
            const hadCachedRecords = TENANT_CACHE_KEYS.some((key) => localStorage.getItem(key) !== null);
            TENANT_CACHE_KEYS.forEach((key) => localStorage.removeItem(key));
            if (hadCachedRecords) window.location.reload();
        } catch { /* storage unavailable: nothing cached */ }
    }, [dataScope]);

    const snapshot = activeIdentity ? (tenantAccess?.snapshot ?? null) : null;
    /** True when the module / sub-module / feature key is active for the organisation (unknown until loaded: true). */
    const isEntitled = (key) => snapshotAllows(snapshot, key);
    const isNavItemEnabled = (navId) => snapshotAllows(snapshot, entitlementForNavItem(navId));
    const isTabEnabled = (tab) => snapshotAllows(snapshot, entitlementForTab(tab));
    const entitlementConfig = (key) => snapshot?.config?.[key] ?? {};

    /** Make another organisation the active one (server checks membership), then reload the workspace. */
    const switchTenant = async (tenantId) => {
        const res = await fetch('/api/v1/identity/context', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantId }),
        }).catch(() => null);
        if (!res?.ok) return false;
        try { sessionStorage.clear(); } catch {}
        window.location.href = '/workspace';
        return true;
    };

    const login = async (email, password) => {
        try {
            const res = await fetch(PASSWORD_LOGIN_PATH, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            if (!res.ok) return false;
            const json = await res.json();
            if (json?.user) {
                setLiveProfile(null);
                setSavedUser(json.user);
                if (typeof window !== 'undefined') {
                    storeSignedInUser(json.user);
                }
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
                TENANT_CACHE_KEYS.forEach((key) => localStorage.removeItem(key));
                localStorage.removeItem(DATA_SCOPE_KEY);
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
        if (!isTabEnabled(moduleKey)) return false;
        const role = roleKey || userWithTenant?.role || 'EMPLOYEE';
        if (role === 'SUPER_ADMIN' || role === 'ADMIN') return true;
        const allowedRoles = modulePermissions[moduleKey];
        if (!allowedRoles) return true;
        return allowedRoles.includes(role);
    };

    const isConsoleAllowed = (consoleId, roleKey) => {
        if (consoleId && !isEntitled(`dashboards.${String(consoleId).toLowerCase()}`)) return false;
        const role = roleKey || userWithTenant?.role || 'EMPLOYEE';
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
            user: userWithTenant,
            tenantAccess: activeIdentity ? tenantAccess : null,
            isEntitled,
            isNavItemEnabled,
            isTabEnabled,
            entitlementConfig,
            refreshTenantAccess: loadTenantAccess,
            switchTenant,
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
