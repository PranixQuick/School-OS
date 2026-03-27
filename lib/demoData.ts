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
  { id: 'ev2', title: 'Parent Teacher Meeting', event_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0], is_holiday: false, description: 'PTM for Classes 1 to 5' },
  { id: 'ev3', title: 'School Holiday — Ugadi', event_date: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0], is_holiday: true, description: 'School closed for Ugadi festival' },
  { id: 'ev4', title: 'Term 2 Exams Begin', event_date: new Date(Date.now() + 21 * 86400000).toISOString().split('T')[0], is_holiday: false, description: 'Term 2 examinations for all classes' },
];
