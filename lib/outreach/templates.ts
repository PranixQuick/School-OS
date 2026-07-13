export interface OutreachTemplate {
  subjectTemplate?: string
  bodyTemplate: string
  channels: ('email' | 'whatsapp')[]
}

export const outreachTemplates = {
  te: {
    email: {
      subject: "ఎడ్ ప్రో సిస్టమ్స్ (EdProSys) - విద్యా గ్రిడ్ (VIDYA-GRID) పైలట్ ప్రాజెక్ట్ ఆహ్వానం",
      body: `గౌరవనీయులైన {contactPerson} గారికి,

నమస్కారం. {name} కు సరికొత్త "ఎడ్ ప్రో సిస్టమ్స్" (EdProSys) మరియు "విద్యా గ్రిడ్" (VIDYA-GRID) భాగస్వామ్య పైలట్ ప్రాజెక్ట్‌ను పరిచయం చేయడానికి మేము గర్విస్తున్నాము.

ప్రభుత్వ మరియు ప్రైవేట్ పాఠశాలలలో 9వ మరియు 10వ తరగతి విద్యార్థుల కొరకు తెలుగు మరియు ఇంగ్లీష్ (ద్విభాషా) భాషలలో కాన్సెప్ట్-గ్రాఫ్ మరియు అధునాతన MCQ అసెస్‌మెంట్‌లను విద్యార్థులకు సులువుగా అందించడమే మా లక్ష్యం. 

మీ పాఠశాల కొరకు ప్రత్యేకంగా రూపొందించిన మా వివరణాత్మక వీడియోని క్రింది లింక్ ద్వారా వీక్షించండి:
లింక్: {videoUrl}

ఎడ్ ప్రో సిస్టమ్స్ మరియు విద్యా గ్రిడ్ భాగస్వామ్యం ద్వారా మీ విద్యార్థుల అభ్యసనా నైపుణ్యాలను పెంపొందించడానికి మేము సిద్ధంగా ఉన్నాము.

ధన్యవాదాలు,
ప్రశాంత్ రావు,
స్థాపకుడు, ప్రానిక్స్ ఏఐ ల్యాబ్స్ (Pranix AI Labs)`
    },
    whatsapp: {
      body: `నమస్కారం {contactPerson} గారు ({role}, {name}). మీ పాఠశాల కొరకు ప్రత్యేకంగా రూపొందించిన "ఎడ్ ప్రో సిస్టమ్స్" & "విద్యా గ్రిడ్" విద్యా ప్రణాళిక వీడియోను ఇక్కడ చూడండి: {videoUrl}. మా ద్విభాషా కాన్సెప్ట్ అసెస్‌మెంట్స్ మీ విద్యార్థులకు ఎంతో ఉపయోగపడతాయి. - ప్రశాంత్ రావు, ప్రానిక్స్ ఏఐ ల్యాబ్స్.`
    }
  },
  en: {
    email: {
      subject: "Invitation to Join EdProSys & VIDYA-GRID Pilot Initiative for {name}",
      body: `Dear {contactPerson} ({role}),

We are pleased to introduce the EdProSys (School-OS) and VIDYA-GRID partnership initiative designed for {name} in the {district} district.

Our platform supports Class 9 and Class 10 students with misconception-tagged bilingual (English & Telugu) MCQ assessment tools and automated learning pathways. 

Please find your custom explainer video generated specifically for your institution below:
Custom Video Link: {videoUrl}

We look forward to scheduling a brief 10-minute demo to share how EdProSys can assist {name} in tracking student learning gaps.

Warm regards,
Prashanth Rao,
Founder, Pranix AI Labs`
    },
    whatsapp: {
      body: `Hello {contactPerson} ({role}, {name}). View your custom EdProSys (School-OS) explainer video here: {videoUrl}. Discover how our bilingual learning gap assessments can help your students. - Prashanth Rao, Pranix AI Labs.`
    }
  }
}
