'use client';
import { readData } from '../services/workspace-data.mjs';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from '@/services/auth-service.mjs';
import { ROLE_PERMISSIONS, ROLES } from '../utils/permissions';

/** Storage keys */
const SESSION_KEY = 'nucleus_session';
const ACTIVITY_KEY = 'nucleus_last_activity';
/** 2 hours in milliseconds */
const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000;

export const DEFAULT_MODULE_PERMISSIONS = {
    people_core: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.HR_MANAGER, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD, ROLES.EMPLOYEE],
    payroll: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.FINANCE_MANAGER, ROLES.HR_MANAGER, ROLES.EMPLOYEE, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD],
    recruitment: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD],
    onboarding: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD, ROLES.EMPLOYEE],
    performance: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.HR_MANAGER, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD, ROLES.EMPLOYEE],
    attendance: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.HR_MANAGER, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD, ROLES.FINANCE_MANAGER, ROLES.EMPLOYEE],
    leaves: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.HR_MANAGER, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD, ROLES.FINANCE_MANAGER, ROLES.EMPLOYEE],
    analytics: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER, ROLES.FINANCE_MANAGER, ROLES.PROJECT_MANAGER],
    learning: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.HR_MANAGER, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD, ROLES.FINANCE_MANAGER, ROLES.EMPLOYEE],
    compensation: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER, ROLES.FINANCE_MANAGER, ROLES.EMPLOYEE],
    experience: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.HR_MANAGER, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD, ROLES.FINANCE_MANAGER, ROLES.EMPLOYEE],
    integrations: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER],
    compliance: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER, ROLES.FINANCE_MANAGER],
    helpdesk: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.HR_MANAGER, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD, ROLES.FINANCE_MANAGER, ROLES.EMPLOYEE],
    contract_workforce: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER, ROLES.FINANCE_MANAGER, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD],
    projects: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD, ROLES.EMPLOYEE],
    team: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.HR_MANAGER, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD, ROLES.FINANCE_MANAGER, ROLES.EMPLOYEE],
    settings: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.HR_MANAGER, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD, ROLES.FINANCE_MANAGER, ROLES.EMPLOYEE],
    plt_platform: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER, ROLES.FINANCE_MANAGER, ROLES.MANAGER, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD, ROLES.EMPLOYEE]
};

export const DEFAULT_CONSOLE_PERMISSIONS = {
    S1: [ROLES.SUPER_ADMIN, ROLES.ADMIN],
    S2: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER],
    S3: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.HR_MANAGER, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD],
    S4: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER],
    S5: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.FINANCE_MANAGER],
    S6: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.HR_MANAGER, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD],
    S7: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.HR_MANAGER, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD],
    S8: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.HR_MANAGER, ROLES.FINANCE_MANAGER, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD, ROLES.EMPLOYEE],
    S9: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER, ROLES.TEAM_LEAD, ROLES.EMPLOYEE],
    S10: [ROLES.SUPER_ADMIN, ROLES.ADMIN]
};

const AuthContext = createContext({
    isSigningOut: false,
    ...readData("context.AuthContext", "AuthContext_fields_1"),
    login: async () => { },
    logout: () => { },
    hasPermission: () => false,
    ...readData("context.AuthContext", "AuthContext_fields_2"),
    modulePermissions: DEFAULT_MODULE_PERMISSIONS,
    consolePermissions: DEFAULT_CONSOLE_PERMISSIONS,
    ...readData("context.AuthContext", "AuthContext_fields_3"),
    openAccessControl: () => { },
    closeAccessControl: () => { },
    toggleModulePermission: () => { },
    toggleConsolePermission: () => { },
    grantModulePermission: () => { },
    revokeModulePermission: () => { },
    grantConsolePermission: () => { },
    revokeConsolePermission: () => { },
    resetPermissionsToDefault: () => { },
    isModuleAllowed: () => true,
    isConsoleAllowed: () => true,
    getPermittedConsoles: () => []
});

const roleProfiles = readData("context.AuthContext", "roleProfiles_4");

