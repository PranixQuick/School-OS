// app/api/admin/fee-templates/[id]/generate/route.ts
// Batch 2: Bulk fee generation from template.
// POST: { dry_run?: boolean }
//
// DUPLICATE PROTECTION (Task 3d):
//   fees table has no academic_year_id, no metadata, no reference_id.
//   Generation hash = sha256(schoolId + studentId + feeType + templateId + dueMMYYYY)
//   Stored in fees.data_source as 'gen:<hex16>' to distinguish from other values.
//   Before each INSERT: SELECT existing row matching same data_source hash.
//   If found: skip. Prevents re-running bulk generation twice.
//
// TODO(item-15): migrate to supabaseForUser
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { createHash } from 'crypto';

export const runtime = 'nodejs';

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function makeGenHash(schoolId: string, studentId: string, feeType: string, templateId: string, dueDate: string): string {
  const raw = `${schoolId}|${studentId}|${feeType}|${templateId}|${dueDate.slice(0, 7)}`; // YYYY-MM only
  return 'gen:' + createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: templateId } = await params;
  if (!isUuid(templateId)) return NextResponse.json({ error: 'Invalid template id' }, { status: 400 });
  let ctx; try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;
  let body: unknown; try { body = await req.json().catch(() => ({})); } catch { body = {}; }
  const dryRun = (body as Record<string, unknown>)?.dry_run === true;

  // Fetch template
  const { data: template, error: tErr } = await supabaseAdmin.from('fee_templates')
    .select('*').eq('id', templateId).eq('school_id', schoolId).eq('is_active', true).maybeSingle();
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
  if (!template) return NextResponse.json({ error: 'Template not found or inactive' }, { status: 404 });

  // Fetch matching students (students.class = grade_level TEXT, section optional)
  let studentQuery = supabaseAdmin.from('students').select('id, name')
    .eq('school_id', schoolId).eq('is_active', true).eq('class', template.grade_level);
  if (template.section) studentQuery = studentQuery.eq('section', template.section);
  const { data: students, error: sErr } = await studentQuery;
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
  if (!students || students.length === 0) {
    return NextResponse.json({ generated: 0, skipped_existing: 0, students_processed: 0, note: 'No active students found for this grade/section' });
  }

  const feeItems = (template.fee_items as { fee_type: string; amount: number; description?: string }[]) ?? [];
  if (feeItems.length === 0) return NextResponse.json({ error: 'Template has no fee items' }, { status: 400 });

  // Default due date: 30 days from today
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);
  const dueDateStr = dueDate.toISOString().slice(0, 10);

  let generated = 0, skippedExisting = 0;
  const preview: { student_name: string; fees_to_create: { fee_type: string; amount: number }[] }[] = [];

  for (const student of students) {
    const feesToCreate: { fee_type: string; amount: number }[] = [];

    for (const item of feeItems) {
      const genHash = makeGenHash(schoolId, student.id, item.fee_type, templateId, dueDateStr);

      if (dryRun) {
        // Check existence for dry-run preview
        const { data: existing } = await supabaseAdmin.from('fees').select('id')
          .eq('school_id', schoolId).eq('student_id', student.id).eq('data_source', genHash).maybeSingle();
        if (!existing) feesToCreate.push({ fee_type: item.fee_type, amount: item.amount });
        else skippedExisting++;
        continue;
      }

      // Duplicate check via generation hash in data_source
      const { data: existing } = await supabaseAdmin.from('fees').select('id')
        .eq('school_id', schoolId).eq('student_id', student.id).eq('data_source', genHash).maybeSingle();
      if (existing) { skippedExisting++; continue; }

      const { error: insErr } = await supabaseAdmin.from('fees').insert({
        school_id: schoolId,
        student_id: student.id,
        amount: item.amount,
        original_amount: item.amount,
        fee_type: item.fee_type,
        description: item.description ?? null,
        status: 'pending',
        due_date: dueDateStr,
        data_source: genHash,
      });
      if (!insErr) generated++;
      else console.error('[fee-generate] insert failed:', insErr.message);
    }

    if (dryRun && feesToCreate.length > 0) {
      preview.push({ student_name: student.name, fees_to_create: feesToCreate });
    }
  }

  if (dryRun) {
    const wouldGenerate = preview.reduce((s, p) => s + p.fees_to_create.length, 0);
    return NextResponse.json({
      dry_run: true,
      would_generate: wouldGenerate,
      would_skip: skippedExisting,
      students_processed: students.length,
      preview: preview.slice(0, 20), // cap preview at 20 students
    });
  }

  return NextResponse.json({
    generated,
    skipped_existing: skippedExisting,
    students_processed: students.length,
    template_name: template.name,
    grade_level: template.grade_level,
    section: template.section ?? 'all',
  });
}
