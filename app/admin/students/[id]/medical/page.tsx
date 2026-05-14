'use client';
// app/admin/students/[id]/medical/page.tsx
// Batch 4E — Student medical profile view/edit + health incidents log.

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Layout from '@/components/Layout';

const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-','unknown'];
const INCIDENT_TYPES = ['injury','illness','allergy_reaction','fever','fainting','other'];
const INCIDENT_COLORS: Record<string, [string,string]> = {
  injury: ['#FEE2E2','#991B1B'], illness: ['#FEF9C3','#92400E'],
  allergy_reaction: ['#FDE8D8','#C2410C'], fever: ['#FEF3C7','#D97706'],
  fainting: ['#E0E7FF','#3730A3'], other: ['#F3F4F6','#374151'],
};

interface MedicalData { blood_group: string | null; allergies: string[] | null; chronic_conditions: string[] | null; medical_notes: string | null; emergency_contact_name: string | null; emergency_contact_phone: string | null; emergency_contact_relation: string | null; dietary_restrictions: string | null; medical_updated_at: string | null; name?: string; class?: string; section?: string; }
interface Incident { id: string; incident_date: string; incident_type: string; description: string; first_aid_given: string | null; referred_to_hospital: boolean; parent_notified: boolean; recorded_by_name: string; }

