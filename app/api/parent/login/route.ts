// Parent auth is phone+PIN. OTP flow is NOT deployed. Future migration to OTP is separate roadmap work.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import bcrypt from 'bcryptjs';

// Parent portal login: phone + access_pin auth.
// Mirrors /api/teacher/login pattern but for parents table.
//
// Auth model (Item 13 MVP):
//   - No session cookies. Each subsequent /api/parent/* call re-verifies phone + PIN.
//   - Frontend stores parent_id + student_id + class_id in component state, NOT cookies.
//
// Multi-tenant defense (Spawn 7 #23):
//   - parents UNIQUE constraint is (school_id, phone), NOT (phone) alone.
//   - Same phone could exist in 2 schools. Login query without school filter
//     could return multiple rows. We handle that with maybeSingle-style logic:
//     0 rows -> 401, 1 row -> success, 2+ rows -> 409 "Multiple matches".
//   - For single-tenant MVP this branch is unreachable but defensively guarded.
//
// Spawn 7 #22: parents UNIQUE(school_id, phone) limits multi-child support to 1
// student per phone. If a parent has multiple kids enrolled, only 1 surfaces.
// Future Item: redesign to parent_students join table.
//
// Returns parent + student + resolved class.id (for downstream queries).

interface LoginRequest {
  phone?: string;
  pin?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { phone, pin } = await req.json() as LoginRequest;

    if (!phone || !pin) {
      return NextResponse.json({ error: 'phone and pin required' }, { status: 400 });
    }

    // Lookup parent. Multi-tenant defense: don't use .single() (which throws on 0 or 2+).
    const { data: parents, error: pErr } = await supabaseAdmin
      .from('parents')
      .select('id, school_id, student_id, name, phone, language_pref, access_pin, access_pin_hashed')
      .eq('phone', phone);

    if (pErr) {
      console.error('Parent lookup error:', pErr);
      return NextResponse.json({ error: 'Failed to verify credentials' }, { status: 500 });
    }
    if (!parents || parents.length === 0) {
      return NextResponse.json({ error: 'Invalid phone number or PIN' }, { status: 401 });
    }
    if (parents.length > 1) {
      // Multi-tenant collision: same phone in 2+ schools. Should not happen in
      // single-tenant MVP. Surface as 409 so frontend can show a helpful message.
      console.error(`Parent login: multiple matches for phone ${phone} (${parents.length} schools)`);
      return NextResponse.json({
        error: 'Multiple accounts match this phone. Please contact your school admin.',
      }, { status: 409 });
    }

    const parent = parents[0];

    // H2: bcrypt PIN upgrade-on-login
    let pinValid = false;
    if (parent.access_pin_hashed) {
      pinValid = await bcrypt.compare(pin, parent.access_pin_hashed);
    } else if (parent.access_pin) {
      pinValid = (parent.access_pin === pin);
      if (pinValid) {
        const hashed = await bcrypt.hash(pin, 10);
        await supabaseAdmin.from('parents')
          .update({ access_pin_hashed: hashed, access_pin: null })
          .eq('id', parent.id);
      }
    }
    if (!pinValid) {
      return NextResponse.json({ error: 'Invalid phone number or PIN' }, { status: 401 });
    }

    // Hydrate the student record + resolve their class.id by joining
    // students.class + students.section to classes.grade_level + classes.section.
    // students.class is TEXT (not FK to classes.id) per Spawn 7 #1.
    const { data: student, error: sErr } = await supabaseAdmin
      .from('students')
      .select('id, school_id, name, class, section, is_active')
      .eq('id', parent.student_id)
      .eq('school_id', parent.school_id)  // cross-tenant guard
      .single();

    if (sErr || !student) {
      console.error('Student lookup error:', sErr);
      return NextResponse.json({
        error: 'Student record not found. Please contact your school admin.',
      }, { status: 404 });
    }

    // Best-effort: resolve class_id from classes table via grade_level + section match.
    // If classes table is empty (Spawn 7 #1 — currently 0 rows), class_id stays null.
    // Downstream routes degrade gracefully (homework/lesson_plans return empty).
    let resolvedClassId: string | null = null;
    if (student.class && student.section) {
      const { data: classRow, error: cErr } = await supabaseAdmin
        .from('classes')
        .select('id')
        .eq('school_id', student.school_id)
        .eq('grade_level', student.class)
        .eq('section', student.section)
        .maybeSingle();

      if (cErr) {
        console.error('Class resolution error:', cErr);
        // Non-fatal: class_id stays null.
      } else if (classRow) {
        resolvedClassId = classRow.id;
      }
    }

    // PR-3: Resolve institution_type for the parent's school (for parent portal tab gating)
    let institutionType: string | null = null;
    {
      const { data: schoolRow } = await supabaseAdmin
        .from('schools')
        .select('institution_id, institutions(institution_type)')
        .eq('id', parent.school_id)
        .maybeSingle();
      if (schoolRow?.institutions) {
        const inst = Array.isArray(schoolRow.institutions) ? schoolRow.institutions[0] : schoolRow.institutions;
        institutionType = (inst as { institution_type?: string } | null)?.institution_type ?? null;
      }
    }

    // Best-effort: stamp last_access. parents has the column but no throttling RPC,
    // so we just write it directly. Failure is non-fatal.
    const { error: updErr } = await supabaseAdmin
      .from('parents')
      .update({ last_access: new Date().toISOString() })
      .eq('id', parent.id);
    if (updErr) {
      console.error('last_access stamp error (non-fatal):', updErr);
    }

    return NextResponse.json({
      success: true,
      parent: {
        id: parent.id,
        school_id: parent.school_id,
        name: parent.name,
        phone: parent.phone,
        language_pref: parent.language_pref ?? 'en',
      },
      student: {
        id: student.id,
        name: student.name,
        class: student.class,
        section: student.section,
        is_active: student.is_active,
        institution_type: institutionType,
      },
      // class_id may be null if classes table doesn't have a matching row yet.
      // Frontend should still render but homework/lesson_plans tabs will show empty.
      class_id: resolvedClassId,
    });

  } catch (err) {
    console.error('Parent login error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
