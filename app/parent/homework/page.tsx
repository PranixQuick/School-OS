'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface HW { id: string; title: string; subject: string; class: string; due_date: string; description?: string; created_at: string; }

export default function ParentHomeworkPage() {
  const [hw, setHw] = useState<HW[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/parent/homework')
      .then(r => r.ok ? r.json() : { homework: [] })
      .then(d => setHw(d.homework ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const isOverdue = (d: string) => new Date(d) < new Date();

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ background: '#4F46E5', padding: '16px 16px 20px' }}>
        <Link href="/parent" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, textDecoration: 'none', display: 'block', marginBottom: 8 }}>← Back</Link>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>Homework</div>
      </div>
      <div style={{ padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading…</div>
        ) : hw.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#9CA3AF' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📚</div>
            <div style={{ fontWeight: 700, color: '#374151' }}>No homework assigned recently.</div>
          </div>
        ) : hw.map(h => (
          <div key={h.id} style={{ background: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', flex: 1 }}>{h.title}</div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: isOverdue(h.due_date) ? '#FEF2F2' : '#FFFBEB', color: isOverdue(h.due_date) ? '#B91C1C' : '#D97706', flexShrink: 0, marginLeft: 8 }}>
                {isOverdue(h.due_date) ? 'Overdue' : 'Due'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>{h.subject} · Due {new Date(h.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
            {h.description && <div style={{ fontSize: 13, color: '#374151', marginTop: 8, borderTop: '1px solid #F3F4F6', paddingTop: 8 }}>{h.description}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
