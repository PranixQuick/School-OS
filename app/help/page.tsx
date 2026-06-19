'use client';
// app/help/page.tsx
// ISS-5 (#5 / P4.5) — Role-aware in-app user manual.
// Fetches the viewer's role from /api/auth/me and surfaces the topics relevant
// to that role first. Static content (no DB). Accordion sections.

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

const ADMINISH = ['owner', 'principal', 'admin_staff', 'admin'];
const FINANCE = ['accountant', ...ADMINISH];

interface Topic { q: string; a: string }
interface Section { id: string; title: string; icon: string; roles: 'all' | string[]; topics: Topic[] }

const SECTIONS: Section[] = [
  {
    id: 'account', title: 'Signing in & your account', icon: '🔐', roles: 'all',
    topics: [
      { q: 'How do I change my password?', a: 'Open Settings and click "Change password" (or go to /account/password). Enter your current password, then your new one twice. Staff sign in with email + password.' },
      { q: 'I forgot my password', a: 'On the login screen use "Forgot password" to receive a secure sign-in link by email. After signing in, set a new password from Settings.' },
      { q: 'Show / hide password', a: 'Use the eye / "show" toggle next to any password or PIN field to check what you typed before submitting.' },
    ],
  },
  {
    id: 'search', title: 'Finding people', icon: '🔎', roles: ['owner', 'principal', 'admin_staff', 'admin', 'counsellor', 'viewer'],
    topics: [
      { q: 'Search for a student or staff member', a: 'Use the search box in the top bar. Type a name or admission number; results are scoped to your school and your role.' },
      { q: 'See full details', a: 'Click a person’s name in any list to open a detail card with their key information.' },
    ],
  },
  {
    id: 'students', title: 'Students', icon: '👨‍🎓', roles: ADMINISH,
    topics: [
      { q: 'Add or import students', a: 'On the Students page, add a student manually or import a CSV. IDs (admission number) can be any format and must be unique within your school.' },
      { q: 'Student lifecycle', a: 'From a student row you can transfer, graduate, withdraw, archive, or edit. These actions keep historical records intact.' },
    ],
  },
  {
    id: 'fees', title: 'Fees & accounts', icon: '💰', roles: FINANCE,
    topics: [
      { q: 'Accountant cockpit', a: 'Open /accountant for today’s and this month’s collections, overdue totals, and payments awaiting verification.' },
      { q: 'Defaulters', a: 'The Defaulters report lists students with overdue fees, sorted oldest first, with a tap-to-call parent number.' },
      { q: 'Student fee ledger', a: 'Search a student to see their full fee history with billed / paid / pending / overdue totals.' },
      { q: 'Generate fee demands', a: 'Use Generate demands to create fees in bulk from a fee template. Always preview first; re-running is safe (already-generated fees are skipped).' },
      { q: 'Receipts', a: 'Open a paid fee’s receipt to print or save it as a PDF (A5).' },
      { q: 'Tally export', a: 'On the Tally export page, pick a date range and download Receipt vouchers as Tally XML (direct import) or CSV. Make sure the ledger names exist in Tally first.' },
    ],
  },
  {
    id: 'payroll', title: 'Payroll', icon: '💼', roles: ADMINISH,
    topics: [
      { q: 'Run payroll', a: 'In Payroll, set up salary structures per staff member, then create a monthly run. Review payslips, approve, and mark as paid. Export a CSV for your records.' },
    ],
  },
  {
    id: 'staff', title: 'Staff', icon: '👥', roles: ADMINISH,
    topics: [
      { q: 'Add staff & send invites', a: 'Add a staff member with their email and role, then send an invitation so they can set their password. Use "Send all invitations" to invite everyone not yet set up.' },
    ],
  },
  {
    id: 'parents', title: 'Parents', icon: '👨‍👩‍👧', roles: ADMINISH,
    topics: [
      { q: 'Parent logins', a: 'Parents register automatically when a student is added with a phone number. From the Parents page you can send or reset a parent’s PIN.' },
    ],
  },
  {
    id: 'vendors', title: 'Vendors', icon: '🏪', roles: ['owner', 'principal', 'admin_staff', 'admin'],
    topics: [
      { q: 'Vendor portal', a: 'Grant a vendor portal access with a login email; they sign in with email + PIN to view their profile and update their contact details. Parents can see relevant suppliers (books, uniform, transport).' },
    ],
  },
  {
    id: 'permissions', title: 'Roles & permissions', icon: '🛡️', roles: ['owner'],
    topics: [
      { q: 'Edit the permission matrix', a: 'Super-admins can open the role-permissions matrix to set which roles can view/create/edit/delete each module. Where no rule is set, safe built-in defaults apply.' },
    ],
  },
  {
    id: 'teacher', title: 'For teachers', icon: '📚', roles: ['teacher'],
    topics: [
      { q: 'Daily tools', a: 'Use your dashboard for today’s timetable, homework, attendance, and marks. Open Syllabus to view the curriculum for your classes.' },
    ],
  },
  {
    id: 'parents_portal', title: 'For parents', icon: '📱', roles: ['parent'],
    topics: [
      { q: 'Using the parent app', a: 'See attendance, homework, fees, marks, report cards, timetable, notices and events. Change your login PIN from the "Change PIN" tile on the home screen.' },
    ],
  },
];

export default function HelpPage() {
  const [role, setRole] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then((d: { role?: string } | null) => setRole(d?.role ?? null))
      .catch(() => setRole(null))
      .finally(() => setLoaded(true));
  }, []);

  const relevant = SECTIONS.filter(s => s.roles === 'all' || (role != null && s.roles.includes(role)));
  const base = showAll || !role ? SECTIONS : (relevant.length > 0 ? relevant : SECTIONS);
  const q = query.trim().toLowerCase();
  const shown = q
    ? SECTIONS
        .map(s => ({ ...s, topics: s.topics.filter(t => t.q.toLowerCase().includes(q) || t.a.toLowerCase().includes(q) || s.title.toLowerCase().includes(q)) }))
        .filter(s => s.topics.length > 0)
    : base;

  function toggle(id: string) { setOpen(o => ({ ...o, [id]: !o[id] })); }

  return (
    <Layout title="User Manual" subtitle="Help & how-to guides">
      <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search help…"
          style={{ width: '100%', height: 40, padding: '0 14px', border: '1px solid #D1D5DB', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 13, color: '#6B7280' }}>
            {loaded && role ? <>Showing help for your role: <b style={{ color: '#374151', textTransform: 'capitalize' }}>{role.replace(/_/g, ' ')}</b></> : 'Help topics'}
          </div>
          {role && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
              <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
              Show all topics
            </label>
          )}
        </div>

        {shown.map(section => (
          <div key={section.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden' }}>
            <button
              onClick={() => toggle(section.id)}
              style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
                <span style={{ marginRight: 8 }}>{section.icon}</span>{section.title}
              </span>
              <span style={{ fontSize: 18, color: '#9CA3AF' }}>{(q || open[section.id]) ? '▾' : '▸'}</span>
            </button>
            {(q || open[section.id]) && (
              <div style={{ borderTop: '1px solid #F3F4F6', padding: '6px 16px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {section.topics.map((t, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 3 }}>{t.q}</div>
                    <div style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.6 }}>{t.a}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>
          Can’t find what you need? Contact your school administrator.
        </div>
      </div>
    </Layout>
  );
}
