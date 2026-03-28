import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { callClaude } from '@/lib/claudeClient';
import { getSchoolId } from '@/lib/getSchoolId';

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

async function evaluateTeaching(
  transcript: string,
  teacherName: string
): Promise<EvalResult> {
  const system = `You are an expert teaching coach evaluating classroom recordings.
Analyze the transcript and return ONLY a valid JSON object with exactly these four keys:
{
  "score": <integer 1-10>,
  "strengths": "<2-3 specific strengths observed, 60-90 words>",
  "improvements": "<2-3 specific areas to improve, 60-90 words>",
  "feedback": "<overall coaching feedback with actionable next steps, 80-120 words>"
}
No markdown. No explanation. No text before or after. Only the JSON object.`;

  const userMsg = `Teacher: ${teacherName}

Classroom transcript:
${transcript.slice(0, 6000)}

Evaluate this teaching session and return the JSON.`;

  const raw = await callClaude(system, userMsg, 700);

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Claude returned invalid JSON');

  const parsed = JSON.parse(match[0]) as EvalResult;
  if (typeof parsed.score !== 'number') throw new Error('Invalid evaluation schema');

  return parsed;
}

export async function POST(req: NextRequest) {
  const schoolId = getSchoolId(req);
  let recordingId: string | null = null;

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
        recording_id?: string; // provided when re-running an existing evaluation
      };
      staffId = body.staffId;
      preUploadedPath = body.storagePath;
      fileName = body.fileName;
      mimeType = 'audio/mpeg';

      // If re-running an existing recording, track its ID immediately
      if (body.recording_id) {
        recordingId = body.recording_id;
      }

      // Use signed URL (bucket is private)
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
          score: 0, error: String(e),
          strengths: 'Transcription failed — please re-upload the audio file.',
          improvements: '', feedback: 'Processing failed. Try re-running the evaluation.',
        }),
      }).eq('id', recordingId);
      throw new Error(`Transcription failed: ${String(e)}`);
    }

    await supabaseAdmin.from('recordings')
      .update({ transcript, status: 'analysing' })
      .eq('id', recordingId);

    // Evaluate — mark failed immediately if Claude throws
    let evalResult: EvalResult;
    try {
      evalResult = await evaluateTeaching(transcript, teacherName);
    } catch (e) {
      await supabaseAdmin.from('recordings').update({
        status: 'failed',
        eval_report: JSON.stringify({
          score: 0, error: String(e),
          strengths: 'AI evaluation failed — transcript was captured successfully.',
          improvements: '', feedback: 'Click Re-run to try the evaluation again.',
        }),
      }).eq('id', recordingId);
      throw new Error(`Evaluation failed: ${String(e)}`);
    }

    // Save final result
    await supabaseAdmin.from('recordings').update({
      eval_report: JSON.stringify(evalResult),
      coaching_score: evalResult.score,
      status: 'done',
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
    // Final safety net: if recordingId is known but not yet marked failed, mark it now
    if (recordingId) {
      await supabaseAdmin.from('recordings')
        .update({ status: 'failed' })
        .eq('id', recordingId)
        .eq('status', 'transcribing'); // only if still stuck in transcribing
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
