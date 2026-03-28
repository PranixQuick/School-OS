import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId } from '@/lib/getSchoolId';


const SAMPLE_SCRIPTS = [
  `Good morning everyone. Please settle down and open your notebooks to page 42. 
Today we are going to learn about fractions. Now, who can tell me what a fraction is? 
Yes, Arjun, very good. A fraction represents a part of a whole. 
If I have a pizza and I cut it into 4 equal pieces and take 1 piece, 
that is one-fourth, written as 1 over 4. 
Now let us look at some examples on the board. 
Can everyone see? Good. 
The top number is called the numerator. It tells us how many parts we have. 
The bottom number is called the denominator. It tells us how many total parts there are. 
Let us try a problem together. If I have 3 out of 8 equal parts, what fraction is that? 
Correct, it is 3 over 8 or three-eighths. 
Now I want all of you to try problems 1 through 5 on page 43. 
Raise your hand if you need help. You have 10 minutes. 
Remember, numerator on top, denominator on the bottom. Take your time.`,

  `Class, please pay attention. We are continuing with our chapter on photosynthesis. 
Yesterday we learned that plants make their own food using sunlight, water, and carbon dioxide. 
Today we will understand the process step by step. 
Photosynthesis happens in the chloroplasts, which are found in plant cells. 
The chlorophyll inside the chloroplasts is what makes plants green, 
and it captures energy from sunlight. 
The plant absorbs water through its roots and brings it up to the leaves. 
It also absorbs carbon dioxide from the air through tiny pores called stomata. 
Using the energy from sunlight, the plant converts water and carbon dioxide into glucose. 
Glucose is the food that gives the plant energy to grow. 
Oxygen is released as a byproduct, which is what we breathe. 
The formula is: six carbon dioxide plus six water plus light energy gives glucose plus six oxygen. 
Can everyone write this formula in their notebooks? 
Good. Now let us watch a short animation to see this process visually.`,
];

async function generateTTSAudio(text: string): Promise<ArrayBuffer> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: text,
      voice: 'nova',
      response_format: 'mp3',
      speed: 0.95,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`TTS API error: ${response.status} - ${err}`);
  }

  return await response.arrayBuffer();
}

export async function POST(req: NextRequest) {
  const schoolId = getSchoolId(req);
  try {
    const body = await req.json() as { staffId?: string; scriptIndex?: number };
    const { staffId, scriptIndex = 0 } = body;

    if (!staffId) {
      return NextResponse.json({ error: 'staffId required' }, { status: 400 });
    }

    const script = SAMPLE_SCRIPTS[scriptIndex % SAMPLE_SCRIPTS.length];

    // Generate audio via OpenAI TTS
    const audioBuffer = await generateTTSAudio(script);

    // Upload to Supabase Storage
    const timestamp = Date.now();
    const storagePath = `${schoolId}/${staffId}/sample_${timestamp}.mp3`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('recordings')
      .upload(storagePath, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: false,
      });

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

    const { data: urlData } = supabaseAdmin.storage
      .from('recordings')
      .getPublicUrl(storagePath);

    return NextResponse.json({
      success: true,
      fileUrl: urlData?.publicUrl ?? storagePath,
      storagePath,
      script: script.slice(0, 100) + '...',
      fileName: `sample_classroom_${timestamp}.mp3`,
    });

  } catch (err) {
    console.error('Generate audio error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
