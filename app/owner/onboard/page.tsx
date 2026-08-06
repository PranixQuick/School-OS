'use client';
import { useState } from 'react';
import Layout from '@/components/Layout';

// Full KG -> PG spectrum. Values match the public.institution_type DB enum.
const INSTITUTION_TYPES: { value: string; label: string }[] = [
  { value: 'anganwadi', label: 'Anganwadi / Pre-Primary (KG)' },
  { value: 'school_k10', label: 'School (K-10)' },
  { value: 'school_k12', label: 'School (K-12)' },
  { value: 'govt_school', label: 'Government School' },
  { value: 'govt_aided_school', label: 'Govt-Aided School' },
  { value: 'welfare_school', label: 'Welfare / Residential School' },
  { value: 'junior_college', label: 'Junior College' },
  { value: 'intermediate_college', label: 'Intermediate College' },
  { value: 'degree_college', label: 'Degree College' },
  { value: 'engineering', label: 'Engineering College' },
  { value: 'polytechnic', label: 'Polytechnic' },
  { value: 'mba', label: 'MBA Institute' },
  { value: 'medical', label: 'Medical College' },
  { value: 'university', label: 'University (UG / PG)' },
  { value: 'vocational', label: 'Vocational Institute' },
  { value: 'coaching', label: 'Coaching Centre' },
];

export default function OnboardInstitutionPage() {
  const [form, setForm] = useState({
    school_name: '',
    institution_type: 'school_k12',
    ownership_type: 'private',
    board: 'CBSE',
    admin_name: '',
    admin_email: '',
    contact_phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ name: string; email: string } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.school_name || !form.admin_name || !form.admin_email) {
      setError('Please fill in Institution Name, Admin Name and Admin Email.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/schools/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(data.error || 'Failed to onboard institution.');
      }
      setSuccess({ name: form.school_name, email: form.admin_email });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: 6 };

  return (
    <Layout title="Onboard New Institution" subtitle="Add a new institution to your organization (KG to PG)">
      <div style={{ maxWidth: 600, margin: '20px auto 0' }}>
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, padding: '24px 30px' }}>
          {success ? (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>&#9989;</div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#065F46', marginBottom: 8 }}>Institution Created</h2>
              <p style={{ fontSize: 14, color: '#374151', marginBottom: 6 }}><strong>{success.name}</strong> has been onboarded.</p>
              <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>Its administrator (<strong>{success.email}</strong>) can now log in to set it up and invite staff.</p>
              <button
                onClick={() => { setSuccess(null); setForm({ school_name: '', institution_type: 'school_k12', ownership_type: 'private', board: 'CBSE', admin_name: '', admin_email: '', contact_phone: '' }); }}
                style={{ padding: '10px 18px', borderRadius: 8, background: '#4F46E5', color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}
              >
                Onboard Another Institution
              </button>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 20 }}>Onboard New Institution</h2>
              {error && (
                <div style={{ padding: '12px 16px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', fontSize: 13, fontWeight: 600, marginBottom: 20 }}>{error}</div>
              )}
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label htmlFor="school_name" style={labelStyle}>Institution Name *</label>
                  <input type="text" id="school_name" name="school_name" value={form.school_name} onChange={handleChange} placeholder="e.g. Suchitra Junior College" required style={inputStyle} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label htmlFor="institution_type" style={labelStyle}>Institution Type</label>
                    <select id="institution_type" name="institution_type" value={form.institution_type} onChange={handleChange} style={{ ...inputStyle, background: '#fff', cursor: 'pointer' }}>
                      {INSTITUTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="ownership_type" style={labelStyle}>Ownership Type</label>
                    <select id="ownership_type" name="ownership_type" value={form.ownership_type} onChange={handleChange} style={{ ...inputStyle, background: '#fff', cursor: 'pointer' }}>
                      <option value="private">Private</option>
                      <option value="government">Government</option>
                      <option value="aided">Aided</option>
                      <option value="franchise">Franchise</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor="board" style={labelStyle}>Board / Affiliation</label>
                  <select id="board" name="board" value={form.board} onChange={handleChange} style={{ ...inputStyle, background: '#fff', cursor: 'pointer' }}>
                    <option value="CBSE">CBSE</option>
                    <option value="ICSE">ICSE</option>
                    <option value="State">State Board</option>
                    <option value="IB">IB</option>
                    <option value="Cambridge">Cambridge</option>
                  </select>
                </div>
                <div style={{ borderTop: '1px dashed #E5E7EB', margin: '6px 0' }} />
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#4B5563', margin: 0 }}>Administrator Account</h3>
                <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 0, marginBottom: 6 }}>The root admin who will set up this institution and invite its staff.</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label htmlFor="admin_name" style={labelStyle}>Admin Name *</label>
                    <input type="text" id="admin_name" name="admin_name" value={form.admin_name} onChange={handleChange} placeholder="e.g. Rahul Sharma" required style={inputStyle} />
                  </div>
                  <div>
                    <label htmlFor="admin_email" style={labelStyle}>Admin Email *</label>
                    <input type="email" id="admin_email" name="admin_email" value={form.admin_email} onChange={handleChange} placeholder="admin@institution.com" required style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label htmlFor="contact_phone" style={labelStyle}>Contact Phone</label>
                  <input type="tel" id="contact_phone" name="contact_phone" value={form.contact_phone} onChange={handleChange} placeholder="e.g. +919876543210" style={inputStyle} />
                </div>
                <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px 18px', borderRadius: 8, background: loading ? '#9CA3AF' : '#4F46E5', color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', marginTop: 8 }}>
                  {loading ? 'Onboarding...' : 'Onboard Institution'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
