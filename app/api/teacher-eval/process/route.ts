import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { callClaude } from '@/lib/claudeClient';
import { getSchoolId } from '@/lib/getSchoolId';

// Allow up to 60 seconds for Whisper transcription + Claude evaluation
export const maxDuration = 60;

const MAX_FILE_SIZE = 50 * 1024 * 1024;

interface EvalResult {
  score: number;
  strengths: string;
  improvements: string;
  feedback: string;
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

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Whisper API error: ${response.status} - ${err}`);
  }

  const data = await response.json() as { text: string };
  return data.text ?? '';
}

async function evaluateTeaching(transcript: string, teacherName: string, subject: string): Promise<EvalResult> {
  const system = `You are an expert teacher coach evaluating classroom teaching quality.
Analyse the transcript and respond with ONLY valid JSON matching this exact schema:
{"score": <number 1-10>, "strengths": "<string>", "improvements": "<string>", "feedback": "<string>"}
score: overall teaching quality 1-10.
strengths: 1-2 sentences on what was done well.
improvements: 1-2 sentences on specific areas to improve.
feedback: 2-3 sentences of actionable coaching advice.`;

  const user = `Teacher: ${teacherName}${subject ? `, Subject: ${subject}` : ''}

Transcript:
${transcript.slice(0, 3000)}${transcript.length > 3000 ? '\n[truncated]' : ''}`;

  const raw = await callClaude(system, user, 300);

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Claude returned invalid JSON');
  const parsed = JSON.parse(match[0]) as EvalResult;
  if (typeof parsed.score !== 'number') throw new Error('Invalid evaluation schema');
  return parsed;
}

export async function POST(req: NextRequest) {
  const schoolId = getSchoolId(req);
  let recordingId: string | null = null;

  // ── Graceful 503 guard: check OPENAI_API_KEY BEFORE any DB writes ──────────
  // This prevents orphaned 'transcribing' rows when the key is absent.
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      error: 'Teacher evaluation requires OpenAI Whisper. OPENAI_API_KEY not configured.',
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
    let staffId: string;
    let preUploadedPath: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('audio') as File | null;
      staffId = (formData.get('staffId') as string) ?? '';

      if (!file || !staffId) {
        return NextResponse.json({ error: 'audio file and staffId required' }, { status: 400 });
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'File too large. Max 50MB.' }, { status: 400 });
      }
      audioBuffer = await file.arrayBuffer();
      fileName = file.name;
      mimeType = file.type || 'audio/mpeg';
    } else {
      // JSON body — audio already uploaded via generate-audio route
      const body = await req.json() as {
        staffId: string;
        storagePath: string;
        fileUrl: string;
        fileName: string;
        recording_id?: string;
      };
      staffId = body.staffId;
      preUploadedPath = body.storagePath;
      fileName = body.fileName;
      mimeType = 'audio/mpeg';

      if (body.recording_id) {
        recordingId = body.recording_id;
      }

      const { data: signedData, error: signErr } = await supabaseAdmin.storage
        .from('recordings')
        .createSignedUrl(preUploadedPath, 300);

      if (signErr || !signedData?.signedUrl) {
        throw new Error(`Failed to create signed URL: ${signErr?.message ?? 'unknown'}`);
      }

      const dlRes = await fetch(signedData.signedUrl);
      if (!dlRes.ok) throw new Error(`Failed to download audio: ${dlRes.status}`);
      audioBuffer = await dlRes.arrayBuffer();
    }

    // Fetch teacher info
    const { data: staffData } = await supabaseAdmin
      .from('staff')
      .select('name, subject')
      .eq('id', staffId)
      .eq('school_id', schoolId)
      .single();

    const teacherName = staffData?.name ?? 'Teacher';

    // Upload to storage if not already uploaded
    let fileUrl = '';
    if (!preUploadedPath) {
      const timestamp = Date.now();
      const ext = fileName.split('.').pop() ?? 'mp3';
      const storagePath = `${schoolId}/${staffId}/${timestamp}.${ext}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('recordings')
        .upload(storagePath, audioBuffer, { contentType: mimeType, upsert: false });

      if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

      const { data: urlData } = supabaseAdmin.storage
        .from('recordings')
        .getPublicUrl(storagePath);
      fileUrl = urlData?.publicUrl ?? storagePath;
    } else {
      fileUrl = preUploadedPath;
    }

    // Insert recording row (only if not a re-run)
    if (!recordingId) {
      const { data: recording, error: insertError } = await supabaseAdmin
        .from('recordings')
        .insert({
          school_id: schoolId,
          staff_id: staffId,
          file_url: fileUrl,
          file_name: fileName,
          status: 'transcribing',
          uploaded_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (insertError || !recording) throw new Error('Failed to create recording record');
      recordingId = recording.id as string;
    } else {
      // Re-run: reset status
      await supabaseAdmin.from('recordings')
        .update({ status: 'transcribing', eval_report: null, coaching_score: null, processed_at: null })
        .eq('id', recordingId);
    }

    // Transcribe — mark failed immediately if Whisper throws
    let transcript = '';
    try {
      transcript = await transcribeAudio(audioBuffer, mimeType, fileName);
    } catch (e) {
      await supabaseAdmin.from('recordings').update({
        status: 'failed',
        eval_report: JSON.stringify({
          error: 'Transcription failed',
          detail: String(e),
        }),
        processed_at: new Date().toISOString(),
      }).eq('id', recordingId);
      throw new Error(`Transcription failed: ${String(e)}`);
    }

    // Update status to analysing
    await supabaseAdmin.from('recordings')
      .update({ status: 'analysing', transcript })
      .eq('id', recordingId);

    // Evaluate — mark failed immediately if Claude throws
    let evalResult: EvalResult;
    try {
      evalResult = await evaluateTeaching(transcript, teacherName, staffData?.subject ?? '');
    } catch (e) {
      await supabaseAdmin.from('recordings').update({
        status: 'failed',
        eval_report: JSON.stringify({ error: 'Evaluation failed', detail: String(e) }),
        processed_at: new Date().toISOString(),
      }).eq('id', recordingId);
      throw new Error(`Evaluation failed: ${String(e)}`);
    }

    // Save final result
    await supabaseAdmin.from('recordings').update({
      status: 'done',
      transcript,
      eval_report: JSON.stringify(evalResult),
      coaching_score: evalResult.score,
      processed_at: new Date().toISOString(),
    }).eq('id', recordingId);

    return NextResponse.json({
      success: true,
      recordingId,
      teacherName,
      transcript: transcript.slice(0, 400) + (transcript.length > 400 ? '...' : ''),
      evaluation: evalResult,
    });

  } catch (err) {
    console.error('Teacher eval error:', err);
    // Final safety net: mark recording failed if it exists and is stuck in transcribing
    if (recordingId) {
      await supabaseAdmin.from('recordings')
        .update({ status: 'failed' })
        .eq('id', recordingId)
        .eq('status', 'transcribing');
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
