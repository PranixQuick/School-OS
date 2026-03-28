'use client';

import { useState, useEffect, FormEvent } from 'react';
import Layout from '@/components/Layout';

interface School { id: string; name: string; plan: string; contact_email: string; contact_phone: string | null; address: string | null; board: string; slug: string; }
interface Usage { reports_generated: number; evaluations_done: number; broadcasts_sent: number; leads_scored: number; max_reports_per_month: number; max_evaluations_per_month: number; max_broadcasts_per_month: number; max_students: number; reset_at: string; }
interface User { id: string; email: string; name: string; role: string; is_active: boolean; last_login: string | null; }
interface Config {
  class_list: string[];
  sections: string[];
  fee_categories: string[];
  academic_terms: string[];
  school_timings: { start: string; end: string };
}

const PLAN_COLOR: Record<string, { bg: string; color: string }> = {
  starter: { bg: '#F3F4F6', color: '#6B7280' },
  free:    { bg: '#F3F4F6', color: '#6B7280' },
  growth:  { bg: '#EEF2FF', color: '#4F46E5' },
  pro:     { bg: '#EEF2FF', color: '#4F46E5' },
  campus:  { bg: '#ECFDF5', color: '#065F46' },
  enterprise: { bg: '#ECFDF5', color: '#065F46' },
};

