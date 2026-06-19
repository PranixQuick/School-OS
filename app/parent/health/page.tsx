'use client';
// app/parent/health/page.tsx
// ISS-11 (#11 / P4.3) — Parent health screen: view + limited edit.
// Editing the basic card requires an explicit consent checkbox. Growth /
// immunization / nutrition records are shown read-only for govt/anganwadi.

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface GrowthRow { recorded_date: string; height_cm: number | null; weight_kg: number | null; muac_cm: number | null; grade_for_age: string | null; malnutrition_cat: string | null; notes: string | null }
interface ImmRow { vaccine_name: string; dose_number: number | null; scheduled_date: string | null; administered_date: string | null; status: string | null }
interface NutritionRow { supplement_type: string; quantity: number | null; unit: string | null; distribution_date: string | null }
interface Student { id: string; name: string; class: string | null; section: string | null; blood_group: string | null; allergies: string[] | null; medical_notes: string | null; medical_updated_at: string | null }
interface HealthData {
  student: Student;
  institution_type: string;
  show_records: boolean;
  growth: GrowthRow[];
  immunization: ImmRow[];
  nutrition: NutritionRow[];
  last_parent_update: string | null;
}

const BLOOD_GROUPS = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function ParentHealthPage() {
  const router = useRouter();
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [bloodGroup, setBloodGroup] = useState('');
  const [allergies, setAllergies] = useState('');
  const [notes, setNotes] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/parent/health')
      .then(r => {
        if (r.status === 401) { router.push('/parent/login'); return null; }
        return r.ok ? r.json() : null;
      })
      .then((d: HealthData | null) => {
        if (d) {
          setData(d);
          setBloodGroup(d.student.blood_group ?? '');
          setAllergies((d.student.allergies ?? []).join(', '));
          setNotes(d.student.medical_notes ?? '');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!consent) { setMsg({ kind: 'err', text: 'Please tick the consent box to save.' }); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/parent/health', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blood_group: bloodGroup, allergies, medical_notes: notes, consent: true }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not save.');
      setMsg({ kind: 'ok', text: 'Health information updated.' });
      setConsent(false);
      load();
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const card: React.CSSProperties = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 16, marginBottom: 14 };
  const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5, display: 'block' };
  const input: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 9, fontSize: 15, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' };
  const th: React.CSSProperties = { textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #E5E7EB', fontWeight: 700, color: '#374151', fontSize: 11, whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '6px 8px', borderBottom: '1px solid #F3F4F6', color: '#111827', fontSize: 12 };

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', padding: '16px 16px 20px' }}>
        <Link href="/parent" style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, textDecoration: 'none', fontWeight: 600 }}>← Back</Link>
        <div style={{ color: '#fff', fontSize: 20, fontWeight: 800, marginTop: 10 }}>Health</div>
        <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 }}>
          {data ? `${data.student.name}${data.student.class ? ` · Class ${data.student.class}${data.student.section ?? ''}` : ''}` : 'Student health record'}
        </div>
      </div>

      <div style={{ padding: 16, maxWidth: 560, margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading…</div>
        ) : !data ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Could not load health information.</div>
        ) : (
          <>
            {msg && (
              <div style={{ marginBottom: 12, fontSize: 13, padding: '8px 12px', borderRadius: 8, background: msg.kind === 'ok' ? '#F0FDF4' : '#FEF2F2', color: msg.kind === 'ok' ? '#065F46' : '#B91C1C' }}>{msg.text}</div>
            )}

            {/* Editable basic card */}
            <form onSubmit={save} style={card}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 12 }}>Health card</div>

              <div style={{ marginBottom: 12 }}>
                <label style={label}>Blood group</label>
                <select value={bloodGroup} onChange={e => setBloodGroup(e.target.value)} style={input}>
                  {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b || 'Not set'}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={label}>Allergies <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(comma separated)</span></label>
                <input value={allergies} onChange={e => setAllergies(e.target.value)} placeholder="e.g. Peanuts, Penicillin" style={input} />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={label}>Medical notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="Conditions, medication, doctor's notes…" style={{ ...input, resize: 'vertical' }} />
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#4B5563', cursor: 'pointer', marginBottom: 12, lineHeight: 1.5 }}>
                <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ marginTop: 2 }} />
                I confirm this information is accurate and consent to the school storing and processing it for my child's care and safety.
              </label>

              <button type="submit" disabled={busy || !consent}
                style={{ width: '100%', background: (busy || !consent) ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 18px', fontSize: 15, fontWeight: 700, cursor: (busy || !consent) ? 'not-allowed' : 'pointer' }}>
                {busy ? 'Saving…' : 'Save health card'}
              </button>

              {data.student.medical_updated_at && (
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 10 }}>
                  Last updated {new Date(data.student.medical_updated_at).toLocaleDateString()}
                </div>
              )}
            </form>

            {/* Read-only records (govt / anganwadi) */}
            {data.show_records && (
              <>
                {data.growth.length > 0 && (
                  <div style={card}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 8 }}>Growth records</div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr style={{ background: '#F9FAFB' }}>
                          <th style={th}>Date</th><th style={th}>Height</th><th style={th}>Weight</th><th style={th}>MUAC</th><th style={th}>Status</th>
                        </tr></thead>
                        <tbody>
                          {data.growth.map((g, i) => (
                            <tr key={i}>
                              <td style={td}>{g.recorded_date || '—'}</td>
                              <td style={td}>{g.height_cm != null ? `${g.height_cm} cm` : '—'}</td>
                              <td style={td}>{g.weight_kg != null ? `${g.weight_kg} kg` : '—'}</td>
                              <td style={td}>{g.muac_cm != null ? `${g.muac_cm} cm` : '—'}</td>
                              <td style={td}>{g.malnutrition_cat || g.grade_for_age || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {data.immunization.length > 0 && (
                  <div style={card}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 8 }}>Immunization</div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr style={{ background: '#F9FAFB' }}>
                          <th style={th}>Vaccine</th><th style={th}>Dose</th><th style={th}>Date</th><th style={th}>Status</th>
                        </tr></thead>
                        <tbody>
                          {data.immunization.map((m, i) => (
                            <tr key={i}>
                              <td style={td}>{m.vaccine_name}</td>
                              <td style={td}>{m.dose_number ?? '—'}</td>
                              <td style={td}>{m.administered_date || m.scheduled_date || '—'}</td>
                              <td style={td}>{m.status || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {data.nutrition.length > 0 && (
                  <div style={card}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 8 }}>Nutrition supplements</div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr style={{ background: '#F9FAFB' }}>
                          <th style={th}>Date</th><th style={th}>Supplement</th><th style={th}>Quantity</th>
                        </tr></thead>
                        <tbody>
                          {data.nutrition.map((n, i) => (
                            <tr key={i}>
                              <td style={td}>{n.distribution_date || '—'}</td>
                              <td style={td}>{n.supplement_type}</td>
                              <td style={td}>{n.quantity != null ? `${n.quantity}${n.unit ? ' ' + n.unit : ''}` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            <div style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.6 }}>
              Growth, immunization and nutrition records are maintained by the school and shown here for your reference.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
