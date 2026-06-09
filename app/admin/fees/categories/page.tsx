'use client';
// app/admin/fees/categories/page.tsx
// PR-103 — Fee Categories UI

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface FeeCategory {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function FeeCategoriesPage() {
  const [categories, setCategories] = useState<FeeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/fee-categories?show_inactive=${showInactive}`);
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setCategories(json.categories ?? []);
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!formName.trim()) { setFormError('Name is required'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/fee-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName.trim(), description: formDesc.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) { setFormError(json.error ?? 'Failed to create'); return; }
      setShowModal(false);
      setFormName('');
      setFormDesc('');
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(cat: FeeCategory) {
    setTogglingId(cat.id);
    try {
      await fetch(`/api/admin/fee-categories/${cat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !cat.is_active }),
      });
      load();
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <Layout title="Fee Categories" subtitle="Manage fee category labels for your school">
      {/* Header actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          onClick={() => { setFormName(''); setFormDesc(''); setFormError(''); setShowModal(true); }}
          style={{ padding: '9px 18px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
        >
          + New Category
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6B7280', cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
            style={{ width: 14, height: 14 }}
          />
          Show inactive
        </label>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ color: '#9CA3AF', fontSize: 14, padding: 20 }}>Loading…</div>
      ) : categories.length === 0 ? (
        <div style={{ color: '#9CA3AF', fontSize: 14, padding: 20 }}>No categories found. Create one to get started.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 700, color: '#374151' }}>Name</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 700, color: '#374151' }}>Description</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 700, color: '#374151' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 700, color: '#374151' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(cat => (
                <tr key={cat.id} style={{ borderBottom: '1px solid #F3F4F6', opacity: cat.is_active ? 1 : 0.55 }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#111827' }}>{cat.name}</td>
                  <td style={{ padding: '10px 12px', color: '#6B7280' }}>{cat.description ?? '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                      background: cat.is_active ? '#D1FAE5' : '#F3F4F6',
                      color: cat.is_active ? '#065F46' : '#9CA3AF',
                    }}>
                      {cat.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <button
                      onClick={() => handleToggle(cat)}
                      disabled={togglingId === cat.id}
                      style={{
                        padding: '5px 12px', borderRadius: 6, border: '1px solid #E5E7EB',
                        background: cat.is_active ? '#FEF2F2' : '#F0FDF4',
                        color: cat.is_active ? '#DC2626' : '#16A34A',
                        fontWeight: 600, fontSize: 12, cursor: 'pointer',
                      }}
                    >
                      {togglingId === cat.id ? '…' : cat.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 16, color: '#111827' }}>New Fee Category</div>
            <form onSubmit={handleCreate}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Name *</label>
              <input
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="e.g. Tuition Fee"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 13, marginBottom: 12, boxSizing: 'border-box' }}
                autoFocus
              />
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Description</label>
              <textarea
                value={formDesc}
                onChange={e => setFormDesc(e.target.value)}
                placeholder="Optional description"
                rows={3}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 13, marginBottom: 12, boxSizing: 'border-box', resize: 'vertical' }}
              />
              {formError && <div style={{ color: '#DC2626', fontSize: 12, marginBottom: 10 }}>{formError}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)}
                  style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: '#4F46E5', color: '#fff', fontWeight: 700, fontSize: 13, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
