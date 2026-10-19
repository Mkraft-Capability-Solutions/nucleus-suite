import { useContext } from 'react';
import { ThemeContext, type ThemeContextValue } from './theme-context';

/** Current appearance and its setters. Must be used under <ThemeProvider> (the root layout provides it). */
export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (value === null) throw new Error('useTheme must be used within <ThemeProvider>.');
  return value;
}
