// lib/i18n-parent.ts — G13: Minimal multilingual parent portal labels
// Scope: parent/page.tsx only. Admin/teacher dashboards stay English.
// Full sentence-level translation is Phase J.
export type Lang = 'en' | 'hi' | 'te' | 'ta' | 'kn';

export const PARENT_LABELS: Record<string, Record<Lang, string>> = {
  homework:      { en: 'Homework',      hi: 'गृहकार्य', te: 'ఇంటిపని', ta: 'இல்லப்படி', kn: 'ಮನೆಗೆಲಸ' },
  attendance:    { en: 'Attendance',    hi: 'उपस्थिति', te: 'హాజరు',    ta: 'வருகை',     kn: 'ಹಾಜರಾತಿ' },
  fees:          { en: 'Fees',          hi: 'शुल्क',    te: 'ఫీజులు',   ta: 'கட்டணம்',   kn: 'ಶುಲ್ಕ' },
  reports:       { en: 'Reports',       hi: 'रिपोर्ट',  te: 'నివేదికలు', ta: 'அறிக்கைகள்', kn: 'ವರದಿಗಳು' },
  ptm:           { en: 'PTM',           hi: 'पालक-शिक्षक', te: 'PTM',    ta: 'PTM',       kn: 'PTM' },
  transport:     { en: 'Transport',     hi: 'परिवहन',   te: 'రవాణా',    ta: 'போக்குவரத்து', kn: 'ಸಾರಿಗೆ' },
  announcements: { en: 'Announcements', hi: 'सूचनाएं',  te: 'ప్రకటనలు', ta: 'அறிவிப்புகள்', kn: 'ಪ್ರಕಟಣೆಗಳು' },
  complaints:    { en: 'Complaints',    hi: 'शिकायतें',  te: 'ఫిర్యాదులు', ta: 'புகார்கள்',   kn: 'ದೂರುಗಳು' },
};

export function L(key: string, lang: Lang): string {
  return PARENT_LABELS[key]?.[lang] ?? PARENT_LABELS[key]?.['en'] ?? key;
}
