/**
 * Typed translator hook for TypeScript components: keys are checked against the catalog's English source at compile
 * time. Reads the active locale from the nearest LocaleProvider (English outside one) and suspends while a language
 * chunk loads, like the engine's useT it wraps.
 */
import { useCallback } from 'react';
import { useT } from '@/features/landing/i18n/locale-provider.jsx';
import type { Catalog, MessageKey, MessageValues, Translate } from './catalog';

export function useTranslations<Messages extends object>(catalog: Catalog<Messages>): Translate<Messages> {
  const t = useT(catalog.engine);
  return useCallback((key: MessageKey<Messages>, values?: MessageValues) => t(key, values), [t]);
}
