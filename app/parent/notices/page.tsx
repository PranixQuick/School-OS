'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Notice { id: string; subject: string; message: string; created_at: string; }

export default function ParentNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/parent/announcements')
      .then(r => r.ok ? r.json() : { announcements: [] })
      .then(d => setNotices(d.announcements ?? d.broadcasts ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ background: '#4F46E5', padding: '16px 16px 20px' }}>
        <Link href="/parent" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, textDecoration: 'none', display: 'block', marginBottom: 8 }}>← Back</Link>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>School Notices</div>
      </div>
      <div style={{ padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading…</div>
        ) : notices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#9CA3AF' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📢</div>
            <div style={{ fontWeight: 700, color: '#374151' }}>No notices from school.</div>
          </div>
        ) : notices.map(n => (
          <div key={n.id} style={{ background: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, borderLeft: '3px solid #4F46E5', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 6 }}>{n.subject}</div>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{n.message}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>{new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