export const AuthProvider = ({ children }) => {
    const router = useRouter();
    const [isSigningOut, setIsSigningOut] = useState(false);
    const idleTimerRef = useRef(null);

    // ── Restore session from localStorage on mount ──────────────────────────
    const [user, setUser] = useState(() => {
        if (typeof window === 'undefined') return null;
        try {
            const raw = localStorage.getItem(SESSION_KEY);
            if (!raw) return null;
            const { userData, lastActivity } = JSON.parse(raw);
            const idleMs = Date.now() - (lastActivity || 0);
            if (idleMs > IDLE_TIMEOUT_MS) {
                // Session expired while browser was closed
                localStorage.removeItem(SESSION_KEY);
                localStorage.removeItem(ACTIVITY_KEY);
                return null;
            }
            return userData || null;
        } catch {
            return null;
        }
    });

    const isLoading = false;
    const [isAccessControlOpen, setIsAccessControlOpen] = useState(false);

    // ── Update last-activity timestamp in localStorage ───────────────────────
    const refreshActivity = useCallback(() => {
        try {
            localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
            // Also keep lastActivity inside the session blob for cross-tab read on mount
            const raw = localStorage.getItem(SESSION_KEY);
            if (raw) {
                const session = JSON.parse(raw);
                session.lastActivity = Date.now();
                localStorage.setItem(SESSION_KEY, JSON.stringify(session));
            }
        } catch { /* Storage unavailable */ }
    }, []);

    // ── Attach activity listeners & idle-check interval ──────────────────────
    useEffect(() => {
        if (!user) return;

        const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
        EVENTS.forEach(ev => window.addEventListener(ev, refreshActivity, { passive: true }));

        // Check idle every 60 seconds
        idleTimerRef.current = setInterval(() => {
            try {
                const lastActivity = parseInt(localStorage.getItem(ACTIVITY_KEY) || '0', 10);
                if (lastActivity && Date.now() - lastActivity > IDLE_TIMEOUT_MS) {
                    // Idle for more than 2 hours — auto-logout
                    clearInterval(idleTimerRef.current);
                    setIsSigningOut(true);
                    setUser(null);
                    localStorage.removeItem(SESSION_KEY);
                    localStorage.removeItem(ACTIVITY_KEY);
                    router.replace('/');
                }
            } catch { /* Storage unavailable */ }
        }, 60_000);

        // Stamp activity immediately on login/restore
        refreshActivity();

        return () => {
            EVENTS.forEach(ev => window.removeEventListener(ev, refreshActivity));
            clearInterval(idleTimerRef.current);
        };
    }, [user, refreshActivity, router]);

    // Dynamic Permissions State
    const [modulePermissions, setModulePermissions] = useState(DEFAULT_MODULE_PERMISSIONS);
    const [consolePermissions, setConsolePermissions] = useState(DEFAULT_CONSOLE_PERMISSIONS);
    const [userCustomPermissions, setUserCustomPermissions] = useState({});

    const toggleModulePermission = (moduleKey, roleKey) => {
        setModulePermissions(prev => {
            const currentRoles = prev[moduleKey] || [];
            const updated = currentRoles.includes(roleKey)
                ? currentRoles.filter(r => r !== roleKey)
                : [...currentRoles, roleKey];
            const next = { ...prev, [moduleKey]: updated };
            return next;
        });
    };

    const grantModulePermission = (moduleKey, roleKey) => {
        setModulePermissions(prev => {
            const currentRoles = prev[moduleKey] || [];
            if (currentRoles.includes(roleKey)) return prev;
            const next = { ...prev, [moduleKey]: [...currentRoles, roleKey] };
            return next;
        });
    };

    const revokeModulePermission = (moduleKey, roleKey) => {
        setModulePermissions(prev => {
            const currentRoles = prev[moduleKey] || [];
            const next = { ...prev, [moduleKey]: currentRoles.filter(r => r !== roleKey) };
            return next;
        });
    };

    const toggleConsolePermission = (consoleId, roleKey) => {
        setConsolePermissions(prev => {
            const currentRoles = prev[consoleId] || [];
            const updated = currentRoles.includes(roleKey)
                ? currentRoles.filter(r => r !== roleKey)
                : [...currentRoles, roleKey];
            const next = { ...prev, [consoleId]: updated };
            return next;
        });
    };

    const grantConsolePermission = (consoleId, roleKey) => {
        setConsolePermissions(prev => {
            const currentRoles = prev[consoleId] || [];
            if (currentRoles.includes(roleKey)) return prev;
            const next = { ...prev, [consoleId]: [...currentRoles, roleKey] };
            return next;
        });
    };

    const revokeConsolePermission = (consoleId, roleKey) => {
        setConsolePermissions(prev => {
            const currentRoles = prev[consoleId] || [];
            const next = { ...prev, [consoleId]: currentRoles.filter(r => r !== roleKey) };
            return next;
        });
    };

    // --- USER-SPECIFIC PERMISSION OVERRIDES (FOR ANY USER ON THE PLATFORM) ---
    const setUserModulePermission = (userId, moduleKey, isAllowed) => {
        if (!userId) return;
        setUserCustomPermissions(prev => {
            const userConfig = prev[userId] || readData("context.AuthContext", "userConfig_5");
            const nextModules = { ...userConfig.modules };
            if (isAllowed === null || isAllowed === undefined) {
                delete nextModules[moduleKey];
            } else {
                nextModules[moduleKey] = !!isAllowed;
            }
            const next = {
                ...prev,
                [userId]: {
                    ...userConfig,
                    modules: nextModules,
                    updatedAt: new Date().toISOString()
                }
            };
            return next;
        });
    };

    const setUserConsolePermission = (userId, consoleId, isAllowed) => {
        if (!userId) return;
        setUserCustomPermissions(prev => {
            const userConfig = prev[userId] || readData("context.AuthContext", "userConfig_6");
            const nextConsoles = { ...userConfig.consoles };
            if (isAllowed === null || isAllowed === undefined) {
                delete nextConsoles[consoleId];
            } else {
                nextConsoles[consoleId] = !!isAllowed;
            }
            const next = {
                ...prev,
                [userId]: {
                    ...userConfig,
                    consoles: nextConsoles,
                    updatedAt: new Date().toISOString()
                }
            };
            return next;
        });
    };

    const setUserDataScope = (userId, scope) => {
        if (!userId) return;
        setUserCustomPermissions(prev => {
            const userConfig = prev[userId] || readData("context.AuthContext", "userConfig_7");
            const next = {
                ...prev,
                [userId]: {
                    ...userConfig,
                    dataScope: scope,
                    updatedAt: new Date().toISOString()
                }
            };
            return next;
        });
    };

    const resetUserPermissions = (userId) => {
        if (!userId) return;
        setUserCustomPermissions(prev => {
            const next = { ...prev };
            delete next[userId];
            return next;
        });
    };

    const grantAllToUser = (userId) => {
        if (!userId) return;
        const allModules = Object.keys(DEFAULT_MODULE_PERMISSIONS).reduce((acc, k) => ({ ...acc, [k]: true }), {});
        const allConsoles = Object.keys(DEFAULT_CONSOLE_PERMISSIONS).reduce((acc, k) => ({ ...acc, [k]: true }), {});
        setUserCustomPermissions(prev => {
            const next = {
                ...prev,
                [userId]: {
                    modules: allModules,
                    consoles: allConsoles,
                    ...readData("context.AuthContext", "userId_fields_8"),
                    updatedAt: new Date().toISOString()
                }
            };
            return next;
        });
    };

    const revokeAllFromUser = (userId) => {
        if (!userId) return;
        const allModules = Object.keys(DEFAULT_MODULE_PERMISSIONS).reduce((acc, k) => ({ ...acc, [k]: false }), {});
        const allConsoles = Object.keys(DEFAULT_CONSOLE_PERMISSIONS).reduce((acc, k) => ({ ...acc, [k]: false }), {});
        setUserCustomPermissions(prev => {
            const next = {
                ...prev,
                [userId]: {
                    modules: allModules,
                    consoles: allConsoles,
                    ...readData("context.AuthContext", "userId_fields_9"),
                    updatedAt: new Date().toISOString()
                }
            };
            return next;
        });
    };

    const getUserCustomPermissions = (userId) => {
        if (!userId) return null;
        return userCustomPermissions[userId] || null;
    };

    const resetPermissionsToDefault = () => {
        setModulePermissions(DEFAULT_MODULE_PERMISSIONS);
        setConsolePermissions(DEFAULT_CONSOLE_PERMISSIONS);
        setUserCustomPermissions({});
        try {
            localStorage.removeItem('nucleus_module_permissions');
            localStorage.removeItem('nucleus_console_permissions');
            localStorage.removeItem('nucleus_user_permissions');
        } catch (e) { }
    };

    const isModuleAllowed = (moduleKey, roleKey, userId) => {
        const currentUserId = userId || user?.id || user?.email;
        const currentRole = roleKey || user?.role;

        if (currentRole === ROLES.SUPER_ADMIN || currentRole === ROLES.ADMIN) return true; // Super admin and Admin have full platform access

        // 1. Check user-level explicit override if present
        if (currentUserId && userCustomPermissions[currentUserId]?.modules?.[moduleKey] !== undefined) {
            return userCustomPermissions[currentUserId].modules[moduleKey];
        }

        // 2. Check role-level permission baseline
        if (!currentRole) return false;
        const allowed = modulePermissions[moduleKey] || DEFAULT_MODULE_PERMISSIONS[moduleKey] || [];
        return allowed.includes(currentRole);
    };

    const isConsoleAllowed = (consoleId, roleKey, userId) => {
        const currentUserId = userId || user?.id || user?.email;
        const currentRole = roleKey || user?.role;

        if (currentRole === ROLES.SUPER_ADMIN || currentRole === ROLES.ADMIN) return true; // Super admin and Admin have full platform access

        // 1. Check user-level explicit override if present
        if (currentUserId && userCustomPermissions[currentUserId]?.consoles?.[consoleId] !== undefined) {
            return userCustomPermissions[currentUserId].consoles[consoleId];
        }

        // 2. Check role-level permission baseline
        if (!currentRole) return false;
        const allowed = consolePermissions[consoleId] || DEFAULT_CONSOLE_PERMISSIONS[consoleId] || [];
        return allowed.includes(currentRole);
    };

    const getPermittedConsoles = (roleKey, userId) => {
        const currentRole = roleKey || user?.role;
        if (currentRole === ROLES.SUPER_ADMIN) return readData("context.AuthContext", "getPermittedConsoles_10");
        const allKeys = readData("context.AuthContext", "allKeys_11");
        return allKeys.filter(cid => isConsoleAllowed(cid, currentRole, userId));
    };

    const login = async (email, password) => {
        try {
            const authenticatedUser = await signIn(email, password);
            if (!authenticatedUser) return false;
            const profile = roleProfiles[authenticatedUser.role];
            const nextUser = { ...profile, ...authenticatedUser };
            setUser(nextUser);

            // Persist session to localStorage
            try {
                localStorage.setItem(SESSION_KEY, JSON.stringify({
                    userData: nextUser,
                    lastActivity: Date.now(),
                }));
                localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
            } catch { /* Storage unavailable */ }

            return true;
        } catch {
            return false;
        }
    };

    const logout = () => {
        setIsSigningOut(true);
        router.replace('/');
        setUser(null);
        clearInterval(idleTimerRef.current);
        resetPermissionsToDefault();
        try {
            localStorage.removeItem(SESSION_KEY);
            localStorage.removeItem(ACTIVITY_KEY);
            localStorage.removeItem('nucleus_user');
            sessionStorage.removeItem('nucleus_nav_state');
        } catch { /* Storage may be unavailable. */ }
    };

    const switchRole = (roleKey) => {
        if (user?.role !== ROLES.SUPER_ADMIN) return null;
        const targetUser = roleProfiles[roleKey];
        if (!targetUser) return null;
        resetPermissionsToDefault();

        setUser(targetUser);

        return targetUser;
    };

    const hasPermission = (permission) => {
        // Universal Fail-Closed Model
        if (!user || !user.role || !permission) return false;
        // Universal Super Admin Bypass: grant immediate full access
        if (user.role === ROLES.SUPER_ADMIN || user.role === 'SUPER_ADMIN') return true;
        const permissions = ROLE_PERMISSIONS[user.role] || [];
        const normalized = String(permission).trim();
        return permissions.includes(normalized) || permissions.includes(normalized.toUpperCase());
    };

    return (
        <AuthContext.Provider value={{
            user,
            login,
            logout,
            switchRole,
            hasPermission,
            isLoading,
            isSigningOut,
            modulePermissions,
            consolePermissions,
            userCustomPermissions,
            setUserModulePermission,
            setUserConsolePermission,
            setUserDataScope,
            resetUserPermissions,
            grantAllToUser,
            revokeAllFromUser,
            getUserCustomPermissions,
            isAccessControlOpen,
            openAccessControl: () => {
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('nucleus:navigate_tab', readData("context.AuthContext", "openAccessControl_15")));
                }
            },
            closeAccessControl: () => setIsAccessControlOpen(false),
            setIsAccessControlOpen,
            toggleModulePermission,
            toggleConsolePermission,
            grantModulePermission,
            revokeModulePermission,
            grantConsolePermission,
            revokeConsolePermission,
            resetPermissionsToDefault,
            isModuleAllowed,
            isConsoleAllowed,
            getPermittedConsoles
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);

