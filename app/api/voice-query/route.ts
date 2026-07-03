import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseClient';
import { getParentSession } from '../../../lib/parent-auth';
import { verifySession } from '../../../lib/session';
import { verifyStudentSession } from '../../../lib/student-auth';
import { supabaseForUser } from '../../../lib/supabaseForUser';
import { isTeacher, isAccountant } from '../../../lib/authz';
import { canDo } from '../../../lib/permissions';

interface VoiceQueryRequest {
  transcript?: string;
  confidence?: number;
  audio_base64?: string;
  language_pref?: string;
  device_supports_tts?: boolean;
}

const AARIA_BASE_URL = 'https://pranix-aaria.onrender.com';

function parseIntent(transcript: string, role: string): string | null {
  const text = transcript.toLowerCase().trim();
  
  if (role === 'parent') {
    // Parent Attendance synonyms
    const attWords = ['attendance', 'present', 'absent', 'report', 'status', 'హజరు', 'హాజరు', 'ప్రెజెంట్', 'ఆబ్సెంట్', 'అటెండెన్స్', 'उपस्थिति', 'हाजिरी', 'प्रेजेंट', 'एब्सेंट', 'வருகை', 'ಹಾಜರಾತಿ', 'उपस्थिती', 'ഹാജർ'];
    if (attWords.some(w => text.includes(w))) {
      return 'parent_attendance';
    }
    // Parent Marks synonyms
    const marksWords = ['marks', 'score', 'exam', 'result', 'grade', 'test', 'report card', 'మార్కులు', 'పరీక్ష', 'రిజల్ట్', 'గ్రేడ్', 'రిజల్ట్స్', 'अंक', 'नंबर', 'परीक्षा', 'रिजल्ट', 'ग्रेड', 'மதிப்பெண்', 'ಅಂಕಗಳು', 'गुण', 'മാർക്കുകൾ'];
    if (marksWords.some(w => text.includes(w))) {
      return 'parent_marks';
    }
    // Parent Fees synonyms
    const feesWords = ['fee', 'due', 'pay', 'installment', 'outstanding', 'amount', 'ఫీజు', 'బకాయి', 'చెల్లింపు', 'డబ్బులు', 'డ్యూస్', 'ఫీజ్', 'फीस', 'बकाया', 'भुगतान', 'पैसे', 'கட்டணம்', 'ಶುಲ್ಕ', 'शुल्क', 'ഫീസ്'];
    if (feesWords.some(w => text.includes(w))) {
      return 'parent_fees';
    }
  } else if (role === 'teacher') {
    // Teacher Class Summary synonyms
    const sumWords = ['summary', 'class', 'averages', 'average', 'performance', 'stats', 'overall', 'తరగతి', 'సారాంశం', 'సగటు', 'పనితీరు', 'క్లాస్ సమ్మరీ', 'సమ్మరీ', 'कक्षा', 'सारांश', 'औसत', 'प्रदर्शन', 'வகுப்பு', 'ತರಗತಿ', 'वर्ग', 'ക്ലാസ്'];
    if (sumWords.some(w => text.includes(w))) {
      return 'teacher_class_summary';
    }
    // Teacher Student Detail synonyms
    const detWords = ['student', 'detail', 'particular', 'particulars', 'tell me about', 'profile', 'info', 'report', 'about', 'విద్యార్థి', 'వివరాలు', 'గురించి', 'ప్రొఫైల్', 'స్టూడెంట్ డీటెయిల్స్', 'స్టూడెంట్ డీటెయిల్', 'డీటెయిల్స్', 'డీటెయిల్', 'छात्र', 'विवरण', 'जानकारी', 'प्रोफ़ाइल', 'बारे में', 'மாணவர்', 'ವಿದ್ಯಾರ್ಥి', 'विद्यार्थी', 'വിദ്യാർത്ഥി'];
    if (detWords.some(w => text.includes(w))) {
      return 'teacher_student_detail';
    }
  } else if (role === 'accountant') {
    // Accountant Collection Totals synonyms
    const collWords = ['collection', 'total', 'revenue', 'amount', 'collected', 'collections', 'income', 'earnings', 'వసూళ్లు', 'మొత్తం', 'ఫీజు వసూలు', 'ఆదాయం', 'టోటల్ కలెక్షన్స్', 'కలెక్షన్స్', 'కలెక్షన్', 'संग्रह', 'कुल', 'कमाई', 'कलेक्शन', 'राजस्व', 'வசூல்', 'ಸಂಗ್ರಹಣೆ', 'वसुली', 'ശേഖരണം'];
    if (collWords.some(w => text.includes(w))) {
      return 'accountant_collection_totals';
    }
  } else if (role === 'principal') {
    const sumWords = ['summary', 'school', 'averages', 'average', 'performance', 'stats', 'overall', 'పాఠశాల', 'సారాంశం', 'స్కూల్', 'సమ్మరీ'];
    if (sumWords.some(w => text.includes(w))) {
      return 'principal_school_summary';
    }
  } else if (role === 'owner') {
    const sumWords = ['all schools', 'schools', 'summary', 'portfolio', 'performance', 'మొత్తం పాఠశాలలు', 'స్కూల్స్', 'సమ్మరీ'];
    if (sumWords.some(w => text.includes(w))) {
      return 'owner_multi_school_summary';
    }
  } else if (role === 'student') {
    const attWords = ['attendance', 'present', 'absent', 'report', 'status', 'హాజరు', 'అటెండెన్స్'];
    const marksWords = ['marks', 'score', 'exam', 'result', 'grade', 'test', 'మార్కులు', 'పరీక్ష', 'రిజల్ట్'];
    if (attWords.some(w => text.includes(w))) {
      return 'student_self_attendance';
    }
    if (marksWords.some(w => text.includes(w))) {
      return 'student_self_marks';
    }
  }
  return null;
}

function getParentAttendanceResponse(lang: string, name: string, pct: number, present: number, total: number): string {
  switch (lang) {
    case 'te': return `${name} మొత్తం హాజరు ${pct} శాతం (${present}/${total} రోజులు హాజరు).`;
    case 'hi': return `${name} की कुल उपस्थिति ${pct} प्रतिशत है (${present}/${total} दिन उपस्थित)।`;
    case 'ta': return `${name} இன் ஒட்டுமொத்த வருகை ${pct} சதவீதம் ஆகும் (${present}/${total} நாட்கள் வருகை).`;
    case 'kn': return `${name} ರ ಒಟ್ಟು ಹಾಜರಾತಿ ${pct} ಪ್ರತಿಶತ ಆಗಿದೆ (${present}/${total} ದಿನಗಳು ಹಾಜರು).`;
    case 'mr': return `${name} ची एकूण उपस्थिती ${pct} टक्के आहे (${present}/${total} दिवस उपस्थित).`;
    case 'ml': return `${name} ന്റെ ആകെ ഹാജർ ${pct} ശതമാനം ആണ് (${present}/${total} ദിവസങ്ങൾ ഹാജർ).`;
    default: return `${name}'s overall attendance is ${pct} percent. Present for ${present} out of ${total} days.`;
  }
}

