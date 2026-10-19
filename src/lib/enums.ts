/**
 * Canonical System Enums and Multilingual Resolver.
 * Backed by the PostgreSQL `system_enums` table with 11-locale translations.
 * Locales supported: en, hi, mr, ta, te, bn, es, fr, de, ja, ar
 */

export const EmploymentTypeEnum = {
  FULL_TIME: 'Full-time',
  CONTRACT: 'Contract',
  INTERN: 'Intern',
  PART_TIME: 'Part-time',
  PERMANENT: 'Permanent',
} as const;
export type EmploymentType = (typeof EmploymentTypeEnum)[keyof typeof EmploymentTypeEnum];

export const RequisitionStatusEnum = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  OPEN: 'Open',
  ON_HOLD: 'On Hold',
  CLOSED: 'Closed',
} as const;
export type RequisitionStatus = (typeof RequisitionStatusEnum)[keyof typeof RequisitionStatusEnum];

export const ExperienceLevelEnum = {
  ENTRY: 'Entry',
  MID: 'Mid',
  SENIOR: 'Senior',
  LEAD: 'Lead',
  EXECUTIVE: 'Executive',
} as const;
export type ExperienceLevel = (typeof ExperienceLevelEnum)[keyof typeof ExperienceLevelEnum];

export const CandidateStageEnum = {
  APPLIED: 'Applied',
  SCREENING: 'Screening',
  TECHNICAL_ROUND_1: 'Technical Round 1',
  TECHNICAL_ROUND_2: 'Technical Round 2',
  HR_ROUND: 'HR Round',
  OFFER_EXTENDED: 'Offer Extended',
  HIRED: 'Hired',
  REJECTED: 'Rejected',
} as const;
export type CandidateStage = (typeof CandidateStageEnum)[keyof typeof CandidateStageEnum];

export const InterviewRecommendationEnum = {
  STRONG_HIRE: 'Strong Hire',
  HIRE: 'Hire',
  HOLD: 'Hold',
  REJECT: 'Reject',
} as const;
export type InterviewRecommendation = (typeof InterviewRecommendationEnum)[keyof typeof InterviewRecommendationEnum];

export const ApprovalStatusEnum = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
} as const;
export type ApprovalStatus = (typeof ApprovalStatusEnum)[keyof typeof ApprovalStatusEnum];

export const CandidateAcceptanceEnum = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
} as const;
export type CandidateAcceptance = (typeof CandidateAcceptanceEnum)[keyof typeof CandidateAcceptanceEnum];

export const OnboardingStatusEnum = {
  PRE_BOARDING: 'Pre-Boarding',
  DAY_1_PENDING: 'Day 1 Pending',
  IN_INDUCTION: 'In Induction',
  PROBATION: 'Probation',
  COMPLETED: 'Completed',
} as const;
export type OnboardingStatus = (typeof OnboardingStatusEnum)[keyof typeof OnboardingStatusEnum];

export const AssistantActionTypeEnum = {
  NAVIGATE: 'NAVIGATE',
  QUERY: 'QUERY',
  ACTION: 'ACTION',
  EXECUTE: 'EXECUTE',
} as const;
export type AssistantActionType = (typeof AssistantActionTypeEnum)[keyof typeof AssistantActionTypeEnum];

export const TicketPriorityEnum = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
  CRITICAL: 'Critical',
} as const;
export type TicketPriority = (typeof TicketPriorityEnum)[keyof typeof TicketPriorityEnum];

export const TicketStatusEnum = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  PENDING_USER: 'Pending User',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
} as const;
export type TicketStatus = (typeof TicketStatusEnum)[keyof typeof TicketStatusEnum];

export const ReviewCycleStatusEnum = {
  SELF_REVIEW: 'Self Review',
  MANAGER_REVIEW: 'Manager Review',
  CALIBRATION: 'Calibration',
  SIGNED_OFF: 'Signed Off',
  CLOSED: 'Closed',
} as const;
export type ReviewCycleStatus = (typeof ReviewCycleStatusEnum)[keyof typeof ReviewCycleStatusEnum];

export const ContractorStatusEnum = {
  ACTIVE: 'Active',
  EXPIRING: 'Expiring',
  TERMINATED: 'Terminated',
  PENDING_ONBOARDING: 'Pending Onboarding',
} as const;
export type ContractorStatus = (typeof ContractorStatusEnum)[keyof typeof ContractorStatusEnum];

export const CourseStatusEnum = {
  ACTIVE: 'Active',
  DRAFT: 'Draft',
  ARCHIVED: 'Archived',
} as const;
export type CourseStatus = (typeof CourseStatusEnum)[keyof typeof CourseStatusEnum];

export interface SystemEnumItem {
  id: string;
  category: string;
  code: string;
  label: string;
  translatedLabel: string;
  sortOrder: number;
  isActive: boolean;
  translations: Record<string, string>;
}

