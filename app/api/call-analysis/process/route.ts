// PATH: app/api/call-analysis/process/route.ts
// Counsellor call analysis: Upload audio → Whisper transcript → Claude coaching score
// Stores result in call_logs table

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { callClaude } from '@/lib/claudeClient';
import { getSchoolId } from '@/lib/getSchoolId';

// Allow up to 60 seconds for Whisper transcription + Claude evaluation
export const maxDuration = 60;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

interface CallAnalysisResult {
  quality_score: number;       // 1–10
  summary: string;             // 2–3 sentence call summary
  strengths: string;           // what counsellor did well
  improvements: string;        // specific areas to improve
  feedback: string;            // actionable coaching note
  follow_up_suggested: boolean;
  follow_up_note?: string;
}

async function transcribeAudio(
  audioBuffer: ArrayBuffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: mimeType });
  formData.append('file', blob, fileName);
  formData.append('model', 'whisper-1');
  formData.append('language', 'en');
  formData.append('response_format', 'text');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Whisper API error: ${response.status} - ${err}`);
  }

  return (await response.text()).trim();
}

async function analyseCall(
  transcript: string,
  counsellorName: string
): Promise<CallAnalysisResult> {
  const system = `You are an expert admissions training coach reviewing counsellor call recordings at a premium school.
Analyse the transcript and return ONLY a valid JSON object with exactly these keys:
{
  "quality_score": <integer 1-10>,
  "summary": "<2-3 sentence summary of what the call covered>",
  "strengths": "<2-3 specific things the counsellor did well, 50-80 words>",
  "improvements": "<2-3 specific areas to improve with concrete suggestions, 50-80 words>",
  "feedback": "<overall coaching feedback and actionable next steps, 70-100 words>",
  "follow_up_suggested": <true|false>,
  "follow_up_note": "<what follow-up action is recommended, or empty string>"
}
No markdown. No explanation. Only the JSON object.`;

  const userMsg = `Counsellor: ${counsellorName}

Call transcript:
${transcript.slice(0, 6000)}

Analyse this admissions call and return the JSON.`;

  const raw = await callClaude(system, userMsg, 700);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Claude returned invalid JSON');

  const parsed = JSON.parse(match[0]) as CallAnalysisResult;
  if (typeof parsed.quality_score !== 'number') throw new Error('Invalid analysis schema');
  return parsed;
}

export async function POST(req: NextRequest) {
  const schoolId = getSchoolId(req);
  let callLogId: string | null = null;

  // ── Graceful 503 guard: check OPENAI_API_KEY BEFORE any DB writes ──────────
  // This prevents call_log rows from being created with no way to complete them.
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      error: 'Call analysis requires OpenAI Whisper. OPENAI_API_KEY not configured.',
      setup: [
        'Add OPENAI_API_KEY to Vercel environment variables',
        'Redeploy after adding the key',
      ],
    }, { status: 503 });
  }

  try {
    const contentType = req.headers.get('content-type') ?? '';

    let audioBuffer: ArrayBuffer;
    let fileName: string;
    let mimeType: string;
    let staffId: string | null = null;
    let inquiryId: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('audio') as File | null;
      staffId = (formData.get('staffId') as string) ?? null;
      inquiryId = (formData.get('inquiryId') as string) ?? null;

      if (!file) return NextResponse.json({ error: 'audio file required' }, { status: 400 });
      if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'File too large. Max 50MB.' }, { status: 400 });

      audioBuffer = await file.arrayBuffer();
      fileName = file.name;
      mimeType = file.type || 'audio/mpeg';
    } else {
      return NextResponse.json({ error: 'Multipart form data required' }, { status: 400 });
    }

    // Fetch counsellor name if staffId provided
    let counsellorName = 'Counsellor';
    if (staffId) {
      const { data: staffData } = await supabaseAdmin
        .from('staff').select('name').eq('id', staffId).eq('school_id', schoolId).single();
      if (staffData?.name) counsellorName = staffData.name;
    }

    // Upload to storage
    const timestamp = Date.now();
    const ext = fileName.split('.').pop() ?? 'mp3';
    const storagePath = `${schoolId}/call_recordings/${timestamp}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('recordings')
      .upload(storagePath, audioBuffer, { contentType: mimeType, upsert: false });

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

    const { data: urlData } = supabaseAdmin.storage.from('recordings').getPublicUrl(storagePath);
    const fileUrl = urlData?.publicUrl ?? storagePath;

    // Create call_log record
    const { data: callLog, error: insertError } = await supabaseAdmin
      .from('call_logs')
      .insert({
        school_id: schoolId,
        inquiry_id: inquiryId,
        staff_id: staffId,
        recording_url: fileUrl,
        called_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError || !callLog) throw new Error('Failed to create call log record');
    callLogId = callLog.id as string;

    // Transcribe
    const transcript = await transcribeAudio(audioBuffer, mimeType, fileName);

    // Analyse
    const analysis = await analyseCall(transcript, counsellorName);

    // Update call_log with results
    await supabaseAdmin.from('call_logs').update({
      transcript,
      quality_score: analysis.quality_score,
      ai_feedback: JSON.stringify(analysis),
      duration_seconds: Math.round(audioBuffer.byteLength / 16000), // rough estimate
      processed_at: new Date().toISOString(),
    }).eq('id', callLogId);

    return NextResponse.json({
      success: true,
      call_log_id: callLogId,
      counsellor: counsellorName,
      transcript: transcript.slice(0, 500) + (transcript.length > 500 ? '...' : ''),
      analysis,
    });

  } catch (err) {
    console.error('Call analysis error:', err);
    if (callLogId) {
      await supabaseAdmin.from('call_logs').update({
        ai_feedback: JSON.stringify({ error: String(err) }),
        processed_at: new Date().toISOString(),
      }).eq('id', callLogId).then(null, () => {});
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// GET: list recent call logs for this school
export async function GET(req: NextRequest) {
  const schoolId = getSchoolId(req);
  try {
    const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '20');
    const { data, error } = await supabaseAdmin
      .from('call_logs')
      .select('id, staff_id, inquiry_id, recording_url, transcript, quality_score, ai_feedback, duration_seconds, called_at, processed_at, staff(name, role), inquiries(parent_name, child_name, target_class)')
      .eq('school_id', schoolId)
      .order('called_at', { ascending: false })
      .limit(Math.min(limit, 50));

    if (error) throw new Error(error.message);
    return NextResponse.json({ call_logs: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
