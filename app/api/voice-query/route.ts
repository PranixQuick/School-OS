import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseClient';
import { getParentSession } from '../../../lib/parent-auth';
import { verifySession } from '../../../lib/session';
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
    if (text.includes('attendance') || text.includes('present') || text.includes('absent') || text.includes('హజరు') || text.includes('హాజరు')) {
      return 'parent_attendance';
    }
    if (text.includes('marks') || text.includes('score') || text.includes('exam') || text.includes('మార్కులు') || text.includes('పరీక్ష') || text.includes('result')) {
      return 'parent_marks';
    }
    if (text.includes('fee') || text.includes('due') || text.includes('pay') || text.includes('ఫీజు')) {
      return 'parent_fees';
    }
  } else if (role === 'teacher') {
    if (text.includes('summary') || text.includes('class') || text.includes('averages') || text.includes('తరగతి') || text.includes('performance')) {
      return 'teacher_class_summary';
    }
    if (text.includes('student') || text.includes('detail') || text.includes('particular') || text.includes('విద్యార్థి') || text.includes('particulars') || text.includes('tell me about') || text.includes('profile')) {
      return 'teacher_student_detail';
    }
  } else if (role === 'accountant') {
    if (text.includes('collection') || text.includes('total') || text.includes('revenue') || text.includes('వసూళ్లు') || text.includes('amount')) {
      return 'accountant_collection_totals';
    }
  }
  return null;
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

  // Check cookie prioritized by the requesting page (referer) to prevent cookie collision
  const referer = req.headers.get('referer') || '';
  const isParentPortal = referer.includes('/parent');

  if (isParentPortal) {
    parentSession = await getParentSession(req);
    if (parentSession) {
      role = 'parent';
      resolvedUserId = parentSession.parentId;
      schoolId = parentSession.schoolId;
    } else {
      const token = req.cookies.get('school_session')?.value;
      const staffSession = await verifySession(token);
      if (staffSession) {
        role = staffSession.userRole;
        resolvedUserId = staffSession.userId;
        schoolId = staffSession.schoolId;
      }
    }
  } else {
    const token = req.cookies.get('school_session')?.value;
    const staffSession = await verifySession(token);
    if (staffSession) {
      role = staffSession.userRole;
      resolvedUserId = staffSession.userId;
      schoolId = staffSession.schoolId;
    } else {
      parentSession = await getParentSession(req);
      if (parentSession) {
        role = 'parent';
        resolvedUserId = parentSession.parentId;
        schoolId = parentSession.schoolId;
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
        intent = data.intent;
        console.log(`[POST] Aaria NLU resolved intent: ${intent}`);
      }
    } catch (err) {
      console.error('Aaria Understand fallback failed:', err);
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
  }

  // 4. Read-Only Query Resolution with strict permissions boundaries
  let textResponse = '';
  console.log(`[POST] Starting DB query resolution for role=${role}, intent=${intent}...`);
  try {
    const supabase = supabaseForUser(schoolId);
    if (intent === 'fallback_unknown' || intent === 'unknown') {
      if (role === 'parent') {
        textResponse = "I'm sorry, I couldn't understand that. Please try asking about your child's attendance, marks, or fees.";
      } else if (role === 'teacher') {
        textResponse = "I'm sorry, I couldn't understand that. Please try asking about class summary or student details.";
      } else if (role === 'accountant') {
        textResponse = "I'm sorry, I couldn't understand that. Please try asking about total collections.";
      } else {
        textResponse = "I'm sorry, I couldn't understand your request.";
      }
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
          textResponse = `No attendance records found for ${targetChild.name}.`;
        } else {
          const present = att.filter(a => a.status === 'present').length;
          const total = att.length;
          const pct = Math.round((present / total) * 100);
          textResponse = `${targetChild.name}'s overall attendance is ${pct} percent. Present for ${present} out of ${total} days.`;
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
          textResponse = `No exam marks recorded for ${targetChild.name}.`;
        } else {
          const summary = scores.map((s: any) => {
            const test = s.tests;
            return `${test?.subject || 'Exam'}: ${s.marks_obtained}/${test?.max_marks || 100}`;
          }).join(', ');
          textResponse = `Exam marks for ${targetChild.name}: ${summary}.`;
        }
      } else if (intent === 'parent_fees') {
        const { data: installments } = await supabase
          .from('fee_installments')
          .select('amount, status, due_date')
          .eq('school_id', schoolId)
          .eq('student_id', targetChild.id);

        if (!installments || installments.length === 0) {
          textResponse = `${targetChild.name} has no fee installments registered.`;
        } else {
          const unpaid = installments.filter(i => i.status !== 'paid');
          const totalDues = unpaid.reduce((sum, i) => sum + Number(i.amount), 0);
          textResponse = `${targetChild.name} has Rs. ${totalDues} outstanding dues across ${unpaid.length} pending installments.`;
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
          textResponse = `No students enrolled in your assigned classes.`;
        } else {
          const { data: att } = await supabase
            .from('attendance')
            .select('status')
            .in('student_id', studentIds);

          const total = att?.length || 0;
          const present = att?.filter(a => a.status === 'present').length || 0;
          const pct = total > 0 ? Math.round((present / total) * 100) : 100;
          textResponse = `Class Performance Summary: Total assigned students: ${studentIds.length}. Overall attendance average: ${pct} percent.`;
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
          'student', 'show', 'info for', 'info of', 'info', 'profile for', 'profile of', 'profile'
        ];
        
        for (const kw of keywordsToRemove) {
          const regex = new RegExp('\\b' + kw + '\\b', 'gi');
          cleanedQuery = cleanedQuery.replace(regex, '');
        }
        cleanedQuery = cleanedQuery.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").replace(/\s+/g, " ").trim();

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
          textResponse = `I couldn't find a student matching "${searchName}" in your assigned classes.`;
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
          textResponse = `Student details for ${targetStudent.name}: Class ${targetStudent.class}-${targetStudent.section}. Overall attendance is ${pct} percent (${present}/${total} days present).`;
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
        textResponse = `Total fee collections received for this school is Rs. ${totalCollected.toLocaleString('en-IN')}.`;
      } else {
        console.log(`[POST] Accountant query error: unauthorized intent requested: ${intent}`);
        return NextResponse.json({ error: 'Access Denied: Accountant not authorized for this intent' }, { status: 403 });
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
