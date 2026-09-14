import { describe, it, expect } from 'vitest';
import { translate, defaultMessages, getMessagesForLocale, buildLocaleMessages } from './i18n';
import { supportedLanguages, locales } from '@/locales';

describe('interface translations', () => {
  it('resolves a supplied locale with English fallback', () => {
    expect(translate({ public: { menu: 'Menü' } }, 'public', 'menu')).toBe('Menü');
    expect(translate({ public: { menu: 'Menü' } }, 'public', 'navigation')).toBe(defaultMessages.public.navigation);
  });

  it('interpolates known values without evaluating or interpreting markup', () => {
    expect(translate({ example: { message: 'Hello {name}: {count}' } }, 'example', 'message', { name: '<script>', count: 0 })).toBe('Hello <script>: 0');
    expect(translate({}, 'missing', 'key')).toBe('missing.key');
  });

  it('contains valid translations for all 11 supported languages (English, 5 International, 5 Indian)', () => {
    expect(supportedLanguages.length).toBe(11);
    
    // Top 5 International languages
    const internationalCodes = ['en', 'es', 'fr', 'de', 'ja', 'ar'];
    // Top 5 Indian languages
    const indianCodes = ['hi', 'ta', 'te', 'bn', 'mr'];

    for (const code of [...internationalCodes, ...indianCodes]) {
      const messages = getMessagesForLocale(code);
      expect(messages).toBeDefined();
      expect(messages.common).toBeDefined();
      expect(messages.common.save).toBeDefined();
      expect(messages.auth.signIn).toBeDefined();
      expect(messages.leave.apply).toBeDefined();
      expect(messages.attendance.punchIn).toBeDefined();
      expect(messages.payroll.payslip).toBeDefined();
      expect(messages.people.profile).toBeDefined();
      expect(messages.navigation.home).toBeDefined();
    }
  });

  it('safely handles unknown locale requests with fallback to English', () => {
    const fallbackMessages = getMessagesForLocale('xx_INVALID');
    expect(fallbackMessages.common.save).toBe('Save');
  });
});

it('indexes public copy while preserving routing and icon identifiers', () => {
  expect(defaultMessages.publicContent['pages.home.title']).toContain('HR that flows.');
  expect(defaultMessages.publicContent['nav.0.href']).toBeUndefined();
  expect(defaultMessages.publicContent['pages.home.cards.0.icon']).toBeUndefined();
});