function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState('');
  function add() {
    const trimmed = input.trim();
    if (trimmed && !value.includes(trimmed)) { onChange([...value, trimmed]); setInput(''); }
  }
  return (
    <div style={{ border: '1px solid #D1D5DB', borderRadius: 7, padding: '4px 8px', display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', minHeight: 36 }}>
      {value.map(v => (
        <span key={v} style={{ background: '#EEF2FF', color: '#4F46E5', fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4, display: 'flex', gap: 4, alignItems: 'center' }}>
          {v}
          <button onClick={() => onChange(value.filter(x => x !== v))} style={{ border: 'none', background: 'none', color: '#4F46E5', cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 0 }}>×</button>
        </span>
      ))}
      <input value={input} onChange={e => setInput(e.target.value)} placeholder={placeholder}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
        style={{ border: 'none', outline: 'none', fontSize: 12, flex: 1, minWidth: 80 }}
        onBlur={add} />
    </div>
  );
}

export default function StudentMedicalPage() {
  const params = useParams();
  const studentId = params?.id as string;

  const [medical, setMedical] = useState<MedicalData | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [incForm, setIncForm] = useState({ incident_date: new Date().toISOString().slice(0,10), incident_type: 'illness', description: '', first_aid_given: '', referred_to_hospital: false, parent_notified: false });
  const [incSaving, setIncSaving] = useState(false);

  const load = useCallback(async () => {
    if (!studentId) return;
    const res = await fetch(`/api/admin/students/${studentId}/medical`);
    const d = await res.json() as { medical?: MedicalData; incidents?: Incident[] };
    setMedical(d.medical ?? null);
    setIncidents(d.incidents ?? []);
    setLoading(false);
  }, [studentId]);

  useEffect(() => { void load(); }, [load]);

  async function saveMedical() {
    if (!medical) return;
    setSaving(true); setSaveMsg(null);
    const res = await fetch(`/api/admin/students/${studentId}/medical`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blood_group: medical.blood_group, allergies: medical.allergies ?? [],
        chronic_conditions: medical.chronic_conditions ?? [],
        medical_notes: medical.medical_notes,
        emergency_contact_name: medical.emergency_contact_name,
        emergency_contact_phone: medical.emergency_contact_phone,
        emergency_contact_relation: medical.emergency_contact_relation,
        dietary_restrictions: medical.dietary_restrictions,
      }),
    });
    setSaveMsg(res.ok ? '✓ Saved' : 'Error saving');
    setSaving(false);
    setTimeout(() => setSaveMsg(null), 3000);
  }

  async function logIncident() {
    setIncSaving(true);
    const res = await fetch(`/api/admin/students/${studentId}/health-incidents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(incForm),
    });
    if (res.ok) { setShowIncidentModal(false); void load(); }
    setIncSaving(false);
  }

  const cardStyle = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, marginBottom: 18 };
  const inputStyle = { width: '100%', padding: '6px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 12, boxSizing: 'border-box' as const, marginTop: 3 };
  const labelStyle = { fontSize: 11, fontWeight: 700, color: '#6B7280' } as const;

  if (loading) return <Layout title="Medical Profile"><div style={{ padding: 40, color: '#9CA3AF' }}>Loading…</div></Layout>;
  if (!medical) return <Layout title="Medical Profile"><div style={{ padding: 40, color: '#9CA3AF' }}>Student not found.</div></Layout>;

  return (
    <Layout title={`Medical — ${medical.name ?? ''}`}
      subtitle={`Class ${medical.class}-${medical.section}`}
      actions={
        <button onClick={() => void saveMedical()} disabled={saving}
          style={{ padding: '6px 16px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          {saving ? 'Saving…' : 'Save Medical Profile'}
        </button>
      }>

      {saveMsg && <div style={{ marginBottom: 14, padding: '8px 12px', background: saveMsg.startsWith('✓') ? '#D1FAE5' : '#FEE2E2', borderRadius: 7, fontSize: 12, color: saveMsg.startsWith('✓') ? '#065F46' : '#B91C1C' }}>{saveMsg}</div>}

      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 16 }}>🩺 Medical Profile</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <div style={labelStyle}>BLOOD GROUP</div>
            <select value={medical.blood_group ?? ''} onChange={e => setMedical(m => m ? { ...m, blood_group: e.target.value || null } : m)}
              style={{ ...inputStyle, maxWidth: 140 }}>
              <option value="">Not set</option>
              {BLOOD_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <div style={labelStyle}>DIETARY RESTRICTIONS</div>
            <input value={medical.dietary_restrictions ?? ''} onChange={e => setMedical(m => m ? { ...m, dietary_restrictions: e.target.value } : m)} style={inputStyle} placeholder="e.g. vegetarian, nut-free" />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <div style={labelStyle}>ALLERGIES (press Enter to add)</div>
            <TagInput value={medical.allergies ?? []} onChange={v => setMedical(m => m ? { ...m, allergies: v } : m)} placeholder="Add allergy…" />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <div style={labelStyle}>CHRONIC CONDITIONS</div>
            <TagInput value={medical.chronic_conditions ?? []} onChange={v => setMedical(m => m ? { ...m, chronic_conditions: v } : m)} placeholder="Add condition…" />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <div style={labelStyle}>MEDICAL NOTES</div>
            <textarea value={medical.medical_notes ?? ''} onChange={e => setMedical(m => m ? { ...m, medical_notes: e.target.value } : m)}
              rows={3} style={{ ...inputStyle, resize: 'none' }} placeholder="Any additional medical notes for school staff" />
          </div>
        </div>
      </div>

      {/* Emergency contact */}
      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 16 }}>🚨 Emergency Contact</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <div style={labelStyle}>NAME</div>
            <input value={medical.emergency_contact_name ?? ''} onChange={e => setMedical(m => m ? { ...m, emergency_contact_name: e.target.value } : m)} style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>PHONE</div>
            <input value={medical.emergency_contact_phone ?? ''} onChange={e => setMedical(m => m ? { ...m, emergency_contact_phone: e.target.value } : m)} style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>RELATION</div>
            <input value={medical.emergency_contact_relation ?? ''} onChange={e => setMedical(m => m ? { ...m, emergency_contact_relation: e.target.value } : m)} style={inputStyle} placeholder="e.g. Parent, Guardian, Sibling" />
          </div>
        </div>
        {medical.medical_updated_at && (
          <div style={{ marginTop: 12, fontSize: 10, color: '#9CA3AF' }}>
            Last updated: {new Date(medical.medical_updated_at).toLocaleDateString('en-IN')}
          </div>
        )}
      </div>

      {/* Health incidents */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>📋 Health Incidents</div>
          <button onClick={() => setShowIncidentModal(true)}
            style={{ padding: '5px 12px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            + Log Incident
          </button>
        </div>
        {incidents.length === 0 ? (
          <div style={{ color: '#9CA3AF', fontSize: 12, textAlign: 'center', padding: 16 }}>No health incidents recorded.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {incidents.map(i => {
              const [bg, fg] = INCIDENT_COLORS[i.incident_type] ?? ['#F3F4F6','#374151'];
              return (
                <div key={i.id} style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px', borderLeft: `3px solid ${fg}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ background: bg, color: fg, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4 }}>{i.incident_type.replace('_',' ')}</span>
                      <span style={{ fontSize: 11, color: '#374151', fontWeight: 600 }}>{i.description}</span>
                    </div>
                    <span style={{ fontSize: 10, color: '#9CA3AF', flexShrink: 0, marginLeft: 8 }}>{i.incident_date}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#6B7280', flexWrap: 'wrap' }}>
                    {i.first_aid_given && <span>First aid: {i.first_aid_given}</span>}
                    {i.referred_to_hospital && <span style={{ color: '#DC2626', fontWeight: 600 }}>🏥 Referred to hospital</span>}
                    {i.parent_notified && <span style={{ color: '#065F46', fontWeight: 600 }}>✓ Parent notified</span>}
                    <span>By: {i.recorded_by_name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Log incident modal */}
      {showIncidentModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 440, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 18 }}>Log Health Incident</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><div style={labelStyle}>DATE</div><input type="date" value={incForm.incident_date} onChange={e => setIncForm(f => ({ ...f, incident_date: e.target.value }))} style={inputStyle} /></div>
              <div><div style={labelStyle}>TYPE</div>
                <select value={incForm.incident_type} onChange={e => setIncForm(f => ({ ...f, incident_type: e.target.value }))} style={inputStyle}>
                  {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
                </select>
              </div>
              <div><div style={labelStyle}>DESCRIPTION *</div><textarea value={incForm.description} onChange={e => setIncForm(f => ({ ...f, description: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'none' }} /></div>
              <div><div style={labelStyle}>FIRST AID GIVEN</div><input value={incForm.first_aid_given} onChange={e => setIncForm(f => ({ ...f, first_aid_given: e.target.value }))} style={inputStyle} /></div>
              <div style={{ display: 'flex', gap: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={incForm.referred_to_hospital} onChange={e => setIncForm(f => ({ ...f, referred_to_hospital: e.target.checked }))} />
                  Referred to hospital
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={incForm.parent_notified} onChange={e => setIncForm(f => ({ ...f, parent_notified: e.target.checked }))} />
                  Parent notified
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowIncidentModal(false)} style={{ flex: 1, padding: '8px', background: '#F3F4F6', border: 'none', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => void logIncident()} disabled={incSaving || !incForm.description}
                style={{ flex: 2, padding: '8px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {incSaving ? 'Saving…' : 'Log Incident'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
