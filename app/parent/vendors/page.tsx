'use client';
// app/parent/vendors/page.tsx
// ISS-7 (#7) — Parent-facing list of school suppliers/vendors.

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Vendor { id: string; name: string; vendor_type: string; contact_name: string | null; contact_phone: string | null; contact_email: string | null }

const TYPE_LABEL: Record<string, string> = { transport: 'Transport', books: 'Books', uniform: 'Uniform', food: 'Food / Canteen' };
const TYPE_ICON: Record<string, string> = { transport: '🚌', books: '📚', uniform: '👕', food: '🍱' };
const ORDER = ['transport', 'books', 'uniform', 'food'];

export default function ParentVendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/parent/vendors')
      .then(r => r.ok ? r.json() : { vendors: [] })
      .then(d => setVendors(d.vendors ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const groups = ORDER
    .map(t => ({ type: t, items: vendors.filter(v => v.vendor_type === t) }))
    .filter(g => g.items.length > 0);

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ background: '#4F46E5', padding: '16px 16px 20px' }}>
        <Link href="/parent" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, textDecoration: 'none', display: 'block', marginBottom: 8 }}>← Back</Link>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>Suppliers</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>School transport, books, uniform & canteen</div>
      </div>

      <div style={{ padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading…</div>
        ) : groups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#9CA3AF' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🏪</div>
            <div style={{ fontWeight: 700, color: '#374151' }}>No suppliers listed yet.</div>
            <div style={{ marginTop: 4, fontSize: 13 }}>Your school hasn’t shared vendor contacts.</div>
          </div>
        ) : groups.map(g => (
          <div key={g.type} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
              {TYPE_ICON[g.type] ?? '🏪'} {TYPE_LABEL[g.type] ?? g.type}
            </div>
            {g.items.map(v => (
              <div key={v.id} style={{ background: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{v.name}</div>
                {v.contact_name && <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{v.contact_name}</div>}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  {v.contact_phone && (
                    <a href={`tel:${v.contact_phone}`} style={{ fontSize: 13, fontWeight: 600, color: '#4F46E5', textDecoration: 'none', background: '#EEF2FF', borderRadius: 8, padding: '6px 12px' }}>📞 {v.contact_phone}</a>
                  )}
                  {v.contact_email && (
                    <a href={`mailto:${v.contact_email}`} style={{ fontSize: 13, fontWeight: 600, color: '#4F46E5', textDecoration: 'none', background: '#EEF2FF', borderRadius: 8, padding: '6px 12px' }}>✉️ {v.contact_email}</a>
                  )}
                  {!v.contact_phone && !v.contact_email && (
                    <span style={{ fontSize: 12, color: '#9CA3AF' }}>No contact shared</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
