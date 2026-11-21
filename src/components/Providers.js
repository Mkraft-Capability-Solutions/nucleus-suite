"use client";
import { AppearanceProvider } from '@/context/AppearanceContext';
import { UiModeProvider } from '@/context/UiModeContext';
import FormValidationBoundary from '@/components/FormValidationBoundary';
import { I18nProvider } from '@/context/I18nContext';
import WorkspaceTheme from '@/components/WorkspaceTheme';
import { AuthProvider } from '@/context/AuthContext';

export function Providers({ children, locale, messages }) {
    return (
        <I18nProvider locale={locale} messages={messages}>
            <AuthProvider>
                <AppearanceProvider>
                    <UiModeProvider>
                        <WorkspaceTheme>
                            <FormValidationBoundary>{children}</FormValidationBoundary>
                        </WorkspaceTheme>
                    </UiModeProvider>
                </AppearanceProvider>
            </AuthProvider>
        </I18nProvider>
    );
}
