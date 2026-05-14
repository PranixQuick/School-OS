'use client';
// app/admin/sanitary/page.tsx
// Batch 4E — Sanitary inventory: stock overview, restock, dispense, 30-day log.

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface InventoryItem { id: string; item_name: string; item_type: string; stock_count: number; min_stock_alert: number; today_dispensed: number; low_stock: boolean; last_restocked_at: string | null; updated_at: string; }
interface LogEntry { id: string; dispensed_at: string; quantity: number; notes: string | null; student_name: string | null; student_class?: string; student_section?: string; staff_name: string; }

export default function SanitaryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRestock, setShowRestock] = useState<string | null>(null);
  const [showDispense, setShowDispense] = useState<string | null>(null);
  const [restockQty, setRestockQty] = useState('');
  const [dispenseData, setDispenseData] = useState({ student_id: '', quantity: '1', notes: '' });
  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
  const [actionMsg, setActionMsg] = useState<{ id: string; msg: string; ok: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [invRes] = await Promise.allSettled([
      fetch('/api/admin/sanitary').then(r => r.ok ? r.json() : null),
    ]);
    if (invRes.status === 'fulfilled' && invRes.value?.inventory) {
      const inv = invRes.value.inventory as InventoryItem[];
      setInventory(inv);
      // Load logs for first item
      if (inv[0]) {
        const logRes = await fetch(`/api/admin/sanitary/${inv[0].id}/log`);
        const ld = await logRes.json() as { logs?: LogEntry[] };
        setLogs(ld.logs ?? []);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    void fetch('/api/admin/students?limit=200').then(r => r.ok ? r.json() : null)
      .then((d: { students?: { id: string; name: string }[] } | null) => { if (d?.students) setStudents(d.students); });
  }, []);

  async function doRestock(id: string) {
    setSaving(true);
    const res = await fetch(`/api/admin/sanitary/${id}/restock`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: parseInt(restockQty) }),
    });
    const d = await res.json() as { inventory?: InventoryItem; error?: string };
    setActionMsg({ id, msg: res.ok ? `✓ Restocked ${restockQty} units` : (d.error ?? 'Error'), ok: res.ok });
    setShowRestock(null); setRestockQty('');
    if (res.ok) void load();
    setSaving(false);
    setTimeout(() => setActionMsg(null), 3000);
  }

  async function doDispense(id: string) {
    setSaving(true);
    const body: Record<string,unknown> = { quantity: parseInt(dispenseData.quantity || '1') };
    if (dispenseData.student_id) body.student_id = dispenseData.student_id;
    if (dispenseData.notes) body.notes = dispenseData.notes;
    const res = await fetch(`/api/admin/sanitary/${id}/dispense`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await res.json() as { remaining_stock?: number; error?: string };
    setActionMsg({ id, msg: res.ok ? `✓ Dispensed. ${d.remaining_stock} remaining` : (d.error ?? 'Error'), ok: res.ok });
    setShowDispense(null); setDispenseData({ student_id: '', quantity: '1', notes: '' });
    if (res.ok) void load();
    setSaving(false);
    setTimeout(() => setActionMsg(null), 3000);
  }

  const cardStyle = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, marginBottom: 18 };
  const inputStyle = { width: '100%', padding: '6px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 12, boxSizing: 'border-box' as const, marginTop: 3 };

  return (
    <Layout title="Sanitary Inventory" subtitle="Track and dispense sanitary items">
      {loading ? <div style={{ padding: 40, color: '#9CA3AF', textAlign: 'center' }}>Loading…</div> : (
        <>
          {inventory.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📦</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>No inventory configured</div>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 6 }}>Contact school admin to add sanitary inventory items.</div>
            </div>
          ) : (
            inventory.map(item => (
              <div key={item.id} style={{ ...cardStyle, borderLeft: item.low_stock ? '3px solid #DC2626' : '3px solid #16A34A' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>{item.item_name}</div>
                    <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{item.item_type}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setShowRestock(item.id)}
                      style={{ padding: '6px 14px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      + Restock
                    </button>
                    <button onClick={() => setShowDispense(item.id)}
                      style={{ padding: '6px 14px', background: '#065F46', color: '#fff', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      Dispense
                    </button>
                  </div>
                </div>

                {/* Stock stats */}
                <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
                  {[
                    ['Current Stock', item.stock_count, item.low_stock ? '#DC2626' : '#065F46'],
                    ['Min Alert', item.min_stock_alert, '#6B7280'],
                    ['Dispensed Today', item.today_dispensed, '#4F46E5'],
                  ].map(([l, v, c]) => (
                    <div key={l as string} style={{ textAlign: 'center', background: '#F9FAFB', borderRadius: 8, padding: '8px 14px', flex: 1 }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: c as string }}>{v as number}</div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF' }}>{l as string}</div>
                    </div>
                  ))}
                </div>

                {item.low_stock && (
                  <div style={{ marginTop: 10, padding: '6px 10px', background: '#FEF2F2', borderRadius: 6, fontSize: 11, color: '#DC2626', fontWeight: 600 }}>
                    ⚠️ Stock at or below alert threshold — please restock.
                  </div>
                )}
                {item.last_restocked_at && (
                  <div style={{ marginTop: 8, fontSize: 10, color: '#9CA3AF' }}>
                    Last restocked: {new Date(item.last_restocked_at).toLocaleDateString('en-IN')}
                  </div>
                )}

                {actionMsg?.id === item.id && (
                  <div style={{ marginTop: 8, padding: '6px 10px', background: actionMsg.ok ? '#D1FAE5' : '#FEE2E2', borderRadius: 6, fontSize: 11, color: actionMsg.ok ? '#065F46' : '#DC2626', fontWeight: 600 }}>
                    {actionMsg.msg}
                  </div>
                )}
              </div>
            ))
          )}

          {/* Dispensing log */}
          {logs.length > 0 && (
            <div style={cardStyle}>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>📋 Dispensing Log (Last 30 Days)</div>
              <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB' }}>
                      {['Date/Time','Student','Staff','Qty','Notes'].map(h => (
                        <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, fontSize: 10, color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(l => (
                      <tr key={l.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={{ padding: '7px 10px', color: '#6B7280' }}>{new Date(l.dispensed_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td style={{ padding: '7px 10px' }}>{l.student_name ? `${l.student_name} (${l.student_class})` : <span style={{ color: '#9CA3AF' }}>Anonymous</span>}</td>
                        <td style={{ padding: '7px 10px', color: '#6B7280' }}>{l.staff_name}</td>
                        <td style={{ padding: '7px 10px', fontWeight: 700 }}>{l.quantity}</td>
                        <td style={{ padding: '7px 10px', color: '#9CA3AF' }}>{l.notes ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Restock modal */}
      {showRestock && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 340, maxWidth: '95vw' }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 16 }}>+ Restock Inventory</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', marginBottom: 4 }}>QUANTITY TO ADD</div>
            <input type="number" value={restockQty} onChange={e => setRestockQty(e.target.value)} placeholder="e.g. 50"
              style={inputStyle} autoFocus />
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={() => setShowRestock(null)} style={{ flex: 1, padding: '8px', background: '#F3F4F6', border: 'none', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => void doRestock(showRestock)} disabled={saving || !restockQty || parseInt(restockQty) <= 0}
                style={{ flex: 2, padding: '8px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {saving ? 'Saving…' : 'Restock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispense modal */}
      {showDispense && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 380, maxWidth: '95vw' }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 16 }}>Dispense Item</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280' }}>STUDENT (optional)</div>
                <select value={dispenseData.student_id} onChange={e => setDispenseData(d => ({ ...d, student_id: e.target.value }))} style={inputStyle}>
                  <option value="">Anonymous / Not recorded</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div><div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280' }}>QUANTITY</div>
                <input type="number" value={dispenseData.quantity} onChange={e => setDispenseData(d => ({ ...d, quantity: e.target.value }))}
                  min={1} style={{ ...inputStyle, maxWidth: 100 }} />
              </div>
              <div><div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280' }}>NOTES (optional)</div>
                <input value={dispenseData.notes} onChange={e => setDispenseData(d => ({ ...d, notes: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={() => setShowDispense(null)} style={{ flex: 1, padding: '8px', background: '#F3F4F6', border: 'none', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => void doDispense(showDispense)} disabled={saving}
                style={{ flex: 2, padding: '8px', background: '#065F46', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {saving ? 'Saving…' : 'Dispense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
