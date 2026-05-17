'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

interface Room { id: string; block: string; room_number: string; capacity: number; room_type: string; occupied: number; available: number; floor: number | null; }
interface Allocation { id: string; check_in_date: string; check_out_date: string | null; status: string; fee_amount: number | null; student?: { name: string; class: string | null; section: string | null } | null; room?: { block: string; room_number: string } | null; }
interface Student { id: string; name: string; class: string | null; section: string | null; }

export default function HostelPage() {
  const [tab, setTab] = useState<'rooms' | 'allocations'>('rooms');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [showAllocate, setShowAllocate] = useState(false);
  const [roomForm, setRoomForm] = useState({ block: '', room_number: '', capacity: '2', room_type: 'shared', floor: '' });
  const [allocForm, setAllocForm] = useState({ student_id: '', room_id: '', check_in_date: '', fee_amount: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    setLoading(true);
    const [r, a, s] = await Promise.all([
      fetch('/api/admin/hostel').then(x => x.json()),
      fetch('/api/admin/hostel?view=allocations').then(x => x.json()),
      fetch('/api/students?limit=500').then(x => x.json()),
    ]);
    setRooms(r.rooms ?? []);
    setAllocations(a.allocations ?? []);
    setStudents(s.students ?? []);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function addRoom() {
    setSaving(true);
    const res = await fetch('/api/admin/hostel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...roomForm, capacity: Number(roomForm.capacity), floor: roomForm.floor ? Number(roomForm.floor) : null }) });
    const d = await res.json();
    setSaving(false);
    if (res.ok) { setMsg('Room added'); setShowAddRoom(false); setRoomForm({ block: '', room_number: '', capacity: '2', room_type: 'shared', floor: '' }); void load(); }
    else setMsg(d.error ?? 'Error');
  }

  async function allocate() {
    setSaving(true);
    const res = await fetch('/api/admin/hostel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'allocate', ...allocForm, fee_amount: allocForm.fee_amount ? Number(allocForm.fee_amount) : null }) });
    const d = await res.json();
    setSaving(false);
    if (res.ok) { setMsg('Student allocated to room'); setShowAllocate(false); setAllocForm({ student_id: '', room_id: '', check_in_date: '', fee_amount: '' }); void load(); }
    else setMsg(d.error ?? 'Error');
  }

  async function checkout(id: string) {
    await fetch('/api/admin/hostel', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'checkout' }) });
    setMsg('Student checked out');
    void load();
  }

  const totalOccupied = rooms.reduce((s, r) => s + r.occupied, 0);
  const totalCapacity = rooms.reduce((s, r) => s + r.capacity, 0);
  const S = { card: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 14, marginBottom: 8 } as React.CSSProperties };

  return (
    <Layout title="Hostel" subtitle="Room management and student allocations">
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 16px 40px' }}>
        {msg && <div style={{ background: msg.includes('rror') ? '#FEE2E2' : '#D1FAE5', color: msg.includes('rror') ? '#991B1B' : '#065F46', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>{msg}</div>}

        {/* Summary strip */}
        {rooms.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'Total Rooms', value: rooms.length, bg: '#EEF2FF', color: '#4F46E5' },
              { label: 'Occupied', value: totalOccupied, bg: '#FEE2E2', color: '#991B1B' },
              { label: 'Available', value: totalCapacity - totalOccupied, bg: '#D1FAE5', color: '#065F46' },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: s.color, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 0, marginBottom: 16, background: '#F3F4F6', borderRadius: 10, padding: 4 }}>
          {(['rooms', 'allocations'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex: 1, padding: '8px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: tab === t ? '#fff' : 'transparent', color: tab === t ? '#111827' : '#6B7280' }}>
              {t === 'rooms' ? `Rooms (${rooms.length})` : `Allocations (${allocations.length})`}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <button onClick={() => setShowAddRoom(true)} style={{ padding: '8px 14px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Add Room</button>
          <button onClick={() => setShowAllocate(true)} style={{ padding: '8px 14px', background: '#065F46', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Assign Student</button>
        </div>

        {showAddRoom && (
          <div style={{ ...S.card, border: '2px solid #4F46E5', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Add Room</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              {(['block', 'room_number'] as const).map(k => (
                <div key={k}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>{k === 'block' ? 'BLOCK *' : 'ROOM NO. *'}</label>
                  <input value={roomForm[k]} onChange={e => setRoomForm(f => ({ ...f, [k]: e.target.value }))} placeholder={k === 'block' ? 'e.g. A' : 'e.g. 101'} style={{ width: '100%', padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13 }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>CAPACITY</label>
                <input type="number" value={roomForm.capacity} onChange={e => setRoomForm(f => ({ ...f, capacity: e.target.value }))} style={{ width: '100%', padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>TYPE</label>
                <select value={roomForm.room_type} onChange={e => setRoomForm(f => ({ ...f, room_type: e.target.value }))} style={{ width: '100%', padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13 }}>
                  {['shared', 'single', 'double', 'triple', 'suite'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>FLOOR</label>
                <input type="number" value={roomForm.floor} onChange={e => setRoomForm(f => ({ ...f, floor: e.target.value }))} placeholder="e.g. 1" style={{ width: '100%', padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13 }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={addRoom} disabled={saving || !roomForm.block || !roomForm.room_number} style={{ flex: 1, padding: '8px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{saving ? 'Adding...' : 'Add Room'}</button>
              <button onClick={() => setShowAddRoom(false)} style={{ padding: '8px 14px', background: '#F3F4F6', border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}

        {showAllocate && (
          <div style={{ ...S.card, border: '2px solid #065F46', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Assign Student to Room</div>
            {(['student_id', 'room_id'] as const).map(k => (
              <div key={k} style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>{k === 'student_id' ? 'STUDENT *' : 'ROOM *'}</label>
                <select value={allocForm[k]} onChange={e => setAllocForm(f => ({ ...f, [k]: e.target.value }))} style={{ width: '100%', padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13 }}>
                  <option value="">— Select —</option>
                  {k === 'student_id' ? students.map(s => <option key={s.id} value={s.id}>{s.name}{s.class ? ` (Class ${s.class})` : ''}</option>) :
                    rooms.filter(r => r.available > 0).map(r => <option key={r.id} value={r.id}>{r.block}-{r.room_number} ({r.available} beds avail.)</option>)}
                </select>
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>CHECK-IN DATE</label>
                <input type="date" value={allocForm.check_in_date} onChange={e => setAllocForm(f => ({ ...f, check_in_date: e.target.value }))} style={{ width: '100%', padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>FEE (₹)</label>
                <input type="number" value={allocForm.fee_amount} onChange={e => setAllocForm(f => ({ ...f, fee_amount: e.target.value }))} placeholder="Monthly fee" style={{ width: '100%', padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13 }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={allocate} disabled={saving || !allocForm.student_id || !allocForm.room_id} style={{ flex: 1, padding: '8px', background: '#065F46', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{saving ? 'Assigning...' : 'Assign Room'}</button>
              <button onClick={() => setShowAllocate(false)} style={{ padding: '8px 14px', background: '#F3F4F6', border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}

        {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading...</div> :
          tab === 'rooms' ? (
            rooms.length === 0 ? <div style={{ textAlign: 'center', padding: 48, color: '#9CA3AF' }}><div style={{ fontSize: 32, marginBottom: 8 }}>🏠</div><div>No rooms yet. Add hostel rooms to start allocating students.</div></div> :
            rooms.map(r => (
              <div key={r.id} style={{ ...S.card, borderLeft: `3px solid ${r.available === 0 ? '#F87171' : r.available <= 1 ? '#FCD34D' : '#6EE7B7'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{r.block}-{r.room_number}</span>
                    <span style={{ fontSize: 12, color: '#6B7280', marginLeft: 8 }}>{r.room_type}{r.floor != null ? ` · Floor ${r.floor}` : ''}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: r.available === 0 ? '#991B1B' : '#065F46' }}>{r.occupied}/{r.capacity} occupied</span>
                </div>
              </div>
            ))
          ) : (
            allocations.length === 0 ? <div style={{ textAlign: 'center', padding: 48, color: '#9CA3AF' }}><div style={{ fontSize: 32, marginBottom: 8 }}>📋</div><div>No active allocations.</div></div> :
            allocations.map(a => (
              <div key={a.id} style={S.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{a.student?.name ?? '—'}</div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>Room {a.room?.block}-{a.room?.room_number} · Checked in {a.check_in_date}</div>
                    {a.fee_amount && <div style={{ fontSize: 11, color: '#374151' }}>Fee: ₹{a.fee_amount}/month</div>}
                  </div>
                  <button onClick={() => void checkout(a.id)} style={{ padding: '5px 10px', background: '#FEE2E2', color: '#991B1B', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}>Check Out</button>
                </div>
              </div>
            ))
          )}
      </div>
    </Layout>
  );
}
