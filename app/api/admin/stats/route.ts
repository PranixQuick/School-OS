import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

const SUPER_ADMIN_EMAIL = 'pranixailabs@gmail.com';

export async function GET(req: NextRequest) {
  const userEmail = req.headers.get('x-user-email');
  if (userEmail !== SUPER_ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const [schoolsRes, usersRes, usageRes, upgradeRes, activityRes] = await Promise.all([
      supabaseAdmin.from('schools').select('id, name, plan, is_active, created_at, onboarded_at').order('created_at', { ascending: false }),
      supabaseAdmin.from('school_users').select('id, email, role, school_id, created_at').order('created_at', { ascending: false }),
      supabaseAdmin.from('usage_limits').select('school_id, plan, reports_generated, evaluations_done, broadcasts_sent'),
      supabaseAdmin.from('upgrade_requests').select('id, school_name, current_plan, requested_plan, status, created_at').order('created_at', { ascending: false }).limit(20),
      supabaseAdmin.from('activity_logs').select('action, module, created_at').order('created_at', { ascending: false }).limit(20),
    ]);

    const schools = schoolsRes.data ?? [];
    const users = usersRes.data ?? [];
    const usage = usageRes.data ?? [];

    const totalReports = usage.reduce((s, u) => s + (u.reports_generated ?? 0), 0);
    const totalBroadcasts = usage.reduce((s, u) => s + (u.broadcasts_sent ?? 0), 0);
    const totalEvals = usage.reduce((s, u) => s + (u.evaluations_done ?? 0), 0);

    const planBreakdown = {
      free: schools.filter(s => s.plan === 'free' || s.plan === 'starter').length,
      pro: schools.filter(s => s.plan === 'pro' || s.plan === 'growth').length,
      enterprise: schools.filter(s => s.plan === 'enterprise' || s.plan === 'campus').length,
    };

    return NextResponse.json({
      summary: {
        total_schools: schools.length,
        active_schools: schools.filter(s => s.is_active).length,
        total_users: users.length,
        total_reports_generated: totalReports,
        total_broadcasts_sent: totalBroadcasts,
        total_evaluations: totalEvals,
        plan_breakdown: planBreakdown,
      },
      schools: schools.map(s => {
        const u = usage.find(ul => ul.school_id === s.id);
        return { ...s, usage: u ?? null };
      }),
      recent_upgrades: upgradeRes.data ?? [],
      recent_activity: activityRes.data ?? [],
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
