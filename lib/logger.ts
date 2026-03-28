import { supabaseAdmin } from './supabaseClient';

export async function logActivity(params: {
  schoolId: string;
  action: string;
  module: 'report_cards' | 'teacher_eval' | 'admissions' | 'broadcasts' | 'ptm' | 'risk' | 'settings' | 'auth' | 'import';
  actorEmail?: string;
  details?: Record<string, unknown>;
}) {
  try {
    await supabaseAdmin.from('activity_logs').insert({
      school_id: params.schoolId,
      action: params.action,
      module: params.module,
      actor_email: params.actorEmail ?? null,
      details: params.details ?? {},
    });
  } catch (e) {
    console.error('Activity log failed:', e);
  }
}

export async function logError(params: {
  route: string;
  error: string;
  schoolId?: string;
  details?: Record<string, unknown>;
}) {
  try {
    await supabaseAdmin.from('error_logs').insert({
      school_id: params.schoolId ?? null,
      route: params.route,
      error: params.error.slice(0, 1000),
      details: params.details ?? {},
    });
  } catch (e) {
    console.error('Error log failed:', e);
  }
}

export async function logNotification(params: {
  schoolId: string;
  type: 'broadcast' | 'fee_reminder' | 'ptm' | 'alert' | 'system' | 'risk';
  title: string;
  message: string;
  targetCount?: number;
  module?: string;
  referenceId?: string;
}) {
  try {
    await supabaseAdmin.from('notifications').insert({
      school_id: params.schoolId,
      type: params.type,
      title: params.title,
      message: params.message.slice(0, 500),
      target_count: params.targetCount ?? 0,
      module: params.module ?? null,
      reference_id: params.referenceId ?? null,
    });
  } catch (e) {
    console.error('Notification log failed:', e);
  }
}
