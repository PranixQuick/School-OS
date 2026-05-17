'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

interface Room { id: string; block: string; room_number: string; capacity: number; room_type: string; floor: number | null; occupied: number; available: number; notes: string | null; }
interface Allocation { id: string; student_id: string; room_id: string; check_in_date: string; check_out_date: string | null; fee_amount: number | null; status: string; student?: { name: string; class: string; section: string } | null; room?: { block: string; room_number: string; room_type: string } | null; }

export default function HostelPage() {
  const [tab, setTab] = useState<'rooms' | 'allocations'>('rooms');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [allocForm, setAllocForm] = useState({ student_id: '', room_id: '', fee_amount: '' });
  const [allocating, setAllocating] = useState(false);
  const [allocMsg, setAllocMsg] = useState('');
  const [checkinout, setCheckinout] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [r, a] = await Promise.all([
      fetch('/api/admin/hostel').then(d => d.json()),
      fetch('/api/admin/hostel?view=allocations').then(d => d.json()),
    ]);
    setRooms(r.rooms ?? []);
    setAllocations(a.allocations ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function allocate() {
    if (!allocForm.student_id || !allocForm.room_id) { setAllocMsg('Student ID and Room required'); return; }
    setAllocating(true); setAllocMsg('');
    const res = await fetch('/api/admin/hostel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'allocate', student_id: allocForm.student_id, room_id: allocForm.room_id, fee_amount: allocForm.fee_amount ? Number(allocForm.fee_amount) : null }) });
    const d = await res.json();
    if (res.ok) { setAllocMsg('Allocated'); setAllocForm({ student_id: '', room_id: '', fee_amount: '' }); void load(); }
    else setAllocMsg(d.error ?? 'Error');
    setAllocating(false);
  }

  async function checkout(id: string) {
    setCheckinout(id);
    await fetch('/api/admin/hostel', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'checkout' }) });
    setCheckinout(null);
    void load();
  }

  const totalRooms = rooms.length;
  const totalCapacity = rooms.reduce((s, r) => s + r.capacity, 0);
  const totalOccupied = rooms.reduce((s, r) => s + r.occupied, 0);
  const inputStyle = { padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const };

  return (
    <Layout title="Hostel" subtitle="Room allocation and occupancy management">
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 0 40px' }}>

        {/* Summary strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
          {[['Total Rooms', totalRooms, '#4F46E5'], ['Total Capacity', totalCapacity, '#0284C7'], ['Occupied', totalOccupied, '#D97706']].map(([l, v, c]) => (
            <div key={String(l)} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>{l}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: String(c) }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Allocate form */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 18, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Allocate Room</div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr auto', gap: 8, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>STUDENT ID</label>
              <input placeholder="Student UUID or admission no" value={allocForm.student_id} onChange={e => setAllocForm(f => ({ ...f, student_id: e.target.value }))} style={{ ...inputStyle, width: '100%' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>ROOM</label>
              <select value={allocForm.room_id} onChange={e => setAllocForm(f => ({ ...f, room_id: e.target.value }))} style={{ ...inputStyle, width: '100%', background: '#fff' }}>
                <option value="">Select room</option>
                {rooms.filter(r => r.available > 0).map(r => (
                  <option key={r.id} value={r.id}>{r.block}-{r.room_number} ({r.room_type}) — {r.available} free</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>FEE (₹)</label>
              <input type="number" placeholder="Optional" value={allocForm.fee_amount} onChange={e => setAllocForm(f => ({ ...f, fee_amount: e.target.value }))} style={{ ...inputStyle, width: '100%' }} />
            </div>
            <button onClick={allocate} disabled={allocating} style={{ height: 36, padding: '0 16px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {allocating ? '...' : 'Allocate'}
            </button>
          </div>
          {allocMsg && <div style={{ fontSize: 12, color: allocMsg === 'Allocated' ? '#065F46' : '#991B1B', marginTop: 8 }}>{allocMsg}</div>}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #E5E7EB', marginBottom: 16 }}>
          {(['rooms', 'allocations'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t ? 700 : 500, color: tab === t ? '#4F46E5' : '#6B7280', borderBottom: tab === t ? '2px solid #4F46E5' : '2px solid transparent', marginBottom: -2 }}>
              {t === 'rooms' ? 'All Rooms' : 'Current Allocations'}
            </button>
          ))}
        </div>

        {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Loading...</div> : tab === 'rooms' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 10 }}>
            {rooms.map(r => (
              <div key={r.id} style={{ background: '#fff', border: `1px solid ${r.available === 0 ? '#FECACA' : r.available <= 1 ? '#FED7AA' : '#D1FAE5'}`, borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>{r.block}-{r.room_number}</div>
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{r.room_type}{r.floor !== null ? ` · Floor ${r.floor}` : ''}</div>
                <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: r.available === 0 ? '#991B1B' : '#065F46' }}>
                  {r.occupied}/{r.capacity} occupied
                </div>
                {r.notes && <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>{r.notes}</div>}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
            {allocations.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>No active allocations.</div> : allocations.map(a => (
              <div key={a.id} style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{a.student?.name ?? 'Unknown'}</div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>
                    {a.room ? `${a.room.block}-${a.room.room_number} (${a.room.room_type})` : ''} · Check-in {new Date(a.check_in_date).toLocaleDateString('en-IN')}
                    {a.fee_amount ? ` · ₹${a.fee_amount}` : ''}
                  </div>
                </div>
                <button onClick={() => { if (confirm('Check out this student?')) checkout(a.id); }} disabled={checkinout === a.id} style={{ padding: '5px 12px', background: '#FEE2E2', color: '#991B1B', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {checkinout === a.id ? '...' : 'Check Out'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
