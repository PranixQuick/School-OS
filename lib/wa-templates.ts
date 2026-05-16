// lib/wa-templates.ts — G8/K4: Multilingual WhatsApp message templates
// Languages: en / hi / te / ta / kn
// Templates: fee_reminder / attendance_low / homework_due
export type Lang = 'en' | 'hi' | 'te' | 'ta' | 'kn';

export const WA: Record<string, Record<Lang, string>> = {
  fee_reminder: {
    en: 'Dear {parent_name}, fee of Rs.{amount} for {student_name} is due on {due_date}.',
    hi: 'प्रिय {parent_name}, {student_name} के Rs.{amount} शुल्क की नियत तिथि {due_date} है।',
    te: 'ప్రియమైన {parent_name}, {student_name} కోసం Rs.{amount} ఫీజు {due_date} నాటి చెల్లించాలి.',
    ta: 'அன்பான {parent_name}, {student_name} காண Rs.{amount} கட்டணம் {due_date} அன்று செலுத்தவும்.',
    kn: 'ಪ್ರಿಯ {parent_name}, {student_name} ಗಾಗಿ Rs.{amount} ಶುಲ್ಕ {due_date} ಒಳಗೆ ಪಾವಿಸಿ.',
  },
  attendance_low: {
    en: 'Dear {parent_name}, {student_name} attendance is {pct}%. Please ensure regular attendance.',
    hi: 'प्रिय {parent_name}, {student_name} की उपस्थिति {pct}% है। नियमित उपस्थिति सुनिश्चित करें।',
    te: 'ప్రియమైన {parent_name}, {student_name} హాజరు {pct}%. రోజూ హాజరు వేయించండి.',
    ta: '{parent_name}, {student_name} வருகை {pct}%. தொடர்ந்த வருகைக்கு உதவுங்கள்.',
    kn: '{parent_name}, {student_name} ಹಾಜರಾತಿ {pct}%. ನಿಯಮಿತ ಹಾಜರಾತಿ ಖಾತ್ರಿಪಡಿಸಿ.',
  },
  homework_due: {
    en: '{student_name} has homework: {title}. Due: {due_date}.',
    hi: '{student_name} का गृहकार्य: {title}। नियत तिथि: {due_date}।',
    te: '{student_name} కు ఇంటిపని: {title}. చెల్లించాల్సిన తేది: {due_date}.',
    ta: '{student_name} க்கு இல்லப்படி: {title}. கடைசி தேதி: {due_date}.',
    kn: '{student_name} ಗೆ ಮನೆಗೆಲಸ: {title}. ಕೊನೆಯ ದಿನಾಂಕ: {due_date}.',
  },
};

export function getWaMsg(key: string, lang: Lang, vars: Record<string, string>): string {
  const tpl = WA[key]?.[lang] ?? WA[key]?.['en'] ?? '';
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}
