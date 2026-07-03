import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../../app/api/voice-query/route';
import { issueSession } from '../../lib/session';
import { signParentSession } from '../../lib/parent-auth';

describe('EdProSys read-only voice query endpoint tests', () => {
  it('1. Parent positive query - Suresh Reddy queries Arjun Reddy marks (Zero-Burn)', async () => {
    const parentToken = await signParentSession({
      parentId: '41074512-070e-4c20-9fd1-3fd00f5ee8b9', // Suresh Reddy
      schoolId: '00000000-0000-0000-0000-000000000001',
      studentId: '00000000-0000-0000-0000-000000000020', // Arjun Reddy
      phone: '+919515479595'
    });

    const payload = {
      transcript: 'Give me the exam marks for my child Arjun Reddy',
      confidence: 0.95,
      language_pref: 'en',
      device_supports_tts: true
    };

    const req = new NextRequest(new URL('http://localhost:3000/api/voice-query'), {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Cookie': `parent_session=${parentToken}`
      }
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    
    expect(data.intent).toBe('parent_marks');
    expect(data.text_response).toContain('Exam marks for Arjun Reddy:');
    expect(data.zero_burn_ratio).toBe(1.0);
    expect(data.stt_source).toBe('device');
    expect(data.nlu_source).toBe('device');
    expect(data.tts_source).toBe('device');
  });

  it('2. Parent negative query - Suresh Reddy queries unassociated child (Rejected)', async () => {
    const parentToken = await signParentSession({
      parentId: '41074512-070e-4c20-9fd1-3fd00f5ee8b9', // Suresh Reddy
      schoolId: '00000000-0000-0000-0000-000000000001',
      studentId: '00000000-0000-0000-0000-000000000020', // Arjun Reddy
      phone: '+919515479595'
    });

    // Probing with a non-associated student UUID in transcript
    const payload = {
      transcript: 'Show me marks of child 81d8b151-4bb2-4c8e-b2c1-f388c78c3d2c',
      confidence: 0.95,
      language_pref: 'en',
      device_supports_tts: true
    };

    const req = new NextRequest(new URL('http://localhost:3000/api/voice-query'), {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Cookie': `parent_session=${parentToken}`
      }
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('Access Denied: Parent not authorized');
  });

  it('3. Teacher positive query - test.teacher queries assigned student Arjun Reddy', async () => {
    const teacherToken = await issueSession({
      schoolId: '00000000-0000-0000-0000-000000000001',
      schoolName: 'Demo Institution',
      schoolSlug: 'demo',
      plan: 'campus',
      userId: '268d6f30-d964-4b37-adde-688a9d984cba', // test.teacher
      userEmail: 'test.teacher@schoolos.local',
      userRole: 'teacher',
      userName: 'Test Teacher'
    });

    const payload = {
      transcript: 'Give me the student detail for Arjun Reddy',
      confidence: 0.95,
      language_pref: 'en',
      device_supports_tts: true
    };

    const req = new NextRequest(new URL('http://localhost:3000/api/voice-query'), {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Cookie': `school_session=${teacherToken}`
      }
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.intent).toBe('teacher_student_detail');
    expect(data.text_response).toContain('Student details for Arjun Reddy: Class 5-A');
  });

  it('4. Teacher negative query - test.teacher queries student Vikas Reddy (Outside class scope)', async () => {
    const teacherToken = await issueSession({
      schoolId: '00000000-0000-0000-0000-000000000001',
      schoolName: 'Demo Institution',
      schoolSlug: 'demo',
      plan: 'campus',
      userId: '268d6f30-d964-4b37-adde-688a9d984cba', // test.teacher
      userEmail: 'test.teacher@schoolos.local',
      userRole: 'teacher',
      userName: 'Test Teacher'
    });

    // Vikas Reddy is in class 5-b, teacher is assigned only to 5-A
    const payload = {
      transcript: 'Show me details for Vikas Reddy',
      confidence: 0.95,
      language_pref: 'en',
      device_supports_tts: true
    };

    const req = new NextRequest(new URL('http://localhost:3000/api/voice-query'), {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Cookie': `school_session=${teacherToken}`
      }
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('Access Denied: Student is not in your assigned class scope');
  });

  it('5. Accountant query - demo.accountant queries total collections', async () => {
    const accountantToken = await issueSession({
      schoolId: '00000000-0000-0000-0000-000000000001',
      schoolName: 'Demo Institution',
      schoolSlug: 'demo',
      plan: 'campus',
      userId: 'd2d90e8b-7d23-46a7-ab36-f90bab3e7de2', // demo.accountant
      userEmail: 'demo.accountant@schoolos.local',
      userRole: 'accountant',
      userName: 'Demo Accountant'
    });

    const payload = {
      transcript: 'Show total collections received',
      confidence: 0.95,
      language_pref: 'en',
      device_supports_tts: true
    };

    const req = new NextRequest(new URL('http://localhost:3000/api/voice-query'), {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Cookie': `school_session=${accountantToken}`
      }
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.intent).toBe('accountant_collection_totals');
    expect(data.text_response).toContain('Total fee collections received for this school is Rs. 2,12,000');
  });

  it('6. Cloud Fallback Test - triggers cloud NLU & TTS fallbacks', async () => {
    const parentToken = await signParentSession({
      parentId: '41074512-070e-4c20-9fd1-3fd00f5ee8b9', // Suresh Reddy
      schoolId: '00000000-0000-0000-0000-000000000001',
      studentId: '00000000-0000-0000-0000-000000000020', // Arjun Reddy
      phone: '+919515479595'
    });

    const originalFetch = global.fetch;
    const mockFetch = vi.fn().mockImplementation((url, init) => {
      const urlStr = url.toString();
      if (urlStr.endsWith('/api/voice/understand')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ intent: 'parent_attendance', confidence: 0.85 })
        } as Response);
      }
      if (urlStr.endsWith('/api/voice/speak')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ audio_ref: 'cloud-tts-audio-base64' })
        } as Response);
      }
      // Pass-through database requests to actual Supabase API
      return originalFetch(url, init);
    });
    vi.stubGlobal('fetch', mockFetch);

    const payload = {
      transcript: 'some ambiguous query phrase',
      confidence: 0.95,
      language_pref: 'en',
      device_supports_tts: false // Forces cloud TTS
    };

    const req = new NextRequest(new URL('http://localhost:3000/api/voice-query'), {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Cookie': `parent_session=${parentToken}`
      }
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    
    expect(data.intent).toBe('parent_attendance');
    expect(data.stt_source).toBe('device');
    expect(data.nlu_source).toBe('cloud'); // Triggers cloud NLU
    expect(data.tts_source).toBe('cloud'); // Triggers cloud TTS
    expect(data.audio_response_base64).toBe('cloud-tts-audio-base64');
    expect(data.zero_burn_ratio).toBeCloseTo(1 / 3, 2);

    vi.unstubAllGlobals();
  });

  it('7. Unauthenticated request - no session cookie (Rejected 401)', async () => {
    const payload = {
      transcript: 'Give me the exam marks for my child Arjun Reddy',
      confidence: 0.95,
      language_pref: 'en',
      device_supports_tts: true
    };

    const req = new NextRequest(new URL('http://localhost:3000/api/voice-query'), {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain('Unauthorized: Session not found');
  });

  it('8. Parent query without name - Suresh Reddy asks "attendance of my child"', async () => {
    const parentToken = await signParentSession({
      parentId: '41074512-070e-4c20-9fd1-3fd00f5ee8b9', // Suresh Reddy
      schoolId: '00000000-0000-0000-0000-000000000001',
      studentId: '00000000-0000-0000-0000-000000000020', // Arjun Reddy
      phone: '+919515479595'
    });

    const payload = {
      transcript: 'attendance of my child',
      confidence: 0.95,
      language_pref: 'en',
      device_supports_tts: true
    };

    const req = new NextRequest(new URL('http://localhost:3000/api/voice-query'), {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Cookie': `parent_session=${parentToken}`
      }
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.intent).toBe('parent_attendance');
    expect(data.text_response).toContain('Arjun Reddy\'s overall attendance is 84 percent');
    expect(data.text_response).toContain('Present for 21 out of 25 days');
  });

  it('9. Parent query without name - Suresh Reddy asks "marks of my child"', async () => {
    const parentToken = await signParentSession({
      parentId: '41074512-070e-4c20-9fd1-3fd00f5ee8b9', // Suresh Reddy
      schoolId: '00000000-0000-0000-0000-000000000001',
      studentId: '00000000-0000-0000-0000-000000000020', // Arjun Reddy
      phone: '+919515479595'
    });

    const payload = {
      transcript: 'marks of my child',
      confidence: 0.95,
      language_pref: 'en',
      device_supports_tts: true
    };

    const req = new NextRequest(new URL('http://localhost:3000/api/voice-query'), {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Cookie': `parent_session=${parentToken}`
      }
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.intent).toBe('parent_marks');
    expect(data.text_response).toContain('Chemistry: 73/100');
    expect(data.text_response).toContain('Physics: 65/100');
  });

  it('10. Parent query without name - Suresh Reddy asks "fees of my child"', async () => {
    const parentToken = await signParentSession({
      parentId: '41074512-070e-4c20-9fd1-3fd00f5ee8b9', // Suresh Reddy
      schoolId: '00000000-0000-0000-0000-000000000001',
      studentId: '00000000-0000-0000-0000-000000000020', // Arjun Reddy
      phone: '+919515479595'
    });

    const payload = {
      transcript: 'fees of my child',
      confidence: 0.95,
      language_pref: 'en',
      device_supports_tts: true
    };

    const req = new NextRequest(new URL('http://localhost:3000/api/voice-query'), {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Cookie': `parent_session=${parentToken}`
      }
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.intent).toBe('parent_fees');
    expect(data.text_response).toContain('Arjun Reddy has no fee installments registered');
  });

  it('11. Teacher query - robust student name matching for "tell me about Arjun"', async () => {
    const teacherToken = await issueSession({
      schoolId: '00000000-0000-0000-0000-000000000001',
      schoolName: 'Demo Institution',
      schoolSlug: 'demo',
      plan: 'campus',
      userId: '268d6f30-d964-4b37-adde-688a9d984cba', // test.teacher
      userEmail: 'test.teacher@schoolos.local',
      userRole: 'teacher',
      userName: 'Test Teacher'
    });

    const payload = {
      transcript: 'tell me about Arjun',
      confidence: 0.95,
      language_pref: 'en',
      device_supports_tts: true
    };

    const req = new NextRequest(new URL('http://localhost:3000/api/voice-query'), {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Cookie': `school_session=${teacherToken}`
      }
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.intent).toBe('teacher_student_detail');
    expect(data.text_response).toContain('Student details for Arjun Reddy: Class 5-A');
  });

  it('12. Teacher query - robust matching fallback for nonexistent student', async () => {
    const teacherToken = await issueSession({
      schoolId: '00000000-0000-0000-0000-000000000001',
      schoolName: 'Demo Institution',
      schoolSlug: 'demo',
      plan: 'campus',
      userId: '268d6f30-d964-4b37-adde-688a9d984cba', // test.teacher
      userEmail: 'test.teacher@schoolos.local',
      userRole: 'teacher',
      userName: 'Test Teacher'
    });

    const payload = {
      transcript: 'details of NonexistentStudent',
      confidence: 0.95,
      language_pref: 'en',
      device_supports_tts: true
    };

    const req = new NextRequest(new URL('http://localhost:3000/api/voice-query'), {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Cookie': `school_session=${teacherToken}`
      }
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.intent).toBe('teacher_student_detail');
    expect(data.text_response).toContain('I couldn\'t find a student matching "nonexistentstudent" in your assigned classes.');
  });

  it('13. Localized Response - Parent query for attendance in Telugu (language_pref: "te")', async () => {
    const parentToken = await signParentSession({
      parentId: '41074512-070e-4c20-9fd1-3fd00f5ee8b9', // Suresh Reddy
      schoolId: '00000000-0000-0000-0000-000000000001',
      studentId: '00000000-0000-0000-0000-000000000020', // Arjun Reddy
      phone: '+919515479595'
    });

    const payload = {
      transcript: 'హాజరు',
      confidence: 0.95,
      language_pref: 'te',
      device_supports_tts: true
    };

    const req = new NextRequest(new URL('http://localhost:3000/api/voice-query'), {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Cookie': `parent_session=${parentToken}`
      }
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.intent).toBe('parent_attendance');
    expect(data.text_response).toContain('మొత్తం హాజరు 84 శాతం');
  });

  it('14. Localized Response - Parent query for marks in Telugu (language_pref: "te")', async () => {
    const parentToken = await signParentSession({
      parentId: '41074512-070e-4c20-9fd1-3fd00f5ee8b9', // Suresh Reddy
      schoolId: '00000000-0000-0000-0000-000000000001',
      studentId: '00000000-0000-0000-0000-000000000020', // Arjun Reddy
      phone: '+919515479595'
    });

    const payload = {
      transcript: 'మార్కులు',
      confidence: 0.95,
      language_pref: 'te',
      device_supports_tts: true
    };

    const req = new NextRequest(new URL('http://localhost:3000/api/voice-query'), {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Cookie': `parent_session=${parentToken}`
      }
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.intent).toBe('parent_marks');
    expect(data.text_response).toContain('పరీక్ష మార్కులు');
  });

  it('15. Localized Response - Teacher query for student details in Telugu (language_pref: "te")', async () => {
    const teacherToken = await issueSession({
      schoolId: '00000000-0000-0000-0000-000000000001',
      schoolName: 'Demo Institution',
      schoolSlug: 'demo',
      plan: 'campus',
      userId: '268d6f30-d964-4b37-adde-688a9d984cba', // test.teacher
      userEmail: 'test.teacher@schoolos.local',
      userRole: 'teacher',
      userName: 'Test Teacher'
    });

    const payload = {
      transcript: 'అర్జున్ రెడ్డి వివరాలు',
      confidence: 0.95,
      language_pref: 'te',
      device_supports_tts: true
    };

    const req = new NextRequest(new URL('http://localhost:3000/api/voice-query'), {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Cookie': `school_session=${teacherToken}`
      }
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.intent).toBe('teacher_student_detail');
    expect(data.text_response).toContain('వివరాలు: తరగతి 5-A. మొత్తం హాజరు 84 శాతం');
  });

  it('16. Localized Response - Teacher query for class summary in Telugu (language_pref: "te")', async () => {
    const teacherToken = await issueSession({
      schoolId: '00000000-0000-0000-0000-000000000001',
      schoolName: 'Demo Institution',
      schoolSlug: 'demo',
      plan: 'campus',
      userId: '268d6f30-d964-4b37-adde-688a9d984cba', // test.teacher
      userEmail: 'test.teacher@schoolos.local',
      userRole: 'teacher',
      userName: 'Test Teacher'
    });

    const payload = {
      transcript: 'తరగతి పనితీరు',
      confidence: 0.95,
      language_pref: 'te',
      device_supports_tts: true
    };

    const req = new NextRequest(new URL('http://localhost:3000/api/voice-query'), {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Cookie': `school_session=${teacherToken}`
      }
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.intent).toBe('teacher_class_summary');
    expect(data.text_response).toContain('తరగతి పనితీరు సారాంశం');
  });

  it('17. Localized Response - Accountant query for collections in Telugu (language_pref: "te")', async () => {
    const accountantToken = await issueSession({
      schoolId: '00000000-0000-0000-0000-000000000001',
      schoolName: 'Demo Institution',
      schoolSlug: 'demo',
      plan: 'campus',
      userId: 'd2d90e8b-7d23-46a7-ab36-f90bab3e7de2', // demo.accountant
      userEmail: 'demo.accountant@schoolos.local',
      userRole: 'accountant',
      userName: 'Demo Accountant'
    });

    const payload = {
      transcript: 'వసూళ్లు',
      confidence: 0.95,
      language_pref: 'te',
      device_supports_tts: true
    };

    const req = new NextRequest(new URL('http://localhost:3000/api/voice-query'), {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Cookie': `school_session=${accountantToken}`
      }
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.intent).toBe('accountant_collection_totals');
    expect(data.text_response).toContain('ఫీజు వసూళ్లు రూ. 2,12,000');
  });

  it('18. Phonetic Telugu - Class summary transliterated matches locally (Zero-Burn)', async () => {
    const teacherToken = await issueSession({
      schoolId: '00000000-0000-0000-0000-000000000001',
      schoolName: 'Demo Institution',
      schoolSlug: 'demo',
      plan: 'campus',
      userId: '268d6f30-d964-4b37-adde-688a9d984cba', // test.teacher
      userEmail: 'test.teacher@schoolos.local',
      userRole: 'teacher',
      userName: 'Test Teacher'
    });

    const payload = {
      transcript: 'క్లాస్ సమ్మరీ',
      confidence: 0.95,
      language_pref: 'te',
      device_supports_tts: true
    };

    const req = new NextRequest(new URL('http://localhost:3000/api/voice-query'), {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Cookie': `school_session=${teacherToken}`
      }
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.intent).toBe('teacher_class_summary');
    expect(data.text_response).toContain('తరగతి పనితీరు సారాంశం');
  });

  it('19. Name-only student query - overrides to teacher_student_detail', async () => {
    const teacherToken = await issueSession({
      schoolId: '00000000-0000-0000-0000-000000000001',
      schoolName: 'Demo Institution',
      schoolSlug: 'demo',
      plan: 'campus',
      userId: '268d6f30-d964-4b37-adde-688a9d984cba', // test.teacher
      userEmail: 'test.teacher@schoolos.local',
      userRole: 'teacher',
      userName: 'Test Teacher'
    });

    const payload = {
      transcript: 'అర్జున్ రెడ్డి',
      confidence: 0.95,
      language_pref: 'te',
      device_supports_tts: true
    };

    const req = new NextRequest(new URL('http://localhost:3000/api/voice-query'), {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Cookie': `school_session=${teacherToken}`
      }
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.intent).toBe('teacher_student_detail');
    expect(data.text_response).toContain('వివరాలు: తరగతి 5-A. మొత్తం హాజరు 84 శాతం');
  });

  it('20. Aaria Fallback - maps get_student_info to teacher_student_detail', async () => {
    const teacherToken = await issueSession({
      schoolId: '00000000-0000-0000-0000-000000000001',
      schoolName: 'Demo Institution',
      schoolSlug: 'demo',
      plan: 'campus',
      userId: '268d6f30-d964-4b37-adde-688a9d984cba', // test.teacher
      userEmail: 'test.teacher@schoolos.local',
      userRole: 'teacher',
      userName: 'Test Teacher'
    });

    const originalFetch = global.fetch;
    const mockFetch = vi.fn().mockImplementation((url, init) => {
      const urlStr = url.toString();
      if (urlStr.endsWith('/api/voice/understand')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ intent: 'get_student_info', confidence: 0.85 })
        } as Response);
      }
      return originalFetch(url, init);
    });
    vi.stubGlobal('fetch', mockFetch);

    try {
      const payload = {
        transcript: 'show Arjun Reddy',
        confidence: 0.95,
        language_pref: 'en',
        device_supports_tts: true
      };

      const req = new NextRequest(new URL('http://localhost:3000/api/voice-query'), {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Cookie': `school_session=${teacherToken}`
        }
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.intent).toBe('teacher_student_detail');
      expect(data.text_response).toContain('Student details for Arjun Reddy: Class 5-A');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});


