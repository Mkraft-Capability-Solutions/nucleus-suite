'use client';
import { readData } from '../services/workspace-data.mjs';

import { createContext, useContext, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from '@/services/auth-service.mjs';
import { ROLE_PERMISSIONS, ROLES } from '../utils/permissions';

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
    settings: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.HR_MANAGER, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD, ROLES.FINANCE_MANAGER, ROLES.EMPLOYEE]
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
    const [user, setUser] = useState(null);
    const isLoading = false;
    const [isAccessControlOpen, setIsAccessControlOpen] = useState(false);

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

            return true;
        } catch {
            return false;
        }
    };

    const logout = () => {
        setIsSigningOut(true);
        router.replace('/');
        setUser(null);
        resetPermissionsToDefault();
        try { localStorage.removeItem('nucleus_user'); } catch { /* Storage may be unavailable. */ }
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
        if (!user) return false;
        if (user.role === ROLES.SUPER_ADMIN) return true;
        const permissions = ROLE_PERMISSIONS[user.role] || [];
        return permissions.includes(permission);
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

