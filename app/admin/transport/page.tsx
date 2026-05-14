'use client';
// app/admin/transport/page.tsx
// Batch 4F — Transport module: Routes | Students | Today's Trips

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

type Tab = 'routes' | 'students' | 'trips';

interface Route { id: string; route_name: string; route_number: string | null; vehicle_reg: string | null; driver_name: string | null; driver_phone: string | null; capacity: number; student_count: number; }
interface Stop { id: string; stop_name: string; stop_order: number; pickup_time: string | null; dropoff_time: string | null; landmark: string | null; student_count: number; }
interface Assignment { id: string; student_id: string; student_name: string; student_class?: string; student_section?: string; route_name: string; route_number?: string; stop_name: string | null; pickup_time?: string | null; fee_amount: number | null; }
interface Trip { id: string; route_id: string; trip_type: string; status: string; route_name?: string; route_number?: string; driver_name?: string; driver_phone?: string; expected?: number; boarded?: number; absent?: number; unmarked?: number; }
interface AttendeeRow { id: string; student_id: string; student_name: string; student_class?: string; boarded: boolean | null; }
interface Student { id: string; name: string; class?: string; section?: string; }

const TRIP_STATUS_COLORS: Record<string, [string,string]> = {
  scheduled: ['#F3F4F6','#374151'], in_progress: ['#FEF9C3','#92400E'],
  completed: ['#D1FAE5','#065F46'], cancelled: ['#FEE2E2','#991B1B'],
};

