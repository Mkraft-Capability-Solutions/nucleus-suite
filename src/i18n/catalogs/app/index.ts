/**
 * "app" catalog: English inline, every other locale a lazily loaded chunk. Locales without a file fall back to
 * English at runtime and are reported by check:i18n.
 */
import { defineCatalog } from '../../catalog';
import en from './en';

export default defineCatalog('app', en, {
  hi: () => import('./hi'),
  bn: () => import('./bn'),
  mr: () => import('./mr'),
  te: () => import('./te'),
  ta: () => import('./ta'),
  gu: () => import('./gu'),
  pa: () => import('./pa'),
  kn: () => import('./kn'),
  or: () => import('./or'),
  ml: () => import('./ml'),
  as: () => import('./as'),
  mai: () => import('./mai'),
  ne: () => import('./ne'),
  kok: () => import('./kok'),
  zh: () => import('./zh'),
  es: () => import('./es'),
  ar: () => import('./ar'),
  fr: () => import('./fr'),
  pt: () => import('./pt'),
  ru: () => import('./ru'),
  ja: () => import('./ja'),
  de: () => import('./de'),
  id: () => import('./id'),
  ko: () => import('./ko'),
  it: () => import('./it'),
  tr: () => import('./tr'),
  vi: () => import('./vi'),
  th: () => import('./th'),
});