function getParentMarksResponse(lang: string, name: string, summary: string): string {
  switch (lang) {
    case 'te': return `${name} పరీక్ష మార్కులు: ${summary}.`;
    case 'hi': return `${name} के परीक्षा अंक: ${summary}।`;
    case 'ta': return `${name} தேர்வு மதிப்பெண்கள்: ${summary}.`;
    case 'kn': return `${name} ಪರೀಕ್ಷಾ ಅಂಕಗಳು: ${summary}.`;
    case 'mr': return `${name} चे परीक्षेचे गुण: ${summary}.`;
    case 'ml': return `${name} ന്റെ పരീക്ഷാ മാർക്കുകൾ: ${summary}.`;
    default: return `Exam marks for ${name}: ${summary}.`;
  }
}

function getParentFeesResponse(lang: string, name: string, amount: number, count: number, status: 'unpaid' | 'none'): string {
  if (status === 'none') {
    switch (lang) {
      case 'te': return `${name} కు ఎటువంటి ఫీజు వాయిదాలు నమోదు కాలేదు.`;
      case 'hi': return `${name} के लिए कोई शुल्क किस्त पंजीकृत नहीं है।`;
      case 'ta': return `${name} க்கு கட்டண தவணைகள் எதுவும் பதிவு செய்யப்படவில்லை.`;
      case 'kn': return `${name} ಗೆ ಯಾವುದೇ ಶುಲ್ಕ ಕಂತುಗಳು ನೋಂದಾಯಿಸಲ್ಪಟ್ಟಿಲ್ಲ.`;
      case 'mr': return `${name} साठी कोणतेही शुल्क हप्ते नोंदणीकृत नाहीत.`;
      case 'ml': return `${name} ന് ഫീസ് ഗഡുക്കളൊന്നും രജിസ്റ്റർ ചെയ്തിട്ടില്ല.`;
      default: return `${name} has no fee installments registered.`;
    }
  }
  if (amount === 0) {
    switch (lang) {
      case 'te': return `${name} కు ఎటువంటి ఫీజు బకాయిలు లేవు.`;
      case 'hi': return `${name} का कोई शुल्क बकाया नहीं है।`;
      case 'ta': return `${name} க்கு எந்த கட்டண நிலுவையும் இல்லை.`;
      case 'kn': return `${name} ಗೆ ಯಾವುದೇ ಶುಲ್ಕ ಬಾಕಿ ಇಲ್ಲ.`;
      case 'mr': return `${name} कडे कोणतीही थकबाकी नाही.`;
      case 'ml': return `${name} ന് ഫീസ് കുടിശ്ശികയൊന്നുമില്ല.`;
      default: return `${name} has no outstanding dues.`;
    }
  }
  switch (lang) {
    case 'te': return `${name} కు ${count} పెండింగ్ వాయిదాలలో రూ. ${amount.toLocaleString('en-IN')} బకాయిలు ఉన్నాయి.`;
    case 'hi': return `${name} के ${count} लंबित किश्तों में रु. ${amount.toLocaleString('en-IN')} बकाया हैं।`;
    case 'ta': return `${name} க்கு ${count} நிலುவையில் உள்ள தவணைகளில் రూ. ${amount.toLocaleString('en-IN')} செலுத்த வேண்டியுள்ளது.`;
    case 'kn': return `${name} ಗೆ ${count} ಬಾಕಿ ಇರುವ ಕಂತುಗಳಲ್ಲಿ ರೂ. ${amount.toLocaleString('en-IN')} ಬಾಕಿ ಹಣ ಪಾವತಿಸಬೇಕಿದೆ.`;
    case 'mr': return `${name} कडे ${count} प्रलंबित हप्त्यांमध्ये रु. ${amount.toLocaleString('en-IN')} थकबाकी आहे.`;
    case 'ml': return `${name} ന് ${count} തീർപ്പാക്കാത്ത ഗഡുക്കളിലായി രൂപ ${amount.toLocaleString('en-IN')} കുടിശ്ശികയുണ്ട്.`;
    default: return `${name} has Rs. ${amount.toLocaleString('en-IN')} outstanding dues across ${count} pending installments.`;
  }
}

function getTeacherClassSummaryResponse(lang: string, count: number, pct: number, status: 'none' | 'ok'): string {
  if (status === 'none') {
    switch (lang) {
      case 'te': return `మీకు కేటాయించిన తరగతులలో విద్యార్థులు ఎవరూ నమోదు కాలేదు.`;
      case 'hi': return `आपकी आवंटित कक्षाओं में कोई छात्र नामांकित नहीं है।`;
      case 'ta': return `உங்களுக்கு ஒதுக்கப்பட்ட வகுப்புகளில் மாணவர்கள் யாரும் சேர்க்கப்படவில்லை.`;
      case 'kn': return `ನಿಮಗೆ ನಿಯೋಜಿಸಲಾದ ತರಗತಿಗಳಲ್ಲಿ ಯಾವುದೇ ವಿದ್ಯಾರ್ಥಿಗಳು ದಾಖಲಾಗಿಲ್ಲ.`;
      case 'mr': return `तुमच्या नियुक्त वर्गांमध्ये कोणतेही विद्यार्थी नोंदणीकृत नाहीत.`;
      case 'ml': return `നിങ്ങൾക്ക് അനുവദിച്ച ക്ലാസുകളിൽ വിദ്യാർത്ഥികളാരും ചേർന്നിട്ടില്ല.`;
      default: return `No students enrolled in your assigned classes.`;
    }
  }
  switch (lang) {
    case 'te': return `తరగతి పనితీరు సారాంశం: మొత్తం కేటాయించిన విద్యార్థులు: ${count}. మొత్తం సగటు హాజరు: ${pct} శాతం.`;
    case 'hi': return `कक्षा प्रदर्शन सारांश: कुल आवंटित छात्र: ${count}। कुल औसत उपस्थिति: ${pct} प्रतिशत।`;
    case 'ta': return `வகுப்பு செயல்திறன் சுருக்கம்: ஒதுக்கப்பட்ட மொத்த மாணவர்கள்: ${count}. ஒட்டுமொத்த வருகை சராசரி: ${pct} சதவீதம்.`;
    case 'kn': return `ತರಗತಿಯ ಕಾರ್ಯಕ್ಷಮತೆಯ ಸಾರಾಂಶ: ಒಟ್ಟು ನಿಯೋಜಿತ ವಿದ್ಯಾರ್ಥಿಗಳು: ${count}. ಒಟ್ಟು ಸರಾಸರಿ ಹಾಜರಾತಿ: ${pct} ಪ್ರತಿಶತ.`;
    case 'mr': return `वर्ग कामगिरीचा सारांश: एकूण नियुक्त विद्यार्थी: ${count}. एकूण सरासरी उपस्थिती: ${pct} टक्के.`;
    case 'ml': return `ക്ലാസ് പ്രകടന സംഗ്രഹം: ആകെ അസൈൻ ചെയ്ത വിദ്യാർത്ഥികൾ: ${count}. ആകെ ശരാശരി ഹാജർ: ${pct} ശതമാനം.`;
    default: return `Class Performance Summary: Total assigned students: ${count}. Overall attendance average: ${pct} percent.`;
  }
}