export default function TransportPage() {
  const [tab, setTab] = useState<Tab>('routes');

  // Routes state
  const [routes, setRoutes] = useState<Route[]>([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [showAddRoute, setShowAddRoute] = useState(false);
  const [routeForm, setRouteForm] = useState({ route_name: '', route_number: '', vehicle_reg: '', driver_name: '', driver_phone: '', capacity: '40' });
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);
  const [stopsByRoute, setStopsByRoute] = useState<Record<string, Stop[]>>({});
  const [showAddStop, setShowAddStop] = useState<string | null>(null);
  const [stopForm, setStopForm] = useState({ stop_name: '', stop_order: '', pickup_time: '', dropoff_time: '', landmark: '' });

  // Students state
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [showAssign, setShowAssign] = useState(false);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [assignForm, setAssignForm] = useState({ student_id: '', route_id: '', stop_id: '', fee_amount: '' });
  const [availableStops, setAvailableStops] = useState<Stop[]>([]);

  // Trips state
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [activeAttendance, setActiveAttendance] = useState<{ tripId: string; roster: AttendeeRow[] } | null>(null);
  const [savingAttendance, setSavingAttendance] = useState(false);

  const [saving, setSaving] = useState(false);

  const loadRoutes = useCallback(async () => {
    setRouteLoading(true);
    const res = await fetch('/api/admin/transport/routes');
    const d = await res.json() as { routes?: Route[] };
    setRoutes(d.routes ?? []);
    setRouteLoading(false);
  }, []);

  const loadAssignments = useCallback(async () => {
    const url = assignmentFilter !== 'all' ? `/api/admin/transport/students?route_id=${assignmentFilter}` : '/api/admin/transport/students';
    const res = await fetch(url);
    const d = await res.json() as { assignments?: Assignment[] };
    setAssignments(d.assignments ?? []);
  }, [assignmentFilter]);

  const loadTrips = useCallback(async () => {
    setTripsLoading(true);
    const res = await fetch('/api/admin/transport/trips');
    const d = await res.json() as { trips?: Trip[] };
    setTrips(d.trips ?? []);
    setTripsLoading(false);
  }, []);

  useEffect(() => { void loadRoutes(); }, [loadRoutes]);
  useEffect(() => { if (tab === 'students') void loadAssignments(); }, [tab, loadAssignments]);
  useEffect(() => { if (tab === 'trips') void loadTrips(); }, [tab, loadTrips]);

  useEffect(() => {
    if (tab === 'students' && !allStudents.length) {
      void fetch('/api/admin/students?limit=500').then(r => r.ok ? r.json() : null)
        .then((d: { students?: Student[] } | null) => { if (d?.students) setAllStudents(d.students); });
    }
  }, [tab, allStudents.length]);

  async function loadStops(routeId: string) {
    const res = await fetch(`/api/admin/transport/routes/${routeId}/stops`);
    const d = await res.json() as { stops?: Stop[] };
    setStopsByRoute(prev => ({ ...prev, [routeId]: d.stops ?? [] }));
  }

  async function addRoute() {
    setSaving(true);
    const res = await fetch('/api/admin/transport/routes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...routeForm, capacity: parseInt(routeForm.capacity) || 40 }),
    });
    if (res.ok) { setShowAddRoute(false); setRouteForm({ route_name:'',route_number:'',vehicle_reg:'',driver_name:'',driver_phone:'',capacity:'40' }); void loadRoutes(); }
    setSaving(false);
  }

  async function addStop(routeId: string) {
    setSaving(true);
    const res = await fetch(`/api/admin/transport/routes/${routeId}/stops`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...stopForm, stop_order: parseInt(stopForm.stop_order) || 1, pickup_time: stopForm.pickup_time || null, dropoff_time: stopForm.dropoff_time || null, landmark: stopForm.landmark || null }),
    });
    if (res.ok) { setShowAddStop(null); setStopForm({ stop_name:'',stop_order:'',pickup_time:'',dropoff_time:'',landmark:'' }); void loadStops(routeId); }
    setSaving(false);
  }

  async function deleteStop(routeId: string, stopId: string) {
    await fetch(`/api/admin/transport/routes/${routeId}/stops?stop_id=${stopId}`, { method: 'DELETE' });
    void loadStops(routeId);
  }

  async function assignStudent() {
    setSaving(true);
    const res = await fetch('/api/admin/transport/students', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...assignForm, stop_id: assignForm.stop_id || undefined, fee_amount: assignForm.fee_amount ? parseFloat(assignForm.fee_amount) : undefined }),
    });
    if (res.ok) { setShowAssign(false); setAssignForm({ student_id:'',route_id:'',stop_id:'',fee_amount:'' }); void loadAssignments(); }
    setSaving(false);
  }

  async function removeAssignment(id: string) {
    await fetch(`/api/admin/transport/students/${id}`, { method: 'DELETE' });
    void loadAssignments();
  }

  async function startTrip(routeId: string, tripType: 'pickup' | 'dropoff') {
    const res = await fetch('/api/admin/transport/trips', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ route_id: routeId, trip_type: tripType }),
    });
    if (res.ok) void loadTrips();
  }

  async function openAttendance(tripId: string) {
    const res = await fetch(`/api/admin/transport/trips/${tripId}/attendance`);
    const d = await res.json() as { roster?: AttendeeRow[] };
    setActiveAttendance({ tripId, roster: d.roster ?? [] });
  }

  async function saveAttendance() {
    if (!activeAttendance) return;
    setSavingAttendance(true);
    const records = activeAttendance.roster.map(r => ({ student_id: r.student_id, boarded: r.boarded ?? false }));
    await fetch(`/api/admin/transport/trips/${activeAttendance.tripId}/attendance`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records }),
    });
    setActiveAttendance(null);
    setSavingAttendance(false);
    void loadTrips();
  }

  const cardStyle = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, marginBottom: 12 };
  const inputStyle = { width: '100%', padding: '6px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 12, boxSizing: 'border-box' as const, marginTop: 3 };
  const labelStyle = { fontSize: 11, fontWeight: 700, color: '#6B7280' } as const;

  return (
    <Layout title="Transport" subtitle="Bus routes, stops, and trip tracking">
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {(['routes','students','trips'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '6px 18px', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: tab===t ? '#4F46E5' : '#fff', color: tab===t ? '#fff' : '#374151', textTransform: 'capitalize' }}>
            {t === 'routes' ? '🚌 Routes' : t === 'students' ? '👥 Students' : '📅 Today\'s Trips'}
          </button>
        ))}
      </div>

      {/* ===== ROUTES TAB ===== */}
      {tab === 'routes' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button onClick={() => setShowAddRoute(true)}
              style={{ padding: '6px 16px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Add Route</button>
          </div>
          {routeLoading ? <div style={{ color: '#9CA3AF', fontSize: 13, padding: 20, textAlign: 'center' }}>Loading…</div>
          : routes.length === 0 ? <div style={{ ...cardStyle, textAlign: 'center', padding: 30, color: '#9CA3AF' }}>No routes. Add your first bus route.</div>
          : routes.map(r => (
            <div key={r.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>{r.route_name}</div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#6B7280', marginTop: 3, flexWrap: 'wrap' }}>
                    {r.route_number && <span>🚌 {r.route_number}</span>}
                    {r.vehicle_reg && <span>🔢 {r.vehicle_reg}</span>}
                    {r.driver_name && <span>👤 {r.driver_name}</span>}
                    {r.driver_phone && <a href={`tel:${r.driver_phone}`} style={{ color: '#4F46E5' }}>{r.driver_phone}</a>}
                    <span>💺 Cap: {r.capacity}</span>
                    <span style={{ fontWeight: 700, color: '#4F46E5' }}>👥 {r.student_count} students</span>
                  </div>
                </div>
                <button onClick={async () => {
                  if (expandedRoute === r.id) { setExpandedRoute(null); return; }
                  await loadStops(r.id); setExpandedRoute(r.id);
                }}
                  style={{ padding: '4px 12px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: '#F9FAFB' }}>
                  {expandedRoute === r.id ? '▲ Hide Stops' : '▼ View Stops'}
                </button>
              </div>

              {expandedRoute === r.id && (
                <div style={{ marginTop: 12, borderTop: '1px solid #F3F4F6', paddingTop: 12 }}>
                  {(stopsByRoute[r.id] ?? []).length === 0 ? (
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8 }}>No stops added yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
                      {(stopsByRoute[r.id] ?? []).map(s => (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: '#F9FAFB', borderRadius: 6, fontSize: 11 }}>
                          <span style={{ background: '#EEF2FF', color: '#4F46E5', fontWeight: 700, fontSize: 10, width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.stop_order}</span>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: 600 }}>{s.stop_name}</span>
                            {s.pickup_time && <span style={{ color: '#6B7280', marginLeft: 8 }}>↑{s.pickup_time.slice(0,5)}</span>}
                            {s.dropoff_time && <span style={{ color: '#6B7280', marginLeft: 6 }}>↓{s.dropoff_time.slice(0,5)}</span>}
                            {s.landmark && <span style={{ color: '#9CA3AF', marginLeft: 8 }}>({s.landmark})</span>}
                            <span style={{ color: '#4F46E5', marginLeft: 8, fontSize: 10 }}>👥{s.student_count}</span>
                          </div>
                          <button onClick={() => void deleteStop(r.id, s.id)}
                            style={{ fontSize: 10, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => setShowAddStop(r.id)}
                    style={{ fontSize: 11, color: '#4F46E5', background: '#EEF2FF', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 700 }}>+ Add Stop</button>

                  {showAddStop === r.id && (
                    <div style={{ marginTop: 10, background: '#F9FAFB', borderRadius: 8, padding: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                        <div><div style={labelStyle}>STOP NAME *</div><input value={stopForm.stop_name} onChange={e => setStopForm(f => ({...f,stop_name:e.target.value}))} style={inputStyle} /></div>
                        <div><div style={labelStyle}>ORDER *</div><input type="number" value={stopForm.stop_order} onChange={e => setStopForm(f => ({...f,stop_order:e.target.value}))} style={inputStyle} /></div>
                        <div><div style={labelStyle}>PICKUP TIME</div><input type="time" value={stopForm.pickup_time} onChange={e => setStopForm(f => ({...f,pickup_time:e.target.value}))} style={inputStyle} /></div>
                        <div><div style={labelStyle}>DROPOFF TIME</div><input type="time" value={stopForm.dropoff_time} onChange={e => setStopForm(f => ({...f,dropoff_time:e.target.value}))} style={inputStyle} /></div>
                        <div style={{ gridColumn:'1/-1' }}><div style={labelStyle}>LANDMARK</div><input value={stopForm.landmark} onChange={e => setStopForm(f => ({...f,landmark:e.target.value}))} style={inputStyle} /></div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setShowAddStop(null)} style={{ padding: '5px 12px', background: '#F3F4F6', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                        <button onClick={() => void addStop(r.id)} disabled={saving || !stopForm.stop_name}
                          style={{ padding: '5px 14px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          {saving ? '…' : 'Add Stop'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {/* ===== STUDENTS TAB ===== */}
      {tab === 'students' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <select value={assignmentFilter} onChange={e => setAssignmentFilter(e.target.value)}
                style={{ padding: '5px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 12 }}>
                <option value="all">All Routes</option>
                {routes.map(r => <option key={r.id} value={r.id}>{r.route_name}</option>)}
              </select>
            </div>
            <button onClick={() => setShowAssign(true)}
              style={{ padding: '6px 16px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Assign Student</button>
          </div>
          <div style={cardStyle}>
            {assignments.length === 0 ? (
              <div style={{ color: '#9CA3AF', fontSize: 13, padding: 20, textAlign: 'center' }}>No students assigned to transport.</div>
            ) : (
              <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB' }}>
                      {['Student','Class','Route','Stop','Pickup','Fee',''].map(h => (
                        <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, fontSize: 10, color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map(a => (
                      <tr key={a.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={{ padding: '7px 10px', fontWeight: 600 }}>{a.student_name}</td>
                        <td style={{ padding: '7px 10px', color: '#6B7280' }}>{a.student_class}-{a.student_section}</td>
                        <td style={{ padding: '7px 10px' }}>{a.route_name}{a.route_number ? ` (${a.route_number})` : ''}</td>
                        <td style={{ padding: '7px 10px', color: '#6B7280' }}>{a.stop_name ?? '—'}</td>
                        <td style={{ padding: '7px 10px', color: '#6B7280' }}>{a.pickup_time?.slice(0,5) ?? '—'}</td>
                        <td style={{ padding: '7px 10px' }}>{a.fee_amount != null ? `₹${Number(a.fee_amount).toLocaleString('en-IN')}` : '—'}</td>
                        <td style={{ padding: '7px 10px' }}>
                          <button onClick={() => void removeAssignment(a.id)}
                            style={{ fontSize: 10, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== TRIPS TAB ===== */}
      {tab === 'trips' && (
        <>
          {/* Start trip buttons per route */}
          <div style={{ ...cardStyle, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginRight: 4 }}>Start trip:</span>
            {routes.map(r => (
              <div key={r.id} style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => void startTrip(r.id, 'pickup')}
                  style={{ padding: '5px 10px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                  ↑ {r.route_name.split('—')[0].trim()} Pickup
                </button>
                <button onClick={() => void startTrip(r.id, 'dropoff')}
                  style={{ padding: '5px 10px', background: '#065F46', color: '#fff', border: 'none', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                  ↓ Dropoff
                </button>
              </div>
            ))}
            <button onClick={() => void loadTrips()} style={{ padding: '5px 10px', background: '#F3F4F6', border: 'none', borderRadius: 6, fontSize: 10, cursor: 'pointer' }}>🔄 Refresh</button>
          </div>

          {tripsLoading ? <div style={{ color: '#9CA3AF', fontSize: 13, padding: 20 }}>Loading…</div>
          : trips.length === 0 ? <div style={{ ...cardStyle, textAlign: 'center', color: '#9CA3AF', padding: 30 }}>No trips today. Start a trip above.</div>
          : trips.map(trip => {
            const [sbg, sfg] = TRIP_STATUS_COLORS[trip.status] ?? ['#F3F4F6','#374151'];
            return (
              <div key={trip.id} style={{ ...cardStyle, borderLeft: trip.trip_type === 'pickup' ? '3px solid #4F46E5' : '3px solid #065F46' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 800 }}>{trip.route_name}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: trip.trip_type === 'pickup' ? '#4F46E5' : '#065F46', background: trip.trip_type === 'pickup' ? '#EEF2FF' : '#D1FAE5', padding: '2px 6px', borderRadius: 4 }}>
                        {trip.trip_type === 'pickup' ? '↑ Pickup' : '↓ Dropoff'}
                      </span>
                      <span style={{ background: sbg, color: sfg, fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>{trip.status}</span>
                    </div>
                    {trip.driver_name && <div style={{ fontSize: 11, color: '#6B7280' }}>Driver: {trip.driver_name}{trip.driver_phone && <a href={`tel:${trip.driver_phone}`} style={{ color: '#4F46E5', marginLeft: 6 }}>{trip.driver_phone}</a>}</div>}
                    <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#6B7280', marginTop: 4 }}>
                      <span>Expected: <strong>{trip.expected ?? 0}</strong></span>
                      <span style={{ color: '#065F46' }}>Boarded: <strong>{trip.boarded ?? 0}</strong></span>
                      {(trip.absent ?? 0) > 0 && <span style={{ color: '#DC2626' }}>Absent: <strong>{trip.absent}</strong></span>}
                      {(trip.unmarked ?? 0) > 0 && <span style={{ color: '#D97706' }}>Unmarked: <strong>{trip.unmarked}</strong></span>}
                    </div>
                  </div>
                  {trip.status !== 'completed' && trip.status !== 'cancelled' && (
                    <button onClick={() => void openAttendance(trip.id)}
                      style={{ padding: '6px 14px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      Mark Attendance
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Add Route Modal */}
      {showAddRoute && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 440, maxWidth: '95vw' }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 18 }}>Add Route</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1/-1' }}><div style={labelStyle}>ROUTE NAME *</div><input value={routeForm.route_name} onChange={e => setRouteForm(f => ({...f,route_name:e.target.value}))} style={inputStyle} placeholder="e.g. Route A — Kompally" /></div>
              <div><div style={labelStyle}>BUS NUMBER</div><input value={routeForm.route_number} onChange={e => setRouteForm(f => ({...f,route_number:e.target.value}))} style={inputStyle} /></div>
              <div><div style={labelStyle}>VEHICLE REG</div><input value={routeForm.vehicle_reg} onChange={e => setRouteForm(f => ({...f,vehicle_reg:e.target.value}))} style={inputStyle} /></div>
              <div><div style={labelStyle}>DRIVER NAME</div><input value={routeForm.driver_name} onChange={e => setRouteForm(f => ({...f,driver_name:e.target.value}))} style={inputStyle} /></div>
              <div><div style={labelStyle}>DRIVER PHONE</div><input value={routeForm.driver_phone} onChange={e => setRouteForm(f => ({...f,driver_phone:e.target.value}))} style={inputStyle} /></div>
              <div><div style={labelStyle}>CAPACITY</div><input type="number" value={routeForm.capacity} onChange={e => setRouteForm(f => ({...f,capacity:e.target.value}))} style={inputStyle} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={() => setShowAddRoute(false)} style={{ flex: 1, padding: '8px', background: '#F3F4F6', border: 'none', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => void addRoute()} disabled={saving || !routeForm.route_name}
                style={{ flex: 2, padding: '8px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {saving ? 'Saving…' : 'Add Route'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Student Modal */}
      {showAssign && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 420, maxWidth: '95vw' }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 18 }}>Assign Student to Route</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><div style={labelStyle}>STUDENT *</div>
                <select value={assignForm.student_id} onChange={e => setAssignForm(f => ({...f,student_id:e.target.value}))} style={inputStyle}>
                  <option value="">Select student…</option>
                  {allStudents.map(s => <option key={s.id} value={s.id}>{s.name} ({s.class}-{s.section})</option>)}
                </select>
              </div>
              <div><div style={labelStyle}>ROUTE *</div>
                <select value={assignForm.route_id} onChange={async e => {
                  const rid = e.target.value; setAssignForm(f => ({...f,route_id:rid,stop_id:''}));
                  if (rid) { const res = await fetch(`/api/admin/transport/routes/${rid}/stops`); const d = await res.json() as { stops?: Stop[] }; setAvailableStops(d.stops ?? []); }
                }} style={inputStyle}>
                  <option value="">Select route…</option>
                  {routes.map(r => <option key={r.id} value={r.id}>{r.route_name}</option>)}
                </select>
              </div>
              <div><div style={labelStyle}>STOP</div>
                <select value={assignForm.stop_id} onChange={e => setAssignForm(f => ({...f,stop_id:e.target.value}))} style={inputStyle}>
                  <option value="">No stop assigned</option>
                  {availableStops.map(s => <option key={s.id} value={s.id}>#{s.stop_order} {s.stop_name}{s.pickup_time ? ` (${s.pickup_time.slice(0,5)})` : ''}</option>)}
                </select>
              </div>
              <div><div style={labelStyle}>TRANSPORT FEE (₹)</div>
                <input type="number" value={assignForm.fee_amount} onChange={e => setAssignForm(f => ({...f,fee_amount:e.target.value}))} style={inputStyle} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={() => setShowAssign(false)} style={{ flex: 1, padding: '8px', background: '#F3F4F6', border: 'none', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => void assignStudent()} disabled={saving || !assignForm.student_id || !assignForm.route_id}
                style={{ flex: 2, padding: '8px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {saving ? 'Saving…' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Modal */}
      {activeAttendance && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 460, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 18 }}>Mark Attendance</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button onClick={() => setActiveAttendance(a => a ? { ...a, roster: a.roster.map(r => ({ ...r, boarded: true })) } : a)}
                style={{ padding: '4px 12px', background: '#D1FAE5', color: '#065F46', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                All Boarded
              </button>
              <button onClick={() => setActiveAttendance(a => a ? { ...a, roster: a.roster.map(r => ({ ...r, boarded: false })) } : a)}
                style={{ padding: '4px 12px', background: '#FEE2E2', color: '#991B1B', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                All Absent
              </button>
            </div>
            {activeAttendance.roster.map(r => (
              <div key={r.student_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{r.student_name}</div>
                  <div style={{ fontSize: 10, color: '#9CA3AF' }}>{r.student_class}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setActiveAttendance(a => a ? { ...a, roster: a.roster.map(x => x.student_id === r.student_id ? { ...x, boarded: true } : x) } : a)}
                    style={{ padding: '4px 10px', background: r.boarded === true ? '#D1FAE5' : '#F3F4F6', color: r.boarded === true ? '#065F46' : '#374151', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: r.boarded === true ? 700 : 400, cursor: 'pointer' }}>✓</button>
                  <button onClick={() => setActiveAttendance(a => a ? { ...a, roster: a.roster.map(x => x.student_id === r.student_id ? { ...x, boarded: false } : x) } : a)}
                    style={{ padding: '4px 10px', background: r.boarded === false ? '#FEE2E2' : '#F3F4F6', color: r.boarded === false ? '#991B1B' : '#374151', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: r.boarded === false ? 700 : 400, cursor: 'pointer' }}>✕</button>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setActiveAttendance(null)} style={{ flex: 1, padding: '8px', background: '#F3F4F6', border: 'none', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => void saveAttendance()} disabled={savingAttendance}
                style={{ flex: 2, padding: '8px', background: '#065F46', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {savingAttendance ? 'Saving…' : 'Save Attendance'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
