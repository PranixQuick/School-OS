'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';

interface Lead { id: string; parent_name: string; child_name: string | null; child_age: number; target_class: string; source: string; phone: string; email: string | null; score: number; priority: string; status: string; has_sibling: boolean; notes: string | null; created_at: string; }

const P_BADGE: Record<string, string> = { high: 'badge badge-high', medium: 'badge badge-medium', low: 'badge badge-low' };
const STATUS_OPTIONS = ['new', 'contacted', 'visit_scheduled', 'admitted', 'lost'];
const SOURCE_LABELS: Record<string, string> = { referral: 'Referral', google: 'Google', website: 'Website', instagram: 'Instagram', facebook: 'Facebook', 'walk-in': 'Walk-in', other: 'Other' };

function scoreColor(s: number) { return s >= 70 ? '#15803D' : s >= 40 ? '#A16207' : '#B91C1C'; }
function scoreBg(s: number) { return s >= 70 ? '#DCFCE7' : s >= 40 ? '#FEF9C3' : '#FEE2E2'; }

export default function CRMPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Lead | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => { fetchLeads(); }, []);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  async function fetchLeads() {
    setLoading(true);
    const res = await fetch('/api/admissions/list');
    const data = await res.json() as { leads?: Lead[] };
    setLeads(data.leads ?? []);
    setLoading(false);
  }

  async function updateStatus(id: string, newStatus: string) {
    setUpdatingId(id);
    await fetch('/api/admissions/list', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: newStatus }) });
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l));
    setUpdatingId(null);
  }

  async function handleDelete(lead: Lead) {
    const res = await fetch('/api/admissions/list', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: lead.id }) });
    if (res.ok) {
      setLeads(prev => prev.filter(l => l.id !== lead.id));
      showToast('Lead removed', true);
    } else {
      showToast('Delete failed', false);
    }
    setDeleteConfirm(null);
  }

  const filtered = leads.filter(l => (filter === 'all' || l.priority === filter) && (statusFilter === 'all' || l.status === statusFilter));
  const counts = { high: leads.filter(l => l.priority === 'high').length, medium: leads.filter(l => l.priority === 'medium').length, low: leads.filter(l => l.priority === 'low').length };

  return (
    <Layout
      title="Leads CRM"
      subtitle={`${leads.length} total leads · AI-scored and categorised`}
      actions={<Link href="/admissions" className="btn btn-primary btn-sm">+ New Inquiry</Link>}
    >
      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.ok ? 'toast-success' : 'toast-error'}`}>
          {toast.ok ? '✓' : '✗'} {toast.msg}
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
        {([['high', '🟢 High Priority', '#DCFCE7', '#15803D'], ['medium', '🟡 Medium Priority', '#FEF9C3', '#A16207'], ['low', '🔴 Low Priority', '#FEE2E2', '#B91C1C']] as const).map(([p, label, bg, color]) => (
          <button key={p} onClick={() => setFilter(filter === p ? 'all' : p)}
            style={{ padding: '16px 18px', textAlign: 'left', borderRadius: 14, background: filter === p ? bg : '#fff', border: `1px solid ${filter === p ? color : '#E5E7EB'}`, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color, marginBottom: 4 }}>{counts[p]}</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>{label}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input" style={{ width: 'auto', height: 36, fontSize: 13 }}>
          <option value="all">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}</option>)}
        </select>
        {filter !== 'all' && <button onClick={() => setFilter('all')} className="btn btn-ghost btn-sm">Clear filter ×</button>}
        <button onClick={fetchLeads} className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}>↻ Refresh</button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="card"><div className="empty-state"><span className="spinner" style={{ width: 24, height: 24, border: '3px solid #E5E7EB', borderTop: '3px solid #4F46E5', marginBottom: 12 }} /><div className="empty-state-title">Loading leads...</div></div></div>
      ) : filtered.length === 0 ? (
        <div className="card"><div className="empty-state"><div className="empty-state-icon">👥</div><div className="empty-state-title">No leads match this filter</div></div></div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Score</th><th>Parent / Child</th><th>Phone</th><th>Class</th><th>Source</th><th>Priority</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(lead => (
                <tr key={lead.id}>
                  <td>
                    <div className="score-circle" style={{ width: 40, height: 40, background: scoreBg(lead.score), border: `2px solid ${scoreColor(lead.score)}`, fontWeight: 800, fontSize: 13, color: scoreColor(lead.score) }}>{lead.score}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{lead.parent_name}</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                      {lead.child_name ? `${lead.child_name}, ` : ''}Age {lead.child_age}
                      {lead.has_sibling && <span className="badge badge-high" style={{ fontSize: 9, marginLeft: 4 }}>SIBLING</span>}
                    </div>
                  </td>
                  <td style={{ fontSize: 13, color: '#374151' }}>{lead.phone}</td>
                  <td><span style={{ fontWeight: 600, fontSize: 13 }}>Cl {lead.target_class}</span></td>
                  <td><span className="badge badge-gray" style={{ fontSize: 11 }}>{SOURCE_LABELS[lead.source] ?? lead.source}</span></td>
                  <td><span className={P_BADGE[lead.priority] ?? 'badge badge-gray'}>{lead.priority.toUpperCase()}</span></td>
                  <td>
                    <select value={lead.status} disabled={updatingId === lead.id} onChange={e => updateStatus(lead.id, e.target.value)}
                      style={{ height: 30, borderRadius: 7, border: '1px solid #D1D5DB', background: '#F9FAFB', fontSize: 12, padding: '0 8px', outline: 'none', fontFamily: 'inherit', opacity: updatingId === lead.id ? 0.5 : 1, cursor: 'pointer' }}>
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}</option>)}
                    </select>
                  </td>
                  <td>
                    {lead.status === 'admitted' && (
                      <a
                        href={`/admin/students/new?from_inquiry=${lead.id}&child_name=${encodeURIComponent(lead.child_name ?? '')}&target_class=${encodeURIComponent(lead.target_class)}`}
                        style={{ height: 28, padding: '0 10px', borderRadius: 6, border: '1px solid #D1FAE5', background: '#ECFDF5', color: '#065F46', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
                      >
                        Enroll →
                      </a>
                    )}
                    <button
                      onClick={() => setDeleteConfirm(lead)}
                      style={{ height: 28, padding: '0 10px', borderRadius: 6, border: '1px solid #FEE2E2', background: '#FEF2F2', color: '#B91C1C', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.some(l => l.notes) && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.05em', marginBottom: 8 }}>AI INSIGHTS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.filter(l => l.notes).map(l => (
              <div key={l.id} className="alert alert-info" style={{ display: 'flex', gap: 10 }}>
                <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{l.parent_name}:</span>
                <span>{l.notes}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-box-sm">
            <div className="confirm-icon">⚠️</div>
            <div className="confirm-title">Remove {deleteConfirm.parent_name}?</div>
            <div className="confirm-body">
              This lead will be removed from the CRM. This action cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="btn btn-danger" style={{ flex: 1 }}>Remove Lead</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
              }
