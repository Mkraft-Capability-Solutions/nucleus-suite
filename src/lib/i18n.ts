import publicContent from '@/config/public-site.json';
import englishInterface from '@/locales/en/interface.json';
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

// Cache for reverse English string lookups to find namespace & key
let englishReverseMap: Map<string, { namespace: string; key: string }> | null = null;

function getEnglishReverseMap(): Map<string, { namespace: string; key: string }> {
  if (englishReverseMap) return englishReverseMap;
  const map = new Map<string, { namespace: string; key: string }>();
  for (const [namespace, dict] of Object.entries(defaultMessages)) {
    if (dict && typeof dict === 'object') {
      for (const [key, value] of Object.entries(dict)) {
        if (typeof value === 'string') {
          map.set(value.toLowerCase().trim(), { namespace, key });
        }
      }
    }
  }
  englishReverseMap = map;
  return map;
}

export function translate(
  messages: Messages,
  namespaceOrKey: string,
  keyOrParams?: string | TranslationParams,
  params?: TranslationParams,
): string {
  let namespace = namespaceOrKey;
  let key: string | undefined;
  let actualParams: TranslationParams = {};

  if (typeof keyOrParams === 'string') {
    key = keyOrParams;
    actualParams = params || {};
  } else if (typeof keyOrParams === 'object' && keyOrParams !== null) {
    actualParams = keyOrParams;
  }

  // Case 1: Dot-notation string like "common.save" or "navigation.dashboard"
  if (!key && namespace.includes('.')) {
    const parts = namespace.split('.');
    if (parts.length === 2) {
      namespace = parts[0];
      key = parts[1];
    } else {
      // Deep nested key like components.Clerio.LeftDock.text_0ab6910b45
      const lastPart = parts.pop()!;
      namespace = parts.join('.');
      key = lastPart;
    }
  }

  // Case 2: Standard lookup (namespace + key)
  if (key) {
    const template =
      messages[namespace]?.[key] ??
      defaultMessages[namespace]?.[key] ??
      `${namespace}.${key}`;
    return template.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (match, name) =>
      Object.hasOwn(actualParams, name) ? String(actualParams[name]) : match,
    );
  }

  // Case 3: Single string query (e.g. "Save", "Dashboard", "Apply Leave", "attendance")
  const query = namespace.trim();
  const queryLower = query.toLowerCase();

  // 3a. Direct key match in any namespace (e.g. key is 'save' or 'dashboard')
  for (const [ns, dict] of Object.entries(messages)) {
    if (dict && typeof dict === 'object' && Object.hasOwn(dict, queryLower)) {
      const template = dict[queryLower];
      return template.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (match, name) =>
        Object.hasOwn(actualParams, name) ? String(actualParams[name]) : match,
      );
    }
  }

  // 3b. Reverse lookup from English text (e.g. query is "Leave Balance", find ns="leave", key="balance")
  const reverseMap = getEnglishReverseMap();
  const found = reverseMap.get(queryLower);
  if (found) {
    const template = messages[found.namespace]?.[found.key] ?? defaultMessages[found.namespace]?.[found.key];
    if (template) {
      return template.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (match, name) =>
        Object.hasOwn(actualParams, name) ? String(actualParams[name]) : match,
      );
    }
  }

  // 3c. If not found in any translation dictionary, return the clean string
  return query.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (match, name) =>
    Object.hasOwn(actualParams, name) ? String(actualParams[name]) : match,
  );
}

/** Server/static fallback. Client components use useTranslation for locale updates. */
export const t = (
  namespaceOrKey: string,
  keyOrParams?: string | TranslationParams,
  params?: TranslationParams,
) => translate(defaultMessages, namespaceOrKey, keyOrParams, params);

export default t;
