'use client';
// app/accountant/demand/page.tsx
// ISS-10 (#10 / P4.1d) — Fee demand generation UI.
// Lists fee templates and runs the existing bulk generator
// (POST /api/admin/fee-templates/[id]/generate). A dry-run preview is required
// before the real run. Backend + duplicate-protection already exist; this fills
// the missing front-end. (Receipts already exist at /admin/fees/receipt/[id].)

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

interface FeeItem { fee_type: string; amount: number; description?: string }
interface Template {
  id: string;
  name: string;
  grade_level: string;
  section: string | null;
  fee_items: FeeItem[];
  is_active: boolean;
}
interface DryResult {
  would_generate: number;
  would_skip: number;
  students_processed: number;
  preview: { student_name: string; fees_to_create: { fee_type: string; amount: number }[] }[];
}
interface GenResult { generated: number; skipped_existing: number; students_processed: number }

const inr = (n: number) => '₹' + Math.round(n || 0).toLocaleString('en-IN');

export default function DemandPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dry, setDry] = useState<DryResult | null>(null);
  const [gen, setGen] = useState<GenResult | null>(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    fetch('/api/admin/fee-templates')
      .then(r => r.ok ? r.json() : Promise.reject(new Error(r.status === 403 ? 'Not permitted' : 'Failed to load')))
      .then((d: { templates?: Template[] }) => setTemplates(d.templates ?? []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function toggle(id: string) {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    setDry(null);
    setGen(null);
    setActionError('');
  }

  async function preview(id: string) {
    setBusy(true); setActionError(''); setGen(null); setDry(null);
    try {
      const r = await fetch(`/api/admin/fee-templates/${id}/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dry_run: true }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Preview failed');
      setDry(d as DryResult);
    } catch (e) { setActionError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function generate(id: string, count: number) {
    if (!window.confirm(`Generate fee demands for ${count} student${count === 1 ? '' : 's'}? This creates pending fee records.`)) return;
    setBusy(true); setActionError('');
    try {
      const r = await fetch(`/api/admin/fee-templates/${id}/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Generation failed');
      setGen(d as GenResult); setDry(null);
    } catch (e) { setActionError((e as Error).message); }
    finally { setBusy(false); }
  }

  const perStudent = (t: Template) => (t.fee_items ?? []).reduce((s, i) => s + Number(i.amount || 0), 0);

  return (
    <Layout title="Generate Fee Demands" subtitle="Bulk-create fees from a template">
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#B91C1C' }}>{error}</div>
      ) : templates.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32 }}>📋</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginTop: 8 }}>No fee templates</div>
          <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>Create a fee template first to generate demands.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, color: '#6B7280' }}>
            Pick a template, preview what would be created, then generate. Re-running is safe — already-generated fees are skipped automatically.
          </div>

          {templates.map(t => {
            const open = openId === t.id;
            const cls = [t.grade_level, t.section].filter(Boolean).join('-') || t.grade_level;
            return (
              <div key={t.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden' }}>
                <button
                  onClick={() => toggle(t.id)}
                  style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
                      {t.name}{!t.is_active && <span style={{ marginLeft: 8, fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>(inactive)</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                      Class {cls}{t.section ? '' : ' · all sections'} · {(t.fee_items ?? []).length} item{(t.fee_items ?? []).length === 1 ? '' : 's'} · {inr(perStudent(t))}/student
                    </div>
                  </div>
                  <div style={{ fontSize: 18, color: '#9CA3AF' }}>{open ? '▾' : '▸'}</div>
                </button>

                {open && (
                  <div style={{ borderTop: '1px solid #F3F4F6', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Fee items */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {(t.fee_items ?? []).map((i, idx) => (
                        <span key={idx} style={{ fontSize: 12, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: '4px 10px', color: '#374151' }}>
                          {i.fee_type}: <b>{inr(i.amount)}</b>
                        </span>
                      ))}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => preview(t.id)}
                        disabled={busy || !t.is_active}
                        style={{ background: '#EEF2FF', color: '#4F46E5', border: '1px solid #C7D2FE', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: busy ? 'wait' : 'pointer', opacity: t.is_active ? 1 : 0.5 }}
                      >
                        {busy ? 'Working…' : '🔍 Preview'}
                      </button>
                      {dry && (
                        <button
                          onClick={() => generate(t.id, dry.would_generate)}
                          disabled={busy || dry.would_generate === 0}
                          style={{ background: dry.would_generate === 0 ? '#F3F4F6' : '#15803D', color: dry.would_generate === 0 ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: dry.would_generate === 0 || busy ? 'not-allowed' : 'pointer' }}
                        >
                          ⚡ Generate {dry.would_generate} fee{dry.would_generate === 1 ? '' : 's'}
                        </button>
                      )}
                    </div>

                    {actionError && <div style={{ fontSize: 13, color: '#B91C1C' }}>{actionError}</div>}

                    {/* Dry-run preview */}
                    {dry && (
                      <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: 12 }}>
                        <div style={{ fontSize: 13, color: '#374151', marginBottom: 8 }}>
                          <b style={{ color: '#15803D' }}>{dry.would_generate}</b> would be created · <b>{dry.would_skip}</b> already exist · {dry.students_processed} student{dry.students_processed === 1 ? '' : 's'} matched
                        </div>
                        {dry.preview.length > 0 && (
                          <div style={{ fontSize: 12, color: '#6B7280' }}>
                            {dry.preview.map((p, i) => (
                              <div key={i} style={{ padding: '2px 0' }}>
                                {p.student_name} — {p.fees_to_create.map(f => `${f.fee_type} ${inr(f.amount)}`).join(', ')}
                              </div>
                            ))}
                            {dry.would_generate > dry.preview.reduce((s, p) => s + p.fees_to_create.length, 0) && (
                              <div style={{ marginTop: 4, fontStyle: 'italic' }}>…and more (preview capped)</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Generation result */}
                    {gen && (
                      <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10, padding: 12, fontSize: 13, color: '#065F46' }}>
                        ✅ Generated <b>{gen.generated}</b> fee{gen.generated === 1 ? '' : 's'} · skipped <b>{gen.skipped_existing}</b> existing · {gen.students_processed} student{gen.students_processed === 1 ? '' : 's'} processed.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
