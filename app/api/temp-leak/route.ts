import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    bypass: process.env.E2E_BYPASS_SECRET || 'not found',
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'not found',
    anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'not found'
  });
}
