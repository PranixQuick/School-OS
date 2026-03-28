export const DEMO_KPIS = {
  total_students: 247,
  total_staff: 18,
  pending_fees_count: 12,
  pending_fees_amount: 180000,
  total_leads: 34,
  high_priority_leads: 11,
  evals_done: 7,
  narratives_generated: 85,
};

export const DEMO_LEADS = [
  { id: 'd1', parent_name: 'Suresh Verma', child_name: 'Ananya', child_age: 5, target_class: '1', source: 'referral', phone: '+91 91000 00210', score: 88, priority: 'high', status: 'new', created_at: new Date().toISOString() },
  { id: 'd2', parent_name: 'Preethi Iyer', child_name: 'Karthik', child_age: 8, target_class: '3', source: 'google', phone: '+91 91000 00211', score: 72, priority: 'high', status: 'contacted', created_at: new Date().toISOString() },
  { id: 'd3', parent_name: 'Sunita Rao', child_name: 'Vikram', child_age: 6, target_class: '1', source: 'referral', phone: '+91 91000 00213', score: 91, priority: 'high', status: 'visit_scheduled', created_at: new Date().toISOString() },
  { id: 'd4', parent_name: 'Ashok Pillai', child_name: 'Nandini', child_age: 9, target_class: '4', source: 'instagram', phone: '+91 91000 00214', score: 52, priority: 'medium', status: 'new', created_at: new Date().toISOString() },
  { id: 'd5', parent_name: 'Geeta Sharma', child_name: 'Aryan', child_age: 7, target_class: '2', source: 'google', phone: '+91 91000 00215', score: 65, priority: 'medium', status: 'contacted', created_at: new Date().toISOString() },
];

export const DEMO_EVALS = [
  { id: 'e1', file_name: 'priya_maths_class5.mp3', coaching_score: 8, eval_report: JSON.stringify({ score: 8, strengths: 'Excellent concept explanation with real-world examples. Students were highly engaged throughout.', improvements: 'Could increase student participation with more open questions.', feedback: 'Strong lesson delivery with clear structure.' }), status: 'done', uploaded_at: new Date(Date.now() - 86400000).toISOString() },
  { id: 'e2', file_name: 'ravi_science_demo.mp3', coaching_score: 7, eval_report: JSON.stringify({ score: 7, strengths: 'Clear explanations and good use of visual aids.', improvements: 'Pacing could be improved in the second half.', feedback: 'Good session overall with room to improve engagement techniques.' }), status: 'done', uploaded_at: new Date(Date.now() - 172800000).toISOString() },
];

export const DEMO_EVENTS = [
  { id: 'ev1', title: 'Annual Sports Day', event_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0], is_holiday: false, description: 'Annual sports day for all classes' },
  { id: 'ev2', title: 'Parent Teacher Meeting', event_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0], is_holiday: false, description: 'PTM for Classes 5 and 6' },
  { id: 'ev3', title: 'School Holiday — Ugadi', event_date: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0], is_holiday: true, description: 'School closed for Ugadi festival' },
  { id: 'ev4', title: 'Term 2 Exams Begin', event_date: new Date(Date.now() + 21 * 86400000).toISOString().split('T')[0], is_holiday: false, description: 'Term 2 examinations for all classes' },
];

// Phase 2 demo data
export const DEMO_BROADCASTS = [
  { id: 'b1', type: 'fee_reminder', title: 'Term 2 Fee Reminder', message: 'Dear Parent, this is a gentle reminder that the Term 2 tuition fee of ₹18,500 is due by 15th April 2025. Kindly ensure timely payment. — Suchitra Academy.', target_classes: ['5','6'], target_count: 47, sent_count: 47, status: 'sent', sent_at: new Date(Date.now() - 2 * 86400000).toISOString(), created_at: new Date(Date.now() - 2 * 86400000).toISOString() },
  { id: 'b2', type: 'homework', title: 'Homework — Mathematics Class 5', message: 'Dear Parent, Class 5 homework: Mathematics Exercise 4.2 Q1-10 (Fractions). Due tomorrow. — Ms. Priya Sharma.', target_classes: ['5'], target_count: 22, sent_count: 22, status: 'sent', sent_at: new Date(Date.now() - 86400000).toISOString(), created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: 'b3', type: 'event', title: 'Annual Sports Day Notice', message: 'Dear Parents, Annual Sports Day is next Saturday 10am–2pm. Please send your child in comfortable sportswear. Spectators welcome from 11am. — Suchitra Academy Admin.', target_classes: ['1','2','3','4','5','6'], target_count: 120, sent_count: 120, status: 'sent', sent_at: new Date(Date.now() - 3 * 3600000).toISOString(), created_at: new Date(Date.now() - 3 * 3600000).toISOString() },
  { id: 'b4', type: 'general', title: 'School Holiday — Ugadi', message: 'Dear Parents, school will remain closed on 30th March on account of Ugadi festival. Classes resume 31st March. Happy Ugadi! — Principal, Suchitra Academy.', target_classes: ['1','2','3','4','5','6','7','8','9','10'], target_count: 247, sent_count: 247, status: 'sent', sent_at: new Date(Date.now() - 5 * 3600000).toISOString(), created_at: new Date(Date.now() - 5 * 3600000).toISOString() },
];

export const DEMO_BRIEFING = {
  id: 'br1',
  date: new Date().toISOString().split('T')[0],
  briefing_text: `Good morning, Principal. Here is your intelligence briefing for today.\n\n• ATTENDANCE: Student attendance stands at 88% today. Three students in Class 5-A have missed 4+ consecutive days — recommend a parent call.\n\n• FEES: ₹180K in pending dues across 12 students. Four accounts are overdue by more than 30 days — escalation recommended before Term 2 begins.\n\n• ADMISSIONS: 11 active leads in the pipeline, 6 classified as high priority. Sunita Rao (Class 1, score 91) has a site visit scheduled — ensure reception is briefed.\n\n• TEACHING: 2 teacher evaluations completed this week. Priya Sharma scored 8/10 with strong student engagement. Ravi Kumar at 7/10 — coaching session recommended on pacing.\n\n• UPCOMING: Annual Sports Day in 7 days. PTM scheduled in 14 days for Classes 5 and 6.\n\nAction items: Schedule parent calls for long-absent students, follow up on overdue fees, and brief admissions team on today's visit.`,
  kpi_snapshot: { total_students: 247, attendance_pct: 88, pending_fees_amount: 180000, new_leads_week: 5, high_priority_leads: 6, avg_eval_score: 7, teachers_present: '3/3' },
  generated_at: new Date().toISOString(),
};

export const DEMO_RISK_FLAGS = [
  { id: 'rf1', student_id: 's1', risk_level: 'high', risk_factors: ['Fee overdue', 'Requires immediate follow-up'], ai_summary: 'Contact parent immediately to resolve outstanding fee and check on student well-being.', attendance_pct: 72, avg_score: 58, fee_overdue: true, flagged_at: new Date().toISOString(), resolved_at: null, students: { name: 'Rahul Singh', class: '5', section: 'A' } },
  { id: 'rf2', student_id: 's2', risk_level: 'medium', risk_factors: ['Low academic performance in one or more subjects'], ai_summary: 'Schedule teacher-parent meeting to discuss academic support strategies for improvement.', attendance_pct: 85, avg_score: 52, fee_overdue: false, flagged_at: new Date().toISOString(), resolved_at: null, students: { name: 'Meera Krishnan', class: '6', section: 'A' } },
];
