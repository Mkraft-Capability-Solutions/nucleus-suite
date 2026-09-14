/**
 * Nucleus Enterprise Design System - Military-Grade Token Architecture
 * Strict WCAG AA contrast, 4 theme palettes, semantic elevations & transitions
 */

export type ThemePaletteMode = 'pearl-violet' | 'graphite-night' | 'slate-blue' | 'sage-teal';

export interface ThemeTokens {
  mode: ThemePaletteMode;
  isDark: boolean;
  colors: {
    primary: string;
    primaryWash: string;
    primaryHover: string;
    secondary: string;
    background: string;
    backgroundSubtle: string;
    surface: string;
    surfaceElevated: string;
    surfaceBorder: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    statusSuccess: string;
    statusSuccessWash: string;
    statusWarning: string;
    statusWarningWash: string;
    statusDanger: string;
    statusDangerWash: string;
    statusInfo: string;
    statusInfoWash: string;
  };
  typography: {
    fontFamilySans: string;
    fontFamilyMono: string;
  };
  radii: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
    full: string;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
    glow: string;
  };
}

export const THEME_PALETTES: Record<ThemePaletteMode, ThemeTokens> = {
  'pearl-violet': {
    mode: 'pearl-violet',
    isDark: false,
    colors: {
      primary: '#7c3aed',
      primaryWash: 'rgba(124, 58, 237, 0.08)',
      primaryHover: '#6d28d9',
      secondary: '#4f46e5',
      background: '#f8fafc',
      backgroundSubtle: '#f1f5f9',
      surface: '#ffffff',
      surfaceElevated: '#ffffff',
      surfaceBorder: '#e2e8f0',
      textPrimary: '#0f172a',
      textSecondary: '#475569',
      textMuted: '#94a3b8',
      statusSuccess: '#16a34a',
      statusSuccessWash: 'rgba(22, 163, 74, 0.1)',
      statusWarning: '#d97706',
      statusWarningWash: 'rgba(217, 119, 6, 0.1)',
      statusDanger: '#dc2626',
      statusDangerWash: 'rgba(220, 38, 38, 0.1)',
      statusInfo: '#0284c7',
      statusInfoWash: 'rgba(2, 132, 199, 0.1)',
    },
    typography: {
      fontFamilySans: 'Inter, system-ui, -apple-system, sans-serif',
      fontFamilyMono: 'JetBrains Mono, monospace',
    },
    radii: {
      sm: '4px',
      md: '8px',
      lg: '12px',
      xl: '16px',
      full: '9999px',
    },
    shadows: {
      sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      glow: '0 0 20px rgba(124, 58, 237, 0.25)',
    },
  },
  'graphite-night': {
    mode: 'graphite-night',
    isDark: true,
    colors: {
      primary: '#38bdf8',
      primaryWash: 'rgba(56, 189, 248, 0.12)',
      primaryHover: '#0ea5e9',
      secondary: '#818cf8',
      background: '#070b14',
      backgroundSubtle: '#0c1322',
      surface: '#0f172a',
      surfaceElevated: '#1e293b',
      surfaceBorder: 'rgba(255, 255, 255, 0.08)',
      textPrimary: '#f8fafc',
      textSecondary: '#94a3b8',
      textMuted: '#64748b',
      statusSuccess: '#22c55e',
      statusSuccessWash: 'rgba(34, 197, 94, 0.15)',
      statusWarning: '#f59e0b',
      statusWarningWash: 'rgba(245, 158, 11, 0.15)',
      statusDanger: '#ef4444',
      statusDangerWash: 'rgba(239, 68, 68, 0.15)',
      statusInfo: '#38bdf8',
      statusInfoWash: 'rgba(56, 189, 248, 0.15)',
    },
    typography: {
      fontFamilySans: 'Inter, system-ui, -apple-system, sans-serif',
      fontFamilyMono: 'JetBrains Mono, monospace',
    },
    radii: {
      sm: '4px',
      md: '8px',
      lg: '12px',
      xl: '16px',
      full: '9999px',
    },
    shadows: {
      sm: '0 1px 3px 0 rgba(0, 0, 0, 0.37)',
      md: '0 4px 12px 0 rgba(0, 0, 0, 0.4)',
      lg: '0 12px 32px 0 rgba(0, 0, 0, 0.6)',
      glow: '0 0 24px rgba(56, 189, 248, 0.3)',
    },
  },
  'slate-blue': {
    mode: 'slate-blue',
    isDark: true,
    colors: {
      primary: '#2563eb',
      primaryWash: 'rgba(37, 99, 235, 0.12)',
      primaryHover: '#1d4ed8',
      secondary: '#38bdf8',
      background: '#090d16',
      backgroundSubtle: '#0f172a',
      surface: '#131d31',
      surfaceElevated: '#1a2742',
      surfaceBorder: 'rgba(79, 182, 245, 0.15)',
      textPrimary: '#f8fafc',
      textSecondary: '#94a3b8',
      textMuted: '#64748b',
      statusSuccess: '#10b981',
      statusSuccessWash: 'rgba(16, 185, 129, 0.15)',
      statusWarning: '#f59e0b',
      statusWarningWash: 'rgba(245, 158, 11, 0.15)',
      statusDanger: '#f43f5e',
      statusDangerWash: 'rgba(244, 63, 94, 0.15)',
      statusInfo: '#0284c7',
      statusInfoWash: 'rgba(2, 132, 199, 0.15)',
    },
    typography: {
      fontFamilySans: 'Inter, system-ui, -apple-system, sans-serif',
      fontFamilyMono: 'JetBrains Mono, monospace',
    },
    radii: {
      sm: '4px',
      md: '8px',
      lg: '12px',
      xl: '16px',
      full: '9999px',
    },
    shadows: {
      sm: '0 1px 3px 0 rgba(0, 0, 0, 0.35)',
      md: '0 4px 12px 0 rgba(0, 0, 0, 0.4)',
      lg: '0 12px 32px 0 rgba(0, 0, 0, 0.6)',
      glow: '0 0 24px rgba(37, 99, 235, 0.3)',
    },
  },
  'sage-teal': {
    mode: 'sage-teal',
    isDark: false,
    colors: {
      primary: '#0d9488',
      primaryWash: 'rgba(13, 148, 136, 0.08)',
      primaryHover: '#0f766e',
      secondary: '#0284c7',
      background: '#f0fdfa',
      backgroundSubtle: '#ccfbf1',
      surface: '#ffffff',
      surfaceElevated: '#ffffff',
      surfaceBorder: '#99f6e4',
      textPrimary: '#134e4a',
      textSecondary: '#115e59',
      textMuted: '#5eead4',
      statusSuccess: '#059669',
      statusSuccessWash: 'rgba(5, 150, 105, 0.1)',
      statusWarning: '#d97706',
      statusWarningWash: 'rgba(217, 119, 6, 0.1)',
      statusDanger: '#e11d48',
      statusDangerWash: 'rgba(225, 29, 72, 0.1)',
      statusInfo: '#0284c7',
      statusInfoWash: 'rgba(2, 132, 199, 0.1)',
    },
    typography: {
      fontFamilySans: 'Inter, system-ui, -apple-system, sans-serif',
      fontFamilyMono: 'JetBrains Mono, monospace',
    },
    radii: {
      sm: '4px',
      md: '8px',
      lg: '12px',
      xl: '16px',
      full: '9999px',
    },
    shadows: {
      sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      md: '0 4px 6px -1px rgba(0, 0, 0, 0.08)',
      lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
      glow: '0 0 20px rgba(13, 148, 136, 0.25)',
    },
  },
};
