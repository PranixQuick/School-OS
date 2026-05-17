'use client';
// app/hostel-admin/page.tsx
// Portal for hostel_admin role: room assignments, occupancy, checkout
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Room { id: string; block: string; room_number: string; capacity: number; room_type: string; floor: number | null; occupied: number; available: number; }
interface Allocation { id: string; check_in_date: string; status: string; fee_amount: number | null; student: { name: string; class: string; section: string } | null; room: { block: string; room_number: string } | null; }

export default function HostelAdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'rooms' | 'allocations'>('rooms');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [allocForm, setAllocForm] = useState({ student_id: '', room_id: '', check_in_date: '', fee_amount: '' });
  const [allocError, setAllocError] = useState('');
  const [allocating, setAllocating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(tab === 'rooms' ? '/api/admin/hostel' : '/api/admin/hostel?view=allocations');
    const d = await r.json();
    if (tab === 'rooms') setRooms(d.rooms ?? []);
    else setAllocations(d.allocations ?? []);
    setLoading(false);
  }, [tab]);

  useEffect(() => { load(); }, [tab]);

  async function allocate() {
    if (!allocForm.student_id || !allocForm.room_id) { setAllocError('Student ID and Room ID required'); return; }
    setAllocating(true); setAllocError('');
    const r = await fetch('/api/admin/hostel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'allocate', ...allocForm, fee_amount: allocForm.fee_amount ? Number(allocForm.fee_amount) : null }) });
    const d = await r.json(); setAllocating(false);
    if (!r.ok) { setAllocError(d.error ?? 'Failed'); return; }
    setToast('Student allocated'); setTimeout(() => setToast(''), 3000);
    setAllocForm({ student_id: '', room_id: '', check_in_date: '', fee_amount: '' }); load();
  }

  async function checkout(id: string) {
    const r = await fetch('/api/admin/hostel', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'checkout' }) });
    if (r.ok) { setToast('Student checked out'); setTimeout(() => setToast(''), 3000); load(); }
  }

  const totalBeds = rooms.reduce((s, r) => s + r.capacity, 0);
  const occupied = rooms.reduce((s, r) => s + r.occupied, 0);

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: '#111827', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>{toast}</div>}
      <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><div style={{ fontSize: 18, fontWeight: 800 }}>🏠 Hostel</div><div style={{ fontSize: 12, color: '#6B7280' }}>Hostel Admin Portal</div></div>
        <button onClick={() => { fetch('/api/auth/logout', { method: 'POST' }); router.push('/login'); }} style={{ padding: '6px 12px', border: '1px solid #E5E7EB', borderRadius: 7, background: '#fff', fontSize: 12, cursor: 'pointer' }}>Sign out</button>
      </div>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
          {[['Rooms', rooms.length, '#4F46E5'], ['Total Beds', totalBeds, '#0891B2'], ['Occupied', occupied, '#DC2626']].map(([label, val, color]) => (
            <div key={label as string} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: color as string }}>{val as number}</div>
              <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>{label as string}</div>
            </div>
          ))}
        </div>
        <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1E40AF', marginBottom: 10 }}>Allocate Student to Room</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
            {[['Student ID *', 'student_id', 'text'], ['Room ID *', 'room_id', 'text'], ['Check-in Date', 'check_in_date', 'date'], ['Fee (₹)', 'fee_amount', 'number']].map(([label, key, type]) => (
              <div key={key}><label style={{ fontSize: 11, fontWeight: 600, color: '#1E40AF', display: 'block', marginBottom: 3 }}>{label}</label>
                <input type={type} value={(allocForm as Record<string,string>)[key]} onChange={e => setAllocForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: '100%', height: 36, border: '1px solid #BFDBFE', borderRadius: 7, padding: '0 10px', fontSize: 13, boxSizing: 'border-box' }} /></div>
            ))}
          </div>
          {allocError && <div style={{ color: '#991B1B', fontSize: 12, marginTop: 6 }}>{allocError}</div>}
          <button onClick={allocate} disabled={allocating} style={{ marginTop: 10, padding: '8px 18px', background: '#1D4ED8', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {allocating ? 'Allocating...' : 'Allocate'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 14, background: '#F3F4F6', borderRadius: 8, padding: 4 }}>
          {[['rooms', '🏠 Rooms'], ['allocations', '👤 Current Residents']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key as 'rooms' | 'allocations')}
              style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: tab === key ? '#fff' : 'transparent', color: tab === key ? '#111827' : '#6B7280', boxShadow: tab === key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
              {label}
            </button>
          ))}
        </div>
        {loading ? <div style={{ textAlign: 'center', padding: 32, color: '#6B7280' }}>Loading...</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tab === 'rooms' && rooms.map(r => (
              <div key={r.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><div style={{ fontSize: 14, fontWeight: 700 }}>Block {r.block} · Room {r.room_number}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>{r.room_type}{r.floor != null ? ` · Floor ${r.floor}` : ''}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>ID: {r.id}</div></div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: r.available > 0 ? '#065F46' : '#DC2626' }}>{r.available}/{r.capacity}</div>
                  <div style={{ fontSize: 10, color: '#9CA3AF' }}>available</div>
                </div>
              </div>
            ))}
            {tab === 'allocations' && allocations.map(a => (
              <div key={a.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div><div style={{ fontSize: 14, fontWeight: 700 }}>{a.student?.name ?? '—'}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>Block {a.room?.block} · Room {a.room?.room_number}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>In: {a.check_in_date}{a.fee_amount ? ` · ₹${a.fee_amount}` : ''}</div></div>
                <button onClick={() => checkout(a.id)} style={{ padding: '6px 12px', background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>Checkout</button>
              </div>
            ))}
            {(tab === 'rooms' ? rooms : allocations).length === 0 && <div style={{ textAlign: 'center', padding: 32, color: '#9CA3AF' }}>No {tab} data yet.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
