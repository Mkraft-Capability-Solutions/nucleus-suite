"use client";
import { AppearanceProvider } from '@/context/AppearanceContext';
import WorkspaceTheme from '@/components/WorkspaceTheme';
export function Providers({ children }) {
    return <AppearanceProvider><WorkspaceTheme>{children}</WorkspaceTheme></AppearanceProvider>;
}
