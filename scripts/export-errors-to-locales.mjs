/**
 * Export localized errors dictionary across all 11 supported locales:
 * en, hi, mr, ta, te, bn, es, fr, de, ja, ar
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localesDir = path.resolve(__dirname, '../src/locales');

const ERRORS_BY_LOCALE = {
  en: {
    something_wrong: "Something Went Wrong",
    something_wrong_desc: "An unexpected error occurred while rendering this interface. Our systems have logged the event. You can attempt to retry the current action or return to the workspace home.",
    app_error: "Application Error",
    system_error: "System Error",
    app_failure: "Application Failure",
    app_failure_desc: "A fatal error occurred in the core framework layout. Nucleus diagnostic telemetry has captured this state. Please restart or reload the session.",
    retry_recovery: "Retry Recovery",
    return_home: "Return to Home",
    page_not_found: "Page Not Found",
    page_not_found_desc: "The requested interface route could not be located in this enterprise build.",
    forbidden: "Access Restricted",
    forbidden_desc: "You do not have the required role or authorization to access this view."
  },
  hi: {
    something_wrong: "कुछ गलत हो गया",
    something_wrong_desc: "इस इंटरफ़ेस को रेंडर करते समय एक अप्रत्याशित त्रुटि उत्पन्न हुई। आप वर्तमान क्रिया को पुनः आज़मा सकते हैं या कार्यक्षेत्र पर वापस जा सकते हैं।",
    app_error: "एप्लिकेशन त्रुटि",
    system_error: "सिस्टम त्रुटि",
    app_failure: "एप्लिकेशन विफलता",
    app_failure_desc: "कोर फ्रेमवर्क लेआउट में एक गंभीर त्रुटि उत्पन्न हुई। कृपया सत्र को पुनः लोड करें।",
    retry_recovery: "पुनः प्रयास करें",
    return_home: "होम पर लौटें",
    page_not_found: "पृष्ठ नहीं मिला",
    page_not_found_desc: "अनुरोधित इंटरफ़ेस मार्ग इस एंटरप्राइज़ बिल्ड में नहीं मिल सका।",
    forbidden: "पहुँच प्रतिबंधित",
    forbidden_desc: "आपके पास इस दृश्य तक पहुँचने के लिए आवश्यक भूमिका या प्राधिकरण नहीं है।"
  },
  mr: {
    something_wrong: "काहीतरी चूक झाली",
    something_wrong_desc: "हा इंटरफेस रेंडर करताना अनपेक्षित त्रुटी आली. आपण सध्याची क्रिया पुन्हा करून पाहू शकता किंवा वर्कस्पेसवर परत जाऊ शकता.",
    app_error: "अनुप्रयोग त्रुटी",
    system_error: "प्रणाली त्रुटी",
    app_failure: "अनुप्रयोग अपयश",
    app_failure_desc: "कोर फ्रेमवर्क लेआउटमध्ये गंभीर त्रुटी आली. कृपया सत्र रीलोड करा.",
    retry_recovery: "पुन्हा प्रयत्न करा",
    return_home: "मुख्यपृष्ठावर जा",
    page_not_found: "पृष्ठ आढळले नाही",
    page_not_found_desc: "विनंती केलेला मार्ग उपलब्ध नाही.",
    forbidden: "प्रवेश प्रतिबंधित",
    forbidden_desc: "आपल्याकडे या दृश्यात प्रवेश करण्यासाठी आवश्यक अधिकार नाहीत."
  },
  ta: {
    something_wrong: "ஏதோ தவறு நடந்துவிட்டது",
    something_wrong_desc: "இந்த இடைமுகத்தை ரெண்டர் செய்யும் போது எதிர்பாராத பிழை ஏற்பட்டது. நீங்கள் செயலை மீண்டும் முயற்சி செய்யலாம் அல்லது பணியிடத்திற்கு திரும்பலாம்.",
    app_error: "செயலி பிழை",
    system_error: "அமைப்பு பிழை",
    app_failure: "செயலி தோல்வி",
    app_failure_desc: "முக்கிய கட்டமைப்பு அமைப்பில் முக்கியமான பிழை ஏற்பட்டது. அமர்வை மீண்டும் ஏற்றவும்.",
    retry_recovery: "மீண்டும் முயற்சிக்கவும்",
    return_home: "முகப்புக்குத் திரும்பு",
    page_not_found: "பக்கம் கிடைக்கவில்லை",
    page_not_found_desc: "கோரப்பட்ட பாதை கிடைக்கவில்லை.",
    forbidden: "அணுகல் தடைசெய்யப்பட்டுள்ளது",
    forbidden_desc: "இந்த பார்வையை அணுக உங்களுக்கு தேவையான அனுமதி இல்லை."
  },
  te: {
    something_wrong: "ఏదో తప్పు జరిగింది",
    something_wrong_desc: "ఈ ఇంటర్‌ఫేస్‌ను ప్రదర్శించేటప్పుడు ఊహించని లోపం సంభవించింది. మీరు మళ్లీ ప్రయత్నించవచ్చు లేదా వర్క్‌స్పేస్‌కి తిరిగి వెళ్లవచ్చు.",
    app_error: "అప్లికేషన్ లోపం",
    system_error: "సిస్టమ్ లోపం",
    app_failure: "అప్లికేషన్ వైఫల్యం",
    app_failure_desc: "కోర్ ఫ్రేమ్‌వర్క్ లేఅవుట్‌లో తీవ్రమైన లోపం సంభవించింది. దయచేసి సెషన్‌ను మళ్లీ లోడ్ చేయండి.",
    retry_recovery: "మళ్లీ ప్రయత్నించండి",
    return_home: "హోమ్‌కు తిరిగి వెళ్లండి",
    page_not_found: "పేజీ కనుగొనబడలేదు",
    page_not_found_desc: "అభ్యర్థించిన మార్గం అందుబాటులో లేదు.",
    forbidden: "ప్రాప్యత పరిమితం",
    forbidden_desc: "ఈ వీక్షణను యాక్సెస్ చేయడానికి మీకు అనుమతి లేదు."
  },
  bn: {
    something_wrong: "কিছু ভুল হয়েছে",
    something_wrong_desc: "এই ইন্টারফেসটি রেন্ডার করার সময় একটি অপ্রত্যাশিত ত্রুটি ঘটেছে। আপনি পুনরায় চেষ্টা করতে পারেন বা ওয়ার্কস্পেসে ফিরে যেতে পারেন।",
    app_error: "অ্যাপ্লিকেশন ত্রুটি",
    system_error: "সিস্টেম ত্রুটি",
    app_failure: "অ্যাপ্লিকেশন ব্যর্থতা",
    app_failure_desc: "কোর ফ্রেমওয়ার্ক লেআউটে একটি মারাত্মক ত্রুটি ঘটেছে। অনুগ্রহ করে সেশনটি পুনরায় লোড করুন।",
    retry_recovery: "পুনরায় চেষ্টা করুন",
    return_home: "হোমে ফিরে যান",
    page_not_found: "পৃষ্ঠা পাওয়া যায়নি",
    page_not_found_desc: "অনুরোধ করা ইন্টারফেস রুট খুঁজে পাওয়া যায়নি।",
    forbidden: "প্রবেশাধিকার নিষিদ্ধ",
    forbidden_desc: "আপনার এই পৃষ্ঠাটি দেখার জন্য প্রয়োজনীয় অনুমতি নেই।"
  },
  es: {
    something_wrong: "Algo salió mal",
    something_wrong_desc: "Ocurrió un error inesperado al renderizar esta interfaz. Puede intentar nuevamente o regresar al espacio de trabajo.",
    app_error: "Error de la aplicación",
    system_error: "Error del sistema",
    app_failure: "Fallo de la aplicación",
    app_failure_desc: "Ocurrió un error fatal en el diseño del marco principal. Reinicie o recargue la sesión.",
    retry_recovery: "Reintentar recuperación",
    return_home: "Volver al inicio",
    page_not_found: "Página no encontrada",
    page_not_found_desc: "No se pudo localizar la ruta solicitada en esta compilación.",
    forbidden: "Acceso restringido",
    forbidden_desc: "No tiene los permisos requeridos para acceder a esta vista."
  },
  fr: {
    something_wrong: "Un problème est survenu",
    something_wrong_desc: "Une erreur inattendue est survenue lors de l'affichage de cette interface. Vous pouvez réessayer ou revenir à l'espace de travail.",
    app_error: "Erreur de l'application",
    system_error: "Erreur système",
    app_failure: "Échec de l'application",
    app_failure_desc: "Une erreur fatale est survenue dans la structure principale. Veuillez redémarrer ou recharger la session.",
    retry_recovery: "Réessayer la récupération",
    return_home: "Retour à l'accueil",
    page_not_found: "Page non trouvée",
    page_not_found_desc: "L'itinéraire d'interface demandé est introuvable.",
    forbidden: "Accès restreint",
    forbidden_desc: "Vous n'avez pas l'autorisation nécessaire pour accéder à cette vue."
  },
  de: {
    something_wrong: "Etwas ist schiefgelaufen",
    something_wrong_desc: "Beim Rendern dieser Benutzeroberfläche ist ein unerwarteter Fehler aufgetreten. Sie können es erneut versuchen oder zum Arbeitsbereich zurückkehren.",
    app_error: "Anwendungsfehler",
    system_error: "Systemfehler",
    app_failure: "Anwendungsausfall",
    app_failure_desc: "Im Kernframework-Layout ist ein schwerwiegender Fehler aufgetreten. Bitte laden Sie die Sitzung neu.",
    retry_recovery: "Wiederherstellung versuchen",
    return_home: "Zurück zur Startseite",
    page_not_found: "Seite nicht gefunden",
    page_not_found_desc: "Die angeforderte Route konnte nicht gefunden werden.",
    forbidden: "Zugriff eingeschränkt",
    forbidden_desc: "Sie verfügen nicht über die erforderliche Berechtigung für diese Ansicht."
  },
  ja: {
    something_wrong: "問題が発生しました",
    something_wrong_desc: "このインターフェースの描画中に予期しないエラーが発生しました。再試行するか、ワークスペースのホームに戻ることができます。",
    app_error: "アプリケーションエラー",
    system_error: "システムエラー",
    app_failure: "アプリケーション障害",
    app_failure_desc: "コアフレームワークレイアウトで致命的なエラーが発生しました。セッションを再読み込みしてください。",
    retry_recovery: "再試行して回復",
    return_home: "ホームに戻る",
    page_not_found: "ページが見つかりません",
    page_not_found_desc: "要求されたルートは見つかりませんでした。",
    forbidden: "アクセス制限",
    forbidden_desc: "このビューにアクセスする権限がありません。"
  },
  ar: {
    something_wrong: "حدث خطأ ما",
    something_wrong_desc: "حدث خطأ غير متوقع أثناء معالجة هذه الواجهة. يمكنك المحاولة مرة أخرى أو العودة إلى مساحة العمل.",
    app_error: "خطأ في التطبيق",
    system_error: "خطأ في النظام",
    app_failure: "فشل التطبيق",
    app_failure_desc: "حدث خطأ فادح في تخطيط إطار العمل الأساسي. يرجى إعادة تحميل الجلسة.",
    retry_recovery: "إعادة محاولة الاسترداد",
    return_home: "العودة إلى الصفحة الرئيسية",
    page_not_found: "الصفحة غير موجودة",
    page_not_found_desc: "تعذر العثور على المسار المطلوب في هذا النظام.",
    forbidden: "الوصول مقيد",
    forbidden_desc: "ليس لديك الصلاحيات اللازمة للوصول إلى هذا العرض."
  }
};

for (const [loc, dict] of Object.entries(ERRORS_BY_LOCALE)) {
  const locDir = path.join(localesDir, loc);
  if (!fs.existsSync(locDir)) continue;

  const errorsFilePath = path.join(locDir, 'errors.json');
  fs.writeFileSync(errorsFilePath, JSON.stringify(dict, null, 2), 'utf-8');

  // Update index.ts to include errors
  const indexFile = path.join(locDir, 'index.ts');
  if (fs.existsSync(indexFile)) {
    let content = fs.readFileSync(indexFile, 'utf-8');
    if (!content.includes('errors.json')) {
      content = "import errors from './errors.json';\n" + content;
      content = content.replace(
        new RegExp(`export const ${loc} = \\{([\\s\\S]*?)\\};`),
        (match, p1) => {
          return `export const ${loc} = {${p1}  errors,\n};`;
        }
      );
      fs.writeFileSync(indexFile, content, 'utf-8');
    }
  }
}

console.log('Successfully created errors.json across all 11 locales and wired index.ts.');
