"use client";
import { AppearanceProvider } from '@/context/AppearanceContext';
import FormValidationBoundary from '@/components/FormValidationBoundary';
import { I18nProvider } from '@/context/I18nContext';
import WorkspaceTheme from '@/components/WorkspaceTheme';
import { AuthProvider } from '@/context/AuthContext';

export function Providers({ children, locale, messages }) {
    return (
        <I18nProvider locale={locale} messages={messages}>
            <AuthProvider>
                <AppearanceProvider>
                    <WorkspaceTheme>
                        <FormValidationBoundary>{children}</FormValidationBoundary>
                    </WorkspaceTheme>
                </AppearanceProvider>
            </AuthProvider>
        </I18nProvider>
    );
}