// In-memory cache for fast lookups
let enumCache: SystemEnumItem[] | null = null;
let lastCacheFetch = 0;
const CACHE_TTL_MS = 60000; // 1 minute

/**
 * Fetch localized enum items by category from database `system_enums` or fallback.
 */
export async function getSystemEnums(category?: string, locale: string = 'en'): Promise<SystemEnumItem[]> {
  const now = Date.now();
  if (!enumCache || now - lastCacheFetch > CACHE_TTL_MS) {
    try {
      const { db } = await import('@/lib/db');
      const { systemEnums } = await import('@/lib/db/schema');
      const records = await db.select().from(systemEnums);
      if (records && records.length > 0) {
        enumCache = records.map((r: any) => ({
          id: r.id,
          category: r.category,
          code: r.code,
          label: r.label,
          translatedLabel: r.label,
          sortOrder: r.sortOrder ?? 0,
          isActive: r.isActive ?? true,
          translations: (r.translations || {}) as Record<string, string>,
        }));
      } else {
        enumCache = FALLBACK_ENUMS;
      }
      lastCacheFetch = now;
    } catch {
      // Graceful fallback to static dictionary if DB is temporarily disconnected
      enumCache = FALLBACK_ENUMS;
      lastCacheFetch = now;
    }
  }

  let items = enumCache || FALLBACK_ENUMS;
  if (category) {
    items = items.filter((item) => item.category === category);
  }

  // Sort by sortOrder
  items = [...items].sort((a, b) => a.sortOrder - b.sortOrder);

  // Apply requested locale
  return items.map((item) => {
    const locMap = item.translations || {};
    const translated = locMap[locale] || locMap['en'] || item.label;
    return {
      ...item,
      translatedLabel: translated,
    };
  });
}

/**
 * Translate a specific enum value to the current active locale
 */
export function getTranslatedEnumLabel(
  category: string,
  code: string,
  locale: string = 'en'
): string {
  const items = enumCache || FALLBACK_ENUMS;
  const match = items.find((i) => i.category === category && i.code === code);
  if (!match) return code;
  return match.translations?.[locale] || match.translations?.['en'] || match.label;
}

export const FALLBACK_ENUMS: SystemEnumItem[] = [
  {
    id: 'employment_type:full_time',
    category: 'employment_type',
    code: 'Full-time',
    label: 'Full-time',
    translatedLabel: 'Full-time',
    sortOrder: 1,
    isActive: true,
    translations: {
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
    },
  },
  {
    id: 'employment_type:contract',
    category: 'employment_type',
    code: 'Contract',
    label: 'Contract',
    translatedLabel: 'Contract',
    sortOrder: 2,
    isActive: true,
    translations: {
      en: 'Contract',
      hi: 'अनुबंध',
      mr: 'करार',
      ta: 'ஒப்பந்தம்',
      te: 'ఒప్పందం',
      bn: 'চুক্তিভিত্তিক',
      es: 'Contrato',
      fr: 'Contrat',
      de: 'Vertrag',
      ja: '契約社員',
      ar: 'عقد',
    },
  },
  {
    id: 'employment_type:intern',
    category: 'employment_type',
    code: 'Intern',
    label: 'Intern',
    translatedLabel: 'Intern',
    sortOrder: 3,
    isActive: true,
    translations: {
      en: 'Intern',
      hi: 'इन्टर्न',
      mr: 'प्रशिक्षणार्थी',
      ta: 'பயிற்சியாளர்',
      te: 'ఇంటర్న్',
      bn: 'ইন্টার্ন',
      es: 'Pasante',
      fr: 'Stagiaire',
      de: 'Praktikant',
      ja: 'インターン',
      ar: 'متدرب',
    },
  },
  {
    id: 'employment_type:part_time',
    category: 'employment_type',
    code: 'Part-time',
    label: 'Part-time',
    translatedLabel: 'Part-time',
    sortOrder: 4,
    isActive: true,
    translations: {
      en: 'Part-time',
      hi: 'अंशकालिक',
      mr: 'अर्धवेळ',
      ta: 'பகுதி நேரம்',
      te: 'పార్ట్-టైమ్',
      bn: 'খণ্ডকালীন',
      es: 'Medio tiempo',
      fr: 'Temps partiel',
      de: 'Teilzeit',
      ja: 'パートタイム',
      ar: 'دوام جزئي',
    },
  },
  {
    id: 'employment_type:permanent',
    category: 'employment_type',
    code: 'Permanent',
    label: 'Permanent',
    translatedLabel: 'Permanent',
    sortOrder: 5,
    isActive: true,
    translations: {
      en: 'Permanent',
      hi: 'स्थायी',
      mr: 'कायमस्वरूपी',
      ta: 'நிரந்தர',
      te: 'శాశ్వత',
      bn: 'স্থায়ী',
      es: 'Permanente',
      fr: 'Permanent',
      de: 'Festanstellung',
      ja: '無期雇用',
      ar: 'دائم',
    },
  },
];
