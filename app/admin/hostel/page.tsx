'use client';
import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface Room { id: string; block: string; room_number: string; capacity: number; room_type: string; floor: number | null; occupied: number; available: number; }
interface Allocation { id: string; check_in_date: string; status: string; fee_amount: number | null; student: { name: string; class: string; section: string } | null; room: { block: string; room_number: string; room_type: string } | null; }

export default function HostelPage() {
  const [tab, setTab] = useState<'rooms' | 'allocations'>('rooms');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  const [showAddRoom, setShowAddRoom] = useState(false);
  const [addRoom, setAddRoom] = useState({ block: '', room_number: '', capacity: '2', room_type: 'shared', floor: '' });
  const [addRoomError, setAddRoomError] = useState('');

  const [showAllocate, setShowAllocate] = useState(false);
  const [allocForm, setAllocForm] = useState({ student_id: '', room_id: '', check_in_date: '', fee_amount: '' });
  const [allocError, setAllocError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'rooms') {
        const r = await fetch('/api/admin/hostel');
        const d = await r.json();
        setRooms(d.rooms ?? []);
      } else {
        const r = await fetch('/api/admin/hostel?view=allocations');
        const d = await r.json();
        setAllocations(d.allocations ?? []);
      }
    } finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  async function addRoomSubmit() {
    if (!addRoom.block || !addRoom.room_number) { setAddRoomError('Block and room number required'); return; }
    const r = await fetch('/api/admin/hostel', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...addRoom, capacity: Number(addRoom.capacity), floor: addRoom.floor ? Number(addRoom.floor) : null }) });
    const d = await r.json();
    if (!r.ok) { setAddRoomError(d.error ?? 'Failed'); return; }
    setToast('Room added'); setTimeout(() => setToast(''), 3000);
    setShowAddRoom(false); setAddRoom({ block: '', room_number: '', capacity: '2', room_type: 'shared', floor: '' });
    load();
  }

  async function allocSubmit() {
    if (!allocForm.student_id || !allocForm.room_id) { setAllocError('Student ID and Room ID required'); return; }
    const r = await fetch('/api/admin/hostel', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'allocate', ...allocForm, fee_amount: allocForm.fee_amount ? Number(allocForm.fee_amount) : null }) });
    const d = await r.json();
    if (!r.ok) { setAllocError(d.error ?? 'Failed'); return; }
    setToast('Student allocated to room'); setTimeout(() => setToast(''), 3000);
    setShowAllocate(false); setAllocForm({ student_id: '', room_id: '', check_in_date: '', fee_amount: '' }); load();
  }

  async function checkout(id: string) {
    const r = await fetch('/api/admin/hostel', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'checkout' }) });
    if (r.ok) { setToast('Student checked out'); setTimeout(() => setToast(''), 3000); load(); }
  }

  const totalRooms = rooms.length;
  const totalBeds = rooms.reduce((s, r) => s + r.capacity, 0);
  const occupiedBeds = rooms.reduce((s, r) => s + r.occupied, 0);

  return (
    <Layout title="Hostel" subtitle="Room management and student allocation">
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: '#111827', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>{toast}</div>}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        {[['Rooms', totalRooms, '#4F46E5'], ['Total Beds', totalBeds, '#0891B2'], ['Occupied', occupiedBeds, '#DC2626']].map(([label, val, color]) => (
          <div key={label as string} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: color as string }}>{val as number}</div>
            <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, marginTop: 2 }}>{label as string}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: '#F3F4F6', borderRadius: 10, padding: 4 }}>
        {[['rooms', '🏠 Rooms'], ['allocations', '👤 Allocations']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key as 'rooms' | 'allocations')}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: tab === key ? '#fff' : 'transparent', color: tab === key ? '#111827' : '#6B7280',
              boxShadow: tab === key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {tab === 'rooms' && <button onClick={() => setShowAddRoom(v => !v)} style={{ padding: '8px 16px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Add Room</button>}
        <button onClick={() => setShowAllocate(v => !v)} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #D1D5DB', color: '#374151', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Allocate Student</button>
      </div>

      {showAddRoom && (
        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Add Room</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
            {[['Block *', 'block', 'text'], ['Room No *', 'room_number', 'text'], ['Capacity', 'capacity', 'number'], ['Floor', 'floor', 'number']].map(([label, key, type]) => (
              <div key={key}><label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>{label}</label>
                <input type={type} value={(addRoom as Record<string, string>)[key]} onChange={e => setAddRoom(f => ({ ...f, [key]: e.target.value }))} style={{ width: '100%', height: 36, border: '1px solid #D1D5DB', borderRadius: 7, padding: '0 10px', fontSize: 13, boxSizing: 'border-box' }} /></div>
            ))}
            <div><label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>Type</label>
              <select value={addRoom.room_type} onChange={e => setAddRoom(f => ({ ...f, room_type: e.target.value }))} style={{ width: '100%', height: 36, border: '1px solid #D1D5DB', borderRadius: 7, padding: '0 8px', fontSize: 13 }}>
                <option value="shared">Shared</option><option value="single">Single</option><option value="double">Double</option>
              </select></div>
          </div>
          {addRoomError && <div style={{ color: '#991B1B', fontSize: 12, marginTop: 8 }}>{addRoomError}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={addRoomSubmit} style={{ padding: '8px 14px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Add</button>
            <button onClick={() => setShowAddRoom(false)} style={{ padding: '8px 14px', background: '#fff', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {showAllocate && (
        <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Allocate Student to Room</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            {[['Student ID *', 'student_id'], ['Room ID *', 'room_id'], ['Check-in Date', 'check_in_date'], ['Hostel Fee (₹)', 'fee_amount']].map(([label, key]) => (
              <div key={key}><label style={{ fontSize: 11, fontWeight: 600, color: '#1E40AF', display: 'block', marginBottom: 3 }}>{label}</label>
                <input type={key === 'check_in_date' ? 'date' : key === 'fee_amount' ? 'number' : 'text'}
                  value={(allocForm as Record<string, string>)[key]} onChange={e => setAllocForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: '100%', height: 36, border: '1px solid #BFDBFE', borderRadius: 7, padding: '0 10px', fontSize: 13, boxSizing: 'border-box' }} /></div>
            ))}
          </div>
          {allocError && <div style={{ color: '#991B1B', fontSize: 12, marginTop: 8 }}>{allocError}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={allocSubmit} style={{ padding: '8px 14px', background: '#1D4ED8', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Allocate</button>
            <button onClick={() => setShowAllocate(false)} style={{ padding: '8px 14px', background: '#fff', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>Loading...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tab === 'rooms' && rooms.map(room => (
            <div key={room.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Block {room.block} — Room {room.room_number}</div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>{room.room_type} · {room.floor != null ? `Floor ${room.floor}` : 'Ground'}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>ID: {room.id}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: room.available > 0 ? '#065F46' : '#DC2626' }}>{room.available}/{room.capacity}</div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>available</div>
              </div>
            </div>
          ))}
          {tab === 'allocations' && allocations.map(a => (
            <div key={a.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{a.student?.name ?? 'Unknown'}</div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>Block {a.room?.block} · Room {a.room?.room_number} · {a.room?.room_type}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>In: {a.check_in_date}{a.fee_amount ? ` · ₹${a.fee_amount}` : ''}</div>
              </div>
              <button onClick={() => checkout(a.id)} style={{ padding: '6px 12px', background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                Checkout
              </button>
            </div>
          ))}
          {(tab === 'rooms' ? rooms : allocations).length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>
              {tab === 'rooms' ? 'No rooms added yet. Add rooms above.' : 'No active allocations.'}
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
