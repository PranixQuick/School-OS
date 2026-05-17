// lib/i18n.ts
// Platform-wide i18n for EdProSys — admin, teacher, student key labels
// Supports: English, Hindi, Telugu, Tamil, Kannada, Marathi, Malayalam
// Real India workflow: 70% of institutions need Hindi or regional language support
// Usage: import { T, Lang } from '@/lib/i18n'; const label = T('students', lang);

export type Lang = 'en' | 'hi' | 'te' | 'ta' | 'kn' | 'mr' | 'ml';

export const LANG_LABELS: Record<Lang, string> = {
  en: 'English',
  hi: 'हिन्दी',
  te: 'తెలుగు',
  ta: 'தமிழ்',
  kn: 'ಕನ್ನಡ',
  mr: 'मराठी',
  ml: 'മലയാളം',
};

// Core navigation and action labels used across the platform
const STRINGS: Record<string, Partial<Record<Lang, string>>> = {
  // Navigation
  dashboard: { hi: 'डैशबोर्ड', te: 'డాష్‌బోర్డ్', ta: 'டாஷ்போர்டு', kn: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್', mr: 'डॅशबोर्ड', ml: 'ഡാഷ്‌ബോർഡ്' },
  students: { hi: 'छात्र', te: 'విద్యార్థులు', ta: 'மாணவர்கள்', kn: 'ವಿದ್ಯಾರ್ಥಿಗಳು', mr: 'विद्यार्थी', ml: 'വിദ്യാർത്ഥികൾ' },
  staff: { hi: 'स्टाफ', te: 'సిబ్బంది', ta: 'ஊழியர்கள்', kn: 'ಸಿಬ್ಬಂದಿ', mr: 'कर्मचारी', ml: 'ജീവനക്കാർ' },
  parents: { hi: 'अभिभावक', te: 'తల్లిదండ్రులు', ta: 'பெற்றோர்கள்', kn: 'ಪಾಲಕರು', mr: 'पालक', ml: 'രക്ഷിതാക്കൾ' },
  fees: { hi: 'शुल्क', te: 'రుసుము', ta: 'கட்டணம்', kn: 'ಶುಲ್ಕ', mr: 'शुल्क', ml: 'ഫീസ്' },
  attendance: { hi: 'उपस्थिति', te: 'హాజరు', ta: 'வருகை', kn: 'ಹಾಜರಾತಿ', mr: 'उपस्थिती', ml: 'ഹാജർ' },
  homework: { hi: 'गृहकार्य', te: 'హోమ్‌వర్క్', ta: 'வீட்டுப்பாடம்', kn: 'ಗೃಹಕಾರ್ಯ', mr: 'गृहपाठ', ml: 'ഗൃഹപ്പണി' },
  library: { hi: 'पुस्तकालय', te: 'గ్రంథాలయం', ta: 'நூலகம்', kn: 'ಗ್ರಂಥಾಲಯ', mr: 'ग्रंथालय', ml: 'ലൈബ്രറി' },
  hostel: { hi: 'छात्रावास', te: 'హాస్టల్', ta: 'விடுதி', kn: 'ವಸತಿ ನಿಲಯ', mr: 'वसतिगृह', ml: 'ഹോസ്റ്റൽ' },
  departments: { hi: 'विभाग', te: 'విభాగాలు', ta: 'துறைகள்', kn: 'ವಿಭಾಗಗಳು', mr: 'विभाग', ml: 'വകുപ്പുകൾ' },
  batches: { hi: 'बैच', te: 'బ్యాచ్‌లు', ta: 'தொகுதிகள்', kn: 'ತಂಡಗಳು', mr: 'बॅच', ml: 'ബാച്ചുകൾ' },
  placement: { hi: 'प्लेसमेंट', te: 'ప్లేస్‌మెంట్', ta: 'வேலைவாய்ப்பு', kn: 'ಉದ್ಯೋಗ ನಿಯೋಜನೆ', mr: 'प्लेसमेंट', ml: 'പ്ലേസ്‌മെന്റ്' },
  vendors: { hi: 'विक्रेता', te: 'విక్రేతలు', ta: 'விற்பனையாளர்கள்', kn: 'ಮಾರಾಟಗಾರರು', mr: 'विक्रेते', ml: 'വെൻഡർമാർ' },
  settings: { hi: 'सेटिंग्स', te: 'సెట్టింగ్‌లు', ta: 'அமைப்புகள்', kn: 'ಸೆಟ್ಟಿಂಗ್‌ಗಳು', mr: 'सेटिंग्ज', ml: 'ക്രമീകരണങ്ങൾ' },
  // Actions
  save: { hi: 'सहेजें', te: 'సేవ్ చేయి', ta: 'சேமி', kn: 'ಉಳಿಸು', mr: 'जतन करा', ml: 'സേവ് ചെയ്യുക' },
  cancel: { hi: 'रद्द करें', te: 'రద్దు', ta: 'ரத்து', kn: 'ರದ್ದು', mr: 'रद्द करा', ml: 'റദ്ദാക്കുക' },
  search: { hi: 'खोजें', te: 'వెతుకు', ta: 'தேடு', kn: 'ಹುಡುಕಿ', mr: 'शोधा', ml: 'തിരയുക' },
  add: { hi: 'जोड़ें', te: 'జోడించు', ta: 'சேர்', kn: 'ಸೇರಿಸಿ', mr: 'जोडा', ml: 'ചേർക്കുക' },
  edit: { hi: 'संपादित करें', te: 'సవరించు', ta: 'திருத்து', kn: 'ಸಂಪಾದಿಸಿ', mr: 'संपादित करा', ml: 'എഡിറ്റ് ചെയ്യുക' },
  delete_: { hi: 'हटाएं', te: 'తొలగించు', ta: 'நீக்கு', kn: 'ಅಳಿಸಿ', mr: 'हटवा', ml: 'ഇല്ലാതാക്കുക' },
  active: { hi: 'सक्रिय', te: 'చురుకైన', ta: 'செயலில்', kn: 'ಸಕ್ರಿಯ', mr: 'सक्रिय', ml: 'സജീവ' },
  inactive: { hi: 'निष्क्रिय', te: 'నిష్క్రియ', ta: 'செயலற்ற', kn: 'ನಿಷ್ಕ್ರಿಯ', mr: 'निष्क्रिय', ml: 'നിഷ്‌ക്രിയ' },
  // Status
  present: { hi: 'उपस्थित', te: 'హాజరు', ta: 'இருக்கிறார்', kn: 'ಹಾಜರು', mr: 'उपस्थित', ml: 'ഹാജർ' },
  absent: { hi: 'अनुपस्थित', te: 'గైర్హాజరు', ta: 'இல்லை', kn: 'ಗೈರು', mr: 'अनुपस्थित', ml: 'ഹാജരില്ല' },
  pending: { hi: 'लंबित', te: 'పెండింగ్', ta: 'நிலுவை', kn: 'ಬಾಕಿ', mr: 'प्रलंबित', ml: 'തീർപ്പാക്കാത്ത' },
  paid: { hi: 'भुगतान किया', te: 'చెల్లించారు', ta: 'கட்டணம் செலுத்தப்பட்டது', kn: 'ಪಾವತಿಸಲಾಗಿದೆ', mr: 'पैसे भरले', ml: 'അടച്ചു' },
  // Portal labels
  announcements: { hi: 'घोषणाएं', te: 'ప్రకటనలు', ta: 'அறிவிப்புகள்', kn: 'ಪ್ರಕಟಣೆಗಳು', mr: 'घोषणा', ml: 'അറിയിപ്പുകൾ' },
  transport: { hi: 'परिवहन', te: 'రవాణా', ta: 'போக்குவரத்து', kn: 'ಸಾರಿಗೆ', mr: 'वाहतूक', ml: 'ഗതാഗതം' },
  complaints: { hi: 'शिकायतें', te: 'ఫిర్యాదులు', ta: 'புகார்கள்', kn: 'ದೂರುಗಳು', mr: 'तक्रारी', ml: 'പരാതികൾ' },
  reports: { hi: 'रिपोर्ट', te: 'నివేదికలు', ta: 'அறிக்கைகள்', kn: 'ವರದಿಗಳು', mr: 'अहवाल', ml: 'റിപ്പോർട്ടുകൾ' },
  ptm: { hi: 'अभिभावक-शिक्षक बैठक', te: 'తల్లిదండ్రుల-ఉపాధ్యాయ సమావేశం', ta: 'பெற்றோர்-ஆசிரியர் கூட்டம்', kn: 'ಪಾಲಕ-ಶಿಕ್ಷಕ ಸಭೆ', mr: 'पालक-शिक्षक बैठक', ml: 'രക്ഷിതാവ്-അദ്ധ്യാപക യോഗം' },
  // School types
  school: { hi: 'विद्यालय', te: 'పాఠశాల', ta: 'பள்ளி', kn: 'ಶಾಲೆ', mr: 'शाळा', ml: 'സ്കൂൾ' },
  college: { hi: 'महाविद्यालय', te: 'కళాశాల', ta: 'கல்லூரி', kn: 'ಕಾಲೇಜು', mr: 'महाविद्यालय', ml: 'കോളേജ്' },
};

// Main translation function — falls back to English if key not found
export function T(key: string, lang: Lang): string {
  if (lang === 'en' || !STRINGS[key]) return key;
  return STRINGS[key]?.[lang] ?? STRINGS[key]?.['en'] ?? key;
}

// Helper to get all languages for a selector
export const SUPPORTED_LANGS: Lang[] = ['en', 'hi', 'te', 'ta', 'kn', 'mr', 'ml'];
