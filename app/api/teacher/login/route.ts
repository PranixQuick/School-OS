// app/api/teacher/login/route.ts
// Item #1 Track C (OPTION_1_TRACK_C_ITEM_1_TEACHER_DASHBOARD).
//
// The prior phone+PIN-per-request endpoint has been removed in favor of the
// shared /api/auth/login flow.
//
// This stub remains only so old clients (if any cached the URL) receive a
// clear 410 Gone with a redirect hint. After 30 days of zero traffic this
// file should be deleted from the repo entirely.
//
// Engine note: this is technically a content replacement rather than a true
// git delete, because Spawn 3's GitHub action surface does not include a
// delete-file primitive. Founder may delete the file manually post-merge.

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  return NextResponse.json(
    {
      error: 'gone',
      message: 'This endpoint has been removed. Use POST /api/auth/login instead.',
      replacement: '/api/auth/login',
    },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      error: 'gone',
      message: 'This endpoint has been removed. Use POST /api/auth/login instead.',
      replacement: '/api/auth/login',
    },
    { status: 410 }
  );
}
