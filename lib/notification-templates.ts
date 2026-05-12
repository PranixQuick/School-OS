// lib/notification-templates.ts
// Item #14 — WhatsApp HSM Notification Templates
//
// Reference file for the 5 Twilio Content Template Builder templates.
// Submit these bodies verbatim in the Twilio Console:
//   https://console.twilio.com/us1/develop/sms/content-template-builder
//   Select "WhatsApp" → "Utility" category.
//
// AFTER APPROVAL:
//   Add the returned Content SID (format: HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx)
//   as an env var in Vercel project settings for school-os-rh47.
//
// Dispatcher maps: notification.type → env var → ContentSid sent to Twilio.
//
// ─────────────────────────────────────────────────────────────────────────────
// Template 1: fee_reminder_utility
//   Env var: TWILIO_TEMPLATE_FEE_REMINDER
//   Body:
//     "Hi {{1}}, fee of ₹{{2}} for {{3}} is due on {{4}}. Contact school for queries."
//   Variables: {{1}}=parent_name, {{2}}=amount, {{3}}=student_name, {{4}}=due_date
//
// Template 2: homework_assigned_utility
//   Env var: TWILIO_TEMPLATE_HOMEWORK
//   Body:
//     "Hi {{1}}, new homework assigned for {{2}}: {{3}}. Due: {{4}}."
//   Variables: {{1}}=parent_name, {{2}}=subject, {{3}}=title, {{4}}=due_date
//
// Template 3: attendance_alert_utility
//   Env var: TWILIO_TEMPLATE_ATTENDANCE
//   Body:
//     "Hi {{1}}, {{2}} was marked absent today ({{3}}). Contact school if incorrect."
//   Variables: {{1}}=parent_name, {{2}}=student_name, {{3}}=date
//
// Template 4: leave_approved_utility
//   Env var: TWILIO_TEMPLATE_LEAVE
//   Body:
//     "Leave request for {{1}} from {{2}} to {{3}} has been {{4}}."
//   Variables: {{1}}=staff_name, {{2}}=from_date, {{3}}=to_date, {{4}}=status (approved/rejected)
//
// Template 5: broadcast_utility
//   Env var: TWILIO_TEMPLATE_BROADCAST
//   Body:
//     "Message from {{1}} school: {{2}}"
//   Variables: {{1}}=school_name, {{2}}=message_body
// ─────────────────────────────────────────────────────────────────────────────

export const NOTIFICATION_TEMPLATES = {
  fee_reminder: {
    name: 'fee_reminder_utility',
    env_var: 'TWILIO_TEMPLATE_FEE_REMINDER',
    category: 'UTILITY',
    body: 'Hi {{1}}, fee of ₹{{2}} for {{3}} is due on {{4}}. Contact school for queries.',
    variables: ['parent_name', 'amount', 'student_name', 'due_date'],
  },
  homework_assigned: {
    name: 'homework_assigned_utility',
    env_var: 'TWILIO_TEMPLATE_HOMEWORK',
    category: 'UTILITY',
    body: 'Hi {{1}}, new homework assigned for {{2}}: {{3}}. Due: {{4}}.',
    variables: ['parent_name', 'subject', 'homework_title', 'due_date'],
  },
  attendance_alert: {
    name: 'attendance_alert_utility',
    env_var: 'TWILIO_TEMPLATE_ATTENDANCE',
    category: 'UTILITY',
    body: 'Hi {{1}}, {{2}} was marked absent today ({{3}}). Contact school if incorrect.',
    variables: ['parent_name', 'student_name', 'date'],
  },
  leave_status: {
    name: 'leave_approved_utility',
    env_var: 'TWILIO_TEMPLATE_LEAVE',
    category: 'UTILITY',
    body: 'Leave request for {{1}} from {{2}} to {{3}} has been {{4}}.',
    variables: ['staff_name', 'from_date', 'to_date', 'status'],
  },
  broadcast: {
    name: 'broadcast_utility',
    env_var: 'TWILIO_TEMPLATE_BROADCAST',
    category: 'UTILITY',
    body: 'Message from {{1}} school: {{2}}',
    variables: ['school_name', 'message_body'],
  },
} as const;

export type NotificationTemplateType = keyof typeof NOTIFICATION_TEMPLATES;

/**
 * Returns the Twilio Content Template SID env var name for a given notification type.
 * Used for documentation/reference. The Edge Function reads these directly from Deno.env.
 */
export function getTemplateEnvVar(type: NotificationTemplateType): string {
  return NOTIFICATION_TEMPLATES[type].env_var;
}
