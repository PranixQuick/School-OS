'use client';

import { useState } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';
interface FormData { parent_name: string; child_name: string; child_age: string; target_class: string; source: string; phone: string; email: string; has_sibling: boolean; }
interface SubmitResult { score: number; priority: string; aiNote: string; }

const INITIAL: FormData = { parent_name: '', child_name: '', child_age: '', target_class: '1', source: 'google', phone: '', email: '', has_sibling: false };
const P_STYLES: Record<string, { bg: string; color: string; border: string; label: string }> = {
  high:   { bg: '#DCFCE7', color: '#15803D', border: '#22C55E', label: 'HIGH PRIORITY' },
  medium: { bg: '#FEF9C3', color: '#A16207', border: '#F59E0B', label: 'MEDIUM PRIORITY' },
  low:    { bg: '#FEE2E2', color: '#B91C1C', border: '#EF4444', label: 'LOW PRIORITY' },
};

export default function AdmissionsPage() {
  const [form, setForm] = useState<FormData>(INITIAL);
  const [status, setStatus] = useState<FormStatus>('idle');
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  function set(key: keyof FormData, val: string | boolean) { setForm(prev => ({ ...prev, [key]: val })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.parent_name || !form.phone || !form.child_age) return;
    setStatus('submitting'); setResult(null); setErrorMsg('');
    try {
      const res = await fetch('/api/admissions/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, child_age: parseInt(form.child_age, 10), has_sibling: form.has_sibling, email: form.email || undefined, child_name: form.child_name || undefined }) });
      const data = await res.json() as { error?: string } & SubmitResult;
      if (!res.ok) throw new Error(data.error ?? 'Submission failed');
      setResult({ score: data.score, priority: data.priority, aiNote: data.aiNote });
      setStatus('success'); setForm(INITIAL);
    } catch (err: unknown) { setErrorMsg(err instanceof Error ? err.message : 'Unknown error'); setStatus('error'); }
  }

  return (
    <Layout
      title="New Inquiry"
      subtitle="Add a parent inquiry and AI will score the lead instantly"
      actions={<Link href="/admissions/crm" className="btn btn-ghost btn-sm">View CRM →</Link>}
    >
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <form onSubmit={handleSubmit}>
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div><label className="label">PARENT NAME *</label><input required className="input" value={form.parent_name} onChange={e => set('parent_name', e.target.value)} placeholder="e.g. Ramesh Kumar" /></div>
              <div><label className="label">PHONE NUMBER *</label><input required className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 98765 43210" /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div><label className="label">CHILD NAME</label><input className="input" value={form.child_name} onChange={e => set('child_name', e.target.value)} placeholder="Child's name" /></div>
              <div><label className="label">CHILD AGE *</label><input required type="number" min="3" max="18" className="input" value={form.child_age} onChange={e => set('child_age', e.target.value)} placeholder="e.g. 6" /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label className="label">GRADE INTERESTED IN *</label>
                <select required className="input" value={form.target_class} onChange={e => set('target_class', e.target.value)}>
                  {['1','2','3','4','5','6','7','8','9','10'].map(g => <option key={g} value={g}>Class {g}</option>)}
                </select>
              </div>
              <div>
                <label className="label">HOW DID THEY FIND US *</label>
                <select required className="input" value={form.source} onChange={e => set('source', e.target.value)}>
                  {[{ v: 'referral', l: 'Parent Referral' }, { v: 'google', l: 'Google Search' }, { v: 'website', l: 'School Website' }, { v: 'instagram', l: 'Instagram' }, { v: 'facebook', l: 'Facebook' }, { v: 'walk-in', l: 'Walk-in' }, { v: 'other', l: 'Other' }].map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}><label className="label">EMAIL ADDRESS</label><input type="email" className="input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="parent@email.com (optional)" /></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#F9FAFB', borderRadius: 10, border: '1px solid #F3F4F6' }}>
              <input type="checkbox" id="sibling" checked={form.has_sibling} onChange={e => set('has_sibling', e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#4F46E5' }} />
              <label htmlFor="sibling" style={{ fontSize: 14, color: '#374151', cursor: 'pointer', fontWeight: 500, flex: 1 }}>Sibling already enrolled at this school</label>
              <span className="badge badge-high">+20 pts</span>
            </div>
          </div>

          {status === 'error' && <div className="alert alert-error" style={{ marginBottom: 14 }}><strong>Error:</strong> {errorMsg}</div>}

          <button type="submit" disabled={status === 'submitting'} className="btn btn-primary btn-lg" style={{ width: '100%' }}>
            {status === 'submitting' ? <><span className="spinner" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff' }} />Scoring with AI...</> : '✦ Submit Inquiry & Score Lead'}
          </button>
        </form>

        {status === 'success' && result && (() => {
          const ps = P_STYLES[result.priority] ?? P_STYLES.medium;
          return (
            <div className="card" style={{ marginTop: 16, border: `1.5px solid ${ps.border}`, padding: 0, overflow: 'hidden' }}>
              <div style={{ background: ps.bg, padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: ps.color, letterSpacing: '0.05em', marginBottom: 4 }}>LEAD SCORED</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>{ps.label}</div>
                </div>
                <div className="score-circle" style={{ width: 64, height: 64, background: '#fff', border: `3px solid ${ps.border}` }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: ps.color, lineHeight: 1 }}>{result.score}</div>
                  <div style={{ fontSize: 10, color: ps.color, fontWeight: 600 }}>/ 100</div>
                </div>
              </div>
              {result.aiNote && <div style={{ padding: '12px 22px', borderTop: `1px solid ${ps.bg}` }}><span style={{ fontSize: 11, fontWeight: 700, color: ps.color }}>AI INSIGHT: </span><span style={{ fontSize: 14, color: '#374151' }}>{result.aiNote}</span></div>}
              <div style={{ padding: '12px 22px', borderTop: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#9CA3AF' }}>Lead saved to CRM</span>
                <Link href="/admissions/crm" style={{ fontSize: 13, fontWeight: 700, color: '#4F46E5', textDecoration: 'none' }}>View in CRM →</Link>
              </div>
            </div>
          );
        })()}
      </div>
    </Layout>
  );
}
