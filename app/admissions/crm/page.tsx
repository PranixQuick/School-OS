'use client';

import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import Link from 'next/link';

interface Lead {
  id: string;
  parent_name: string;
  child_name: string | null;
  child_age: number;
  target_class: string;
  source: string;
  phone: string;
  email: string | null;
  score: number;
  priority: string;
  status: string;
  has_sibling: boolean;
  notes: string | null;
  created_at: string;
}

const BTN: CSSProperties = { border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 };

const P_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  high:   { bg: '#E1F5EE', color: '#0F6E56', border: '#1D9E75' },
  medium: { bg: '#FAEEDA', color: '#854F0B', border: '#EF9F27' },
  low:    { bg: '#FAECE7', color: '#993C1D', border: '#F0997B' },
};

const STATUS_OPTIONS = ['new', 'contacted', 'visit_scheduled', 'admitted', 'lost'];

const SOURCE_LABELS: Record<string, string> = {
  referral: 'Referral', google: 'Google', website: 'Website',
  instagram: 'Instagram', facebook: 'Facebook', 'walk-in': 'Walk-in', other: 'Other',
};

function ScoreBadge({ score, priority }: { score: number; priority: string }) {
  const ps = P_STYLE[priority] ?? P_STYLE.medium;
  return (
    <div style={{ width: 44, height: 44, borderRadius: '50%', background: ps.bg, border: `2px solid ${ps.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <span style={{ fontSize: 14, fontWeight: 800, color: ps.color, lineHeight: 1 }}>{score}</span>
    </div>
  );
}

export default function CRMPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => { fetchLeads(); }, []);

  async function fetchLeads() {
    setLoading(true);
    const res = await fetch('/api/admissions/list');
    const data = await res.json() as { leads?: Lead[] };
    setLeads(data.leads ?? []);
    setLoading(false);
  }

  async function updateStatus(id: string, newStatus: string) {
    setUpdatingId(id);
    await fetch('/api/admissions/list', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus }),
    });
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l));
    setUpdatingId(null);
  }

  const filtered = leads.filter(l => {
    if (filter !== 'all' && l.priority !== filter) return false;
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;
    return true;
  });

  const counts = {
    high: leads.filter(l => l.priority === 'high').length,
    medium: leads.filter(l => l.priority === 'medium').length,
    low: leads.filter(l => l.priority === 'low').length,
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F8F7F4', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* Nav */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #E8E6DF', height: 56, display: 'flex', alignItems: 'center', padding: '0 32px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: '#0F6E56', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>S</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#1A1A18' }}>School OS</span>
          </a>
          <span style={{ color: '#D3D1C7', margin: '0 6px' }}>/</span>
          <a href="/admissions" style={{ fontSize: 14, color: '#5F5E5A', textDecoration: 'none' }}>Admissions</a>
          <span style={{ color: '#D3D1C7', margin: '0 6px' }}>/</span>
          <span style={{ fontSize: 14, color: '#3C3489', fontWeight: 600 }}>CRM</span>
        </div>
        <Link href="/admissions"
          style={{ ...BTN, height: 34, padding: '0 16px', borderRadius: 8, background: '#3C3489', color: '#fff', fontSize: 13, display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          + New Inquiry
        </Link>
      </nav>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#EEEDFE', borderRadius: 20, padding: '4px 12px', marginBottom: 12 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3C3489' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#3C3489', letterSpacing: '0.05em' }}>ADMISSIONS CRM</span>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1A1A18', margin: '0 0 4px', letterSpacing: '-0.5px' }}>Lead Management</h1>
            <p style={{ fontSize: 14, color: '#5F5E5A', margin: 0 }}>{leads.length} total leads · AI-scored and categorised</p>
          </div>
          <button onClick={fetchLeads}
            style={{ ...BTN, height: 36, padding: '0 16px', borderRadius: 8, background: '#fff', border: '1px solid #D3D1C7', fontSize: 13, color: '#5F5E5A' }}>
            Refresh
          </button>
        </div>

        {/* Stats cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
          {([['high', 'High Priority', '#0F6E56', '#E1F5EE'], ['medium', 'Medium Priority', '#854F0B', '#FAEEDA'], ['low', 'Low Priority', '#993C1D', '#FAECE7']] as const).map(([p, label, col, bg]) => (
            <button key={p} onClick={() => setFilter(filter === p ? 'all' : p)}
              style={{ ...BTN, background: filter === p ? bg : '#fff', border: `1px solid ${filter === p ? col : '#E8E6DF'}`, borderRadius: 12, padding: '16px 20px', textAlign: 'left' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: col, marginBottom: 4 }}>{counts[p]}</div>
              <div style={{ fontSize: 12, color: '#5F5E5A' }}>{label}</div>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ height: 36, borderRadius: 8, border: '1px solid #D3D1C7', background: '#fff', fontSize: 13, padding: '0 12px', outline: 'none', fontFamily: 'inherit' }}>
            <option value="all">All Statuses</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}</option>)}
          </select>
          {filter !== 'all' && (
            <button onClick={() => setFilter('all')}
              style={{ ...BTN, height: 36, padding: '0 14px', borderRadius: 8, background: '#EEEDFE', color: '#3C3489', fontSize: 13 }}>
              Clear filter ×
            </button>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#888780' }}>Loading leads...</div>
        ) : filtered.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #E8E6DF', borderRadius: 12, padding: 40, textAlign: 'center', color: '#888780', fontSize: 14 }}>
            No leads match this filter.
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #E8E6DF', borderRadius: 16, overflow: 'hidden' }}>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr 100px 80px 90px 110px 120px 130px', gap: 0, padding: '10px 16px', background: '#F8F7F4', borderBottom: '1px solid #E8E6DF' }}>
              {['', 'Parent / Child', 'Phone', 'Class', 'Source', 'Score', 'Priority', 'Status'].map(h => (
                <div key={h} style={{ fontSize: 11, fontWeight: 700, color: '#5F5E5A', letterSpacing: '0.04em' }}>{h}</div>
              ))}
            </div>

            {filtered.map((lead, i) => {
              const ps = P_STYLE[lead.priority] ?? P_STYLE.medium;
              const date = new Date(lead.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
              return (
                <div key={lead.id} style={{ display: 'grid', gridTemplateColumns: '48px 1fr 100px 80px 90px 110px 120px 130px', gap: 0, padding: '14px 16px', borderBottom: i < filtered.length - 1 ? '1px solid #F1EFE8' : 'none', alignItems: 'center', background: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>

                  {/* Score circle */}
                  <ScoreBadge score={lead.score} priority={lead.priority} />

                  {/* Name */}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1A1A18' }}>{lead.parent_name}</div>
                    <div style={{ fontSize: 12, color: '#888780' }}>
                      {lead.child_name ? `${lead.child_name}, ` : ''}Age {lead.child_age} · {date}
                      {lead.has_sibling && <span style={{ marginLeft: 4, fontSize: 10, background: '#E1F5EE', color: '#0F6E56', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>SIBLING</span>}
                    </div>
                  </div>

                  {/* Phone */}
                  <div style={{ fontSize: 13, color: '#2C2C2A' }}>{lead.phone}</div>

                  {/* Class */}
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A18' }}>Class {lead.target_class}</div>

                  {/* Source */}
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 7px', borderRadius: 6, background: '#F1EFE8', color: '#5F5E5A' }}>
                      {SOURCE_LABELS[lead.source] ?? lead.source}
                    </span>
                  </div>

                  {/* Score bar */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: ps.color, marginBottom: 3 }}>{lead.score}/100</div>
                    <div style={{ height: 4, borderRadius: 2, background: '#E8E6DF', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${lead.score}%`, background: ps.border, borderRadius: 2 }} />
                    </div>
                  </div>

                  {/* Priority badge */}
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: ps.bg, color: ps.color }}>
                      {lead.priority.toUpperCase()}
                    </span>
                  </div>

                  {/* Status dropdown */}
                  <select
                    value={lead.status}
                    disabled={updatingId === lead.id}
                    onChange={e => updateStatus(lead.id, e.target.value)}
                    style={{ height: 30, borderRadius: 6, border: '1px solid #D3D1C7', background: '#FAFAF8', fontSize: 12, padding: '0 6px', outline: 'none', fontFamily: 'inherit', opacity: updatingId === lead.id ? 0.5 : 1 }}
                  >
                    {STATUS_OPTIONS.map(s => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        )}

        {/* Notes strip */}
        {filtered.some(l => l.notes) && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#5F5E5A', letterSpacing: '0.05em', marginBottom: 8 }}>AI INSIGHTS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filtered.filter(l => l.notes).map(l => (
                <div key={l.id} style={{ background: '#EEEDFE', borderRadius: 8, padding: '8px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#3C3489', whiteSpace: 'nowrap' }}>{l.parent_name}:</span>
                  <span style={{ fontSize: 12, color: '#3C3489' }}>{l.notes}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
