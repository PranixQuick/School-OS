'use client';
// Hostel Management — Room list, student allocations, occupancy
// Applicable: residential schools, engineering/medical colleges with hostels
// Roles: admin, hostel_warden (both use admin role + designation)

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface HostelRoom { id: string; room_number: string; block: string; room_type: string; capacity: number; floor: number; is_active: boolean; }
interface HostelAlloc { id: string; status: string; check_in_date: string; check_out_date: string | null; fee_amount: number; student?: { name: string; class: string }; room?: { room_number: string; block: string }; }

type Tab = 'rooms' | 'allocations';

export default function HostelPage() {
  const [tab, setTab]         = useState<Tab>('rooms');
  const [rooms, setRooms]     = useState<HostelRoom[]>([]);
  const [allocs, setAllocs]   = useState<HostelAlloc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm]       = useState({ room_number: '', block: 'A', room_type: 'double', capacity: '2', floor: '1' });
  const [saving, setSaving]   = useState(false);

  const loadRooms = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/hostel/rooms');
      if (r.ok) { const d = await r.json() as { rooms?: HostelRoom[] }; setRooms(d.rooms ?? []); }
    } catch {/**/}
    setLoading(false);
  }, []);

  const loadAllocs = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/hostel/allocations');
      if (r.ok) { const d = await r.json() as { allocations?: HostelAlloc[] }; setAllocs(d.allocations ?? []); }
    } catch {/**/}
    setLoading(false);
  }, []);

  useEffect(() => { tab === 'rooms' ? loadRooms() : loadAllocs(); }, [tab, loadRooms, loadAllocs]);

  async function addRoom() {
    if (!form.room_number) { alert('Room number required'); return; }
    setSaving(true);
    const r = await fetch('/api/admin/hostel/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, capacity: Number(form.capacity), floor: Number(form.floor) }) });
    setSaving(false);
    if (r.ok) { setShowAdd(false); setForm({ room_number: '', block: 'A', room_type: 'double', capacity: '2', floor: '1' }); void loadRooms(); }
  }

  const ROOM_TYPE_COLOR: Record<string, string> = { single: '#4F46E5', double: '#0D9488', triple: '#D97706', dormitory: '#7C3AED' };
  const inp = { height: 44, borderRadius: 9, border: '1px solid #D1D5DB', padding: '0 12px', fontSize: 14, fontFamily: 'inherit', background: '#F9FAFB', width: '100%', boxSizing: 'border-box' as const };

  return (
    <Layout title="Hostel Management" subtitle="Rooms and student allocations">
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {(['rooms','allocations'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: tab===t ? '#4F46E5' : '#F3F4F6', color: tab===t ? '#fff' : '#374151', fontFamily: 'inherit' }}>
            {t === 'rooms' ? '🏠 Rooms' : '👩‍🎓 Allocations'}
          </button>
        ))}
      </div>

      {tab === 'rooms' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button onClick={() => setShowAdd(v => !v)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#4F46E5', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {showAdd ? '✕ Cancel' : '+ Add Room'}
            </button>
          </div>
          {showAdd && (
            <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Room No. *</label><input value={form.room_number} onChange={e => setForm(p => ({ ...p, room_number: e.target.value }))} style={inp} /></div>
                <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Block</label>
                  <select value={form.block} onChange={e => setForm(p => ({ ...p, block: e.target.value }))} style={inp}>
                    {['A','B','C','D','Boys','Girls','Mixed'].map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Type</label>
                  <select value={form.room_type} onChange={e => setForm(p => ({ ...p, room_type: e.target.value }))} style={inp}>
                    {['single','double','triple','dormitory'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div><label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Capacity</label><input type="number" inputMode="numeric" value={form.capacity} onChange={e => setForm(p => ({ ...p, capacity: e.target.value }))} style={inp} /></div>
              </div>
              <button onClick={() => void addRoom()} disabled={saving} style={{ width: '100%', height: 44, borderRadius: 10, border: 'none', background: saving ? '#9CA3AF' : '#4F46E5', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Saving…' : '💾 Add Room'}
              </button>
            </div>
          )}
          {loading ? <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div> : rooms.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>No rooms yet.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
              {rooms.map(room => (
                <div key={room.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>Room {room.room_number}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>Block {room.block} · Floor {room.floor}</div>
                  <div style={{ marginTop: 6, display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#F9FAFB', color: ROOM_TYPE_COLOR[room.room_type] ?? '#374151' }}>
                    {room.room_type} · {room.capacity} beds
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'allocations' && (
        loading ? <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div> : allocs.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>No allocations yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {allocs.map(a => (
              <div key={a.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{a.student?.name ?? '—'}</div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>Class {a.student?.class ?? '—'} · Room {a.room?.room_number ?? '—'}, Block {a.room?.block ?? '—'}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>Check-in: {a.check_in_date}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: a.status === 'active' ? '#F0FDF4' : '#F3F4F6', color: a.status === 'active' ? '#15803D' : '#6B7280' }}>{a.status}</span>
                    {a.fee_amount > 0 && <div style={{ fontSize: 12, color: '#D97706', marginTop: 4 }}>₹{a.fee_amount}/mo</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </Layout>
  );
}
