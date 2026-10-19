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

  it('supports dot-notation lookups and single-string queries', () => {
    const esMessages = getMessagesForLocale('es');
    const hiMessages = getMessagesForLocale('hi');

    // Dot notation
    expect(translate(esMessages, 'common.save')).toBe('Guardar');
    expect(translate(hiMessages, 'navigation.dashboard')).toBe('डैशबोर्ड');

    // Single query matching English phrase
    expect(translate(esMessages, 'Save')).toBe('Guardar');
    expect(translate(hiMessages, 'Dashboard')).toBe('डैशबोर्ड');
    expect(translate(hiMessages, 'Apply for Leave')).toBe('छुट्टी का आवेदन करें');
  });

  it('correctly resolves dotted keys with fallback text without concatenating keys', () => {
    const enMessages = getMessagesForLocale('en');
    const hiMessages = getMessagesForLocale('hi');

    // Test error namespace resolution
    expect(translate(enMessages, 'errors.something_wrong', 'Something Went Wrong')).toBe('Something Went Wrong');
    expect(translate(hiMessages, 'errors.something_wrong', 'Something Went Wrong')).toBe('कुछ गलत हो गया');

    // Test fallback when key does not exist
    expect(translate(enMessages, 'errors.nonexistent_key', 'Custom Fallback')).toBe('Custom Fallback');
    expect(translate(hiMessages, 'errors.nonexistent_key', 'Custom Fallback')).toBe('Custom Fallback');

    // Test deep dotted component key with fallback
    expect(translate(enMessages, 'components.Workspace.RecruitmentView.text_save', 'Save Requisition')).toBe('Save Requisition');

    // Dotted interface namespace + key resolves the message instead of echoing the key
    expect(translate(enMessages, 'components.WorkspaceDataBoundary', 'text_e177bbb93e')).toBe('Loading workspace data…');
  });

  it('provides complete multilingual assistant replies and keywords across locales', () => {
    const enMessages = getMessagesForLocale('en');
    const hiMessages = getMessagesForLocale('hi');
    const taMessages = getMessagesForLocale('ta');

    // Replies
    expect(enMessages.assistant.replies.learning).toBe('Opening Learning.');
    expect(hiMessages.assistant.replies.learning).toBe('लर्निंग और प्रशिक्षण खोला जा रहा है।');
    expect(taMessages.assistant.replies.learning).toBe('கற்றல் மற்றும் பயிற்சி திறக்கப்படுகிறது.');

    // Keywords
    expect(enMessages.assistant.keywords.learning).toContain('learn');
    expect(enMessages.assistant.keywords.learning).toContain('course');
    expect(hiMessages.assistant.keywords.learning).toContain('सीखना');
    expect(hiMessages.assistant.keywords.learning).toContain('प्रशिक्षण');
  });

  it('provides complete localized public site structure across locales', () => {
    const enMessages = getMessagesForLocale('en');
    const hiMessages = getMessagesForLocale('hi');

    expect(enMessages.publicContent.brand).toBe('Nucleus');
    expect(hiMessages.publicContent.brand).toBe('न्यूक्लियस');
    expect(hiMessages.publicContent.nav[0].label).toBe('होम');
  });
});

it('indexes public copy while preserving routing and icon identifiers', () => {
  expect(defaultMessages.publicContent.pages.home.title).toContain('HR that flows.');
  expect(defaultMessages.publicStrings['pages.home.title']).toContain('HR that flows.');
  expect(defaultMessages.publicContent.nav[0].href).toBe('/');
  expect(defaultMessages.publicContent.pages.home.cards[0].icon).toBe('people');
});
