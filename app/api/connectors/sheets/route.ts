// PATH: app/api/connectors/sheets/route.ts
//
// Google Sheets connector — fetches sheet data and pipes into the import engine.
//
// The sheet must be publicly readable OR shared with a service account.
// Uses Google Sheets API v4 with an API key (no OAuth required for public sheets).
//
// POST /api/connectors/sheets
// Body: {
//   sheet_url: string,   // Full Google Sheets URL or spreadsheet ID
//   entity: 'students' | 'fees' | 'attendance' | 'academic_records',
//   sheet_name?: string, // Tab name (default: first sheet)
//   header_row?: number, // Row number containing headers (default: 1)
// }

import { NextRequest, NextResponse } from 'next/server';
import { getSchoolId } from '@/lib/getSchoolId';

function extractSheetId(urlOrId: string): string | null {
  // Handle full URL: https://docs.google.com/spreadsheets/d/SHEET_ID/...
  const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  // If it's already just an ID
  if (/^[a-zA-Z0-9_-]{40,}$/.test(urlOrId)) return urlOrId;
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

    const spreadsheetId = extractSheetId(sheet_url);
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Invalid Google Sheets URL or ID' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        error: 'GOOGLE_SHEETS_API_KEY not configured. Add it to Vercel environment variables.',
        setup: 'Get a key at: https://console.cloud.google.com → Enable Sheets API → Create API key',
      }, { status: 503 });
    }

    // Fetch sheet metadata to get the first sheet name if not provided
    let tabName = sheet_name;
    if (!tabName) {
      const metaRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?key=${apiKey}&fields=sheets.properties.title`
      );
      if (!metaRes.ok) {
        const err = await metaRes.text();
        return NextResponse.json({ error: `Google Sheets API error: ${metaRes.status} - ${err}` }, { status: 502 });
      }
      const meta = await metaRes.json() as { sheets: { properties: { title: string } }[] };
      tabName = meta.sheets?.[0]?.properties?.title ?? 'Sheet1';
    }

    // Fetch all values from the sheet
    const range = encodeURIComponent(`${tabName}`);
    const valuesRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${apiKey}`
    );

    if (!valuesRes.ok) {
      const err = await valuesRes.text();
      return NextResponse.json({ error: `Failed to fetch sheet data: ${valuesRes.status} - ${err}` }, { status: 502 });
    }

    const values = await valuesRes.json() as { values?: string[][] };
    const rows = values.values ?? [];

    if (rows.length < header_row + 1) {
      return NextResponse.json({ error: 'Sheet has no data rows after header', row_count: rows.length }, { status: 400 });
    }

    // Parse headers from the header_row (1-indexed)
    const headers = (rows[header_row - 1] ?? []).map((h: string) =>
      h.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    );

    // Convert rows to objects
    const dataRows = rows.slice(header_row).map((row: string[]) => {
      const obj: Record<string, string> = {};
      headers.forEach((header: string, idx: number) => {
        if (header) obj[header] = (row[idx] ?? '').trim();
      });
      return obj;
    }).filter(row => Object.values(row).some(v => v !== ''));

    if (dataRows.length === 0) {
      return NextResponse.json({ error: 'No data rows found in sheet' }, { status: 400 });
    }

    // Forward to the unified import endpoint
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host')}`;
    const importRes = await fetch(`${baseUrl}/api/connectors/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-school-id': schoolId,
        'x-user-email': req.headers.get('x-user-email') ?? 'sheets-connector',
      },
      body: JSON.stringify({
        source: 'google_sheets',
        entity,
        data: dataRows,
        sheet_url,
        dry_run,
      }),
    });

    const importResult = await importRes.json() as Record<string, unknown>;

    return NextResponse.json({
      ...importResult,
      sheet_meta: {
        spreadsheet_id: spreadsheetId,
        tab: tabName,
        headers,
        total_rows: dataRows.length,
      },
    });

  } catch (err) {
    console.error('Sheets connector error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