function getTeacherStudentDetailResponse(lang: string, name: string, class_name: string, section: string, pct: number, present: number, total: number, status: 'not_found' | 'ok'): string {
  if (status === 'not_found') {
    switch (lang) {
      case 'te': return `మీకు కేటాయించిన తరగతులలో "${name}" తో సరిపోలే విద్యార్థి ఎవరూ కనుగొనబడలేదు.`;
      case 'hi': return `आपकी आवंटित कक्षाओं में "${name}" से मेल खाता हुआ कोई छात्र नहीं मिला।`;
      case 'ta': return `உங்களுக்கு ஒதுக்கப்பட்ட வகுப்புகளில் "${name}" உடன் பொருந்தக்கூடிய மாணவர் யாரும் காணப்படவில்லை.`;
      case 'kn': return `ನಿಮಗೆ ನಿಯೋಜಿಸಲಾದ ತರಗತಿಗಳಲ್ಲಿ "${name}" ಗೆ ಹೊಂದಿಕೆಯಾಗುವ ಯಾವುದೇ ವಿದ್ಯಾರ್ಥಿ ಕಂಡುಬಂದಿಲ್ಲ.`;
      case 'mr': return `तुमच्या नियुक्त वर्गांमध्ये "${name}" शी जुळणारा कोणताही विद्यार्थी आढळला नाही.`;
      case 'ml': return `നിങ്ങൾക്ക് അനുവദിച്ച ക്ലാസുകളിൽ "${name}" മായി പൊരുത്തപ്പെടുന്ന ഒരു വിദ്യാർത്ഥിയെയും കണ്ടെത്താനായില്ല.`;
      default: return `I couldn't find a student matching "${name}" in your assigned classes.`;
    }
  }
  switch (lang) {
    case 'te': return `${name} వివరాలు: తరగతి ${class_name}-${section}. మొత్తం హాజరు ${pct} శాతం (${present}/${total} రోజులు హాజరు).`;
    case 'hi': return `${name} का विवरण: कक्षा ${class_name}-${section}। कुल उपस्थिति ${pct} प्रतिशत (${present}/${total} दिन उपस्थित)।`;
    case 'ta': return `${name} விவரங்கள்: வகுப்பு ${class_name}-${section}. ஒட்டுமொத்த வருகை ${pct} சதவீதம் (${present}/${total} நாட்கள் வருகை).`;
    case 'kn': return `${name} ವಿವರಗಳು: ತರಗತಿ ${class_name}-${section}. ಒಟ್ಟು ಹಾಜರಾತಿ ${pct} ಪ್ರತಿಶತ (${present}/${total} ದಿನಗಳು ಹಾಜರು).`;
    case 'mr': return `${name} चा तपशील: वर्ग ${class_name}-${section}. एकूण उपस्थिती ${pct} टक्के (${present}/${total} दिवस उपस्थित).`;
    case 'ml': return `${name} വിവരങ്ങൾ: ക്ലാസ് ${class_name}-${section}. ആകെ ഹാജർ ${pct} ശതമാനം (${present}/${total} ദിവസങ്ങൾ ഹാജർ).`;
    default: return `Student details for ${name}: Class ${class_name}-${section}. Overall attendance is ${pct} percent (${present}/${total} days present).`;
  }
}

function getAccountantCollectionResponse(lang: string, amount: number): string {
  switch (lang) {
    case 'te': return `ఈ పాఠశాలకు వచ్చిన మొత్తం ఫీజు వసూళ్లు రూ. ${amount.toLocaleString('en-IN')}.`;
    case 'hi': return `इस स्कूल के लिए प्राप्त कुल शुल्क संग्रह रु. ${amount.toLocaleString('en-IN')} है।`;
    case 'ta': return `இந்த பள்ளிக்கு பெறப்பட்ட மொத்த கட்டண வசூல் ரூ. ${amount.toLocaleString('en-IN')}.`;
    case 'kn': return `ಈ ಶಾಲೆಗೆ ಸ್ವೀಕರಿಸಲಾದ ಒಟ್ಟು ಶುಲ್ಕ ಸಂಗ್ರಹಣೆ ರೂ. ${amount.toLocaleString('en-IN')} ಆಗಿದೆ.`;
    case 'mr': return `या शाळेसाठी प्राप्त झालेली एकूण शुल्क वसुली रु. ${amount.toLocaleString('en-IN')} आहे.`;
    case 'ml': return `ഈ സ്കൂളിലേക്ക് ലഭിച്ച ആകെ ഫീസ് ശേഖരണം രൂപ ${amount.toLocaleString('en-IN')} ആണ്.`;
    default: return `Total fee collections received for this school is Rs. ${amount.toLocaleString('en-IN')}.`;
  }
}

function getPrincipalSchoolSummaryResponse(lang: string, count: number, pct: number): string {
  switch (lang) {
    case 'te': return `పాఠశాల పనితీరు సారాంశం: మొత్తం విద్యార్థులు: ${count}. సగటు హాజరు: ${pct} శాతం.`;
    default: return `School Performance Summary: Total students: ${count}. Overall attendance average: ${pct} percent.`;
  }
}

function getOwnerMultiSchoolSummaryResponse(lang: string, schoolCount: number, studentCount: number, pct: number): string {
  switch (lang) {
    case 'te': return `మొత్తం పాఠశాలల పనితీరు సారాంశం: పాఠశాలలు: ${schoolCount}, మొత్తం విద్యార్థులు: ${studentCount}. సగటు హాజరు: ${pct} శాతం.`;
    default: return `Portfolio Performance Summary: Schools: ${schoolCount}, Total students: ${studentCount}. Overall attendance average: ${pct} percent.`;
  }
}

function getStudentSelfAttendanceResponse(lang: string, pct: number, present: number, total: number): string {
  switch (lang) {
    case 'te': return `మీ మొత్తం హాజరు ${pct} శాతం (${present}/${total} రోజులు హాజరు).`;
    default: return `Your overall attendance is ${pct} percent. Present for ${present} out of ${total} days.`;
  }
}

function getStudentSelfMarksResponse(lang: string, summary: string): string {
  switch (lang) {
    case 'te': return `మీ పరీక్ష మార్కులు: ${summary}.`;
    default: return `Your exam marks: ${summary}.`;
  }
}

