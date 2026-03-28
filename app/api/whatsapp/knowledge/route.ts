// PATH: app/api/whatsapp/knowledge/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId } from '@/lib/getSchoolId';

// GET — fetch all knowledge chunks for this school
export async function GET(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);

    const { data, error } = await supabaseAdmin
      .from('knowledge_chunks')
      .select('id, title, category, content, source_doc, is_active, created_at')
      .eq('school_id', schoolId)
      .order('category', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return NextResponse.json({ chunks: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST — add a new knowledge chunk
export async function POST(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const body = await req.json() as {
      title: string;
      category: string;
      content: string;
      source_doc?: string;
    };

    const { title, category, content, source_doc } = body;

    if (!title || !category || !content) {
      return NextResponse.json({ error: 'title, category, and content required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('knowledge_chunks')
      .insert({
        school_id: schoolId,
        title: title.trim(),
        category,
        content: content.trim(),
        source_doc: source_doc?.trim() || null,
        is_active: true,
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, id: data?.id });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PATCH — toggle is_active or update content
export async function PATCH(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const body = await req.json() as {
      id: string;
      is_active?: boolean;
      title?: string;
      content?: string;
    };

    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { error } = await supabaseAdmin
      .from('knowledge_chunks')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('school_id', schoolId);

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE — remove a knowledge chunk
export async function DELETE(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const { id } = await req.json() as { id: string };
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { error } = await supabaseAdmin
      .from('knowledge_chunks')
      .delete()
      .eq('id', id)
      .eq('school_id', schoolId);

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