export default function SettingsPage() {
  const [school, setSchool] = useState<School | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');
  const [activeTab, setActiveTab] = useState<'general' | 'usage' | 'team' | 'config'>('general');

  const [form, setForm] = useState({ name: '', contact_email: '', contact_phone: '', address: '', board: 'CBSE' });
  const [configForm, setConfigForm] = useState<Config | null>(null);
  const [newClass, setNewClass] = useState('');
  const [newTerm, setNewTerm] = useState('');
  const [newFeeCategory, setNewFeeCategory] = useState('');

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [settingsRes, configRes] = await Promise.all([
      fetch('/api/settings').then(r => r.json()) as Promise<{ school: School; usage: Usage; users: User[] }>,
      fetch('/api/config').then(r => r.json()) as Promise<{ config: Config }>,
    ]);
    setSchool(settingsRes.school);
    setUsage(settingsRes.usage);
    setUsers(settingsRes.users ?? []);
    setForm({
      name: settingsRes.school?.name ?? '',
      contact_email: settingsRes.school?.contact_email ?? '',
      contact_phone: settingsRes.school?.contact_phone ?? '',
      address: settingsRes.school?.address ?? '',
      board: settingsRes.school?.board ?? 'CBSE',
    });
    setConfig(configRes.config);
    setConfigForm(configRes.config);
    setLoading(false);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault(); setSaving(true); setSaved('');
    await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setSaving(false); setSaved('general'); fetchAll();
    setTimeout(() => setSaved(''), 3000);
  }

  async function handleConfigSave() {
    if (!configForm) return;
    setSaving(true);
    await fetch('/api/config', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(configForm) });
    setSaving(false); setSaved('config');
    setTimeout(() => setSaved(''), 3000);
  }

  function pct(used: number, max: number) {
    if (max === -1) return 0;
    return Math.min(100, Math.round((used / max) * 100));
  }

  function removeFromArray(key: keyof Config, value: string) {
    if (!configForm) return;
    setConfigForm(prev => {
      if (!prev) return prev;
      const arr = prev[key] as string[];
      return { ...prev, [key]: arr.filter((v: string) => v !== value) };
    });
  }

  function addToArray(key: keyof Config, value: string, setter: (v: string) => void) {
    if (!configForm || !value.trim()) return;
    setConfigForm(prev => {
      if (!prev) return prev;
      const arr = prev[key] as string[];
      if (arr.includes(value.trim())) return prev;
      return { ...prev, [key]: [...arr, value.trim()] };
    });
    setter('');
  }

  const pc = PLAN_COLOR[school?.plan ?? 'free'] ?? PLAN_COLOR.free;
  const inputStyle = { width: '100%', height: 42, borderRadius: 9, border: '1px solid #D1D5DB', background: '#F9FAFB', fontSize: 14, padding: '0 14px', outline: 'none', fontFamily: 'inherit', color: '#111827', boxSizing: 'border-box' as const };

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
          <div className="tabs">
            {(['general', 'usage', 'team', 'config'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`tab-btn${activeTab === tab ? ' active' : ''}`}>
                {tab === 'general' ? 'General' : tab === 'usage' ? 'Usage & Plan' : tab === 'team' ? 'Team' : 'School Config'}
              </button>
            ))}
          </div>

          {/* General */}
          {activeTab === 'general' && (
            <form onSubmit={handleSave}>
              <div className="card" style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 20 }}>School Information</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>SCHOOL NAME</label>
                    <input required style={inputStyle} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>BOARD</label>
                    <select style={inputStyle} value={form.board} onChange={e => setForm(p => ({ ...p, board: e.target.value }))}>
                      {['CBSE','ICSE','IB','State','Cambridge'].map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>CONTACT EMAIL</label>
                    <input type="email" style={inputStyle} value={form.contact_email} onChange={e => setForm(p => ({ ...p, contact_email: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>CONTACT PHONE</label>
                    <input style={inputStyle} value={form.contact_phone} onChange={e => setForm(p => ({ ...p, contact_phone: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>ADDRESS</label>
                  <input style={inputStyle} value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="School address" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                {saved === 'general' && <span style={{ fontSize: 14, color: '#15803D', fontWeight: 600 }}>✓ Saved successfully</span>}
              </div>
            </form>
          )}

          {/* Usage */}
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
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{item.label}</span>
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
                    </div>
                  );
                })}
              </div>
              <div className="card">
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
                  Current Plan: <span style={{ color: '#4F46E5', textTransform: 'capitalize' }}>{school?.plan}</span>
                </div>
                <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 12 }}>
                  Usage resets on {usage.reset_at ? new Date(usage.reset_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'next month'}.
                </div>
                <a href="/billing" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#4F46E5', fontWeight: 600, textDecoration: 'none' }}>
                  View billing & upgrade →
                </a>
              </div>
            </div>
          )}

          {/* Team */}
          {activeTab === 'team' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Team Members ({users.length})</div>
              </div>
              <table className="table">
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last Login</th><th>Status</th></tr></thead>
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

          {/* School Config */}
          {activeTab === 'config' && configForm && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                {/* Classes */}
                <div className="card">
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Classes / Grades</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                    {configForm.class_list.map(c => (
                      <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#EEF2FF', color: '#4F46E5', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20 }}>
                        {c}
                        <button onClick={() => removeFromArray('class_list', c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#818CF8', fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={newClass} onChange={e => setNewClass(e.target.value)} placeholder="Add class..." style={{ ...inputStyle, height: 36, fontSize: 13 }} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addToArray('class_list', newClass, setNewClass))} />
                    <button onClick={() => addToArray('class_list', newClass, setNewClass)} className="btn btn-ghost btn-sm">Add</button>
                  </div>
                </div>

                {/* Academic Terms */}
                <div className="card">
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Academic Terms</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                    {configForm.academic_terms.map(t => (
                      <div key={t} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F9FAFB', borderRadius: 8, padding: '6px 10px' }}>
                        <span style={{ fontSize: 13, color: '#374151' }}>{t}</span>
                        <button onClick={() => removeFromArray('academic_terms', t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 16, padding: 0 }}>×</button>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={newTerm} onChange={e => setNewTerm(e.target.value)} placeholder="e.g. Term 1 2025-26" style={{ ...inputStyle, height: 36, fontSize: 13 }} />
                    <button onClick={() => addToArray('academic_terms', newTerm, setNewTerm)} className="btn btn-ghost btn-sm">Add</button>
                  </div>
                </div>

                {/* Fee Categories */}
                <div className="card">
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Fee Categories</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                    {configForm.fee_categories.map(f => (
                      <span key={f} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FEF9C3', color: '#A16207', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20, textTransform: 'capitalize' }}>
                        {f}
                        <button onClick={() => removeFromArray('fee_categories', f)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CA8A04', fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={newFeeCategory} onChange={e => setNewFeeCategory(e.target.value)} placeholder="Add category..." style={{ ...inputStyle, height: 36, fontSize: 13 }} />
                    <button onClick={() => addToArray('fee_categories', newFeeCategory, setNewFeeCategory)} className="btn btn-ghost btn-sm">Add</button>
                  </div>
                </div>

                {/* School Timings */}
                <div className="card">
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>School Timings</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>START TIME</label>
                      <input type="time" style={inputStyle} value={configForm.school_timings.start}
                        onChange={e => setConfigForm(p => p ? { ...p, school_timings: { ...p.school_timings, start: e.target.value } } : p)} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>END TIME</label>
                      <input type="time" style={inputStyle} value={configForm.school_timings.end}
                        onChange={e => setConfigForm(p => p ? { ...p, school_timings: { ...p.school_timings, end: e.target.value } } : p)} />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
                <button onClick={handleConfigSave} disabled={saving} className="btn btn-primary">
                  {saving ? 'Saving...' : 'Save Configuration'}
                </button>
                {saved === 'config' && <span style={{ fontSize: 14, color: '#15803D', fontWeight: 600 }}>✓ Configuration saved</span>}
              </div>
            </div>
          )}
        </>
      )}
    </Layout>
   );
}
