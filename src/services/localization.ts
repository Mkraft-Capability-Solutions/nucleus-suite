import 'server-only';
import { cookies } from 'next/headers';
import { getMessagesForLocale, defaultMessages } from '@/lib/i18n';
import { locales, defaultLocale, type SupportedLocale } from '@/locales';

/**
 * Loads interface messages for the requested locale with automatic cookie detection and fallback.
 */
export async function loadInterfaceMessages(requestedLocale?: string) {
  let activeCode = requestedLocale;

  if (!activeCode) {
    try {
      const cookieStore = await cookies();
      activeCode = cookieStore.get('nucleus_locale')?.value || defaultLocale;
    } catch {
      activeCode = defaultLocale;
    }
  }

  const normalized = (activeCode || defaultLocale).toLowerCase() as SupportedLocale;
  const isSupported = normalized in locales;
  const activeLocale = isSupported ? normalized : defaultLocale;
  const messages = getMessagesForLocale(activeLocale);

  return {
    locale: activeLocale,
    requestedLocale: activeCode,
    messages: structuredClone(messages || defaultMessages),
  };
}

export default loadInterfaceMessages;
