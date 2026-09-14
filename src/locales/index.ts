import en from './en';
import es from './es';
import fr from './fr';
import de from './de';
import ja from './ja';
import ar from './ar';
import hi from './hi';
import ta from './ta';
import te from './te';
import bn from './bn';
import mr from './mr';

export const locales = {
  en,
  es,
  fr,
  de,
  ja,
  ar,
  hi,
  ta,
  te,
  bn,
  mr,
};

export type SupportedLocale = keyof typeof locales;
export const defaultLocale: SupportedLocale = 'en';

export interface LanguageMeta {
  code: SupportedLocale;
  name: string;
  nativeName: string;
  category: 'international' | 'indian';
  dir: 'ltr' | 'rtl';
}

export const supportedLanguages: LanguageMeta[] = [
  // Primary
  { code: 'en', name: 'English', nativeName: 'English', category: 'international', dir: 'ltr' },
  // Top 5 International
  { code: 'es', name: 'Spanish', nativeName: 'Español', category: 'international', dir: 'ltr' },
  { code: 'fr', name: 'French', nativeName: 'Français', category: 'international', dir: 'ltr' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', category: 'international', dir: 'ltr' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', category: 'international', dir: 'ltr' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', category: 'international', dir: 'rtl' },
  // Top 5 Indian
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', category: 'indian', dir: 'ltr' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', category: 'indian', dir: 'ltr' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', category: 'indian', dir: 'ltr' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', category: 'indian', dir: 'ltr' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', category: 'indian', dir: 'ltr' },
];

export default locales;