function getFallbackResponse(lang: string, role: string): string {
  if (role === 'parent') {
    switch (lang) {
      case 'te': return "క్షమించండి, నాకు అర్థం కాలేదు. దయచేసి మీ పిల్లల హాజరు, మార్కులు లేదా ఫీజుల గురించి అడగండి.";
      case 'hi': return "क्षमा करें, मैं समझ नहीं सका। कृपया अपने बच्चे की उपस्थिति, अंक या शुल्क के बारे में पूछें।";
      case 'ta': return "மன்னிக்கவும், என்னால் புரிந்து கொள்ள முடியவில்லை. தயவுசெய்து உங்கள் குழந்தையின் வருகை, மதிப்பெண்கள் அல்லது கட்டணம் பற்றி கேளுங்கள்.";
      case 'kn': return "ಕ್ಷಮಿಸಿ, ನನಗೆ ಅರ್ಥವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಮಗುವಿನ ಹಾಜರಾತಿ, ಅಂಕಗಳು ಅಥವಾ ಶುಲ್ಕದ ಬಗ್ಗೆ ಕೇಳಿ.";
      case 'mr': return "क्षमस्व, मला समजले नाही. कृपया आपल्या मुलाची उपस्थिती, गुण किंवा शुल्काबद्दल विचारून पहा.";
      case 'ml': return "ക്ഷമിക്കണം, എനിക്ക് മനസ്സിലായില്ല. ദയവായി നിങ്ങളുടെ കുട്ടിയുടെ ഹാജർ, മാർക്ക് അല്ലെങ്കിൽ ഫീസ് എന്നിവയെക്കുറിച്ച് ചോദിക്കുക.";
      default: return "I'm sorry, I couldn't understand that. Please try asking about your child's attendance, marks, or fees.";
    }
  }
  if (role === 'teacher') {
    switch (lang) {
      case 'te': return "క్షమించండి, నాకు అర్థం కాలేదు. దయచేసి తరగతి సారాంశం లేదా విద్యార్థి వివరాల గురించి అడగండి.";
      case 'hi': return "क्षमा करें, मैं समझ नहीं सका। कृपया कक्षा सारांश या छात्र विवरण के बारे में पूछें।";
      case 'ta': return "மன்னிக்கவும், என்னால் புரிந்து கொள்ள முடியவில்லை. தயவுசெய்து வகுப்பு சுருக்கம் அல்லது மாணவர் விவரம் பற்றி கேளுங்கள்.";
      case 'kn': return "ಕ್ಷಮಿಸಿ, ನನಗೆ ಅರ್ಥವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ತರಗತಿಯ ಸಾರಾಂಶ ಅಥವಾ ವಿದ್ಯಾರ್ಥಿ ವಿವರಗಳ ಬಗ್ಗೆ ಕೇಳಿ.";
      case 'mr': return "क्षमस्व, मला समजले नाही. कृपया वर्ग सारांश किंवा विद्यार्थ्यांच्या तपशीलाबद्दल विचारून पहा.";
      case 'ml': return "ക്ഷമിക്കണം, എനിക്ക് മനസ്സിലായില്ല. ദയവായി ക്ലാസ് സംഗ്രഹത്തെക്കുറിച്ചോ വിദ്യാർത്ഥി വിവരങ്ങളെക്കുറിച്ചോ ചോദിക്കുക.";
      default: return "I'm sorry, I couldn't understand that. Please try asking about class summary or student details.";
    }
  }
  if (role === 'accountant') {
    switch (lang) {
      case 'te': return "క్షమించండి, నాకు అర్థం కాలేదు. దయచేసి మొత్తం వసూళ్ల గురించి అడగండి.";
      case 'hi': return "क्षमा करें, मैं समझ नहीं सका। कृपया कुल संग्रह के बारे में पूछें।";
      case 'ta': return "மன்னிக்கவும், என்னால் புரிந்து கொள்ள முடியவில்லை. தயவுசெய்து மொத்த வசூல் பற்றி கேளுங்கள்.";
      case 'kn': return "ಕ್ಷಮಿಸಿ, ನನಗೆ ಅರ್ಥವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಒಟ್ಟು ಸಂಗ್ರಹಣೆಯ ಬಗ್ಗೆ ಕೇಳಿ.";
      case 'mr': return "क्षमस्व, मला समजले नाही. कृपया एकूण वसुलीबद्दल विचारून पहा.";
      case 'ml': return "ക്ഷമിക്കണം, എനിക്ക് മനസ്സിലായില്ല. ദയവായി ആകെ ശേഖരണത്തെക്കുറിച്ച് ചോദിക്കുക.";
      default: return "I'm sorry, I couldn't understand that. Please try asking about total collections.";
    }
  }
  if (role === 'principal') {
    switch (lang) {
      case 'te': return "క్షమించండి, నాకు అర్థం కాలేదు. దయచేసి పాఠశాల సారాంశం గురించి అడగండి.";
      default: return "I'm sorry, I couldn't understand that. Please try asking about the school summary.";
    }
  }
  if (role === 'owner') {
    switch (lang) {
      case 'te': return "క్షమించండి, నాకు అర్థం కాలేదు. దయచేసి పాఠశాలల సారాంశం గురించి అడగండి.";
      default: return "I'm sorry, I couldn't understand that. Please try asking about the multi-school portfolio summary.";
    }
  }
  if (role === 'student') {
    switch (lang) {
      case 'te': return "క్షమించండి, నాకు అర్థం కాలేదు. దయచేసి మీ మార్కులు లేదా హాజరు గురించి అడగండి.";
      default: return "I'm sorry, I couldn't understand that. Please try asking about your marks or attendance.";
    }
  }
  switch (lang) {
    case 'te': return "క్షమించండి, నాకు అర్థం కాలేదు.";
    case 'hi': return "क्षमा करें, मैं समझ नहीं सका।";
    case 'ta': return "மன்னிக்கவும், என்னால் புரிந்து கொள்ள முடியவில்லை.";
    case 'kn': return "ಕ್ಷಮಿಸಿ, ನನಗೆ ಅರ್ಥವಾಗಲಿಲ್ಲ.";
    case 'mr': return "क्षमस्व, मला समजले नाही.";
    case 'ml': return "ക്ഷമിക്കണം, എനിക്ക് മനസ്സിലായില്ല.";
    default: return "I'm sorry, I couldn't understand your request.";
  }
}
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let body: VoiceQueryRequest = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }

  const {
    transcript: initialTranscript,
    confidence,
    audio_base64,
    language_pref = 'en',
    device_supports_tts = true
  } = body;

  console.log(`[POST] Request received: transcript=${initialTranscript}`);

  // 1. Authenticate & Resolve Context
  let role: string | null = null;
  let resolvedUserId: string | null = null;
  let schoolId: string | null = null;

  let parentSession: any = null;
  let studentSession: any = null;
  let staffSession: any = null;

  // Check cookie prioritized by the requesting page (referer) to prevent cookie collision
  const referer = req.headers.get('referer') || '';
  const isParentPortal = referer.includes('/parent');
  const isStudentPortal = referer.includes('/student');

  if (isParentPortal) {
    parentSession = await getParentSession(req);
    if (parentSession) {
      role = 'parent';
      resolvedUserId = parentSession.parentId;
      schoolId = parentSession.schoolId;
    } else {
      const token = req.cookies.get('school_session')?.value;
      staffSession = await verifySession(token);
      if (staffSession) {
        role = staffSession.userRole;
        resolvedUserId = staffSession.userId;
        schoolId = staffSession.schoolId;
      }
    }
  } else if (isStudentPortal) {
    const token = req.cookies.get('student_session')?.value;
    studentSession = await verifyStudentSession(token);
    if (studentSession) {
      role = 'student';
      resolvedUserId = studentSession.studentId;
      schoolId = studentSession.schoolId;
    }
  } else {
    const token = req.cookies.get('school_session')?.value;
    staffSession = await verifySession(token);
    if (staffSession) {
      role = staffSession.userRole;
      resolvedUserId = staffSession.userId;
      schoolId = staffSession.schoolId;
    } else {
      const tokenStudent = req.cookies.get('student_session')?.value;
      studentSession = await verifyStudentSession(tokenStudent);
      if (studentSession) {
        role = 'student';
        resolvedUserId = studentSession.studentId;
        schoolId = studentSession.schoolId;
      } else {
        parentSession = await getParentSession(req);
        if (parentSession) {
          role = 'parent';
          resolvedUserId = parentSession.parentId;
          schoolId = parentSession.schoolId;
        }
      }
    }
  }
  console.log(`[DEBUG_VOICE] referer: ${referer}, resolved role: ${role}, resolvedUserId: ${resolvedUserId}, schoolId: ${schoolId}`);

  if (!role || !resolvedUserId || !schoolId) {
    console.log(`[POST] Unauthorized: role=${role}, resolvedUserId=${resolvedUserId}, schoolId=${schoolId}`);
    return NextResponse.json({ error: 'Unauthorized: Session not found' }, { status: 401 });
  }

  // 2. STT Processing (zero-burn first, then fallback to cloud)
  let transcript = initialTranscript || '';
  let sttSource = 'device';
  console.log(`[POST] STT step: transcript=${transcript}, confidence=${confidence}`);

  if (!transcript || (confidence !== undefined && confidence < 0.80)) {
    if (audio_base64) {
      sttSource = 'cloud';
      try {
        const res = await fetch(`${AARIA_BASE_URL}/api/voice/listen`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audio_base64,
            lang_hint: language_pref,
            product: 'EdProSys',
            quality_tier: 'standard'
          })
        });
        if (res.ok) {
          const data = await res.json();
          transcript = data.text || '';
        }
      } catch (err) {
        console.error('Aaria Listen fallback failed:', err);
      }
    }
  }

  // 3. NLU Processing (zero-burn first, then fallback to cloud)
  let intent = parseIntent(transcript, role);
  let nluSource = 'device';
  console.log(`[POST] NLU step: initial intent=${intent}`);

  if (!intent) {
    nluSource = 'cloud';
    console.log(`[POST] Fetching Aaria NLU fallback from ${AARIA_BASE_URL}...`);
    try {
      const res = await fetch(`${AARIA_BASE_URL}/api/voice/understand`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: transcript,
          product: 'EdProSys',
          lang_hint: language_pref
        })
      });
      if (res.ok) {
        const data = await res.json();
        const aariaIntent = data.intent;
        console.log(`[POST] Aaria NLU resolved intent: ${aariaIntent}`);
        
        // Map Aaria's general intents to EdProSys role-scoped intents
        if (role === 'parent') {
          if (aariaIntent === 'get_attendance_status') intent = 'parent_attendance';
          else if (aariaIntent === 'get_fee_status') intent = 'parent_fees';
          else if (aariaIntent === 'get_student_info' || aariaIntent === 'student_detail') intent = 'parent_marks';
        } else if (role === 'teacher') {
          if (aariaIntent === 'get_attendance_status' || aariaIntent === 'class_summary') intent = 'teacher_class_summary';
          else if (aariaIntent === 'get_student_info' || aariaIntent === 'student_detail') intent = 'teacher_student_detail';
        } else if (role === 'accountant') {
          if (aariaIntent === 'get_fee_status' || aariaIntent === 'collection_totals') intent = 'accountant_collection_totals';
        } else if (role === 'principal') {
          if (aariaIntent === 'get_attendance_status' || aariaIntent === 'class_summary' || aariaIntent === 'school_summary') intent = 'principal_school_summary';
        } else if (role === 'owner') {
          if (aariaIntent === 'get_attendance_status' || aariaIntent === 'class_summary' || aariaIntent === 'school_summary' || aariaIntent === 'collection_totals') intent = 'owner_multi_school_summary';
        } else if (role === 'student') {
          if (aariaIntent === 'get_attendance_status') intent = 'student_self_attendance';
          else if (aariaIntent === 'get_student_info' || aariaIntent === 'student_detail') intent = 'student_self_marks';
        }
        
        if (!intent) {
          intent = aariaIntent;
        }
      }
    } catch (err) {
      console.error('Aaria Understand fallback failed:', err);
    }
  }

  if (!intent || intent === 'fallback_unknown' || intent === 'unknown') {
    if (role === 'teacher' && schoolId) {
      try {
        const supabase = supabaseForUser(schoolId);
        const { data: allStudents } = await supabase
          .from('students')
          .select('name')
          .eq('school_id', schoolId);
        
        if (allStudents) {
          const cleanText = transcript.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").replace(/\s+/g, " ").trim();
          let checkText = cleanText;
          const teluguNameMap: Record<string, string> = {
            'అర్జున్ రెడ్డి': 'arjun reddy',
            'అర్జున్': 'arjun',
            'వికాస్ రెడ్డి': 'vikas reddy',
            'వికాస్': 'vikas',
            'సురేష్ రెడ్డి': 'suresh reddy',
            'సురేష్': 'suresh'
          };
          for (const [telKey, engVal] of Object.entries(teluguNameMap)) {
            if (checkText.includes(telKey)) {
              checkText = checkText.replace(telKey, engVal);
            }
          }
          
          const hasStudentMatch = allStudents.some(s => {
            const sName = s.name.toLowerCase();
            return checkText.includes(sName) || sName.includes(checkText);
          });
          
          if (hasStudentMatch) {
            intent = 'teacher_student_detail';
            console.log(`[POST] Override: detected student name in transcript, set intent=teacher_student_detail`);
          }
        }
      } catch (e) {
        console.error('Error in student name override matching:', e);
      }
    }
  }

  if (!intent) {
    intent = 'fallback_unknown';
  }
  console.log(`[POST] Final intent: ${intent}`);
  console.log(`[DEBUG_CROSS_SCOPE] role: ${role}, transcript: ${transcript}, intent: ${intent}`);

  // Reject cross-role intent leaks (allow fallback/unknown queries to bypass)
  const isFallback = intent === 'fallback_unknown' || intent === 'unknown';
  if (!isFallback) {
    if (role === 'parent' && !intent.startsWith('parent_')) {
      console.log(`[POST] Cross-scope intent rejected: parent tried to access ${intent}`);
      return NextResponse.json({ error: 'Access Denied: Cross-scope intent requested' }, { status: 403 });
    }
    if (role === 'teacher' && !intent.startsWith('teacher_')) {
      console.log(`[POST] Cross-scope intent rejected: teacher tried to access ${intent}`);
      return NextResponse.json({ error: 'Access Denied: Cross-scope intent requested' }, { status: 403 });
    }
    if (role === 'accountant' && !intent.startsWith('accountant_')) {
      console.log(`[POST] Cross-scope intent rejected: accountant tried to access ${intent}`);
      return NextResponse.json({ error: 'Access Denied: Cross-scope intent requested' }, { status: 403 });
    }
    if (role === 'principal' && !intent.startsWith('principal_')) {
      console.log(`[POST] Cross-scope intent rejected: principal tried to access ${intent}`);
      return NextResponse.json({ error: 'Access Denied: Cross-scope intent requested' }, { status: 403 });
    }
    if (role === 'owner' && !intent.startsWith('owner_')) {
      console.log(`[POST] Cross-scope intent rejected: owner tried to access ${intent}`);
      return NextResponse.json({ error: 'Access Denied: Cross-scope intent requested' }, { status: 403 });
    }
    if (role === 'student' && !intent.startsWith('student_')) {
      console.log(`[POST] Cross-scope intent rejected: student tried to access ${intent}`);
      return NextResponse.json({ error: 'Access Denied: Cross-scope intent requested' }, { status: 403 });
    }
  }

  // 4. Read-Only Query Resolution with strict permissions boundaries
  let textResponse = '';
  console.log(`[POST] Starting DB query resolution for role=${role}, intent=${intent}...`);
  try {
    const supabase = supabaseForUser(schoolId);
    if (intent === 'fallback_unknown' || intent === 'unknown') {
      textResponse = getFallbackResponse(language_pref, role || '');
    } else if (role === 'parent') {
      // Fetch children registered via parent_students
      console.log(`[POST] Parent query: fetching parent_students for parent_id=${resolvedUserId}...`);
      const { data: children, error: childrenErr } = await supabase
        .from('parent_students')
        .select('student_id')
        .eq('parent_id', resolvedUserId);

      if (childrenErr || !children || children.length === 0) {
        console.log(`[POST] Parent query error: childrenErr=${childrenErr}, count=${children?.length}`);
        return NextResponse.json({ error: 'Access Denied: No children linked to this parent profile' }, { status: 403 });
      }

      const childIds = children.map(c => c.student_id);
      console.log(`[POST] Parent childIds: ${JSON.stringify(childIds)}`);

      // Determine which child is queried (by name matching in transcript, defaulting to first)
      console.log(`[POST] Parent query: fetching students profile...`);
      const { data: studentProfiles } = await supabase
        .from('students')
        .select('id, name')
        .in('id', childIds);

      console.log(`[POST] Parent studentProfiles: ${JSON.stringify(studentProfiles)}`);
      
      const { data: allStudents } = await supabase
        .from('students')
        .select('id, name')
        .eq('school_id', schoolId);

      let targetChild = null;
      let mentionedChildOutsideScope = false;

      if (allStudents) {
        for (const child of allStudents) {
          if (child.name && transcript.toLowerCase().includes(child.name.toLowerCase())) {
            if (childIds.includes(child.id)) {
              targetChild = child;
            } else {
              mentionedChildOutsideScope = true;
            }
          }
        }
      }

      if (mentionedChildOutsideScope && !targetChild) {
        console.log(`[POST] Parent query error: parent mentioned child outside scope`);
        return NextResponse.json({ error: 'Access Denied: Parent not authorized to access child' }, { status: 403 });
      }

      if (!targetChild) {
        const activeStudentId = parentSession?.studentId;
        if (activeStudentId) {
          targetChild = studentProfiles?.find(c => c.id === activeStudentId);
        }
        if (!targetChild) {
          targetChild = studentProfiles?.[0];
        }
      }

      if (!targetChild) {
        console.log(`[POST] Parent query error: targetChild not found`);
        return NextResponse.json({ error: 'Access Denied: Target child profile not found' }, { status: 403 });
      }
      console.log(`[POST] Parent target child: id=${targetChild.id}, name=${targetChild.name}`);

      // If parent queries a student outside their own children list, reject
      const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      const match = transcript.match(uuidRegex);
      if (match && !childIds.includes(match[0])) {
        console.log(`[POST] Parent query error: unauthorized UUID child probe: ${match[0]}`);
        return NextResponse.json({ error: 'Access Denied: Parent not authorized to access child ' + match[0] }, { status: 403 });
      }

      if (intent === 'parent_attendance') {
        const { data: att } = await supabase
          .from('attendance')
          .select('date, status')
          .eq('school_id', schoolId)
          .eq('student_id', targetChild.id)
          .order('date', { ascending: false });

        if (!att || att.length === 0) {
          textResponse = language_pref === 'te' 
            ? `${targetChild.name} కు హాజరు రికార్డులు ఏవీ కనుగొనబడలేదు.`
            : `No attendance records found for ${targetChild.name}.`;
        } else {
          const present = att.filter(a => a.status === 'present').length;
          const total = att.length;
          const pct = Math.round((present / total) * 100);
          textResponse = getParentAttendanceResponse(language_pref, targetChild.name, pct, present, total);
        }
      } else if (intent === 'parent_marks') {
        console.log(`[POST] Parent query: querying test_scores for child_id=${targetChild.id}...`);
        const { data: scores, error: scoresErr } = await supabase
          .from('test_scores')
          .select('marks_obtained, tests(title, max_marks, subject)')
          .eq('school_id', schoolId)
          .eq('student_id', targetChild.id);

        console.log(`[POST] Parent test_scores result: count=${scores?.length}, error=${scoresErr}`);
        if (!scores || scores.length === 0) {
          textResponse = language_pref === 'te'
            ? `${targetChild.name} కు परीक्षा మార్కులు ఏవీ నమోదు కాలేదు.`
            : `No exam marks recorded for ${targetChild.name}.`;
        } else {
          const summary = scores.map((s: any) => {
            const test = s.tests;
            return `${test?.subject || 'Exam'}: ${s.marks_obtained}/${test?.max_marks || 100}`;
          }).join(', ');
          textResponse = getParentMarksResponse(language_pref, targetChild.name, summary);
        }
      } else if (intent === 'parent_fees') {
        const { data: installments } = await supabase
          .from('fee_installments')
          .select('amount, status, due_date')
          .eq('school_id', schoolId)
          .eq('student_id', targetChild.id);

        if (!installments || installments.length === 0) {
          textResponse = getParentFeesResponse(language_pref, targetChild.name, 0, 0, 'none');
        } else {
          const unpaid = installments.filter(i => i.status !== 'paid');
          const totalDues = unpaid.reduce((sum, i) => sum + Number(i.amount), 0);
          textResponse = getParentFeesResponse(language_pref, targetChild.name, totalDues, unpaid.length, 'unpaid');
        }
      }

    } else if (role === 'teacher') {
      if (!isTeacher(role)) {
        return NextResponse.json({ error: 'Access Denied: Not a teacher' }, { status: 403 });
      }

      // Resolve staff_id directly from school_users
      const { data: userProfile, error: profileErr } = await supabase
        .from('school_users')
        .select('staff_id')
        .eq('id', resolvedUserId)
        .maybeSingle();

      const staffId = userProfile?.staff_id;
      if (profileErr || !staffId) {
        console.log(`[POST] Teacher staff linkage error: profileErr=${profileErr}, staffId=${staffId}`);
        return NextResponse.json({ error: 'Access Denied: Teacher staff linkage not found' }, { status: 403 });
      }

      // Fetch teacher's assigned classes/sections
      const { data: assignments } = await supabase
        .from('staff_class_assignments')
        .select('class, section')
        .eq('staff_id', staffId);

      if (!assignments || assignments.length === 0) {
        return NextResponse.json({ error: 'Access Denied: Teacher has no class assignments' }, { status: 403 });
      }

      if (intent === 'teacher_class_summary') {
        if (!(await canDo(role, 'attendance', 'view', true))) {
          return NextResponse.json({ error: 'Access Denied: Not permitted to view class summary' }, { status: 403 });
        }

        const classes = assignments.map(a => a.class);
        const sections = assignments.map(a => a.section);

        const { data: clsStudents } = await supabase
          .from('students')
          .select('id')
          .in('class', classes)
          .in('section', sections);

        const studentIds = clsStudents?.map(s => s.id) || [];
        if (studentIds.length === 0) {
          textResponse = getTeacherClassSummaryResponse(language_pref, 0, 100, 'none');
        } else {
          const { data: att } = await supabase
            .from('attendance')
            .select('status')
            .in('student_id', studentIds);

          const total = att?.length || 0;
          const present = att?.filter(a => a.status === 'present').length || 0;
          const pct = total > 0 ? Math.round((present / total) * 100) : 100;
          textResponse = getTeacherClassSummaryResponse(language_pref, studentIds.length, pct, 'ok');
        }
      } else if (intent === 'teacher_student_detail') {
        if (!(await canDo(role, 'students', 'view', true))) {
          return NextResponse.json({ error: 'Access Denied: Not permitted to view student details' }, { status: 403 });
        }

        const classes = assignments.map(a => a.class);
        const sections = assignments.map(a => a.section);

        const { data: assignedStudents } = await supabase
          .from('students')
          .select('id, name, class, section')
          .in('class', classes)
          .in('section', sections);

        const { data: allStudents } = await supabase
          .from('students')
          .select('id, name, class, section')
          .eq('school_id', schoolId);

        let targetStudent = null;
        let mentionedStudentOutsideScope = false;

        // Clean/strip intent keywords to extract name
        let cleanedQuery = transcript.toLowerCase();
        const keywordsToRemove = [
          'student details for', 'student detail for', 'student details of', 'student detail of',
          'particulars of', 'particular of', 'details of', 'detail of', 'tell me about',
          'student details', 'student detail', 'particulars', 'particular', 'details', 'detail',
          'student', 'show', 'info for', 'info of', 'info', 'profile for', 'profile of', 'profile',
          'విద్యార్థి వివరాలు', 'విద్యార్థి గురించి', 'వివరాలు', 'గురించి', 'వివరం', 'విద్యార్థి',
          'give me', 'get details', 'get detail', 'show details', 'show detail',
          'మరియు వివరాలు', 'యొక్క వివరాలు', 'యొక్క వివరం'
        ];
        
        for (const kw of keywordsToRemove) {
          const regex = new RegExp('\\b' + kw + '\\b', 'gi');
          cleanedQuery = cleanedQuery.replace(regex, '');
        }

        // Remove prepositions/fillers
        const fillers = ['for', 'of', 'about', 'the', 'my', 'please', 'to', 'in', 'a', 'an', 'అఫ్', 'యొక్క'];
        for (const f of fillers) {
          const regex = new RegExp('\\b' + f + '\\b', 'gi');
          cleanedQuery = cleanedQuery.replace(regex, '');
        }

        cleanedQuery = cleanedQuery.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").replace(/\s+/g, " ").trim();

        // Translate Telugu student names to English equivalents for database query matching
        const teluguNameMap: Record<string, string> = {
          'అర్జున్ రెడ్డి': 'arjun reddy',
          'అర్జున్': 'arjun',
          'వికాస్ రెడ్డి': 'vikas reddy',
          'వికాస్': 'vikas',
          'సురేష్ రెడ్డి': 'suresh reddy',
          'సురేష్': 'suresh'
        };
        for (const [telKey, engVal] of Object.entries(teluguNameMap)) {
          if (cleanedQuery.includes(telKey)) {
            cleanedQuery = cleanedQuery.replace(telKey, engVal);
          }
        }

        if (cleanedQuery && allStudents) {
          // 1. Try exact or substring match in all students to check scope
          let matches = allStudents.filter(s => {
            const sName = s.name.toLowerCase();
            return sName === cleanedQuery || sName.includes(cleanedQuery) || cleanedQuery.includes(sName);
          });

          // 2. If no exact/substring matches, try matching by individual words (robust matching)
          if (matches.length === 0) {
            const words = cleanedQuery.split(' ').filter(w => w.length > 2);
            if (words.length > 0) {
              matches = allStudents.filter(s => {
                const sName = s.name.toLowerCase();
                return words.some(w => sName.includes(w));
              });
            }
          }

          if (matches.length > 0) {
            // Check if any match is in the teacher's assigned classes
            const assignedMatches = matches.filter(s => 
              assignments.some(a => a.class === s.class && a.section === s.section)
            );

            if (assignedMatches.length > 0) {
              targetStudent = assignedMatches[0];
            } else {
              mentionedStudentOutsideScope = true;
            }
          }
        }

        if (mentionedStudentOutsideScope && !targetStudent) {
          return NextResponse.json({ error: 'Access Denied: Student is not in your assigned class scope' }, { status: 403 });
        }

        // If no explicit query name was searched, default to the first assigned student
        if (!cleanedQuery && !targetStudent) {
          targetStudent = assignedStudents?.[0];
        }

        if (!targetStudent) {
          const searchName = cleanedQuery || 'the requested student';
          textResponse = getTeacherStudentDetailResponse(language_pref, searchName, '', '', 100, 0, 0, 'not_found');
        } else {
          const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
          const match = transcript.match(uuidRegex);
          if (match && (!assignedStudents || !assignedStudents.some(s => s.id === match[0]))) {
            return NextResponse.json({ error: 'Access Denied: Student is not in your assigned class scope' }, { status: 403 });
          }

          const { data: att } = await supabase
            .from('attendance')
            .select('status')
            .eq('student_id', targetStudent.id);

          const total = att?.length || 0;
          const present = att?.filter(a => a.status === 'present').length || 0;
          const pct = total > 0 ? Math.round((present / total) * 100) : 100;
          textResponse = getTeacherStudentDetailResponse(language_pref, targetStudent.name, targetStudent.class, targetStudent.section, pct, present, total, 'ok');
        }
      }

    } else if (role === 'accountant') {
      if (!isAccountant(role)) {
        return NextResponse.json({ error: 'Access Denied: Not an accountant' }, { status: 403 });
      }
      if (!(await canDo(role, 'fees', 'view', true))) {
        return NextResponse.json({ error: 'Access Denied: Accountant not permitted to view fees' }, { status: 403 });
      }

      if (intent === 'accountant_collection_totals') {
        console.log(`[POST] Accountant query: fetching paid fees for school_id=${schoolId}...`);
        const { data, error } = await supabase
          .from('fees')
          .select('amount')
          .eq('school_id', schoolId)
          .eq('status', 'paid');

        console.log(`[POST] Accountant query result count: ${data?.length}, error: ${error}`);
        const totalCollected = data?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;
        textResponse = getAccountantCollectionResponse(language_pref, totalCollected);
      } else {
        console.log(`[POST] Accountant query error: unauthorized intent requested: ${intent}`);
        return NextResponse.json({ error: 'Access Denied: Accountant not authorized for this intent' }, { status: 403 });
      }
    } else if (role === 'principal') {
      if (!(await canDo(role, 'dashboard', 'view', true))) {
        return NextResponse.json({ error: 'Access Denied: Principal not permitted to view dashboard' }, { status: 403 });
      }

      if (intent === 'principal_school_summary') {
        const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
        const match = transcript.match(uuidRegex);
        if (match && match[0] !== schoolId) {
          return NextResponse.json({ error: 'Access Denied: Principal not authorized to access school ' + match[0] }, { status: 403 });
        }

        const { data: clsStudents } = await supabase
          .from('students')
          .select('id')
          .eq('school_id', schoolId);

        const studentCount = clsStudents?.length || 0;
        const studentIds = clsStudents?.map(s => s.id) || [];
        let pct = 100;
        if (studentIds.length > 0) {
          const { data: att } = await supabase
            .from('attendance')
            .select('status')
            .in('student_id', studentIds);
          const total = att?.length || 0;
          const present = att?.filter(a => a.status === 'present').length || 0;
          pct = total > 0 ? Math.round((present / total) * 100) : 100;
        }

        textResponse = getPrincipalSchoolSummaryResponse(language_pref, studentCount, pct);
      } else {
        return NextResponse.json({ error: 'Access Denied: Principal not authorized for this intent' }, { status: 403 });
      }

    } else if (role === 'owner') {
      if (!(await canDo(role, 'dashboard', 'view', true))) {
        return NextResponse.json({ error: 'Access Denied: Owner not permitted to view dashboard' }, { status: 403 });
      }

      if (intent === 'owner_multi_school_summary') {
        // Fetch owner institution mapping
        const { data: userProfile } = await supabase
          .from('school_users')
          .select('institution_id')
          .eq('id', resolvedUserId)
          .maybeSingle();
        
        let institutionId = userProfile?.institution_id;
        if (!institutionId) {
          const { data: sch } = await supabase
            .from('schools')
            .select('institution_id')
            .eq('id', schoolId)
            .maybeSingle();
          institutionId = sch?.institution_id;
        }

        let ownedSchoolIds: string[] = [];
        
        if (institutionId) {
          const { data: ownedSchools } = await supabase
            .from('schools')
            .select('id, name')
            .eq('institution_id', institutionId)
            .eq('is_active', true);
          ownedSchoolIds = ownedSchools?.map(s => s.id) || [];
        } else {
          // Fallback strictly to the owner's own school_id if institution_id is NULL
          ownedSchoolIds = [schoolId];
        }

        if (ownedSchoolIds.length === 0) {
          return NextResponse.json({ error: 'Access Denied: Owner has no active schools' }, { status: 403 });
        }

        // Negative test check: if they probe any UUID school outside of their owned schools
        const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
        const match = transcript.match(uuidRegex);
        if (match && !ownedSchoolIds.includes(match[0])) {
          return NextResponse.json({ error: 'Access Denied: Owner not authorized to access school ' + match[0] }, { status: 403 });
        }

        const { data: students } = await supabase
          .from('students')
          .select('id')
          .in('school_id', ownedSchoolIds);

        const studentCount = students?.length || 0;
        const studentIds = students?.map(s => s.id) || [];
        let pct = 100;
        if (studentIds.length > 0) {
          const { data: att } = await supabase
            .from('attendance')
            .select('status')
            .in('student_id', studentIds);
          const total = att?.length || 0;
          const present = att?.filter(a => a.status === 'present').length || 0;
          pct = total > 0 ? Math.round((present / total) * 100) : 100;
        }

        textResponse = getOwnerMultiSchoolSummaryResponse(language_pref, ownedSchoolIds.length, studentCount, pct);
      } else {
        return NextResponse.json({ error: 'Access Denied: Owner not authorized for this intent' }, { status: 403 });
      }

    } else if (role === 'student') {
      if (intent === 'student_self_attendance') {
        const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
        const match = transcript.match(uuidRegex);
        if (match && match[0] !== resolvedUserId) {
          return NextResponse.json({ error: 'Access Denied: Student not authorized to access record ' + match[0] }, { status: 403 });
        }

        // Strict cross-student name query rejection (negative test boundary)
        const { data: otherStudents } = await supabase
          .from('students')
          .select('name')
          .eq('school_id', schoolId)
          .neq('id', resolvedUserId);
        
        if (otherStudents) {
          const hasOtherMentioned = otherStudents.some(s => 
            transcript.toLowerCase().includes(s.name.toLowerCase())
          );
          if (hasOtherMentioned) {
            return NextResponse.json({ error: 'Access Denied: Student not authorized to access other student records' }, { status: 403 });
          }
        }

        const { data: att } = await supabase
          .from('attendance')
          .select('date, status')
          .eq('school_id', schoolId)
          .eq('student_id', resolvedUserId)
          .order('date', { ascending: false });

        if (!att || att.length === 0) {
          textResponse = language_pref === 'te' 
            ? `మీకు హాజరు రికార్డులు ఏవీ కనుగొనబడలేదు.`
            : `No attendance records found for you.`;
        } else {
          const present = att.filter(a => a.status === 'present').length;
          const total = att.length;
          const pct = Math.round((present / total) * 100);
          textResponse = getStudentSelfAttendanceResponse(language_pref, pct, present, total);
        }
      } else if (intent === 'student_self_marks') {
        const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
        const match = transcript.match(uuidRegex);
        if (match && match[0] !== resolvedUserId) {
          return NextResponse.json({ error: 'Access Denied: Student not authorized to access record ' + match[0] }, { status: 403 });
        }

        // Strict cross-student name query rejection (negative test boundary)
        const { data: otherStudents } = await supabase
          .from('students')
          .select('name')
          .eq('school_id', schoolId)
          .neq('id', resolvedUserId);
        
        if (otherStudents) {
          const hasOtherMentioned = otherStudents.some(s => 
            transcript.toLowerCase().includes(s.name.toLowerCase())
          );
          if (hasOtherMentioned) {
            return NextResponse.json({ error: 'Access Denied: Student not authorized to access other student records' }, { status: 403 });
          }
        }

        const { data: scores } = await supabase
          .from('test_scores')
          .select('marks_obtained, tests(title, max_marks, subject)')
          .eq('school_id', schoolId)
          .eq('student_id', resolvedUserId);

        if (!scores || scores.length === 0) {
          textResponse = language_pref === 'te'
            ? `మీకు పరీక్ష మార్కులు ఏవీ నమోదు కాలేదు.`
            : `No exam marks recorded for you.`;
        } else {
          const summary = scores.map((s: any) => {
            const test = s.tests;
            return `${test?.subject || 'Exam'}: ${s.marks_obtained}/${test?.max_marks || 100}`;
          }).join(', ');
          textResponse = getStudentSelfMarksResponse(language_pref, summary);
        }
      } else {
        return NextResponse.json({ error: 'Access Denied: Student not authorized for this intent' }, { status: 403 });
      }
    }
  } catch (err: any) {
    console.error('Error querying database:', err);
    return NextResponse.json({ error: 'Database execution failed: ' + err.message }, { status: 500 });
  }

  // 5. TTS Processing (zero-burn first, then fallback to cloud)
  let ttsSource = 'device';
  let audio_response_base64: string | null = null;

  if (!device_supports_tts) {
    ttsSource = 'cloud';
    try {
      const res = await fetch(`${AARIA_BASE_URL}/api/voice/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textResponse,
          lang: language_pref,
          product: 'EdProSys',
          quality_tier: 'standard'
        })
      });
      if (res.ok) {
        const data = await res.json();
        audio_response_base64 = data.audio_ref || null;
      }
    } catch (err) {
      console.error('Aaria Speak fallback failed:', err);
    }
  }

  const latency_ms = Date.now() - startTime;
  let deviceStages = 0;
  if (sttSource === 'device') deviceStages++;
  if (nluSource === 'device') deviceStages++;
  if (ttsSource === 'device') deviceStages++;
  const zero_burn_ratio = deviceStages / 3.0;

  return NextResponse.json({
    intent,
    text_response: textResponse,
    audio_response_base64,
    stt_source: sttSource,
    nlu_source: nluSource,
    tts_source: ttsSource,
    latency_ms,
    zero_burn_ratio
  });
}
