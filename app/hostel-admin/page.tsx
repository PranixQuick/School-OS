'use client';
// Hostel Admin portal — dedicated view for staff with role=hostel_admin
// Uses same /api/admin/hostel API
import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface Room { id: string; block: string; room_number: string; capacity: number; room_type: string; occupied: number; available: number; }
interface Allocation { id: string; check_in_date: string; status: string; fee_amount: number | null; student: { name: string; class: string; section: string } | null; room: { block: string; room_number: string; room_type: string } | null; }

export default function HostelAdminPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [tab, setTab] = useState<'rooms' | 'allocations'>('rooms');

  const [studentId, setStudentId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [feeAmt, setFeeAmt] = useState('');
  const [allocError, setAllocError] = useState('');

  function msg(m: string) { setToast(m); setTimeout(() => setToast(''), 3000); }

  const load = useCallback(async () => {
    setLoading(true);
    const [rr, ar] = await Promise.all([fetch('/api/admin/hostel'), fetch('/api/admin/hostel?view=allocations')]);
    const [rd, ad] = await Promise.all([rr.json(), ar.json()]);
    setRooms(rd.rooms ?? []);
    setAllocations(ad.allocations ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function allocate() {
    if (!studentId || !roomId) { setAllocError('Student ID and Room ID required'); return; }
    setAllocError('');
    const r = await fetch('/api/admin/hostel', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'allocate', student_id: studentId, room_id: roomId, check_in_date: checkIn || undefined, fee_amount: feeAmt ? Number(feeAmt) : null }) });
    const d = await r.json();
    if (!r.ok) { setAllocError(d.error ?? 'Failed'); return; }
    msg('Student allocated'); setStudentId(''); setRoomId(''); setCheckIn(''); setFeeAmt(''); load();
  }

  async function checkout(id: string) {
    const r = await fetch('/api/admin/hostel', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'checkout' }) });
    if (r.ok) { msg('Student checked out'); load(); }
  }

  const totalBeds = rooms.reduce((s, r) => s + r.capacity, 0);
  const occupied = rooms.reduce((s, r) => s + r.occupied, 0);

  return (
    <Layout title="Hostel" subtitle="Room occupancy and student allocation">
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: '#15803D', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>{toast}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        {[['Rooms', rooms.length, '#4F46E5'],['Total Beds', totalBeds, '#0891B2'],['Occupied', occupied, '#DC2626']].map(([l,v,c]) => (
          <div key={l as string} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: c as string }}>{v as number}</div>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{l as string}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: 16, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#1E40AF', marginBottom: 10 }}>Allocate Student to Room</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
          {[['Student ID *', studentId, setStudentId, 'text'],['Room ID *', roomId, setRoomId, 'text'],['Check-in Date', checkIn, setCheckIn, 'date'],['Fee (₹)', feeAmt, setFeeAmt, 'number']].map(([l,v,s,t]) => (
            <div key={l as string}><label style={{ fontSize: 11, fontWeight: 600, color: '#1E40AF', display: 'block', marginBottom: 3 }}>{l as string}</label>
              <input type={t as string} value={v as string} onChange={e => (s as (x:string)=>void)(e.target.value)} style={{ width: '100%', height: 36, border: '1px solid #BFDBFE', borderRadius: 7, padding: '0 10px', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }} /></div>
          ))}
        </div>
        {allocError && <div style={{ color: '#991B1B', fontSize: 12, marginTop: 8 }}>{allocError}</div>}
        <button onClick={allocate} style={{ marginTop: 10, padding: '8px 16px', background: '#1D4ED8', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Allocate</button>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: '#F3F4F6', borderRadius: 10, padding: 4 }}>
        {[['rooms','🏠 Rooms'],['allocations','👤 Allocations']].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k as 'rooms'|'allocations')}
            style={{ flex: 1, padding: '8px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: tab === k ? '#fff' : 'transparent', color: tab === k ? '#111827' : '#6B7280', boxShadow: tab === k ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>{l}</button>
        ))}
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>Loading...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tab === 'rooms' && rooms.map(r => (
            <div key={r.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Block {r.block} · Room {r.room_number}</div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>{r.room_type}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace' }}>ID: {r.id}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: r.available > 0 ? '#065F46' : '#DC2626' }}>{r.available}/{r.capacity}</div>
                <div style={{ fontSize: 10, color: '#9CA3AF' }}>available</div>
              </div>
            </div>
          ))}
          {tab === 'allocations' && allocations.map(a => (
            <div key={a.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{a.student?.name ?? '—'}</div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>Block {a.room?.block} · Room {a.room?.room_number}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>In: {a.check_in_date}{a.fee_amount ? ` · ₹${a.fee_amount}` : ''}</div>
              </div>
              <button onClick={() => checkout(a.id)} style={{ padding: '6px 12px', background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Checkout</button>
            </div>
          ))}
          {(tab === 'rooms' ? rooms : allocations).length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Nothing here yet.</div>}
        </div>
      )}
    </Layout>
  );
}
