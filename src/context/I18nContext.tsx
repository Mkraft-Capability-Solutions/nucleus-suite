'use client';
import { createContext, useContext, useCallback, useMemo, useState, type ReactNode } from 'react';
import { defaultMessages, getMessagesForLocale, translate, type Messages, type TranslationParams } from '@/lib/i18n';
import { supportedLanguages, defaultLocale, type LanguageMeta } from '@/locales';

interface I18nContextValue {
  locale: string;
  messages: Messages;
  setLocale: (newLocale: string) => void;
  supportedLanguages: LanguageMeta[];
}

const I18nContext = createContext<I18nContextValue>({
  locale: defaultLocale,
  messages: defaultMessages,
  setLocale: () => {},
  supportedLanguages,
});

const LOCALE_STORAGE_KEY = 'nucleus_user_locale';

function getInitialLocale(defaultVal: string): string {
  if (typeof window === 'undefined') return defaultVal;
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved) return saved;
    const match = document.cookie.match(/nucleus_locale=([^;]+)/);
    if (match?.[1]) return match[1];
    return defaultVal;
  } catch {
    return defaultVal;
  }
}

export function I18nProvider({
  children,
  locale: initialLocale = defaultLocale,
  messages: initialMessages,
}: {
  children: ReactNode;
  locale?: string;
  messages?: Messages;
}) {
  const [currentLocale, setCurrentLocale] = useState<string>(() => getInitialLocale(initialLocale));
  const [currentMessages, setCurrentMessages] = useState<Messages>(() => {
    const initLoc = getInitialLocale(initialLocale);
    return initLoc === initialLocale && initialMessages ? initialMessages : getMessagesForLocale(initLoc);
  });

  const changeLocale = useCallback((newLocale: string) => {
    const nextMessages = getMessagesForLocale(newLocale);
    setCurrentLocale(newLocale);
    setCurrentMessages(nextMessages);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
        document.cookie = `nucleus_locale=${newLocale};path=/;max-age=31536000;SameSite=Lax`;
        document.documentElement.lang = newLocale;
        const meta = supportedLanguages.find((l) => l.code === newLocale);
        if (meta) {
          document.documentElement.dir = meta.dir;
        }
      } catch {
        // Ignore storage write errors
      }
    }
  }, []);

  const value = useMemo(
    () => ({
      locale: currentLocale,
      messages: currentMessages,
      setLocale: changeLocale,
      supportedLanguages,
    }),
    [currentLocale, currentMessages, changeLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const { locale, messages, setLocale, supportedLanguages } = useContext(I18nContext);
  const t = useCallback(
    (
      namespaceOrKey: string,
      keyOrParams?: string | TranslationParams,
      params?: TranslationParams,
    ) => translate(messages, namespaceOrKey, keyOrParams, params),
    [messages],
  );
  return { locale, t, setLocale, supportedLanguages };
}

export default useTranslation;
