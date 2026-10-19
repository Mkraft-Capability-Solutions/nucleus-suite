import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCALES_DIR = path.resolve(__dirname, '../src/locales');

const ASSISTANT_TRANSLATIONS = {
  en: {
    greeting: "How can I help you navigate the workspace?",
    fallback: "Ask me to open a module such as Payroll, Leave, Attendance, or Performance. I cannot confirm personal balances or execute approvals.",
    replies: {
      payroll: "Opening Payroll.",
      leaves: "Opening Leave Management.",
      attendance: "Opening Attendance.",
      recruitment: "Opening Recruitment.",
      performance: "Opening Performance.",
      learning: "Opening Learning.",
      experience: "Opening Employee Experience.",
      team: "Opening Team Directory.",
      dashboard: "Opening Dashboard.",
      settings: "Opening Settings."
    },
    keywords: {
      payroll: ["payroll", "salary", "payslip", "wage", "compensation"],
      leaves: ["leave", "vacation", "holiday", "time off", "pto"],
      attendance: ["attendance", "clock", "punch", "shift", "biometric"],
      recruitment: ["recruit", "hiring", "candidate", "job", "ats"],
      performance: ["performance", "okr", "goal", "9-box", "appraisal"],
      learning: ["learn", "course", "training", "magnetix", "skill"],
      experience: ["mci", "wellbeing", "vedic", "experience", "mental"],
      team: ["team", "pod", "directory", "colleague", "who is", "people"],
      dashboard: ["dashboard", "console", "home"],
      settings: ["setting", "security", "rbac", "profile", "config"]
    }
  },
  hi: {
    greeting: "कार्यक्षेत्र में नेविगेट करने में मैं आपकी कैसे मदद कर सकता हूँ?",
    fallback: "मुझसे पेरोल, अवकाश, उपस्थिति या प्रदर्शन जैसे मॉड्यूल खोलने के लिए कहें। मैं व्यक्तिगत शेष राशि की पुष्टि या अनुमोदन नहीं कर सकता।",
    replies: {
      payroll: "पेरोल खोला जा रहा है।",
      leaves: "अवकाश प्रबंधन खोला जा रहा है।",
      attendance: "उपस्थिति खोली जा रही है।",
      recruitment: "भर्ती प्रबंधन खोला जा रहा है।",
      performance: "प्रदर्शन प्रबंधन खोला जा रहा है।",
      learning: "लर्निंग और प्रशिक्षण खोला जा रहा है।",
      experience: "कर्मचारी अनुभव खोला जा रहा है।",
      team: "टीम डायरेक्टरी खोली जा रही है।",
      dashboard: "डैशबोर्ड खोला जा रहा है।",
      settings: "सेटिंग्स खोली जा रही है।"
    },
    keywords: {
      payroll: ["पेरोल", "वेतन", "सैलरी", "पेस्लिप", "मुआवजा"],
      leaves: ["अवकाश", "छुट्टी", "लीव", "वेकेशन", "हॉलिडे"],
      attendance: ["उपस्थिति", "हाजिरी", "पंच", "शिफ्ट", "बायोमेट्रिक", "क्लॉक"],
      recruitment: ["भर्ती", "हायरिंग", "उम्मीदवार", "कैंडिडेट", "नौकरी", "जॉब"],
      performance: ["प्रदर्शन", "परफॉरमेंस", "लक्ष्य", "मूल्यांकन", "ओकआर"],
      learning: ["सीखना", "कोर्स", "प्रशिक्षण", "ट्रेनिंग", "कौशल", "स्किल", "लर्निंग"],
      experience: ["अनुभव", "कल्याण", "मानसिक", "स्वास्थ्य", "वेलबीइंग"],
      team: ["टीम", "सहकर्मी", "डायरेक्टरी", "सदस्य", "लोग"],
      dashboard: ["डैशबोर्ड", "कंसोल", "होम"],
      settings: ["सेटिंग", "सुरक्षा", "प्रोफाइल", "कॉन्फिग"]
    }
  },
  mr: {
    greeting: "कार्यक्षेत्रात नेव्हिगेट करण्यासाठी मी तुम्हाला कशी मदत करू शकतो?",
    fallback: "मला पेरोल, रजा, उपस्थिती किंवा कामगिरी यासारखे मॉड्युल्स उघडण्यास सांगा.",
    replies: {
      payroll: "पेरोल उघडत आहे.",
      leaves: "रजा व्यवस्थापन उघडत आहे.",
      attendance: "उपस्थिती उघडत आहे.",
      recruitment: "भरती व्यवस्थापन उघडत आहे.",
      performance: "कामगिरी व्यवस्थापन उघडत आहे.",
      learning: "प्रशिक्षण आणि कौशल्य उघडत आहे.",
      experience: "कर्मचारी अनुभव उघडत आहे.",
      team: "टीम डिरेक्टरी उघडत आहे.",
      dashboard: "डॅशबोर्ड उघडत आहे.",
      settings: "सेटिंग्ज उघडत आहे."
    },
    keywords: {
      payroll: ["पेरोल", "पगार", "वेतन", "पेस्लिप"],
      leaves: ["रजा", "सुट्टी", "हॉलिडे"],
      attendance: ["उपस्थिती", "हजेरी", "पंच", "शिफ्ट"],
      recruitment: ["भरती", "उमेदवार", "नोकरी"],
      performance: ["कामगिरी", "लक्ष्य", "मूल्यांकन"],
      learning: ["शिक्षण", "कोर्स", "प्रशिक्षण", "कौशल्य"],
      experience: ["अनुभव", "कल्याण", "आरोग्य"],
      team: ["टीम", "सहकारी", "डिरेक्टरी"],
      dashboard: ["डॅशबोर्ड", "कंसोल"],
      settings: ["सेटिंग्ज", "सुरक्षा", "प्रोफाइल"]
    }
  },
  ta: {
    greeting: "பணியிடத்தில் வழிகாட்ட நான் உங்களுக்கு எவ்வாறு உதவ முடியும்?",
    fallback: "சம்பளம், விடுப்பு, வருகை அல்லது செயல்திறன் போன்ற தொகுதிகளை திறக்க என்னைக் கேளுங்கள்.",
    replies: {
      payroll: "ஊதிய மேலாண்மை திறக்கப்படுகிறது.",
      leaves: "விடுப்பு மேலாண்மை திறக்கப்படுகிறது.",
      attendance: "வருகை மேலாண்மை திறக்கப்படுகிறது.",
      recruitment: "ஆட்சேர்ப்பு திறக்கப்படுகிறது.",
      performance: "செயல்திறன் மேலாண்மை திறக்கப்படுகிறது.",
      learning: "கற்றல் மற்றும் பயிற்சி திறக்கப்படுகிறது.",
      experience: "பணியாளர் அனுபவம் திறக்கப்படுகிறது.",
      team: "குழு விபரம் திறக்கப்படுகிறது.",
      dashboard: "டாஷ்போர்டு திறக்கப்படுகிறது.",
      settings: "அமைப்புகள் திறக்கப்படுகிறது."
    },
    keywords: {
      payroll: ["ஊதியம்", "சம்பளம்", "பேஸ்லிப்"],
      leaves: ["விடுப்பு", "விடுமுறை", "லீவ்"],
      attendance: ["வருகை", "பஞ்ச்", "ஷிப்ட்"],
      recruitment: ["ஆட்சேர்ப்பு", "வேலை", "விண்ணப்பதாரர்"],
      performance: ["செயல்திறன்", "இலக்கு", "மதிப்பீடு"],
      learning: ["கற்றல்", "பயிற்சி", "திறன்"],
      experience: ["அனுபவம்", "நல்வாழ்வு"],
      team: ["குழு", "பணியாளர்கள்", "டைரக்டரி"],
      dashboard: ["டாஷ்போர்டு", "முகப்பு"],
      settings: ["அமைப்புகள்", "பாதுகாப்பு"]
    }
  },
  te: {
    greeting: "కార్యక్షేత్రంలో నావిగేట్ చేయడానికి నేను మీకు ఎలా సహాయపడగలను?",
    fallback: "పేరోల్, సెలవు, హాజరు లేదా పనితీరు వంటి మాడ్యూల్‌లను తెరవమని నన్ను అడగండి.",
    replies: {
      payroll: "పేరోల్ తెరవబడుతోంది.",
      leaves: "సెలవుల నిర్వహణ తెరవబడుతోంది.",
      attendance: "హాజరు తెరవబడుతోంది.",
      recruitment: "నియామకం తెరవబడుతోంది.",
      performance: "పనితీరు నిర్వహణ తెరవబడుతోంది.",
      learning: "అభ్యాసం మరియు శిక్షణ తెరవబడుతోంది.",
      experience: "ఉద్యోగి అనుభవం తెరవబడుతోంది.",
      team: "టీమ్ డైరెక్టరీ తెరవబడుతోంది.",
      dashboard: "డ్యాష్‌బోర్డ్ తెరవబడుతోంది.",
      settings: "సెట్టింగ్‌లు తెరవబడుతోంది."
    },
    keywords: {
      payroll: ["పేరోల్", "జీతం", "వేతనం", "పేస్లిప్"],
      leaves: ["సెలవు", "సెలవులు", "హాలిడే"],
      attendance: ["హాజరు", "పంచ్", "షిఫ్ట్"],
      recruitment: ["నియామకం", "ఉద్యోగం", "అభ్యర్థి"],
      performance: ["పనితీరు", "లక్ష్యం", "సమీక్ష"],
      learning: ["అభ్యాసం", "కోర్సు", "శిక్షణ", "నైపుణ్యం"],
      experience: ["అనుభవం", "సంక్షేమం"],
      team: ["టీమ్", "సహచరులు", "డైరెక్టరీ"],
      dashboard: ["డ్యాష్‌బోర్డ్"],
      settings: ["సెట్టింగ్‌లు", "భద్రత"]
    }
  },
  bn: {
    greeting: "কর্মক্ষেত্রে নেভিগেট করতে আমি আপনাকে কীভাবে সাহায্য করতে পারি?",
    fallback: "আমাকে পেরোল, ছুটি, উপস্থিতি বা পারফরম্যান্সের মতো মডিউল খুলতে বলুন।",
    replies: {
      payroll: "পেরোল খোলা হচ্ছে।",
      leaves: "ছুটি ব্যবস্থাপনা খোলা হচ্ছে।",
      attendance: "উপস্থিতি খোলা হচ্ছে।",
      recruitment: "নিয়োগ ব্যবস্থাপনা খোলা হচ্ছে।",
      performance: "কর্মক্ষমতা ব্যবস্থাপনা খোলা হচ্ছে।",
      learning: "শিক্ষা ও প্রশিক্ষণ খোলা হচ্ছে।",
      experience: "কর্মী অভিজ্ঞতা খোলা হচ্ছে।",
      team: "টিম ডিরেক্টরি খোলা হচ্ছে।",
      dashboard: "ড্যাশবোর্ড খোলা হচ্ছে।",
      settings: "সেটিংস খোলা হচ্ছে।"
    },
    keywords: {
      payroll: ["পেরোল", "বেতন", "পে-স্লিপ"],
      leaves: ["ছুটি", "অবকাশ", "ভ্যাকেশন"],
      attendance: ["উপস্থিতি", "হাজিরা", "পাঞ্চ", "শিফট"],
      recruitment: ["নিয়োগ", "চাকরি", "প্রার্থী"],
      performance: ["কর্মক্ষমতা", "লক্ষ্য", "পারফরম্যান্স"],
      learning: ["শিক্ষা", "কোর্স", "প্রশিক্ষণ", "দক্ষতা"],
      experience: ["অভিজ্ঞতা", "কল্যাণ"],
      team: ["টিম", "সহকর্মী", "ডিরেক্টরি"],
      dashboard: ["ড্যাশবোর্ড"],
      settings: ["সেটিংস", "নিরাপত্তা"]
    }
  },
  es: {
    greeting: "¿Cómo puedo ayudarte a navegar por el espacio de trabajo?",
    fallback: "Pídeme que abra un módulo como Nómina, Permisos, Asistencia o Rendimiento.",
    replies: {
      payroll: "Abriendo Nómina.",
      leaves: "Abriendo Gestión de Permisos.",
      attendance: "Abriendo Asistencia.",
      recruitment: "Abriendo Selección y Contratación.",
      performance: "Abriendo Rendimiento.",
      learning: "Abriendo Aprendizaje y Formación.",
      experience: "Abriendo Experiencia del Empleado.",
      team: "Abriendo Directorio del Equipo.",
      dashboard: "Abriendo Panel de Control.",
      settings: "Abriendo Configuración."
    },
    keywords: {
      payroll: ["nómina", "salario", "sueldo", "recibo"],
      leaves: ["permiso", "vacaciones", "ausencia", "baja"],
      attendance: ["asistencia", "fichar", "horario", "turno"],
      recruitment: ["selección", "contratación", "candidato", "empleo"],
      performance: ["rendimiento", "objetivo", "evaluación", "desempeño"],
      learning: ["aprendizaje", "curso", "formación", "capacitación", "habilidad"],
      experience: ["experiencia", "bienestar", "salud"],
      team: ["equipo", "directorio", "compañeros", "gente"],
      dashboard: ["panel", "consola", "inicio"],
      settings: ["configuración", "seguridad", "perfil"]
    }
  },
  fr: {
    greeting: "Comment puis-je vous aider à naviguer dans l'espace de travail ?",
    fallback: "Demandez-moi d'ouvrir un module tel que Paie, Congés, Présence ou Performance.",
    replies: {
      payroll: "Ouverture de la Paie.",
      leaves: "Ouverture de la Gestion des Congés.",
      attendance: "Ouverture des Présences.",
      recruitment: "Ouverture du Recrutement.",
      performance: "Ouverture de la Performance.",
      learning: "Ouverture de la Formation.",
      experience: "Ouverture de l'Expérience Collaborateur.",
      team: "Ouverture de l'Annuaire d'Équipe.",
      dashboard: "Ouverture du Tableau de Bord.",
      settings: "Ouverture des Paramètres."
    },
    keywords: {
      payroll: ["paie", "salaire", "bulletin", "rémunération"],
      leaves: ["congé", "vacances", "absence", "rtt"],
      attendance: ["présence", "pointage", "horaire", "shift"],
      recruitment: ["recrutement", "candidat", "poste", "embauche"],
      performance: ["performance", "objectif", "évaluation"],
      learning: ["formation", "cours", "apprentissage", "compétence"],
      experience: ["expérience", "bien-être", "santé"],
      team: ["équipe", "annuaire", "collègue"],
      dashboard: ["tableau de bord", "accueil"],
      settings: ["paramètres", "sécurité", "profil"]
    }
  },
  de: {
    greeting: "Wie kann ich Ihnen bei der Navigation im Arbeitsbereich helfen?",
    fallback: "Bitten Sie mich, ein Modul wie Gehaltsabrechnung, Urlaub, Anwesenheit oder Leistung zu öffnen.",
    replies: {
      payroll: "Gehaltsabrechnung wird geöffnet.",
      leaves: "Urlaubsverwaltung wird geöffnet.",
      attendance: "Anwesenheit wird geöffnet.",
      recruitment: "Personalbeschaffung wird geöffnet.",
      performance: "Leistungsmanagement wird geöffnet.",
      learning: "Lern- und Schulungsportal wird geöffnet.",
      experience: "Mitarbeitererfahrung wird geöffnet.",
      team: "Teamverzeichnis wird geöffnet.",
      dashboard: "Dashboard wird geöffnet.",
      settings: "Einstellungen werden geöffnet."
    },
    keywords: {
      payroll: ["gehalt", "lohn", "abrechnung", "vergütung"],
      leaves: ["urlaub", "abwesenheit", "freizeit"],
      attendance: ["anwesenheit", "stempeluhr", "schicht", "zeiterfassung"],
      recruitment: ["recruiting", "bewerbung", "kandidat", "einstellung"],
      performance: ["leistung", "ziel", "beurteilung", "performance"],
      learning: ["lernen", "kurs", "schulung", "training", "kompetenz"],
      experience: ["erfahrung", "wohlbefinden", "kultur"],
      team: ["team", "verzeichnis", "kollegen"],
      dashboard: ["dashboard", "übersicht"],
      settings: ["einstellungen", "sicherheit", "profil"]
    }
  },
  ja: {
    greeting: "ワークスペースのナビゲーションをどのようにお手伝いしましょうか？",
    fallback: "給与、休暇、勤怠、パフォーマンスなどのモジュールを開くようお尋ねください。",
    replies: {
      payroll: "給与計算を開いています。",
      leaves: "休暇管理を開いています。",
      attendance: "勤怠管理を開いています。",
      recruitment: "採用管理を開いています。",
      performance: "評価管理を開いています。",
      learning: "学習・研修を開いています。",
      experience: "従業員体験を開いています。",
      team: "チーム名簿を開いています。",
      dashboard: "ダッシュボードを開いています。",
      settings: "設定を開いています。"
    },
    keywords: {
      payroll: ["給与", "賞与", "賃金", "給与明細"],
      leaves: ["休暇", "有休", "有給", "休み"],
      attendance: ["勤怠", "出勤", "打刻", "シフト"],
      recruitment: ["採用", "応募者", "求人", "選考"],
      performance: ["評価", "目標", "パフォーマンス"],
      learning: ["学習", "コース", "研修", "トレーニング", "スキル"],
      experience: ["体験", "ウェルビーイング", "健康"],
      team: ["チーム", "社員名簿", "同僚"],
      dashboard: ["ダッシュボード", "ホーム"],
      settings: ["設定", "セキュリティ", "権限"]
    }
  },
  ar: {
    greeting: "كيف يمكنني مساعدتك في التنقل في مساحة العمل؟",
    fallback: "اطلب مني فتح وحدات مثل الرواتب أو الإجازات أو الحضور أو الأداء.",
    replies: {
      payroll: "جارٍ فتح الرواتب.",
      leaves: "جارٍ فتح إدارة الإجازات.",
      attendance: "جارٍ فتح الحضور.",
      recruitment: "جارٍ فتح التوظيف.",
      performance: "جارٍ فتح تقييم الأداء.",
      learning: "جارٍ فتح التدريب والتعلم.",
      experience: "جارٍ فتح تجربة الموظف.",
      team: "جارٍ فتح دليل الفريق.",
      dashboard: "جارٍ فتح لوحة التحكم.",
      settings: "جارٍ فتح الإعدادات."
    },
    keywords: {
      payroll: ["رواتب", "راتب", "أجور", "قسيمة"],
      leaves: ["إجازة", "عطلة", "غياب"],
      attendance: ["حضور", "دوام", "بصمة", "وردية"],
      recruitment: ["توظيف", "مرشح", "وظيفة"],
      performance: ["أداء", "أهداف", "تقييم"],
      learning: ["تدريب", "تعلم", "دورة", "مهارة"],
      experience: ["تجربة", "رفاهية", "صحة"],
      team: ["فريق", "دليل", "زملاء"],
      dashboard: ["لوحة التحكم", "الرئيسية"],
      settings: ["إعدادات", "أمان", "ملف"]
    }
  }
};

for (const [locale, data] of Object.entries(ASSISTANT_TRANSLATIONS)) {
  const targetFile = path.join(LOCALES_DIR, locale, 'assistant.json');
  fs.writeFileSync(targetFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`Generated ${targetFile}`);
}
console.log('All 11 assistant.json locale files generated successfully.');
