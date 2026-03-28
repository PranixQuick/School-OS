import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { callClaude } from '@/lib/claudeClient';
import { getSchoolId } from '@/lib/getSchoolId';
import { sendWhatsApp, normalisePhone } from '@/lib/whatsapp';

const HIGH_DEMAND_CLASSES = ['1', '2', '3', '6'];
const IDEAL_AGE_MAP: Record<string, [number, number]> = {
  '1': [5, 7], '2': [6, 8], '3': [7, 9], '4': [8, 10],
  '5': [9, 11], '6': [10, 12], '7': [11, 13], '8': [12, 14],
  '9': [13, 15], '10': [14, 16],
};

interface InquiryInput {
  parent_name: string;
  child_name?: string;
  child_age: number;
  target_class: string;
  source: string;
  phone: string;
  email?: string;
  has_sibling?: boolean;
  notes?: string;
}

function calculateRuleScore(input: InquiryInput): number {
  let score = 0;
  const sourceScores: Record<string, number> = { referral: 30, google: 20, website: 18, instagram: 15, facebook: 12, 'walk-in': 10, other: 5 };
  score += sourceScores[input.source] ?? 5;
  const ageRange = IDEAL_AGE_MAP[input.target_class];
  if (ageRange) {
    const [min, max] = ageRange;
    if (input.child_age >= min && input.child_age <= max) score += 30;
    else if (input.child_age >= min - 1 && input.child_age <= max + 1) score += 15;
  }
  if (HIGH_DEMAND_CLASSES.includes(input.target_class)) score += 20;
  if (input.has_sibling) score += 20;
  if (input.email) score += 5;
  return Math.min(score, 100);
}

function getPriority(score: number): 'high' | 'medium' | 'low' {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

async function enhanceWithClaude(input: InquiryInput, baseScore: number): Promise<{ score: number; note: string }> {
  try {
    const raw = await callClaude(
      `You are an admissions counsellor for a premium CBSE school. Given a lead's details and a rule-based score, return ONLY a JSON object:\n{"score": <adjusted integer 0-100>, "note": "<one line insight about this lead>"}\nAdjust score by max ±10 based on context. No extra text.`,
      `Lead: ${input.parent_name}, child age ${input.child_age}, class ${input.target_class}, source: ${input.source}, sibling: ${input.has_sibling ?? false}.\nRule score: ${baseScore}. Notes: ${input.notes ?? 'none'}.`,
      150
    );
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { score: baseScore, note: '' };
    const parsed = JSON.parse(match[0]) as { score: number; note: string };
    return { score: Math.min(100, Math.max(0, Math.round(parsed.score))), note: parsed.note ?? '' };
  } catch {
    return { score: baseScore, note: '' };
  }
}

export async function POST(req: NextRequest) {
  const schoolId = getSchoolId(req);
  try {
    const body = await req.json() as InquiryInput;
    const { parent_name, child_age, target_class, source, phone } = body;
    if (!parent_name || !child_age || !target_class || !source || !phone) {
      return NextResponse.json({ error: 'parent_name, child_age, target_class, source, phone required' }, { status: 400 });
    }

    const ruleScore = calculateRuleScore(body);
    const { score, note } = await enhanceWithClaude(body, ruleScore);
    const priority = getPriority(score);

    const { data, error } = await supabaseAdmin
      .from('inquiries')
      .insert({ school_id: schoolId, parent_name, child_name: body.child_name ?? null, child_age, target_class, source, phone, email: body.email ?? null, has_sibling: body.has_sibling ?? false, notes: note || body.notes || null, score, priority, status: 'new' })
      .select('id, score, priority')
      .single();

    if (error) throw new Error(error.message);

    // Send WhatsApp confirmation to parent if phone available
    const normPhone = normalisePhone(phone);
    if (normPhone) {
      const { data: school } = await supabaseAdmin.from('schools').select('name').eq('id', schoolId).single();
      const schoolName = school?.name ?? 'School';
      await sendWhatsApp({
        to: normPhone,
        body: `Dear ${parent_name}, thank you for your enquiry at ${schoolName}. Your application for Class ${target_class} has been received and scored. Our admissions team will contact you shortly. Reference: ${data.id.slice(0, 8).toUpperCase()}`,
        schoolName,
      }).then(null, () => {}); // non-blocking
    }

    return NextResponse.json({ success: true, id: data.id, score: data.score, priority: data.priority, ruleScore, aiNote: note });
  } catch (err) {
    console.error('Admissions create error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
