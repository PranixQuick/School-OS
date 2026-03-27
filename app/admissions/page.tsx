'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';
import Link from 'next/link';

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

interface FormData {
  parent_name: string;
  child_name: string;
  child_age: string;
  target_class: string;
  source: string;
  phone: string;
  email: string;
  has_sibling: boolean;
}

interface SubmitResult {
  score: number;
  priority: string;
  aiNote: string;
}

const BTN: CSSProperties = { border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 };

const PRIORITY_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  high:   { bg: '#E1F5EE', color: '#0F6E56', label: 'HIGH PRIORITY' },
  medium: { bg: '#FAEEDA', color: '#854F0B', label: 'MEDIUM PRIORITY' },
  low:    { bg: '#FAECE7', color: '#993C1D', label: 'LOW PRIORITY' },
};

const INITIAL: FormData = {
  parent_name: '', child_name: '', child_age: '',
  target_class: '1', source: 'google',
  phone: '', email: '', has_sibling: false,
};

export default function AdmissionsPage() {
  const [form, setForm] = useState<FormData>(INITIAL);
  const [status, setStatus] = useState<FormStatus>('idle');
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  function set(key: keyof FormData, val: string | boolean) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.parent_name || !form.phone || !form.child_age) return;
    setStatus('submitting'); setResult(null); setErrorMsg('');

    try {
      const res = await fetch('/api/admissions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          child_age: parseInt(form.child_age, 10),
          has_sibling: form.has_sibling,
          email: form.email || undefined,
          child_name: form.child_name || undefined,
        }),
      });
      const data = await res.json() as { error?: string } & SubmitResult;
      if (!res.ok) throw new Error(data.error ?? 'Submission failed');
      setResult({ score: data.score, priority: data.priority, aiNote: data.aiNote });
      setStatus('success');
      setForm(INITIAL);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  }

  const inputStyle: CSSProperties = {
    width: '100%', height: 42, borderRadius: 8,
    border: '1px solid #D3D1C7', background: '#FAFAF8',
    fontSize: 14, padding: '0 12px', outline: 'none',
    fontFamily: 'inherit', color: '#1A1A18',
  };

  const labelStyle: CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: '#5F5E5A', letterSpacing: '0.05em', marginBottom: 7,
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F8F7F4', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* Nav */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #E8E6DF', height: 56, display: 'flex', alignItems: 'center', padding: '0 32px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: '#0F6E56', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>S</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#1A1A18' }}>School OS</span>
          </a>
          <span style={{ color: '#D3D1C7', margin: '0 6px' }}>/</span>
          <span style={{ fontSize: 14, color: '#5F5E5A' }}>Admissions</span>
        </div>
        <Link href="/admissions/crm"
          style={{ ...BTN, height: 34, padding: '0 16px', borderRadius: 8, background: '#3C3489', color: '#fff', fontSize: 13, display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          View CRM
        </Link>
      </nav>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#EEEDFE', borderRadius: 20, padding: '4px 12px', marginBottom: 14 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3C3489' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#3C3489', letterSpacing: '0.05em' }}>ADMISSIONS INQUIRY</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1A1A18', margin: '0 0 8px', letterSpacing: '-0.5px' }}>
            New Admission Inquiry
          </h1>
          <p style={{ fontSize: 15, color: '#5F5E5A', margin: 0, lineHeight: 1.6 }}>
            Fill in the parent and child details. Our AI will instantly score this lead and categorise it for your admissions team.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ background: '#fff', border: '1px solid #E8E6DF', borderRadius: 16, padding: 28, marginBottom: 16 }}>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
              <div>
                <label style={labelStyle}>PARENT NAME *</label>
                <input required value={form.parent_name} onChange={e => set('parent_name', e.target.value)}
                  placeholder="e.g. Ramesh Kumar" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>PHONE NUMBER *</label>
                <input required value={form.phone} onChange={e => set('phone', e.target.value)}
                  placeholder="+91 98765 43210" style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
              <div>
                <label style={labelStyle}>CHILD NAME</label>
                <input value={form.child_name} onChange={e => set('child_name', e.target.value)}
                  placeholder="Child's name" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>CHILD AGE *</label>
                <input required type="number" min="3" max="18" value={form.child_age}
                  onChange={e => set('child_age', e.target.value)}
                  placeholder="e.g. 6" style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
              <div>
                <label style={labelStyle}>GRADE INTERESTED IN *</label>
                <select required value={form.target_class} onChange={e => set('target_class', e.target.value)} style={inputStyle}>
                  {['1','2','3','4','5','6','7','8','9','10'].map(g => (
                    <option key={g} value={g}>Class {g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>HOW DID THEY FIND US *</label>
                <select required value={form.source} onChange={e => set('source', e.target.value)} style={inputStyle}>
                  {[
                    { value: 'referral', label: 'Parent Referral' },
                    { value: 'google', label: 'Google Search' },
                    { value: 'website', label: 'School Website' },
                    { value: 'instagram', label: 'Instagram' },
                    { value: 'facebook', label: 'Facebook' },
                    { value: 'walk-in', label: 'Walk-in' },
                    { value: 'other', label: 'Other' },
                  ].map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>EMAIL ADDRESS</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="parent@email.com (optional)" style={inputStyle} />
            </div>

            {/* Sibling checkbox */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#F1EFE8', borderRadius: 8, marginBottom: 4 }}>
              <input type="checkbox" id="sibling" checked={form.has_sibling}
                onChange={e => set('has_sibling', e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer' }} />
              <label htmlFor="sibling" style={{ fontSize: 14, color: '#2C2C2A', cursor: 'pointer', fontWeight: 500 }}>
                Sibling already enrolled at this school
              </label>
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#0F6E56', background: '#E1F5EE', padding: '2px 8px', borderRadius: 6 }}>
                +20 pts
              </span>
            </div>
          </div>

          {/* Error */}
          {status === 'error' && (
            <div style={{ background: '#FAECE7', border: '1px solid #F0997B', borderRadius: 10, padding: '14px 18px', color: '#712B13', fontSize: 14, marginBottom: 16 }}>
              <strong>Error:</strong> {errorMsg}
            </div>
          )}

          <button type="submit" disabled={status === 'submitting'}
            style={{ ...BTN, width: '100%', height: 48, borderRadius: 10, background: status === 'submitting' ? '#7F77DD' : '#3C3489', color: '#fff', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            {status === 'submitting' ? <><Spinner /> Scoring with AI...</> : 'Submit Inquiry & Score Lead'}
          </button>
        </form>

        {/* Success result */}
        {status === 'success' && result && (() => {
          const ps = PRIORITY_STYLES[result.priority] ?? PRIORITY_STYLES.medium;
          return (
            <div style={{ marginTop: 20, background: '#fff', border: `1.5px solid ${ps.color}`, borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ background: ps.bg, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: ps.color, letterSpacing: '0.05em', marginBottom: 4 }}>LEAD SCORED</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#1A1A18' }}>{ps.label}</div>
                </div>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fff', border: `3px solid ${ps.color}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: ps.color, lineHeight: 1 }}>{result.score}</div>
                  <div style={{ fontSize: 10, color: ps.color, fontWeight: 600 }}>/ 100</div>
                </div>
              </div>
              {result.aiNote && (
                <div style={{ padding: '14px 24px', borderTop: `1px solid ${ps.bg}` }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: ps.color }}>AI INSIGHT: </span>
                  <span style={{ fontSize: 14, color: '#2C2C2A' }}>{result.aiNote}</span>
                </div>
              )}
              <div style={{ padding: '14px 24px', borderTop: '1px solid #E8E6DF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#888780' }}>Lead saved to CRM</span>
                <Link href="/admissions/crm"
                  style={{ fontSize: 13, fontWeight: 700, color: '#3C3489', textDecoration: 'none' }}>
                  View in CRM →
                </Link>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <>
      <style>{`@keyframes adm_spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.35)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'adm_spin 0.7s linear infinite' }} />
    </>
  );
}
