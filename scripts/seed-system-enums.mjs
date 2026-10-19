/**
 * Seed canonical enterprise Enums into system_enums database table with 11-locale translations.
 * Locales: en, hi, mr, ta, te, bn, es, fr, de, ja, ar
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const SEED_ENUMS = [
  // --- ASSISTANT ACTION TYPES ---
  {
    category: 'assistant_action_type',
    code: 'NAVIGATE',
    label: 'Navigate',
    sort_order: 1,
    translations: {
      en: 'Navigate',
      hi: 'नेविगेट करें',
      mr: 'नेव्हिगेट करा',
      ta: 'வழிசெலுத்து',
      te: 'నావిగేట్ చేయండి',
      bn: 'নেভিগেট করুন',
      es: 'Navegar',
      fr: 'Naviguer',
      de: 'Navigieren',
      ja: 'ナビゲート',
      ar: 'تنقل'
    }
  },
  {
    category: 'assistant_action_type',
    code: 'QUERY',
    label: 'Query',
    sort_order: 2,
    translations: {
      en: 'Query',
      hi: 'खोज / प्रश्न',
      mr: 'शोध / विचारणा',
      ta: 'வினவல்',
      te: 'ప్రశ్న',
      bn: 'অনুসন্ধান',
      es: 'Consulta',
      fr: 'Requête',
      de: 'Abfrage',
      ja: 'クエリ',
      ar: 'استعلام'
    }
  },
  {
    category: 'assistant_action_type',
    code: 'ACTION',
    label: 'Action',
    sort_order: 3,
    translations: {
      en: 'Action',
      hi: 'क्रिया / कार्य',
      mr: 'कृती',
      ta: 'செயல்',
      te: 'చర్య',
      bn: 'পদক্ষেপ',
      es: 'Acción',
      fr: 'Action',
      de: 'Aktion',
      ja: 'アクション',
      ar: 'إجراء'
    }
  },
  {
    category: 'assistant_action_type',
    code: 'EXECUTE',
    label: 'Execute',
    sort_order: 4,
    translations: {
      en: 'Execute',
      hi: 'निष्पादित करें',
      mr: 'अंमलबजावणी करा',
      ta: 'செயல்படுத்து',
      te: 'అమలు చేయండి',
      bn: 'কার্যকর করুন',
      es: 'Ejecutar',
      fr: 'Exécuter',
      de: 'Ausführen',
      ja: '実行',
      ar: 'تنفيذ'
    }
  },
  // --- EMPLOYMENT TYPE ---
  {
    category: 'employment_type',
    code: 'Full-time',
    label: 'Full-time',
    sort_order: 1,
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
      ar: 'دوام كامل'
    }
  },
  {
    category: 'employment_type',
    code: 'Contract',
    label: 'Contract',
    sort_order: 2,
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
      ar: 'عقد'
    }
  },
  {
    category: 'employment_type',
    code: 'Intern',
    label: 'Intern',
    sort_order: 3,
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
      ar: 'متدرب'
    }
  },
  {
    category: 'employment_type',
    code: 'Part-time',
    label: 'Part-time',
    sort_order: 4,
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
      ar: 'دوام جزئي'
    }
  },
  {
    category: 'employment_type',
    code: 'Permanent',
    label: 'Permanent',
    sort_order: 5,
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
      ar: 'دائم'
    }
  },

  // --- REQUISITION STATUS ---
  {
    category: 'requisition_status',
    code: 'Draft',
    label: 'Draft',
    sort_order: 1,
    translations: {
      en: 'Draft',
      hi: 'प्रारूप',
      mr: 'मसुदा',
      ta: 'வரைவு',
      te: 'చిత్తుప్రతి',
      bn: 'খসড়া',
      es: 'Borrador',
      fr: 'Brouillon',
      de: 'Entwurf',
      ja: '下書き',
      ar: 'مسودة'
    }
  },
  {
    category: 'requisition_status',
    code: 'Pending Approval',
    label: 'Pending Approval',
    sort_order: 2,
    translations: {
      en: 'Pending Approval',
      hi: 'स्वीकृति लंबित',
      mr: 'मंजुरी प्रलंबित',
      ta: 'ஒப்புதல் நிலுவையில்',
      te: 'ఆమోదం పెండింగ్‌లో ఉంది',
      bn: 'অনুমোদন অপেক্ষমাণ',
      es: 'Pendiente de aprobación',
      fr: "En attente d'approbation",
      de: 'Ausstehende Genehmigung',
      ja: '承認待ち',
      ar: 'قيد الموافقة'
    }
  },
  {
    category: 'requisition_status',
    code: 'Open',
    label: 'Open',
    sort_order: 3,
    translations: {
      en: 'Open',
      hi: 'खुला',
      mr: 'खुले',
      ta: 'திறந்த',
      te: 'ఓపెన్',
      bn: 'উন্মুক্ত',
      es: 'Abierto',
      fr: 'Ouvert',
      de: 'Offen',
      ja: '募集中',
      ar: 'مفتوح'
    }
  },
  {
    category: 'requisition_status',
    code: 'On Hold',
    label: 'On Hold',
    sort_order: 4,
    translations: {
      en: 'On Hold',
      hi: 'स्थगित',
      mr: 'होल्डवर',
      ta: 'தற்காலிக நிறுத்தம்',
      te: 'హోల్డ్‌లో ఉంది',
      bn: 'স্থগিত',
      es: 'En espera',
      fr: 'En attente',
      de: 'Pausiert',
      ja: '保留中',
      ar: 'معلق'
    }
  },
  {
    category: 'requisition_status',
    code: 'Closed',
    label: 'Closed',
    sort_order: 5,
    translations: {
      en: 'Closed',
      hi: 'बंद',
      mr: 'बंद',
      ta: 'மூடப்பட்டது',
      te: 'మూసివేయబడింది',
      bn: 'বন্ধ',
      es: 'Cerrado',
      fr: 'Fermé',
      de: 'Geschlossen',
      ja: '募集終了',
      ar: 'مغلق'
    }
  },

  // --- EXPERIENCE LEVEL ---
  {
    category: 'experience_level',
    code: 'Entry',
    label: 'Entry',
    sort_order: 1,
    translations: {
      en: 'Entry',
      hi: 'प्रारंभिक',
      mr: 'प्रवेश स्तर',
      ta: 'தொடக்க நிலை',
      te: 'ప్రవేశ స్థాయి',
      bn: 'প্রাথমিক স্তর',
      es: 'Inicial',
      fr: 'Débutant',
      de: 'Einsteiger',
      ja: 'エントリー',
      ar: 'مبتدئ'
    }
  },
  {
    category: 'experience_level',
    code: 'Mid',
    label: 'Mid',
    sort_order: 2,
    translations: {
      en: 'Mid',
      hi: 'मध्यम',
      mr: 'मध्यम स्तर',
      ta: 'நடுத்தர நிலை',
      te: 'మధ్య స్థాయి',
      bn: 'মধ্যবর্তী স্তর',
      es: 'Intermedio',
      fr: 'Intermédiaire',
      de: 'Mittleres Level',
      ja: 'ミドル',
      ar: 'متوسط'
    }
  },
  {
    category: 'experience_level',
    code: 'Senior',
    label: 'Senior',
    sort_order: 3,
    translations: {
      en: 'Senior',
      hi: 'वरिष्ठ',
      mr: 'ज्येष्ठ',
      ta: 'மூத்த நிலை',
      te: 'సీనియర్',
      bn: 'সিনিয়র',
      es: 'Senior',
      fr: 'Senior',
      de: 'Senior',
      ja: 'シニア',
      ar: 'خبير'
    }
  },
  {
    category: 'experience_level',
    code: 'Lead',
    label: 'Lead',
    sort_order: 4,
    translations: {
      en: 'Lead',
      hi: 'प्रमुख',
      mr: 'प्रमुख',
      ta: 'தலைமை',
      te: 'లీడ్',
      bn: 'লিড',
      es: 'Líder',
      fr: "Chef d'équipe",
      de: 'Teamleiter',
      ja: 'リード',
      ar: 'قائد'
    }
  },
  {
    category: 'experience_level',
    code: 'Executive',
    label: 'Executive',
    sort_order: 5,
    translations: {
      en: 'Executive',
      hi: 'कार्यकारी',
      mr: 'कार्यकारी',
      ta: 'நிர்வாகி',
      te: 'ఎగ్జిక్యూటివ్',
      bn: 'নির্বাহী',
      es: 'Ejecutivo',
      fr: 'Cadre',
      de: 'Führungskraft',
      ja: 'エグゼクティブ',
      ar: 'تنفيذي'
    }
  },

  // --- CANDIDATE STAGE ---
  {
    category: 'candidate_stage',
    code: 'Applied',
    label: 'Applied',
    sort_order: 1,
    translations: {
      en: 'Applied',
      hi: 'आवेदित',
      mr: 'अर्ज केला',
      ta: 'விண்ணப்பிக்கப்பட்டது',
      te: 'దరఖాస్తు చేయబడింది',
      bn: 'আবেদন করা হয়েছে',
      es: 'Postulado',
      fr: 'Candidaté',
      de: 'Beworben',
      ja: '応募済み',
      ar: 'تم التقديم'
    }
  },
  {
    category: 'candidate_stage',
    code: 'Screening',
    label: 'Screening',
    sort_order: 2,
    translations: {
      en: 'Screening',
      hi: 'स्क्रीनिंग',
      mr: 'चाळणी',
      ta: 'திரையிடல்',
      te: 'స్క్రీనింగ్',
      bn: 'বাছাইকরণ',
      es: 'Revisión inicial',
      fr: 'Présélection',
      de: 'Vorauswahl',
      ja: '書類選考',
      ar: 'فرز أولي'
    }
  },
  {
    category: 'candidate_stage',
    code: 'Technical Round 1',
    label: 'Technical Round 1',
    sort_order: 3,
    translations: {
      en: 'Technical Round 1',
      hi: 'तकनीकी दौर 1',
      mr: 'तांत्रिक फेरी १',
      ta: 'தொழில்நுட்ப சுற்று 1',
      te: 'టెక్నికల్ రౌండ్ 1',
      bn: 'টেকনিক্যাল রাউন্ড ১',
      es: 'Ronda técnica 1',
      fr: 'Entretien technique 1',
      de: 'Technisches Gespräch 1',
      ja: '一次技術面接',
      ar: 'المقابلة التقنية الأولى'
    }
  },
  {
    category: 'candidate_stage',
    code: 'Technical Round 2',
    label: 'Technical Round 2',
    sort_order: 4,
    translations: {
      en: 'Technical Round 2',
      hi: 'तकनीकी दौर 2',
      mr: 'तांत्रिक फेरी २',
      ta: 'தொழில்நுட்ப சுற்று 2',
      te: 'టెక్నికల్ రౌండ్ 2',
      bn: 'টেকনিক্যাল রাউন্ড ২',
      es: 'Ronda técnica 2',
      fr: 'Entretien technique 2',
      de: 'Technisches Gespräch 2',
      ja: '二次技術面接',
      ar: 'المقابلة التقنية الثانية'
    }
  },
  {
    category: 'candidate_stage',
    code: 'HR Round',
    label: 'HR Round',
    sort_order: 5,
    translations: {
      en: 'HR Round',
      hi: 'एचआर दौर',
      mr: 'एचआर फेरी',
      ta: 'மனிதவள சுற்று',
      te: 'హెచ్ఆర్ రౌండ్',
      bn: 'এইচআর রাউন্ড',
      es: 'Entrevista RRHH',
      fr: 'Entretien RH',
      de: 'HR-Gespräch',
      ja: '人事面接',
      ar: 'مقابلة الموارد البشرية'
    }
  },
  {
    category: 'candidate_stage',
    code: 'Offer Extended',
    label: 'Offer Extended',
    sort_order: 6,
    translations: {
      en: 'Offer Extended',
      hi: 'प्रस्ताव भेजा गया',
      mr: 'ऑफर दिली',
      ta: 'வேலை வாய்ப்பு வழங்கப்பட்டது',
      te: 'ఆఫర్ ఇవ్వబడింది',
      bn: 'অফার পাঠানো হয়েছে',
      es: 'Oferta extendida',
      fr: 'Offre envoyée',
      de: 'Angebot unterbreitet',
      ja: '内定提示',
      ar: 'تم تقديم العرض'
    }
  },
  {
    category: 'candidate_stage',
    code: 'Hired',
    label: 'Hired',
    sort_order: 7,
    translations: {
      en: 'Hired',
      hi: 'नियुक्त',
      mr: 'नियुक्त',
      ta: 'பணியமர்த்தப்பட்டார்',
      te: 'నియమించబడ్డారు',
      bn: 'নিয়োগপ্রাপ্ত',
      es: 'Contratado',
      fr: 'Embauché',
      de: 'Eingestellt',
      ja: '採用決定',
      ar: 'تم التوظيف'
    }
  },
  {
    category: 'candidate_stage',
    code: 'Rejected',
    label: 'Rejected',
    sort_order: 8,
    translations: {
      en: 'Rejected',
      hi: 'अस्वीकृत',
      mr: 'नाकारले',
      ta: 'நிராகரிக்கப்பட்டது',
      te: 'తిరస్కరించబడింది',
      bn: 'প্রত্যাখ্যাত',
      es: 'Rechazado',
      fr: 'Rejeté',
      de: 'Abgelehnt',
      ja: '不合格',
      ar: 'مرفوض'
    }
  },

  // --- INTERVIEW RECOMMENDATION ---
  {
    category: 'interview_recommendation',
    code: 'Strong Hire',
    label: 'Strong Hire',
    sort_order: 1,
    translations: {
      en: 'Strong Hire',
      hi: 'मजबूत नियुक्ति सिफारिश',
      mr: 'तीव्र नियुक्ती शिफारस',
      ta: 'வலுவான பணி பரிந்துரை',
      te: 'బలమైన నియామక సిఫార్సు',
      bn: 'দৃঢ় নিয়োগ সুপারিশ',
      es: 'Contratación firme',
      fr: 'Recrutement fortement recommandé',
      de: 'Klare Einstellungsempfehlung',
      ja: '強く推薦',
      ar: 'توصية قوية بالتوظيف'
    }
  },
  {
    category: 'interview_recommendation',
    code: 'Hire',
    label: 'Hire',
    sort_order: 2,
    translations: {
      en: 'Hire',
      hi: 'नियुक्ति',
      mr: 'नियुक्ती',
      ta: 'பணி அமர்த்துக',
      te: 'నియామకం',
      bn: 'নিয়োগ',
      es: 'Contratar',
      fr: 'Recruter',
      de: 'Einstellen',
      ja: '採用',
      ar: 'توظيف'
    }
  },
  {
    category: 'interview_recommendation',
    code: 'Hold',
    label: 'Hold',
    sort_order: 3,
    translations: {
      en: 'Hold',
      hi: 'होल्ड',
      mr: 'होल्ड',
      ta: 'பொறுத்திரு',
      te: 'హోల్డ్',
      bn: 'অপেক্ষায় রাখুন',
      es: 'Retener',
      fr: 'En réserve',
      de: 'Zurückstellen',
      ja: 'キープ',
      ar: 'حفظ'
    }
  },
  {
    category: 'interview_recommendation',
    code: 'Reject',
    label: 'Reject',
    sort_order: 4,
    translations: {
      en: 'Reject',
      hi: 'अस्वीकार',
      mr: 'नकार',
      ta: 'நிராகரி',
      te: 'తిరస్కరించు',
      bn: 'প্রত্যাখ্যান',
      es: 'Rechazar',
      fr: 'Rejeter',
      de: 'Ablehnen',
      ja: '不採用',
      ar: 'رفض'
    }
  },

  // --- APPROVAL STATUS ---
  {
    category: 'approval_status',
    code: 'Pending',
    label: 'Pending',
    sort_order: 1,
    translations: {
      en: 'Pending',
      hi: 'लंबित',
      mr: 'प्रलंबित',
      ta: 'நிலுவையில்',
      te: 'పెండింగ్‌లో ఉంది',
      bn: 'অপেক্ষমাণ',
      es: 'Pendiente',
      fr: 'En attente',
      de: 'Ausstehend',
      ja: '保留',
      ar: 'معلق'
    }
  },
  {
    category: 'approval_status',
    code: 'Approved',
    label: 'Approved',
    sort_order: 2,
    translations: {
      en: 'Approved',
      hi: 'स्वीकृत',
      mr: 'मंजूर',
      ta: 'ஒப்புதல் அளிக்கப்பட்டது',
      te: 'ఆమోదించబడింది',
      bn: 'অনুমোদিত',
      es: 'Aprobado',
      fr: 'Approuvé',
      de: 'Genehmigt',
      ja: '承認済み',
      ar: 'معتمد'
    }
  },
  {
    category: 'approval_status',
    code: 'Rejected',
    label: 'Rejected',
    sort_order: 3,
    translations: {
      en: 'Rejected',
      hi: 'अस्वीकृत',
      mr: 'नाकारले',
      ta: 'நிராகரிக்கப்பட்டது',
      te: 'తిరస్కరించబడింది',
      bn: 'প্রত্যাখ্যাত',
      es: 'Rechazado',
      fr: 'Rejeté',
      de: 'Abgelehnt',
      ja: '却下',
      ar: 'مرفوض'
    }
  },

  // --- CANDIDATE ACCEPTANCE ---
  {
    category: 'candidate_acceptance',
    code: 'Pending',
    label: 'Pending',
    sort_order: 1,
    translations: {
      en: 'Pending',
      hi: 'लंबित',
      mr: 'प्रलंबित',
      ta: 'நிலுவையில்',
      te: 'పెండింగ్‌లో ఉంది',
      bn: 'অপেক্ষমাণ',
      es: 'Pendiente',
      fr: 'En attente',
      de: 'Ausstehend',
      ja: '検討中',
      ar: 'معلق'
    }
  },
  {
    category: 'candidate_acceptance',
    code: 'Accepted',
    label: 'Accepted',
    sort_order: 2,
    translations: {
      en: 'Accepted',
      hi: 'स्वीकृत',
      mr: 'स्वीकारले',
      ta: 'ஏற்றுக்கொள்ளப்பட்டது',
      te: 'స్వీకరించబడింది',
      bn: 'গৃহীত',
      es: 'Aceptado',
      fr: 'Accepté',
      de: 'Angenommen',
      ja: '承諾',
      ar: 'مقبول'
    }
  },
  {
    category: 'candidate_acceptance',
    code: 'Declined',
    label: 'Declined',
    sort_order: 3,
    translations: {
      en: 'Declined',
      hi: 'अस्वीकार किया',
      mr: 'नाकारले',
      ta: 'நிராகரிக்கப்பட்டது',
      te: 'తిరస్కరించబడింది',
      bn: 'প্রত্যাখ্যান করেছে',
      es: 'Declinado',
      fr: 'Décliné',
      de: 'Abgelehnt',
      ja: '辞退',
      ar: 'مرفوض'
    }
  },

  // --- ONBOARDING STATUS ---
  {
    category: 'onboarding_status',
    code: 'Pre-Boarding',
    label: 'Pre-Boarding',
    sort_order: 1,
    translations: {
      en: 'Pre-Boarding',
      hi: 'प्री-बोर्डिंग',
      mr: 'प्री-बोर्डिंग',
      ta: 'சேர்க்கைக்கு முந்தைய நிலை',
      te: 'ప్రీ-బోర్డింగ్',
      bn: 'প্রি-বোর্ডিং',
      es: 'Preincorporación',
      fr: 'Pré-embarquement',
      de: 'Vor Beginn',
      ja: '入社前手続き',
      ar: 'ما قبل الالتحاق'
    }
  },
  {
    category: 'onboarding_status',
    code: 'Day 1 Pending',
    label: 'Day 1 Pending',
    sort_order: 2,
    translations: {
      en: 'Day 1 Pending',
      hi: 'दिन 1 लंबित',
      mr: 'पहिला दिवस प्रलंबित',
      ta: 'நாள் 1 நிலுவையில்',
      te: 'మొదటి రోజు పెండింగ్‌లో ఉంది',
      bn: 'দিন ১ অপেক্ষমাণ',
      es: 'Día 1 pendiente',
      fr: 'Jour 1 en attente',
      de: 'Tag 1 ausstehend',
      ja: '初日出勤待ち',
      ar: 'اليوم الأول معلق'
    }
  },
  {
    category: 'onboarding_status',
    code: 'In Induction',
    label: 'In Induction',
    sort_order: 3,
    translations: {
      en: 'In Induction',
      hi: 'इंडक्शन में',
      mr: 'प्रवेश प्रक्रियेत',
      ta: 'அறிமுகப் பயிற்சியில்',
      te: 'ఇండక్షన్‌లో ఉంది',
      bn: 'ইন্ডাকশনে চলমান',
      es: 'En inducción',
      fr: 'En intégration',
      de: 'In Einarbeitung',
      ja: 'オリエンテーション中',
      ar: 'قيد التدريب التعريفي'
    }
  },
  {
    category: 'onboarding_status',
    code: 'Probation',
    label: 'Probation',
    sort_order: 4,
    translations: {
      en: 'Probation',
      hi: 'परिवीक्षा',
      mr: 'परिवीक्षाधीन',
      ta: 'பரிசோதனைக் காலம்',
      te: 'ప్రొబేషన్',
      bn: 'শিক্ষানবিস কাল',
      es: 'Período de prueba',
      fr: "Période d'essai",
      de: 'Probezeit',
      ja: '試用期間',
      ar: 'فترة التجربة'
    }
  },
  {
    category: 'onboarding_status',
    code: 'Completed',
    label: 'Completed',
    sort_order: 5,
    translations: {
      en: 'Completed',
      hi: 'पूर्ण',
      mr: 'पूर्ण',
      ta: 'முடிவடைந்தது',
      te: 'పూర్తయింది',
      bn: 'সম্পন্ন',
      es: 'Completado',
      fr: 'Terminé',
      de: 'Abgeschlossen',
      ja: '完了',
      ar: 'مكتمل'
    }
  },

  // --- TICKET PRIORITY ---
  {
    category: 'ticket_priority',
    code: 'Low',
    label: 'Low',
    sort_order: 1,
    translations: {
      en: 'Low',
      hi: 'निम्न',
      mr: 'कमी',
      ta: 'குறைந்த',
      te: 'తక్కువ',
      bn: 'কম',
      es: 'Baja',
      fr: 'Basse',
      de: 'Niedrig',
      ja: '低',
      ar: 'منخفضة'
    }
  },
  {
    category: 'ticket_priority',
    code: 'Medium',
    label: 'Medium',
    sort_order: 2,
    translations: {
      en: 'Medium',
      hi: 'मध्यम',
      mr: 'मध्यम',
      ta: 'நடுத்தர',
      te: 'మధ్యస్థ',
      bn: 'মাঝারি',
      es: 'Media',
      fr: 'Moyenne',
      de: 'Mittel',
      ja: '中',
      ar: 'متوسطة'
    }
  },
  {
    category: 'ticket_priority',
    code: 'High',
    label: 'High',
    sort_order: 3,
    translations: {
      en: 'High',
      hi: 'उच्च',
      mr: 'उच्च',
      ta: 'உயர்',
      te: 'అధిక',
      bn: 'উচ্চ',
      es: 'Alta',
      fr: 'Haute',
      de: 'Hoch',
      ja: '高',
      ar: 'عالية'
    }
  },
  {
    category: 'ticket_priority',
    code: 'Urgent',
    label: 'Urgent',
    sort_order: 4,
    translations: {
      en: 'Urgent',
      hi: 'अति आवश्यक',
      mr: 'तातडीचे',
      ta: 'அவசரம்',
      te: 'తక్షణమే',
      bn: 'জরুরি',
      es: 'Urgente',
      fr: 'Urgent',
      de: 'Dringend',
      ja: '緊急',
      ar: 'عاجل'
    }
  },
  {
    category: 'ticket_priority',
    code: 'Critical',
    label: 'Critical',
    sort_order: 5,
    translations: {
      en: 'Critical',
      hi: 'गंभीर',
      mr: 'अतिगंभीर',
      ta: 'முக்கியமான',
      te: 'క్లిష్టమైన',
      bn: 'সংকটজনক',
      es: 'Crítica',
      fr: 'Critique',
      de: 'Kritisch',
      ja: '最重要',
      ar: 'حرج'
    }
  },

  // --- TICKET STATUS ---
  {
    category: 'ticket_status',
    code: 'Open',
    label: 'Open',
    sort_order: 1,
    translations: {
      en: 'Open',
      hi: 'खुला',
      mr: 'खुले',
      ta: 'திறந்த',
      te: 'ఓపెన్',
      bn: 'উন্মুক্ত',
      es: 'Abierto',
      fr: 'Ouvert',
      de: 'Offen',
      ja: '新規受付',
      ar: 'مفتوح'
    }
  },
  {
    category: 'ticket_status',
    code: 'In Progress',
    label: 'In Progress',
    sort_order: 2,
    translations: {
      en: 'In Progress',
      hi: 'प्रगति पर',
      mr: 'प्रगतीपथावर',
      ta: 'செயல்பாட்டில்',
      te: 'పురోగతిలో ఉంది',
      bn: 'চলমান',
      es: 'En curso',
      fr: 'En cours',
      de: 'In Bearbeitung',
      ja: '対応中',
      ar: 'قيد التنفيذ'
    }
  },
  {
    category: 'ticket_status',
    code: 'Pending User',
    label: 'Pending User',
    sort_order: 3,
    translations: {
      en: 'Pending User',
      hi: 'उपयोगकर्ता लंबित',
      mr: 'वापरकर्ता प्रतिसाद प्रलंबित',
      ta: 'பயனர் பதிலுக்கு காத்திருக்கிறது',
      te: 'వినియోగదారు సమాధానం కోసం ఎదురుచూపు',
      bn: 'ব্যবহারকারীর জবাবের অপেক্ষায়',
      es: 'Esperando usuario',
      fr: 'En attente utilisateur',
      de: 'Warten auf Benutzer',
      ja: 'ユーザー回答待ち',
      ar: 'بانتظار المستخدم'
    }
  },
  {
    category: 'ticket_status',
    code: 'Resolved',
    label: 'Resolved',
    sort_order: 4,
    translations: {
      en: 'Resolved',
      hi: 'समाधानित',
      mr: 'निकाली काढले',
      ta: 'தீர்க்கப்பட்டது',
      te: 'పరిష్కరించబడింది',
      bn: 'সমাধানকৃত',
      es: 'Resuelto',
      fr: 'Résolu',
      de: 'Gelöst',
      ja: '解決済み',
      ar: 'تم الحل'
    }
  },
  {
    category: 'ticket_status',
    code: 'Closed',
    label: 'Closed',
    sort_order: 5,
    translations: {
      en: 'Closed',
      hi: 'बंद',
      mr: 'बंद',
      ta: 'மூடப்பட்டது',
      te: 'మూసివేయబడింది',
      bn: 'বন্ধ',
      es: 'Cerrado',
      fr: 'Fermé',
      de: 'Geschlossen',
      ja: '完了',
      ar: 'مغلق'
    }
  },

  // --- REVIEW CYCLE STATUS ---
  {
    category: 'review_cycle_status',
    code: 'Self Review',
    label: 'Self Review',
    sort_order: 1,
    translations: {
      en: 'Self Review',
      hi: 'स्व-समीक्षा',
      mr: 'स्वयं पुनरावलोकन',
      ta: 'சுய மதிப்பீடு',
      te: 'స్వీయ సమీక్ష',
      bn: 'স্ব-পর্যালোচনা',
      es: 'Autoevaluación',
      fr: 'Auto-évaluation',
      de: 'Selbstbeurteilung',
      ja: '自己評価',
      ar: 'التقييم الذاتي'
    }
  },
  {
    category: 'review_cycle_status',
    code: 'Manager Review',
    label: 'Manager Review',
    sort_order: 2,
    translations: {
      en: 'Manager Review',
      hi: 'प्रबंधक समीक्षा',
      mr: 'व्यवस्थापक पुनरावलोकन',
      ta: 'மேலாளர் மதிப்பீடு',
      te: 'మేనేజర్ సమీక్ష',
      bn: 'ম্যানেজার পর্যালোচনা',
      es: 'Evaluación del gerente',
      fr: 'Évaluation managériale',
      de: 'Manager-Beurteilung',
      ja: '上長評価',
      ar: 'تقييم المدير'
    }
  },
  {
    category: 'review_cycle_status',
    code: 'Calibration',
    label: 'Calibration',
    sort_order: 3,
    translations: {
      en: 'Calibration',
      hi: 'अंशांकन',
      mr: 'कॅलिब्रेशन',
      ta: 'அளவுத்திருத்தம்',
      te: 'కాలిబ్రేషన్',
      bn: 'ক্যালিব্রেশন',
      es: 'Calibración',
      fr: 'Étalonnage',
      de: 'Kalibrierung',
      ja: 'キャリブレーション',
      ar: 'المعايرة'
    }
  },
  {
    category: 'review_cycle_status',
    code: 'Signed Off',
    label: 'Signed Off',
    sort_order: 4,
    translations: {
      en: 'Signed Off',
      hi: 'हस्ताक्षरित',
      mr: 'स्वाक्षरीकृत',
      ta: 'கையொப்பமிடப்பட்டது',
      te: 'సంతకం చేయబడింది',
      bn: 'স্বাক্ষরিত',
      es: 'Firmado',
      fr: 'Validé et signé',
      de: 'Abgezeichnet',
      ja: '承認完了',
      ar: 'تم التوقيع'
    }
  },
  {
    category: 'review_cycle_status',
    code: 'Closed',
    label: 'Closed',
    sort_order: 5,
    translations: {
      en: 'Closed',
      hi: 'बंद',
      mr: 'बंद',
      ta: 'மூடப்பட்டது',
      te: 'మూసివేయబడింది',
      bn: 'বন্ধ',
      es: 'Cerrado',
      fr: 'Fermé',
      de: 'Geschlossen',
      ja: '完了',
      ar: 'مغلق'
    }
  },

  // --- CONTRACTOR STATUS ---
  {
    category: 'contractor_status',
    code: 'Active',
    label: 'Active',
    sort_order: 1,
    translations: {
      en: 'Active',
      hi: 'सक्रिय',
      mr: 'सक्रिय',
      ta: 'செயலில்',
      te: 'క్రియాశీలకంగా ఉంది',
      bn: 'সক্রিয়',
      es: 'Activo',
      fr: 'Actif',
      de: 'Aktiv',
      ja: '稼働中',
      ar: 'نشط'
    }
  },
  {
    category: 'contractor_status',
    code: 'Expiring',
    label: 'Expiring',
    sort_order: 2,
    translations: {
      en: 'Expiring',
      hi: 'समाप्त होने वाला',
      mr: 'मुदत संपत आहे',
      ta: 'காலாவதியாகிறது',
      te: 'గడువు ముగుస్తుంది',
      bn: 'মেয়াদ শেষ হতে চলেছে',
      es: 'Por vencer',
      fr: 'Expirant',
      de: 'Läuft ab',
      ja: '契約満了間近',
      ar: 'سينتهي قريباً'
    }
  },
  {
    category: 'contractor_status',
    code: 'Terminated',
    label: 'Terminated',
    sort_order: 3,
    translations: {
      en: 'Terminated',
      hi: 'समाप्त',
      mr: 'समाप्त केले',
      ta: 'முடிக்கப்பட்டது',
      te: 'రద్దు చేయబడింది',
      bn: 'বাতিল',
      es: 'Rescindido',
      fr: 'Résilié',
      de: 'Beendet',
      ja: '契約解除',
      ar: 'منتهي'
    }
  },
  {
    category: 'contractor_status',
    code: 'Pending Onboarding',
    label: 'Pending Onboarding',
    sort_order: 4,
    translations: {
      en: 'Pending Onboarding',
      hi: 'ऑनबोर्डिंग लंबित',
      mr: 'ऑनबोर्डिंग प्रलंबित',
      ta: 'சேர்க்கை நிலுவையில்',
      te: 'ఆన్‌బోర్డింగ్ పెండింగ్‌లో ఉంది',
      bn: 'অনবোর্ডিং অপেক্ষমাণ',
      es: 'Onboarding pendiente',
      fr: 'Intégration en attente',
      de: 'Einarbeitung ausstehend',
      ja: '入社手続き中',
      ar: 'بانتظار التهيئة'
    }
  },

  // --- COURSE STATUS ---
  {
    category: 'course_status',
    code: 'Active',
    label: 'Active',
    sort_order: 1,
    translations: {
      en: 'Active',
      hi: 'सक्रिय',
      mr: 'सक्रिय',
      ta: 'செயலில்',
      te: 'క్రియాశీలకం',
      bn: 'সক্রিয়',
      es: 'Activo',
      fr: 'Actif',
      de: 'Aktiv',
      ja: '公開中',
      ar: 'نشط'
    }
  },
  {
    category: 'course_status',
    code: 'Draft',
    label: 'Draft',
    sort_order: 2,
    translations: {
      en: 'Draft',
      hi: 'प्रारूप',
      mr: 'मसुदा',
      ta: 'வரைவு',
      te: 'చిత్తుప్రతి',
      bn: 'খসড়া',
      es: 'Borrador',
      fr: 'Brouillon',
      de: 'Entwurf',
      ja: '下書き',
      ar: 'مسودة'
    }
  },
  {
    category: 'course_status',
    code: 'Archived',
    label: 'Archived',
    sort_order: 3,
    translations: {
      en: 'Archived',
      hi: 'संग्रहीत',
      mr: 'संग्रहित',
      ta: 'காப்பகப்படுத்தப்பட்டது',
      te: 'భద్రపరచబడింది',
      bn: 'সংরক্ষণাগারভুক্ত',
      es: 'Archivado',
      fr: 'Archivé',
      de: 'Archiviert',
      ja: 'アーカイブ済み',
      ar: 'مؤرشف'
    }
  }
];

export async function seedSystemEnums() {
  console.log(`Starting system_enums seeding (${SEED_ENUMS.length} records)...`);
  let count = 0;

  for (const item of SEED_ENUMS) {
    const id = `${item.category}:${item.code.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
    await pool.query(
      `INSERT INTO system_enums (id, category, code, label, translations, sort_order, is_active, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
       ON CONFLICT (category, code)
       DO UPDATE SET
         label = EXCLUDED.label,
         translations = EXCLUDED.translations,
         sort_order = EXCLUDED.sort_order,
         is_active = EXCLUDED.is_active,
         updated_at = NOW()`,
      [id, item.category, item.code, item.label, JSON.stringify(item.translations), item.sort_order]
    );
    count++;
  }

  console.log(`Successfully seeded ${count} system enums with full 11-locale translations.`);
  await pool.end();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedSystemEnums().catch((err) => {
    console.error('Failed to seed system_enums:', err);
    process.exit(1);
  });
}
