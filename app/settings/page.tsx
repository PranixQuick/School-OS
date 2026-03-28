'use client';

import { useState, useEffect, FormEvent } from 'react';
import Layout from '@/components/Layout';

interface School { id: string; name: string; plan: string; contact_email: string; contact_phone: string | null; address: string | null; board: string; slug: string; }
interface Usage { reports_generated: number; evaluations_done: number; broadcasts_sent: number; leads_scored: number; max_reports_per_month: number; max_evaluations_per_month: number; max_broadcasts_per_month: number; max_students: number; reset_at: string; }
interface User { id: string; email: string; name: string; role: string; is_active: boolean; last_login: string | null; }

const PLAN_COLOR: Record<string, { bg: string; color: string }> = {
  starter: { bg: '#F3F4F6', color: '#6B7280' },
  growth:  { bg: '#EEF2FF', color: '#4F46E5' },
  campus:  { bg: '#ECFDF5', color: '#065F46' },
};

export default function SettingsPage() {
  const [school, setSchool] = useState<School | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'usage' | 'team'>('general');

  // Edit form state
  const [form, setForm] = useState({ name: '', contact_email: '', contact_phone: '', address: '', board: 'CBSE' });

  useEffect(() => { fetchSettings(); }, []);

  async function fetchSettings() {
    setLoading(true);
    try {
      const res = await fetch('/api/settings');
      const d = await res.json() as { school: School; usage: Usage; users: User[] };
      setSchool(d.school);
      setUsage(d.usage);
      setUsers(d.users ?? []);
      setForm({
        name: d.school?.name ?? '',
        contact_email: d.school?.contact_email ?? '',
        contact_phone: d.school?.contact_phone ?? '',
        address: d.school?.address ?? '',
        board: d.school?.board ?? 'CBSE',
      });
    } finally { setLoading(false); }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setSaved(false);
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false); setSaved(true);
    fetchSettings();
    setTimeout(() => setSaved(false), 3000);
  }

  function pct(used: number, max: number): number {
    if (max === -1) return 0;
    return Math.min(100, Math.round((used / max) * 100));
  }

  const pc = PLAN_COLOR[school?.plan ?? 'starter'] ?? PLAN_COLOR.starter;
  const inputStyle = { width: '100%', height: 42, borderRadius: 9, border: '1px solid #D1D5DB', background: '#F9FAFB', fontSize: 14, padding: '0 14px', outline: 'none', fontFamily: 'inherit', color: '#111827', boxSizing: 'border-box' as const };
  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, letterSpacing: '0.03em' } as const;

  return (
    <Layout title="Settings" subtitle="School configuration and account management">
      {loading ? (
        <div className="card"><div className="empty-state"><div className="empty-state-icon">⚙️</div><div className="empty-state-title">Loading settings...</div></div></div>
      ) : (
        <>
          {/* School header */}
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, padding: '20px 24px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#4F46E5' }}>
                {school?.name?.charAt(0) ?? 'S'}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>{school?.name}</div>
                <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>/{school?.slug} · {school?.board}</div>
              </div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: pc.bg, color: pc.color, textTransform: 'uppercase' }}>
              {school?.plan} plan
            </span>
          </div>

          {/* Tabs */}
          <div className="tabs" style={{ marginBottom: 20 }}>
            {(['general', 'usage', 'team'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`tab-btn${activeTab === tab ? ' active' : ''}`}>
                {tab === 'general' ? 'General' : tab === 'usage' ? 'Usage & Plan' : 'Team Members'}
              </button>
            ))}
          </div>

          {/* General Settings */}
          {activeTab === 'general' && (
            <form onSubmit={handleSave}>
              <div className="card" style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 20 }}>School Information</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={labelStyle}>SCHOOL NAME</label>
                    <input required style={inputStyle} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>BOARD</label>
                    <select style={inputStyle} value={form.board} onChange={e => setForm(p => ({ ...p, board: e.target.value }))}>
                      {['CBSE','ICSE','IB','State','Cambridge'].map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={labelStyle}>CONTACT EMAIL</label>
                    <input type="email" style={inputStyle} value={form.contact_email} onChange={e => setForm(p => ({ ...p, contact_email: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>CONTACT PHONE</label>
                    <input style={inputStyle} value={form.contact_phone} onChange={e => setForm(p => ({ ...p, contact_phone: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>ADDRESS</label>
                  <input style={inputStyle} value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="School address" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                {saved && <span style={{ fontSize: 14, color: '#15803D', fontWeight: 600 }}>✓ Saved successfully</span>}
              </div>
            </form>
          )}

          {/* Usage & Plan */}
          {activeTab === 'usage' && usage && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 20 }}>
                {[
                  { label: 'Reports Generated', used: usage.reports_generated, max: usage.max_reports_per_month, icon: '📄' },
                  { label: 'Teacher Evaluations', used: usage.evaluations_done, max: usage.max_evaluations_per_month, icon: '🎙' },
                  { label: 'Broadcasts Sent', used: usage.broadcasts_sent, max: usage.max_broadcasts_per_month, icon: '📢' },
                  { label: 'Leads Scored', used: usage.leads_scored, max: -1, icon: '👥' },
                ].map(item => {
                  const p = pct(item.used, item.max);
                  const isUnlimited = item.max === -1;
                  return (
                    <div key={item.label} className="card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 18 }}>{item.icon}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{item.label}</span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: p >= 80 ? '#B91C1C' : '#374151' }}>
                          {item.used}{isUnlimited ? '' : `/${item.max}`}
                        </span>
                      </div>
                      {!isUnlimited && (
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${p}%`, background: p >= 80 ? '#EF4444' : p >= 60 ? '#F59E0B' : '#22C55E' }} />
                        </div>
                      )}
                      {isUnlimited && <div style={{ fontSize: 11, color: '#9CA3AF' }}>Unlimited on this plan</div>}
                    </div>
                  );
                })}
              </div>

              <div className="card">
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Current Plan: <span style={{ color: '#4F46E5', textTransform: 'capitalize' }}>{school?.plan}</span></div>
                <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
                  Usage resets on {usage.reset_at ? new Date(usage.reset_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'next month'}.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {[
                    { plan: 'Starter', price: 'Free', features: ['20 reports/mo', '5 evaluations', '10 broadcasts', '100 students'] },
                    { plan: 'Growth', price: '₹2,999/mo', features: ['200 reports/mo', '50 evaluations', '100 broadcasts', '500 students', 'WhatsApp bot', 'Risk detection'] },
                    { plan: 'Campus', price: '₹7,999/mo', features: ['Unlimited everything', 'API access', 'Priority support', 'Custom branding'] },
                  ].map(p => (
                    <div key={p.plan} style={{ border: `1px solid ${school?.plan?.toLowerCase() === p.plan.toLowerCase() ? '#4F46E5' : '#E5E7EB'}`, borderRadius: 12, padding: '16px', background: school?.plan?.toLowerCase() === p.plan.toLowerCase() ? '#EEF2FF' : '#fff' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 4 }}>{p.plan}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#4F46E5', marginBottom: 12 }}>{p.price}</div>
                      {p.features.map(f => <div key={f} style={{ fontSize: 12, color: '#6B7280', marginBottom: 3 }}>✓ {f}</div>)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Team Members */}
          {activeTab === 'team' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Team Members ({users.length})</div>
              </div>
              <table className="table">
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Role</th><th>Last Login</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#4F46E5' }}>{u.name.charAt(0)}</div>
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{u.name}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: 13, color: '#6B7280' }}>{u.email}</td>
                      <td><span className="badge badge-indigo" style={{ fontSize: 11 }}>{u.role.toUpperCase()}</span></td>
                      <td style={{ fontSize: 13, color: '#9CA3AF' }}>{u.last_login ? new Date(u.last_login).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Never'}</td>
                      <td><span className={`badge ${u.is_active ? 'badge-done' : 'badge-gray'}`} style={{ fontSize: 11 }}>{u.is_active ? 'ACTIVE' : 'INACTIVE'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
