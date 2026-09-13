"use client";
import { AppearanceProvider } from '@/context/AppearanceContext';
import FormValidationBoundary from '@/components/FormValidationBoundary';
import WorkspaceTheme from '@/components/WorkspaceTheme';
export function Providers({ children }) {
    return <AppearanceProvider><WorkspaceTheme><FormValidationBoundary>{children}</FormValidationBoundary></WorkspaceTheme></AppearanceProvider>;
}
