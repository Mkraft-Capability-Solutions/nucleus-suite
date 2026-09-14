import publicContent from '@/data/public-site.json';
import englishInterface from '@/data/locales/en/interface.json';
import { locales, defaultLocale, type SupportedLocale } from '@/locales';

export type Messages = Record<string, Record<string, string>>;
export type TranslationParams = Record<string, string | number>;

function publicMessages(value: unknown, path = '', output: Record<string, string> = {}): Record<string, string> {
  if (typeof value === 'string') {
    const field = path.split('.').at(-1);
    if (!['id', 'href', 'icon'].includes(field || '')) output[path] = value;
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) publicMessages(child, path ? `${path}.${key}` : key, output);
  }
  return output;
}

export function buildLocaleMessages(localeKey: SupportedLocale): Messages {
  const slice = locales[localeKey] || locales[defaultLocale];
  return {
    ...englishInterface,
    ...slice,
    publicContent: publicMessages(publicContent),
  };
}

export const defaultMessages: Messages = buildLocaleMessages(defaultLocale);

export function getMessagesForLocale(localeKey: string): Messages {
  const normalized = (localeKey || defaultLocale).toLowerCase() as SupportedLocale;
  if (normalized in locales) {
    return buildLocaleMessages(normalized);
  }
  return defaultMessages;
}

export function translate(messages: Messages, namespace: string, key: string, params: TranslationParams = {}): string {
  const template = messages[namespace]?.[key] ?? defaultMessages[namespace]?.[key] ?? `${namespace}.${key}`;
  return template.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (match, name) => Object.hasOwn(params, name) ? String(params[name]) : match);
}

/** Server/static fallback. Client components use useTranslation for locale updates. */
export const t = (namespace: string, key: string, params?: TranslationParams) => translate(defaultMessages, namespace, key, params);

export default t;
