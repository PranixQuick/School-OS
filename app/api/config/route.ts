import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId } from '@/lib/getSchoolId';

export async function GET(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);

    const { data, error } = await supabaseAdmin
      .from('school_config')
      .select('*')
      .eq('school_id', schoolId)
      .single();

    if (error && error.code !== 'PGRST116') throw new Error(error.message);

    // Return defaults if no config exists yet
    if (!data) {
      const defaults = {
        class_list: ['Nursery','LKG','UKG','1','2','3','4','5','6','7','8','9','10'],
        sections: ['A','B','C','D'],
        subjects: { default: ['Mathematics','Science','English','Social Studies','Hindi'] },
        fee_categories: ['tuition','transport','sports','library','lab','exam','annual','miscellaneous'],
        academic_terms: ['Term 1 2024-25','Term 2 2024-25','Term 3 2024-25'],
        school_timings: { start: '08:00', end: '15:00' },
      };
      return NextResponse.json({ config: defaults });
    }

    return NextResponse.json({ config: data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const body = await req.json() as {
      class_list?: string[];
      sections?: string[];
      subjects?: Record<string, string[]>;
      fee_categories?: string[];
      academic_terms?: string[];
      school_timings?: { start: string; end: string };
    };

    const { data, error } = await supabaseAdmin
      .from('school_config')
      .upsert({
        school_id: schoolId,
        ...(body.class_list !== undefined && { class_list: body.class_list }),
        ...(body.sections !== undefined && { sections: body.sections }),
        ...(body.subjects !== undefined && { subjects: body.subjects }),
        ...(body.fee_categories !== undefined && { fee_categories: body.fee_categories }),
        ...(body.academic_terms !== undefined && { academic_terms: body.academic_terms }),
        ...(body.school_timings !== undefined && { school_timings: body.school_timings }),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'school_id' })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, config: data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
