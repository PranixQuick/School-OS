'use client';
// Year-End Student Promotion Workflow
// Admin / Principal: Run at end of academic year to move all students to next class.
// Handles: promotions, retentions (held back), graduations (Class 10/12 completing).
// Creates promotion_log record for audit trail + rollback capability.
// Mobile-first. Single-tap confirmation with preview before commit.

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface ClassGroup { class: string; section: string; count: number; }
interface PromotionLog {
  id: string; promoted_at: string; total_students: number; promoted_count: number;
  retained_count: number; graduated_count: number; status: string;
}

const CLASS_SEQUENCE: Record<string, string> = {
  'KG': '1', '1': '2', '2': '3', '3': '4', '4': '5',
  '5': '6', '6': '7', '7': '8', '8': '9', '9': '10',
};
const FINAL_CLASSES = ['10', '12', 'III Year', 'IV Year', 'Final Year'];

export default function PromotionPage() {
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [logs, setLogs]               = useState<PromotionLog[]>([]);
  const [loading, setLoading]         = useState(true);
  const [step, setStep]               = useState<'preview' | 'confirm' | 'done'>('preview');
  const [running, setRunning]         = useState(false);
  const [result, setResult]           = useState<{ promoted: number; retained: number; graduated: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/promotion');
      if (r.ok) { const d = await r.json() as { class_groups?: ClassGroup[]; logs?: PromotionLog[] }; setClassGroups(d.class_groups ?? []); setLogs(d.logs ?? []); }
    } catch {/**/}
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function runPromotion() {
    setRunning(true);
    const r = await fetch('/api/admin/promotion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    setRunning(false);
    if (r.ok) {
      const d = await r.json() as { promoted?: number; retained?: number; graduated?: number };
      setResult({ promoted: d.promoted ?? 0, retained: d.retained ?? 0, graduated: d.graduated ?? 0 });
      setStep('done');
      void load();
    } else {
      const d = await r.json() as { error?: string };
      alert(d.error ?? 'Error');
    }
  }

  const totalStudents = classGroups.reduce((s, g) => s + g.count, 0);
  const graduatingCount = classGroups.filter(g => FINAL_CLASSES.includes(g.class)).reduce((s, g) => s + g.count, 0);
  const promotingCount = totalStudents - graduatingCount;

  return (
    <Layout title="Year-End Promotion" subtitle="Move students to next academic class">
      {logs.length > 0 && (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#15803D', fontWeight: 600 }}>
          ✅ Last promotion: {new Date(logs[0].promoted_at).toLocaleDateString('en-IN')} — {logs[0].promoted_count} promoted, {logs[0].graduated_count} graduated
        </div>
      )}

      {step === 'preview' && (
        <>
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #F3F4F6', background: '#F9FAFB' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Current Class Distribution</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{totalStudents} total students across {classGroups.length} class-sections</div>
            </div>
            {loading ? <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div> : (
              classGroups.map((g, i) => {
                const nextClass = CLASS_SEQUENCE[g.class];
                const isGrad = FINAL_CLASSES.includes(g.class);
                return (
                  <div key={`${g.class}-${g.section}`} style={{ padding: '10px 14px', borderBottom: i < classGroups.length-1 ? '1px solid #F9FAFB' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Class {g.class}-{g.section}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                        {isGrad ? '🎓 Will graduate' : nextClass ? `→ Class ${nextClass}` : '→ Next class'}
                      </div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: isGrad ? '#7C3AED' : '#0284C7' }}>{g.count}</div>
                  </div>
                );
              })
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 16 }}>
            <div style={{ background: '#EEF2FF', borderRadius: 12, padding: '12px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#4F46E5' }}>{promotingCount}</div>
              <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>To be Promoted</div>
            </div>
            <div style={{ background: '#F5F3FF', borderRadius: 12, padding: '12px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#7C3AED' }}>{graduatingCount}</div>
              <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>To Graduate</div>
            </div>
          </div>

          <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '12px 14px', marginBottom: 14, fontSize: 13, color: '#92400E' }}>
            ⚠️ This action will move all active students to their next class. Ensure you have completed end-of-year exams and results before proceeding. This action creates an audit log and can be reviewed but individual moves cannot be easily undone.
          </div>

          <button onClick={() => setStep('confirm')} style={{ width: '100%', height: 50, borderRadius: 12, border: 'none', background: '#4F46E5', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
            📋 Preview Promotion Plan →
          </button>
        </>
      )}

      {step === 'confirm' && (
        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 8 }}>⚠️ Confirm Year-End Promotion</div>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, marginBottom: 20 }}>
            You are about to promote <strong>{promotingCount}</strong> students to their next class and graduate <strong>{graduatingCount}</strong> students. This will update all student class records.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button onClick={() => setStep('preview')} style={{ height: 48, borderRadius: 10, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              ← Back
            </button>
            <button onClick={() => void runPromotion()} disabled={running} style={{ height: 48, borderRadius: 10, border: 'none', background: running ? '#9CA3AF' : '#15803D', color: '#fff', fontSize: 14, fontWeight: 800, cursor: running ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {running ? 'Running…' : '✅ Run Promotion'}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && result && (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 14, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#15803D', marginBottom: 12 }}>Promotion Complete!</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { v: result.promoted, l: 'Promoted', c: '#4F46E5' },
              { v: result.graduated, l: 'Graduated', c: '#7C3AED' },
              { v: result.retained, l: 'Retained', c: '#D97706' },
            ].map(s => (
              <div key={s.l} style={{ background: '#fff', borderRadius: 10, padding: '10px 8px' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.c }}>{s.v}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>{s.l}</div>
              </div>
            ))}
          </div>
          <button onClick={() => { setStep('preview'); void load(); }} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#4F46E5', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Back to Dashboard
          </button>
        </div>
      )}

      {/* Promotion history */}
      {logs.length > 0 && step === 'preview' && (
        <>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 8, marginTop: 16 }}>
            Promotion History
          </div>
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
            {logs.slice(0, 3).map((log, i) => (
              <div key={log.id} style={{ padding: '10px 14px', borderBottom: i < Math.min(2, logs.length-1) ? '1px solid #F9FAFB' : 'none', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 12, color: '#374151' }}>{new Date(log.promoted_at).toLocaleDateString('en-IN')}</div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>{log.promoted_count}↑ · {log.graduated_count}🎓 · {log.retained_count} retained</div>
              </div>
            ))}
          </div>
        </>
      )}
    </Layout>
  );
}
