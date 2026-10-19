import { describe, it, expect } from 'vitest';
import {
  EmploymentTypeEnum,
  RequisitionStatusEnum,
  CandidateStageEnum,
  TicketPriorityEnum,
  getTranslatedEnumLabel,
  getSystemEnums,
} from './enums';

describe('System Enums & Multilingual Resolver', () => {
  it('defines canonical typed enums correctly', () => {
    expect(EmploymentTypeEnum.FULL_TIME).toBe('Full-time');
    expect(EmploymentTypeEnum.CONTRACT).toBe('Contract');
    expect(EmploymentTypeEnum.INTERN).toBe('Intern');
    expect(EmploymentTypeEnum.PART_TIME).toBe('Part-time');
    expect(EmploymentTypeEnum.PERMANENT).toBe('Permanent');

    expect(RequisitionStatusEnum.OPEN).toBe('Open');
    expect(CandidateStageEnum.APPLIED).toBe('Applied');
    expect(TicketPriorityEnum.CRITICAL).toBe('Critical');
  });

  it('translates employment types across all 11 supported locales', () => {
    const expectedFullTimeTranslations: Record<string, string> = {
      en: 'Full-time',
      hi: 'पूर्णकालिक',
      mr: 'पूर्णवेळ',
      ta: 'முழு நேரம்',
      te: 'పూర్తి సమయం',
      bn: 'পূর্ণকালীন',
      es: 'Tiempo completo',
      fr: 'Temps plein',
      de: 'Vollzeit',
      ja: '正社員',
      ar: 'دوام كامل',
    };

    for (const [locale, expected] of Object.entries(expectedFullTimeTranslations)) {
      const translated = getTranslatedEnumLabel('employment_type', 'Full-time', locale);
      expect(translated).toBe(expected);
    }
  });

  it('translates contract employment type to Hindi, Marathi, and Japanese', () => {
    expect(getTranslatedEnumLabel('employment_type', 'Contract', 'hi')).toBe('अनुबंध');
    expect(getTranslatedEnumLabel('employment_type', 'Contract', 'mr')).toBe('करार');
    expect(getTranslatedEnumLabel('employment_type', 'Contract', 'ja')).toBe('契約社員');
  });

  it('falls back gracefully to English when an unsupported locale is requested', () => {
    const label = getTranslatedEnumLabel('employment_type', 'Full-time', 'xyz');
    expect(label).toBe('Full-time');
  });

  it('returns code when enum category/code is not found', () => {
    const label = getTranslatedEnumLabel('unknown_category', 'UNKNOWN_CODE', 'en');
    expect(label).toBe('UNKNOWN_CODE');
  });

  it('fetches system enums by category asynchronously', async () => {
    const list = await getSystemEnums('employment_type', 'hi');
    expect(list.length).toBeGreaterThan(0);
    const fullTime = list.find((item) => item.code === 'Full-time');
    expect(fullTime).toBeDefined();
    expect(fullTime?.translatedLabel).toBe('पूर्णकालिक');
  });
});
