import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { callClaude } from '@/lib/claudeClient';

const SCHOOL_ID = '00000000-0000-0000-0000-000000000001';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

interface EvalResult {
  score: number;
  strengths: string;
  improvements: string;
  feedback: string;
}

async function transcribeAudio(audioBuffer: ArrayBuffer, mimeType: string, fileName: string): Promise<string> {
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

  const text = await response.text();
  return text.trim();
}

async function evaluateTeaching(transcript: string, teacherName: string): Promise<EvalResult> {
  const system = `You are an expert teaching coach evaluating classroom recordings.
Analyze the teaching quality and return ONLY a valid JSON object with exactly these keys:
{
  "score": <number 1-10>,
  "strengths": "<2-3 specific strengths observed, 50-80 words>",
  "improvements": "<2-3 specific areas to improve, 50-80 words>",
  "feedback": "<overall coaching feedback with actionable next steps, 80-120 words>"
}
No markdown, no explanation, no extra text. Only the JSON object.`;

  const userMsg = `Teacher: ${teacherName}

Classroom transcript:
${transcript.slice(0, 6000)}

Evaluate the teaching quality and return the JSON evaluation.`;

  const raw = await callClaude(system, userMsg, 600);

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Claude did not return valid JSON');

  const parsed = JSON.parse(jsonMatch[0]) as EvalResult;
  if (typeof parsed.score !== 'number') throw new Error('Invalid evaluation format');

  return parsed;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('audio') as File | null;
    const staffId = formData.get('staffId') as string | null;

    if (!file || !staffId) {
      return NextResponse.json({ error: 'audio file and staffId required' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Max 50MB.' }, { status: 400 });
    }

    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/m4a', 'audio/mp4', 'audio/webm'];
    const fileType = file.type || 'audio/mpeg';
    if (!allowedTypes.some(t => fileType.includes(t.split('/')[1]))) {
      return NextResponse.json({ error: 'Unsupported audio format. Use mp3, wav, or m4a.' }, { status: 400 });
    }

    // Fetch teacher name
    const { data: staffData } = await supabaseAdmin
      .from('staff')
      .select('name, subject')
      .eq('id', staffId)
      .eq('school_id', SCHOOL_ID)
      .single();

    const teacherName = staffData?.name ?? 'Teacher';

    // Upload to Supabase Storage
    const timestamp = Date.now();
    const ext = file.name.split('.').pop() ?? 'mp3';
    const storagePath = `${SCHOOL_ID}/${staffId}/${timestamp}.${ext}`;
    const audioBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabaseAdmin.storage
      .from('recordings')
      .upload(storagePath, audioBuffer, {
        contentType: fileType,
        upsert: false,
      });

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

    const { data: urlData } = supabaseAdmin.storage
      .from('recordings')
      .getPublicUrl(storagePath);

    const fileUrl = urlData?.publicUrl ?? storagePath;

    // Insert recording row with 'transcribing' status
    const { data: recording, error: insertError } = await supabaseAdmin
      .from('recordings')
      .insert({
        school_id: SCHOOL_ID,
        staff_id: staffId,
        file_url: fileUrl,
        file_name: file.name,
        status: 'transcribing',
        uploaded_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError || !recording) throw new Error('Failed to create recording record');

    const recordingId = recording.id as string;

    // Transcribe with Whisper
    let transcript = '';
    try {
      transcript = await transcribeAudio(audioBuffer, fileType, file.name);
    } catch (e) {
      await supabaseAdmin.from('recordings').update({ status: 'failed' }).eq('id', recordingId);
      throw new Error(`Transcription failed: ${String(e)}`);
    }

    // Update status to analysing
    await supabaseAdmin.from('recordings').update({
      transcript,
      status: 'analysing',
    }).eq('id', recordingId);

    // Evaluate with Claude
    let evalResult: EvalResult;
    try {
      evalResult = await evaluateTeaching(transcript, teacherName);
    } catch (e) {
      await supabaseAdmin.from('recordings').update({ status: 'failed' }).eq('id', recordingId);
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
      transcript: transcript.slice(0, 500) + (transcript.length > 500 ? '...' : ''),
      evaluation: evalResult,
    });

  } catch (err) {
    console.error('Teacher eval error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
