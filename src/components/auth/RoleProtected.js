'use client';
import { readData } from '../../services/workspace-data.mjs';

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert } from 'lucide-react';

export default function RoleProtected({ children, moduleKey = null, allowedRoles = [], fallback = null }) {
    const {
        user,
        isLoading,
        isModuleAllowed
    } = useAuth();

    if (isLoading) {
        return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-2)' }}>{readData("components.auth.RoleProtected", "content_text_1")}</div>;
    }

    if (!user) {
        return fallback || (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--flag)' }}>{readData("components.auth.RoleProtected", "content_text_2")}</div>
        );
    }

    // Dynamic Permission Evaluation (resolves user-specific overrides then role baseline)
    const isAllowed = moduleKey
        ? isModuleAllowed(moduleKey, user.role, user.id || user.email)
        : (allowedRoles.length === 0 || allowedRoles.includes(user.role) || user.role === 'SUPER_ADMIN');

    if (!isAllowed) {
        return fallback || (
            <div style={{
                background: 'var(--card)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--r-card)',
                padding: 'clamp(1.5rem, 5vw, 3rem)',
                textAlign: 'center',
                maxWidth: '680px',
                margin: '3rem auto',
                boxShadow: 'var(--shadow-surface)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1.25rem'
            }}>
                <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'var(--flag-wash)',
                    border: '1px solid var(--flag)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--flag)'
                }}>
                    <ShieldAlert size={32} />
                </div>
                <div>
                    <h3 style={{ fontSize: 'var(--t-h2)', fontWeight: 800, color: 'var(--text)', margin: '0 0 0.4rem' }}>{readData("components.auth.RoleProtected", "content_text_3")}</h3>
                    <p style={{ color: 'var(--text-2)', fontSize: 'var(--t-body)', margin: 0 }}>{readData("components.auth.RoleProtected", "content_text_4")}<strong style={{ color: 'var(--text)' }}>{user.role.replace('_', ' ')}</strong>{readData("components.auth.RoleProtected", "content_text_5")}</p>
                </div>
            </div>
        );
    }

    return children;
}

