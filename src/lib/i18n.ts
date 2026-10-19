import publicContent from '@/config/public-site.json';
import englishInterface from '@/locales/en/interface.json';
import { locales, defaultLocale, type SupportedLocale } from '@/locales';
import { publicTranslations } from '@/locales/translations';

export type Messages = Record<string, any>;
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
  const publicLangDict = publicTranslations[localeKey] || {};
  const currentPublic = (slice as any)?.publicContent || publicContent;
  const basePublicMessages = publicMessages(currentPublic);

  return {
    ...englishInterface,
    ...slice,
    meta: {
      locale: localeKey,
    },
    publicContent: currentPublic,
    publicStrings: {
      ...basePublicMessages,
      ...publicLangDict,
    },
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
    if (dict && typeof dict === 'object' && namespace !== 'meta') {
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
  paramsOrFallback?: string | TranslationParams,
): string {
  if (!namespaceOrKey) return '';
  let namespace = namespaceOrKey;
  let key: string | undefined;
  let fallback: string | undefined;
  let actualParams: TranslationParams = {};

  if (namespaceOrKey.includes('.')) {
    // Dotted key call:
    // e.g. t('errors.something_wrong', 'Something Went Wrong')
    // or t('components.Workspace.RecruitmentView.text_bulk_ats_import', 'Bulk ATS Import')
    // or t('common.welcome', { name: 'Alex' })
    // or t('common.welcome', 'Welcome {name}', { name: 'Alex' })
    const parts = namespaceOrKey.split('.');
    if (parts.length === 2) {
      namespace = parts[0];
      key = parts[1];
    } else {
      const lastPart = parts.pop()!;
      namespace = parts.join('.');
      key = lastPart;
    }

    if (typeof keyOrParams === 'string') {
      fallback = keyOrParams;
    } else if (typeof keyOrParams === 'object' && keyOrParams !== null) {
      actualParams = keyOrParams;
    }

    if (typeof paramsOrFallback === 'string') {
      fallback = paramsOrFallback;
    } else if (typeof paramsOrFallback === 'object' && paramsOrFallback !== null) {
      actualParams = paramsOrFallback;
    }
  } else {
    // Non-dotted call:
    // e.g. t('common', 'save')
    // or t('common', 'save', 'Save Now')
    // or t('common', 'welcome', { name: 'Alex' })
    // or t('Direct phrase without namespace')
    if (typeof keyOrParams === 'string') {
      key = keyOrParams;
      if (typeof paramsOrFallback === 'string') {
        fallback = paramsOrFallback;
      } else if (typeof paramsOrFallback === 'object' && paramsOrFallback !== null) {
        actualParams = paramsOrFallback;
      }
    } else if (typeof keyOrParams === 'object' && keyOrParams !== null) {
      actualParams = keyOrParams;
    }
  }

  // Case 2: Standard lookup (namespace + key)
  if (key) {
    let template =
      messages[namespace]?.[key] ??
      defaultMessages[namespace]?.[key];

    if (!template && namespaceOrKey.includes('.')) {
      // Also try direct dotted key lookup in messages (for flat dictionaries)
      template =
        messages[namespaceOrKey]?.[key] ??
        defaultMessages[namespaceOrKey]?.[key];
    }

    if (!template) {
      template = fallback || `${namespace}.${key}`;
    }

    const activeLocale = (messages.meta?.locale || defaultLocale) as SupportedLocale;
    if (activeLocale !== 'en' && publicTranslations[activeLocale]) {
      const translated =
        publicTranslations[activeLocale][template] ??
        Object.entries(publicTranslations[activeLocale]).find(
          ([k]) => k.toLowerCase() === template.toLowerCase(),
        )?.[1];
      if (translated) template = translated;
    }
    return template.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (match, name) =>
      Object.hasOwn(actualParams, name) ? String(actualParams[name]) : match,
    );
  }

  // Case 3: Direct or phrase lookup
  const query = namespace.trim();
  const activeLocale = (messages.meta?.locale || defaultLocale) as SupportedLocale;

  // 3a. Check public translations dictionary for current locale
  if (publicTranslations[activeLocale]?.[query]) {
    const template = publicTranslations[activeLocale][query];
    return template.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (match, name) =>
      Object.hasOwn(actualParams, name) ? String(actualParams[name]) : match,
    );
  }
  if (publicTranslations[activeLocale]) {
    const dict = publicTranslations[activeLocale];
    const ql = query.toLowerCase();
    for (const [k, v] of Object.entries(dict)) {
      if (k.toLowerCase() === ql) {
        return v.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (match, name) =>
          Object.hasOwn(actualParams, name) ? String(actualParams[name]) : match,
        );
      }
    }
  }

  // 3b. Check in publicStrings or publicContent
  const publicCandidate = messages.publicStrings?.[query] ?? (typeof messages.publicContent?.[query] === 'string' ? messages.publicContent[query] : undefined);
  if (publicCandidate) {
    return publicCandidate.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (match: string, name: string) =>
      Object.hasOwn(actualParams, name) ? String(actualParams[name]) : match,
    );
  }

  // 3c. Direct lookup in enums namespace
  if (messages.enums?.[query]) {
    return messages.enums[query];
  }

  const queryLower = query.toLowerCase();

  // 3c. Direct key match in any namespace (e.g. key is 'save' or 'dashboard')
  for (const [ns, dict] of Object.entries(messages)) {
    if (dict && typeof dict === 'object' && ns !== 'meta' && Object.hasOwn(dict, queryLower)) {
      const template = dict[queryLower];
      return template.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (match, name) =>
        Object.hasOwn(actualParams, name) ? String(actualParams[name]) : match,
      );
    }
  }

  // 3d. Reverse lookup from English text
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

  // 3e. If not found, return the clean string formatted with params
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

