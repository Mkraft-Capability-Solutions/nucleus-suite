'use client';

import { useMemo, type ReactNode } from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { useHRMS } from '@/context/HRMSContext';

/** Share the workspace mode with portaled menus, fields and dialogs. */
export default function WorkspaceTheme({ children }: { children: ReactNode }) {
    const { theme: mode } = useHRMS();
    const theme = useMemo(() => createTheme({
        palette: {
            mode,
            primary: { main: mode === 'dark' ? '#bca7ff' : '#5934cc' },
            background: { default: mode === 'dark' ? '#090f14' : '#f3f5f4', paper: mode === 'dark' ? '#122431' : '#ffffff' },
            text: { primary: mode === 'dark' ? '#f1f5f9' : '#10222f', secondary: mode === 'dark' ? '#b1becb' : '#5a6b78' },
        },
        typography: { fontFamily: 'var(--f-ui)' },
        components: {
            MuiDialog: { styleOverrides: { paper: { backgroundImage: 'none', maxHeight: 'calc(100dvh - 32px)', '@media(max-width:600px)': { margin: 12, width: 'calc(100% - 24px)', maxWidth: 'calc(100% - 24px)' } } } },
            MuiButton: { styleOverrides: { root: { whiteSpace: 'normal', '@media(pointer:coarse)': { minHeight: 44 } } } },
        },
    }), [mode]);
    return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
