import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId } from '@/lib/getSchoolId';
import { logActivity, logError } from '@/lib/logger';

interface StudentCSVRow {
  name: string;
  class: string;
  section?: string;
  phone_parent?: string;
  parent_name?: string;
  roll_number?: string;
  admission_number?: string;
}

function parseCSV(text: string): StudentCSVRow[] {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
  const rows: StudentCSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ''; });

    if (!row['name'] || !row['class']) continue;

    rows.push({
      name: row['name'],
      class: row['class'],
      section: row['section'] || 'A',
      phone_parent: row['phone_parent'] || row['phone'] || null!,
      parent_name: row['parent_name'] || null!,
      roll_number: row['roll_number'] || null!,
      admission_number: row['admission_number'] || null!,
    });
  }

  return rows;
}

export async function POST(req: NextRequest) {
  const schoolId = getSchoolId(req);

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'CSV file required' }, { status: 400 });
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'Only CSV files accepted' }, { status: 400 });
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 2MB.' }, { status: 400 });
    }

    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No valid rows found. CSV must have "name" and "class" columns.' }, { status: 400 });
    }

    // Create import job
    const { data: job, error: jobErr } = await supabaseAdmin
      .from('import_jobs')
      .insert({
        school_id: schoolId,
        type: 'students',
        filename: file.name,
        total_rows: rows.length,
        status: 'processing',
      })
      .select('id')
      .single();

    if (jobErr || !job) throw new Error('Failed to create import job');

    const imported: string[] = [];
    const failed: { row: number; name: string; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const { error: insertErr } = await supabaseAdmin.from('students').insert({
          school_id: schoolId,
          name: row.name,
          class: row.class,
          section: row.section ?? 'A',
          phone_parent: row.phone_parent ?? null,
          parent_name: row.parent_name ?? null,
          roll_number: row.roll_number ?? null,
          admission_number: row.admission_number ?? null,
          is_active: true,
        });

        if (insertErr) {
          failed.push({ row: i + 2, name: row.name, error: insertErr.message });
        } else {
          imported.push(row.name);
        }
      } catch (e) {
        failed.push({ row: i + 2, name: row.name, error: String(e) });
      }
    }

    // Update import job
    await supabaseAdmin.from('import_jobs').update({
      imported_rows: imported.length,
      failed_rows: failed.length,
      errors: failed,
      status: 'done',
      completed_at: new Date().toISOString(),
    }).eq('id', job.id);

    await logActivity({
      schoolId,
      action: `Imported ${imported.length} students from ${file.name}`,
      module: 'import',
      details: { file: file.name, imported: imported.length, failed: failed.length },
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      total: rows.length,
      imported: imported.length,
      failed: failed.length,
      errors: failed.slice(0, 20),
    });

  } catch (err) {
    await logError({ route: '/api/import/students', error: String(err), schoolId });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
