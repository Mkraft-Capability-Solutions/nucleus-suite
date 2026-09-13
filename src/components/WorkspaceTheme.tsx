'use client';

import { useMemo, type ReactNode } from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { useAppearance } from '@/context/AppearanceContext';

/** Share the workspace mode with portaled menus, fields and dialogs. */
export default function WorkspaceTheme({ children }: { children: ReactNode }) {
    const { appearance } = useAppearance();
    const mode = appearance.mode as 'light' | 'dark';
    const tokens = appearance.tokens;
    const theme = useMemo(() => createTheme({
        palette: {
            mode,
            primary: { main: mode === 'dark' ? '#bca7ff' : tokens['--signal'] },
            background: { default: tokens['--bg'], paper: tokens['--card'] },
            text: { primary: tokens['--text'], secondary: tokens['--text-2'] },
        },
        typography: { fontFamily: 'var(--f-ui)' },
        components: {
            MuiDialog: { styleOverrides: { paper: { backgroundImage: 'none', maxHeight: 'calc(100dvh - 32px)', '@media(max-width:600px)': { margin: 12, width: 'calc(100% - 24px)', maxWidth: 'calc(100% - 24px)' } } } },
            MuiButton: { styleOverrides: { root: { whiteSpace: 'normal', '@media(pointer:coarse)': { minHeight: 44 } } } },
        },
    }), [mode, tokens]);
    return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
