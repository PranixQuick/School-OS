'use client';
// app/admin/students/new/page.tsx
// H1: Enroll student from admission inquiry
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, Suspense } from 'react';
import Layout from '@/components/Layout';

const inputStyle = { width: '100%', padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const, outline: 'none' };
const labelStyle = { fontSize: 11, fontWeight: 700 as const, color: '#6B7280', letterSpacing: '0.05em', marginBottom: 4, display: 'block' as const };

function NewStudentForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [form, setForm] = useState({
    student_name: searchParams.get('child_name') ?? '',
    cls: searchParams.get('target_class') ?? '',
    section: 'A',
    parent_name: '',
    parent_phone: '',
    parent_email: '',
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const inquiryId = searchParams.get('from_inquiry');

  function set(k: keyof typeof form, val: string) { setForm(p => ({ ...p, [k]: val })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    const res = await fetch('/api/admin/admissions/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, from_inquiry: inquiryId }),
    });
    setSaving(false);
    if (res.ok) {
      setDone(true);
      setTimeout(() => router.push('/admin/students'), 1500);
    } else {
      const d = await res.json() as { error?: string };
      setError(d.error ?? 'Enrollment failed');
    }
  }

  if (done) return (
    <Layout title='Student Enrolled'>
      <div style={{ padding: 32, textAlign: 'center', color: '#065F46', fontSize: 15, fontWeight: 600 }}>
        ✓ Student enrolled successfully! Redirecting...
      </div>
    </Layout>
  );

  return (
    <Layout title='Enroll Student' subtitle='New student from admission inquiry'>
      <form onSubmit={handleSubmit} style={{ maxWidth: 480 }}>
        {error && <div style={{ marginBottom: 14, padding: '10px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#B91C1C', fontSize: 13 }}>{error}</div>}

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>STUDENT NAME *</label>
          <input required style={inputStyle} value={form.student_name} onChange={e => set('student_name', e.target.value)} placeholder='Full name' />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>CLASS *</label>
            <input required style={inputStyle} value={form.cls} onChange={e => set('cls', e.target.value)} placeholder='e.g. 5' />
          </div>
          <div>
            <label style={labelStyle}>SECTION</label>
            <input style={inputStyle} value={form.section} onChange={e => set('section', e.target.value)} placeholder='A' />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>PARENT NAME</label>
          <input style={inputStyle} value={form.parent_name} onChange={e => set('parent_name', e.target.value)} placeholder='Parent / Guardian name' />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>PARENT PHONE</label>
          <input type='tel' style={inputStyle} value={form.parent_phone} onChange={e => set('parent_phone', e.target.value)} placeholder='+91XXXXXXXXXX' />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>PARENT EMAIL</label>
          <input type='email' style={inputStyle} value={form.parent_email} onChange={e => set('parent_email', e.target.value)} placeholder='Optional' />
        </div>

        <button type='submit' disabled={saving}
          style={{ width: '100%', padding: '12px', background: saving ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
          {saving ? 'Enrolling...' : 'Enroll Student'}
        </button>
      </form>
    </Layout>
  );
}

export default function NewStudentPage() {
  return <Suspense fallback={<Layout title='Enroll Student'><div style={{padding:32,color:'#9CA3AF'}}>Loading...</div></Layout>}><NewStudentForm /></Suspense>;
}
