// lib/i18n.ts
// Platform-wide i18n — minimal critical labels only.
// Full sentence-level translation is a future Phase J item.
//
// Supported languages: en, hi, te, ta, kn, mr (Marathi added)
// Scope:
//   - Navigation labels for all user-facing portals
//   - Form labels for common fields
//   - Status labels
//   - Error messages (key ones)
//
// Usage:
//   import { t, Lang } from '@/lib/i18n';
//   const label = t('students', lang);

export type Lang = 'en' | 'hi' | 'te' | 'ta' | 'kn' | 'mr';
export const SUPPORTED_LANGS: { code: Lang; label: string; nativeName: string }[] = [
  { code: 'en', label: 'English',   nativeName: 'English' },
  { code: 'hi', label: 'Hindi',     nativeName: 'हिंदी' },
  { code: 'te', label: 'Telugu',    nativeName: 'తెలుగు' },
  { code: 'ta', label: 'Tamil',     nativeName: 'தமிழ்' },
  { code: 'kn', label: 'Kannada',   nativeName: 'ಕನ್ನಡ' },
  { code: 'mr', label: 'Marathi',   nativeName: 'मराठी' },
];

type TranslationMap = Record<string, Record<Lang, string>>;

const LABELS: TranslationMap = {
  // Navigation
  dashboard:       { en:'Dashboard',      hi:'डैशबोर्ड',    te:'డాష్‌బోర్డ్',  ta:'டாஷ்போர்டு', kn:'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್', mr:'डॅशबोर्ड' },
  students:        { en:'Students',        hi:'छात्र',         te:'విద్యార్థులు', ta:'மாணவர்கள்',   kn:'ವಿದ್ಯಾರ್ಥಿಗಳು',  mr:'विद्यार्थी' },
  staff:           { en:'Staff',           hi:'स्टाफ',         te:'సిబ్బంది',     ta:'ஊழியர்கள்',   kn:'ಸಿಬ್ಬಂದಿ',        mr:'कर्मचारी' },
  parents:         { en:'Parents',         hi:'अभिभावक',       te:'తల్లిదండ్రులు',ta:'பெற்றோர்',    kn:'ಪೋಷಕರು',          mr:'पालक' },
  attendance:      { en:'Attendance',      hi:'उपस्थिति',      te:'హాజరు',        ta:'வருகை',        kn:'ಹಾಜರಾತಿ',         mr:'उपस्थिती' },
  fees:            { en:'Fees',            hi:'शुल्क',          te:'ఫీజులు',       ta:'கட்டணம்',      kn:'ಶುಲ್ಕ',           mr:'शुल्क' },
  homework:        { en:'Homework',        hi:'गृहकार्य',       te:'ఇంటిపని',      ta:'இல்லப்படி',    kn:'ಮನೆಗೆಲಸ',          mr:'गृहपाठ' },
  reports:         { en:'Reports',         hi:'रिपोर्ट',        te:'నివేదికలు',    ta:'அறிக்கைகள்',   kn:'ವರದಿಗಳು',          mr:'अहवाल' },
  timetable:       { en:'Timetable',       hi:'समय-सारिणी',    te:'సమయపట్టిక',   ta:'நேர அட்டவணை',  kn:'ಸಮಯ ಪಟ್ಟಿ',       mr:'वेळापत्रक' },
  exams:           { en:'Exams',           hi:'परीक्षाएं',      te:'పరీక్షలు',     ta:'தேர்வுகள்',    kn:'ಪರೀಕ್ಷೆಗಳು',       mr:'परीक्षा' },
  marks:           { en:'Marks',           hi:'अंक',            te:'మార్కులు',     ta:'மதிப்பெண்கள்', kn:'ಅಂಕಗಳು',           mr:'गुण' },
  library:         { en:'Library',         hi:'पुस्तकालय',      te:'గ్రంథాలయం',   ta:'நூலகம்',       kn:'ಗ್ರಂಥಾಲಯ',         mr:'ग्रंथालय' },
  hostel:          { en:'Hostel',          hi:'छात्रावास',      te:'హాస్టల్',      ta:'விடுதி',       kn:'ಹಾಸ್ಟೆಲ್',         mr:'वसतिगृह' },
  transport:       { en:'Transport',       hi:'परिवहन',         te:'రవాణా',        ta:'போக்குவரத்து',  kn:'ಸಾರಿಗೆ',           mr:'वाहतूक' },
  placement:       { en:'Placement',       hi:'प्लेसमेंट',      te:'ప్లేస్‌మెంట్', ta:'வேலைவாய்ப்பு', kn:'ಪ್ಲೇಸ್‌ಮೆಂಟ್',     mr:'प्लेसमेंट' },
  complaints:      { en:'Complaints',      hi:'शिकायतें',       te:'ఫిర్యాదులు',   ta:'புகார்கள்',    kn:'ದೂರುಗಳು',          mr:'तक्रारी' },
  announcements:   { en:'Announcements',   hi:'सूचनाएं',        te:'ప్రకటనలు',    ta:'அறிவிப்புகள்', kn:'ಪ್ರಕಟಣೆಗಳು',       mr:'सूचना' },
  settings:        { en:'Settings',        hi:'सेटिंग्स',       te:'సెట్టింగ్‌లు',ta:'அமைப்புகள்',  kn:'ಸೆಟ್ಟಿಂಗ್‌ಗಳು',   mr:'सेटिंग्ज' },
  logout:          { en:'Log out',         hi:'लॉग आउट',        te:'లాగ్ అవుట్',  ta:'வெளியேறு',     kn:'ಲಾಗ್ ಔಟ್',         mr:'लॉग आउट' },

  // Forms
  name:            { en:'Name',            hi:'नाम',            te:'పేరు',         ta:'பெயர்',        kn:'ಹೆಸರು',            mr:'नाव' },
  email:           { en:'Email',           hi:'ईमेल',           te:'ఇమెయిల్',     ta:'மின்னஞ்சல்',   kn:'ಇಮೇಲ್',            mr:'ईमेल' },
  phone:           { en:'Phone',           hi:'फोन',            te:'ఫోన్',         ta:'தொலைபேசி',     kn:'ಫೋನ್',             mr:'फोन' },
  class:           { en:'Class',           hi:'कक्षा',           te:'తరగతి',        ta:'வகுப்பு',      kn:'ತರಗತಿ',             mr:'वर्ग' },
  section:         { en:'Section',         hi:'सेक्शन',          te:'విభాగం',       ta:'பிரிவு',       kn:'ವಿಭಾಗ',             mr:'विभाग' },
  department:      { en:'Department',      hi:'विभाग',           te:'విభాగం',       ta:'துறை',         kn:'ವಿಭಾಗ',             mr:'विभाग' },
  batch:           { en:'Batch',           hi:'बैच',             te:'బ్యాచ్',       ta:'தொகுதி',       kn:'ಬ್ಯಾಚ್',            mr:'बॅच' },
  save:            { en:'Save',            hi:'सहेजें',          te:'సేవ్ చేయి',   ta:'சேமி',         kn:'ಉಳಿಸು',             mr:'जतन करा' },
  cancel:          { en:'Cancel',          hi:'रद्द करें',       te:'రద్దు చేయి',  ta:'ரத்து செய்',   kn:'ರದ್ದು ಮಾಡು',       mr:'रद्द करा' },
  submit:          { en:'Submit',          hi:'जमा करें',        te:'సమర్పించు',    ta:'சமர்ப்பி',     kn:'ಸಲ್ಲಿಸು',           mr:'सादर करा' },
  search:          { en:'Search',          hi:'खोजें',           te:'వెతకండి',      ta:'தேடு',         kn:'ಹುಡುಕು',            mr:'शोधा' },
  loading:         { en:'Loading...',      hi:'लोड हो रहा है...', te:'లోడ్ అవుతోంది...', ta:'ஏற்றுகிறது...', kn:'ಲೋಡ್ ಆಗುತ್ತಿದೆ...', mr:'लोड होत आहे...' },
  error:           { en:'Something went wrong. Please try again.', hi:'कुछ गलत हुआ। कृपया पुनः प्रयास करें।', te:'ఏదో తప్పు జరిగింది.', ta:'ஏதோ தவறு நடந்தது.', kn:'ಏನೋ ತಪ್ಪಾಯಿತು.', mr:'काहीतरी चूक झाली.' },
  no_data:         { en:'No records found.',hi:'कोई रिकॉर्ड नहीं मिला।', te:'రికార్డులు కనుగొనబడలేదు.', ta:'பதிவுகள் இல்லை.', kn:'ದಾಖಲೆಗಳು ಕಂಡುಬಂದಿಲ್ಲ.', mr:'कोणतेही नोंदी सापडल्या नाहीत.' },

  // Status
  active:          { en:'Active',          hi:'सक्रिय',          te:'చురుకుగా',     ta:'செயலில்',      kn:'ಸಕ್ರಿಯ',            mr:'सक्रिय' },
  inactive:        { en:'Inactive',        hi:'निष्क्रिय',        te:'నిష్క్రియంగా', ta:'செயலற்ற',      kn:'ನಿಷ್ಕ್ರಿಯ',         mr:'निष्क्रिय' },
  pending:         { en:'Pending',         hi:'लंबित',            te:'పెండింగ్',     ta:'நிலுவையில்',   kn:'ಬಾಕಿ',              mr:'प्रलंबित' },
  paid:            { en:'Paid',            hi:'भुगतान किया',      te:'చెల్లించారు',  ta:'செலுத்தப்பட்டது', kn:'ಪಾವತಿ ಮಾಡಲಾಗಿದೆ', mr:'भरले' },
};

/**
 * Get a translated label.
 * Falls back to English if the key or language is not found.
 */
export function t(key: string, lang: Lang = 'en'): string {
  return LABELS[key]?.[lang] ?? LABELS[key]?.['en'] ?? key;
}

/**
 * Get the user's preferred language from various sources.
 * Falls back to 'en'.
 */
export function getLang(langPref?: string | null): Lang {
  const supported = new Set<string>(['en','hi','te','ta','kn','mr']);
  if (langPref && supported.has(langPref)) return langPref as Lang;
  return 'en';
}

// Re-export parent labels for backwards compatibility
export type { Lang as ParentLang };
