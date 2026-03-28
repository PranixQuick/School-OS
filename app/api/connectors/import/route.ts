// PATH: app/api/connectors/import/route.ts
//
// Unified data ingestion HTTP endpoint.
// All import logic lives in lib/connectorEngine.ts to comply with Next.js
// route export rules (only HTTP verbs may be exported from route.ts files).

import { NextRequest, NextResponse } from 'next/server';
import { getSchoolId } from '@/lib/getSchoolId';
import { runImport, type DataSource, type Entity } from '@/lib/connectorEngine';
import { supabaseAdmin } from '@/lib/supabaseClient';

export async function POST(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const body = await req.json() as {
      source?: DataSource;
      entity: Entity;
      data: Record<string, unknown>[];
      filename?: string;
      sheet_url?: string;
      dry_run?: boolean;
    };

    if (!body.entity || !Array.isArray(body.data) || body.data.length === 0) {
      return NextResponse.json({ error: 'entity and data[] required' }, { status: 400 });
    }

    const result = await runImport({
      schoolId,
      source: body.source ?? 'api',
      entity: body.entity,
      rows: body.data,
      filename: body.filename,
      sheet_url: body.sheet_url,
      dry_run: body.dry_run ?? false,
      triggered_by: req.headers.get('x-user-email') ?? 'api',
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('Connector import error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '20');
    const { data, error } = await supabaseAdmin
      .from('connector_runs')
      .select('id, source, entity, filename, total_rows, inserted, updated, failed, status, started_at, completed_at')
      .eq('school_id', schoolId)
      .order('started_at', { ascending: false })
      .limit(Math.min(limit, 100));
    if (error) throw new Error(error.message);
    return NextResponse.json({ runs: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
