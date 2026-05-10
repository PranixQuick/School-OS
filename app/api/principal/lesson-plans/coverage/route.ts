import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId } from '@/lib/getSchoolId';

// Principal fetches per-class lesson plan coverage rollup for a date.
// Auth: session cookie via getSchoolId(req) (Item 10 pattern).
//
// Query: ?date=YYYY-MM-DD (default today IST)
//
// Aggregates lesson_plans for that planned_date by class_id:
//   - planned, in_progress, completed, skipped counts per class
//   - completion_pct (completed / total) per class
//   - school-wide rollup
//
// Pure JS aggregation (mirrors Item 10's teacher-presence pattern).
// completion_status enum: planned | in_progress | completed | skipped (DB CHECK).

interface ClassCoverage {
  class_id: string;
  grade_level: string;
  section: string;
  planned: number;
  in_progress: number;
  completed: number;
  skipped: number;
  total: number;
  completion_pct: number;
}

function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

const DATE_RX = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const { searchParams } = new URL(req.url);
    const dateOverride = searchParams.get('date');

    let queryDate = todayIST();
    if (dateOverride) {
      if (!DATE_RX.test(dateOverride)) {
        return NextResponse.json({ error: 'Invalid date format (YYYY-MM-DD)' }, { status: 400 });
      }
      queryDate = dateOverride;
    }

    // 2 parallel queries: classes for school, lesson_plans for date.
    const [classesRes, plansRes] = await Promise.all([
      supabaseAdmin.from('classes')
        .select('id, grade_level, section')
        .eq('school_id', schoolId),
      supabaseAdmin.from('lesson_plans')
        .select('class_id, completion_status, staff_id, subject_id')
        .eq('school_id', schoolId)
        .eq('planned_date', queryDate),
    ]);

    if (classesRes.error) {
      console.error('Classes load error:', classesRes.error);
      return NextResponse.json({ error: 'Failed to load classes' }, { status: 500 });
    }
    if (plansRes.error) {
      console.error('Lesson plans load error:', plansRes.error);
      return NextResponse.json({ error: 'Failed to load lesson plans' }, { status: 500 });
    }

    const classes = classesRes.data ?? [];
    const plans = plansRes.data ?? [];

    // Aggregate per class_id.
    const perClass = new Map<string, { planned: number; in_progress: number; completed: number; skipped: number }>();
    for (const c of classes) {
      perClass.set(c.id, { planned: 0, in_progress: 0, completed: 0, skipped: 0 });
    }
    let unmatchedClassPlans = 0;
    for (const p of plans) {
      const cur = perClass.get(p.class_id);
      if (!cur) {
        // Plan exists for a class not in this school's classes table — shouldn't happen
        // given school_id filter, but guard anyway.
        unmatchedClassPlans += 1;
        continue;
      }
      if (p.completion_status === 'planned') cur.planned += 1;
      else if (p.completion_status === 'in_progress') cur.in_progress += 1;
      else if (p.completion_status === 'completed') cur.completed += 1;
      else if (p.completion_status === 'skipped') cur.skipped += 1;
    }

    // Build per-class rows. Include classes with zero plans (they show 0/0 = 0%).
    const perClassRows: ClassCoverage[] = classes.map(c => {
      const counts = perClass.get(c.id) ?? { planned: 0, in_progress: 0, completed: 0, skipped: 0 };
      const total = counts.planned + counts.in_progress + counts.completed + counts.skipped;
      const completion_pct = total > 0 ? Math.round((counts.completed / total) * 100) : 0;
      return {
        class_id: c.id,
        grade_level: c.grade_level,
        section: c.section,
        planned: counts.planned,
        in_progress: counts.in_progress,
        completed: counts.completed,
        skipped: counts.skipped,
        total,
        completion_pct,
      };
    });

    // Sort: lowest completion% first (most urgent for principal review),
    // then by grade_level + section for stable order.
    perClassRows.sort((a, b) => {
      if (a.total === 0 && b.total !== 0) return 1;  // empty rows last
      if (b.total === 0 && a.total !== 0) return -1;
      if (a.completion_pct !== b.completion_pct) return a.completion_pct - b.completion_pct;
      const gradeCmp = a.grade_level.localeCompare(b.grade_level);
      if (gradeCmp !== 0) return gradeCmp;
      return a.section.localeCompare(b.section);
    });

    // School-wide rollup.
    const totals = perClassRows.reduce(
      (acc, r) => ({
        planned: acc.planned + r.planned,
        in_progress: acc.in_progress + r.in_progress,
        completed: acc.completed + r.completed,
        skipped: acc.skipped + r.skipped,
        total: acc.total + r.total,
      }),
      { planned: 0, in_progress: 0, completed: 0, skipped: 0, total: 0 }
    );
    const overallPct = totals.total > 0 ? Math.round((totals.completed / totals.total) * 100) : 0;

    return NextResponse.json({
      success: true,
      date: queryDate,
      total_classes: classes.length,
      classes_with_plans: perClassRows.filter(r => r.total > 0).length,
      classes_without_plans: perClassRows.filter(r => r.total === 0).length,
      school_summary: {
        ...totals,
        completion_pct: overallPct,
      },
      per_class: perClassRows,
      unmatched_plans: unmatchedClassPlans,
    });

  } catch (err) {
    console.error('Coverage rollup error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
