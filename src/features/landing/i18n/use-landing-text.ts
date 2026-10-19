'use client';

/** Typed "nucleus" translator for client islands: follows the active locale of the nearest LocaleProvider. */
import { useMemo } from 'react';
import nucleus from '@/i18n/catalogs/nucleus/index.js';
import { useT } from './locale-provider.jsx';
import { typedText, type LandingText } from './landing-text';

export function useLandingText(): LandingText {
  const t = useT(nucleus);
  return useMemo(() => typedText(t.locale, (key) => t.raw(key)), [t]);
}
