// lib/i18n-admin.ts
// Platform-wide key label translations for admin/teacher/student interfaces
// Scope: sidebar nav, page titles, common action labels, status words
// Languages: English (default), Hindi, Telugu, Tamil, Kannada
// Strategy: label-only, not full sentence translation — keeps bundle small
// Usage: import { t, AdminLang } from '@/lib/i18n-admin'; then t('students', lang)

export type AdminLang = 'en' | 'hi' | 'te' | 'ta' | 'kn';

export const ADMIN_LABELS: Record<string, Record<AdminLang, string>> = {
  // Navigation
  dashboard:        { en: 'Dashboard',        hi: 'डैशबोर्ड',       te: 'డాష్‌బోర్డ్',    ta: 'டாஷ்போர்ட்',   kn: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್' },
  students:         { en: 'Students',          hi: 'छात्र',            te: 'విద్యార్థులు',   ta: 'மாணவர்கள்',    kn: 'ವಿದ್ಯಾರ್ಥಿಗಳು' },
  staff:            { en: 'Staff',             hi: 'शिक्षक/कर्मचारी', te: 'సిబ్బంది',       ta: 'பணியாளர்கள்',  kn: 'ಸಿಬ್ಬಂದಿ' },
  parents:          { en: 'Parents',           hi: 'अभिभावक',         te: 'తల్లిదండ్రులు',  ta: 'பெற்றோர்கள்',  kn: 'ಪಾಲಕರು' },
  attendance:       { en: 'Attendance',        hi: 'उपस्थिति',         te: 'హాజరు',          ta: 'வருகை',        kn: 'ಹಾಜರಾತಿ' },
  fees:             { en: 'Fees',              hi: 'शुल्क',            te: 'ఫీజు',           ta: 'கட்டணம்',      kn: 'ಶುಲ್ಕ' },
  timetable:        { en: 'Timetable',         hi: 'समय सारणी',        te: 'సమయ పట్టిక',    ta: 'நேரமான்',      kn: 'ಸಮಯಪಟ್ಟಿ' },
  homework:         { en: 'Homework',          hi: 'गृहकार्य',          te: 'హోమ్‌వర్క్',     ta: 'வீட்டுப்பாடம்', kn: 'ಮನೆ ಕೆಲಸ' },
  reports:          { en: 'Reports',           hi: 'रिपोर्ट',           te: 'నివేదికలు',      ta: 'அறிக்கைகள்',   kn: 'ವರದಿಗಳು' },
  library:          { en: 'Library',           hi: 'पुस्तकालय',         te: 'గ్రంథాలయం',     ta: 'நூலகம்',       kn: 'ಗ್ರಂಥಾಲಯ' },
  hostel:           { en: 'Hostel',            hi: 'छात्रावास',         te: 'హాస్టల్',        ta: 'விடுதி',       kn: 'ಹಾಸ್ಟೆಲ್' },
  placement:        { en: 'Placement',         hi: 'प्लेसमेंट',         te: 'ప్లేస్‌మెంట్',   ta: 'வேலைவாய்ப்பு', kn: 'ಪ್ಲೇಸ್‌ಮೆಂಟ್' },
  transport:        { en: 'Transport',         hi: 'परिवहन',            te: 'రవాణా',          ta: 'போக்குவரத்து',  kn: 'ಸಾರಿಗೆ' },
  departments:      { en: 'Departments',       hi: 'विभाग',             te: 'విభాగాలు',       ta: 'துறைகள்',      kn: 'ವಿಭಾಗಗಳು' },
  batches:          { en: 'Batches',           hi: 'बैच',               te: 'బ్యాచ్‌లు',      ta: 'தொகுதிகள்',    kn: 'ಬ್ಯಾಚ್‌ಗಳು' },
  settings:         { en: 'Settings',          hi: 'सेटिंग्स',          te: 'సెట్టింగ్‌లు',   ta: 'அமைப்புகள்',   kn: 'ಸೆಟ್ಟಿಂಗ್‌ಗಳು' },
  analytics:        { en: 'Analytics',         hi: 'विश्लेषण',          te: 'విశ్లేషణ',       ta: 'பகுப்பாய்வு',  kn: 'ವಿಶ್ಲೇಷಣೆ' },
  // Actions
  add:              { en: 'Add',               hi: 'जोड़ें',            te: 'జోడించు',        ta: 'சேர்க்க',      kn: 'ಸೇರಿಸು' },
  edit:             { en: 'Edit',              hi: 'संपादित',           te: 'సవరించు',        ta: 'திருத்து',     kn: 'ಸಂಪಾದಿಸು' },
  save:             { en: 'Save',              hi: 'सहेजें',            te: 'సేవ్ చేయి',     ta: 'சேமி',         kn: 'ಉಳಿಸು' },
  cancel:           { en: 'Cancel',            hi: 'रद्द करें',         te: 'రద్దు చేయి',    ta: 'ரத்து செய்',   kn: 'ರದ್ದುಮಾಡು' },
  delete:           { en: 'Delete',            hi: 'हटाएं',             te: 'తొలగించు',      ta: 'நீக்கு',       kn: 'ಅಳಿಸು' },
  search:           { en: 'Search',            hi: 'खोजें',             te: 'వెతుకు',         ta: 'தேடு',         kn: 'ಹುಡುಕು' },
  loading:          { en: 'Loading...',        hi: 'लोड हो रहा है...',  te: 'లోడ్ అవుతోంది...', ta: 'ஏற்றுகிறது...', kn: 'ಲೋಡ್ ಆಗುತ್ತಿದೆ...' },
  // Status
  active:           { en: 'Active',            hi: 'सक्रिय',            te: 'క్రియాశీల',      ta: 'செயலில்',      kn: 'ಸಕ್ರಿಯ' },
  inactive:         { en: 'Inactive',          hi: 'निष्क्रिय',         te: 'నిష్క్రియ',      ta: 'செயலற்ற',     kn: 'ನಿಷ್ಕ್ರಿಯ' },
  present:          { en: 'Present',           hi: 'उपस्थित',           te: 'హాజరు',          ta: 'வருகை',        kn: 'ಹಾಜರು' },
  absent:           { en: 'Absent',            hi: 'अनुपस्थित',         te: 'గైర్హాజరు',     ta: 'இல்லை',        kn: 'ಗೈರು' },
  paid:             { en: 'Paid',              hi: 'भुगतान',            te: 'చెల్లించారు',    ta: 'செலுத்தப்பட்டது', kn: 'ಪಾವತಿಸಲಾಗಿದೆ' },
  pending:          { en: 'Pending',           hi: 'लंबित',             te: 'పెండింగ్',       ta: 'நிலுவை',       kn: 'ಬಾಕಿ' },
  // School types
  school:           { en: 'School',            hi: 'विद्यालय',          te: 'పాఠశాల',         ta: 'பள்ளி',        kn: 'ಶಾಲೆ' },
  college:          { en: 'College',           hi: 'कॉलेज',             te: 'కళాశాల',         ta: 'கல்லூரி',      kn: 'ಕಾಲೇಜು' },
  class:            { en: 'Class',             hi: 'कक्षा',             te: 'తరగతి',          ta: 'வகுப்பு',      kn: 'ತರಗತಿ' },
  section:          { en: 'Section',           hi: 'अनुभाग',            te: 'విభాగం',         ta: 'பிரிவு',       kn: 'ವಿಭಾಗ' },
  subject:          { en: 'Subject',           hi: 'विषय',              te: 'సబ్జెక్ట్',      ta: 'பாடம்',        kn: 'ವಿಷಯ' },
  exam:             { en: 'Exam',              hi: 'परीक्षा',            te: 'పరీక్ష',         ta: 'தேர்வு',       kn: 'ಪರೀಕ್ಷೆ' },
  marks:            { en: 'Marks',             hi: 'अंक',               te: 'మార్కులు',       ta: 'மதிப்பெண்கள்', kn: 'ಅಂಕಗಳು' },
  grade:            { en: 'Grade',             hi: 'श्रेणी',            te: 'గ్రేడ్',         ta: 'தரம்',         kn: 'ದರ್ಜೆ' },
};

export function t(key: string, lang: AdminLang = 'en'): string {
  return ADMIN_LABELS[key]?.[lang] ?? ADMIN_LABELS[key]?.en ?? key;
}
