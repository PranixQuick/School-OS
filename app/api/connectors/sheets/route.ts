// PATH: app/api/connectors/sheets/route.ts
//
// Google Sheets connector — fetches a public/shared sheet via Sheets API v4,
// normalises the rows, and inserts them directly using runImport().
//
// CRITICAL FIX: Previous version used a self-HTTP-fetch to /api/connectors/import
// which was blocked by middleware (no session cookie on internal fetch).
// Now calls runImport() directly as an imported function — no HTTP round-trip.
//
// Requires: GOOGLE_SHEETS_API_KEY in Vercel environment variables.

import { NextRequest, NextResponse } from 'next/server';
import { getSchoolId } from '@/lib/getSchoolId';
import { runImport, type Entity } from '@/app/api/connectors/import/route';

function extractSheetId(urlOrId: string): string | null {
  const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9_-]{30,}$/.test(urlOrId)) return urlOrId;
  return null;
}

export async function POST(req: NextRequest) {
  const schoolId = getSchoolId(req);

  try {
    const body = await req.json() as {
      sheet_url: string;
      entity: string;
      sheet_name?: string;
      header_row?: number;
      dry_run?: boolean;
    };

    const { sheet_url, entity, sheet_name, header_row = 1, dry_run = false } = body;

    if (!sheet_url || !entity) {
      return NextResponse.json({ error: 'sheet_url and entity required' }, { status: 400 });
    }

    const validEntities = ['students', 'fees', 'attendance', 'academic_records'];
    if (!validEntities.includes(entity)) {
      return NextResponse.json({
        error: `Invalid entity. Must be one of: ${validEntities.join(', ')}`,
      }, { status: 400 });
    }

    const spreadsheetId = extractSheetId(sheet_url);
    if (!spreadsheetId) {
      return NextResponse.json({
        error: 'Invalid Google Sheets URL. Expected: https://docs.google.com/spreadsheets/d/SHEET_ID/...',
      }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        error: 'GOOGLE_SHEETS_API_KEY is not configured in environment variables.',
        setup: [
          '1. Go to https://console.cloud.google.com',
          '2. Enable the Google Sheets API',
          '3. Create an API key under Credentials',
          '4. Add GOOGLE_SHEETS_API_KEY to Vercel → Settings → Environment Variables',
          '5. Redeploy',
        ],
      }, { status: 503 });
    }

    // Step 1: Get tab name if not specified
    let tabName = sheet_name;
    if (!tabName) {
      const metaRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?key=${apiKey}&fields=sheets.properties.title`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (!metaRes.ok) {
        const errText = await metaRes.text();
        if (metaRes.status === 403) {
          return NextResponse.json({
            error: 'Access denied. Share the sheet as "Anyone with the link can view" and try again.',
          }, { status: 403 });
        }
        if (metaRes.status === 404) {
          return NextResponse.json({ error: 'Sheet not found. Check the URL.' }, { status: 404 });
        }
        return NextResponse.json({ error: `Sheets API error ${metaRes.status}: ${errText.slice(0, 200)}` }, { status: 502 });
      }
      const meta = await metaRes.json() as { sheets?: { properties: { title: string } }[] };
      tabName = meta.sheets?.[0]?.properties?.title ?? 'Sheet1';
    }

    // Step 2: Fetch all values
    const range = encodeURIComponent(tabName);
    const valuesRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${apiKey}`,
      { signal: AbortSignal.timeout(15000) }
    );
    if (!valuesRes.ok) {
      const errText = await valuesRes.text();
      return NextResponse.json({ error: `Failed to read sheet data: ${valuesRes.status} - ${errText.slice(0, 200)}` }, { status: 502 });
    }

    const values = await valuesRes.json() as { values?: string[][] };
    const allRows: string[][] = values.values ?? [];

    if (allRows.length < header_row) {
      return NextResponse.json({
        error: `Sheet only has ${allRows.length} row(s). Header row ${header_row} not found.`,
      }, { status: 400 });
    }

    // Step 3: Parse headers from header_row (1-indexed)
    const rawHeaders = allRows[header_row - 1] ?? [];
    const headers = rawHeaders.map((h: string) =>
      h.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    );

    if (headers.every((h: string) => h === '')) {
      return NextResponse.json({ error: 'Header row appears to be empty.' }, { status: 400 });
    }

    // Step 4: Convert rows to objects, skip blank rows
    const dataRows: Record<string, string>[] = allRows
      .slice(header_row)
      .map((row: string[]) => {
        const obj: Record<string, string> = {};
        headers.forEach((header: string, idx: number) => {
          if (header) obj[header] = (row[idx] ?? '').trim();
        });
        return obj;
      })
      .filter((row: Record<string, string>) => Object.values(row).some(v => v !== ''));

    if (dataRows.length === 0) {
      return NextResponse.json({
        error: 'No data rows found after the header row.',
        sheet_meta: { spreadsheet_id: spreadsheetId, tab: tabName, headers },
      }, { status: 400 });
    }

    // Step 5: Run import directly — no HTTP self-fetch, no middleware issue
    const result = await runImport({
      schoolId,
      source: 'google_sheets',
      entity: entity as Entity,
      rows: dataRows as Record<string, unknown>[],
      sheet_url,
      dry_run,
      triggered_by: req.headers.get('x-user-email') ?? 'sheets-connector',
    });

    return NextResponse.json({
      ...result,
      sheet_meta: {
        spreadsheet_id: spreadsheetId,
        tab: tabName,
        headers,
        total_rows: dataRows.length,
      },
    });

  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Google Sheets API timed out. The sheet may be too large.' }, { status: 504 });
    }
    console.error('Sheets connector error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
        }
