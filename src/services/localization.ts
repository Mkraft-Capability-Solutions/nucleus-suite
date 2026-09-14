import 'server-only';
import { getMessagesForLocale, defaultMessages } from '@/lib/i18n';
import { locales, defaultLocale, type SupportedLocale } from '@/locales';

/**
 * Loads interface messages for the requested locale with automatic fallback.
 */
export async function loadInterfaceMessages(requestedLocale: string = defaultLocale) {
  const normalized = (requestedLocale || defaultLocale).toLowerCase() as SupportedLocale;
  const isSupported = normalized in locales;
  const activeLocale = isSupported ? normalized : defaultLocale;
  const messages = getMessagesForLocale(activeLocale);

  return {
    locale: activeLocale,
    requestedLocale,
    messages: structuredClone(messages || defaultMessages),
  };
}

export default loadInterfaceMessages;
