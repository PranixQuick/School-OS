import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  console.log('[CRON_KEEP_ALIVE] Pinging Render fallback service...');
  try {
    const res = await fetch('https://pranix-aaria.onrender.com/', {
      method: 'GET',
      headers: {
        'User-Agent': 'SchoolOS-KeepAlive-Cron'
      }
    });
    return NextResponse.json({ 
      status: 'ok', 
      response_status: res.status 
    });
  } catch (err: any) {
    console.error('[CRON_KEEP_ALIVE] Ping failed:', err);
    return NextResponse.json({ 
      status: 'error', 
      error: err.message || err 
    }, { status: 500 });
  }
}
