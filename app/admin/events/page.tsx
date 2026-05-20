'use client';
import { useState, useEffect, useRef } from 'react';
import Layout from '@/components/Layout';
import { T } from '@/lib/i18n';
import { useLang } from '@/lib/useLang';

interface Gallery {
  id: string; title: string; description?: string;
  event_type: string; event_date: string; status: string;
  photo_count: number; video_count: number;
  featured_image_url?: string; allow_download: boolean; audience_type: string;
}

const EVENT_TYPES = [
  { value: 'annual_day', label: '🎭 Annual Day' },
  { value: 'sports_day', label: '🏃 Sports Day' },
  { value: 'farewell', label: '👋 Farewell' },
  { value: 'science_fair', label: '🔬 Science Fair' },
  { value: 'cultural', label: '🎨 Cultural Event' },
  { value: 'trip', label: '🚌 School Trip' },
  { value: 'ptm', label: '👨‍👩‍👧 PTM' },
  { value: 'competition', label: '🏆 Competition' },
  { value: 'celebration', label: '🎉 Celebration' },
  { value: 'seminar', label: '📚 Seminar / Workshop' },
  { value: 'general', label: '📷 General Event' },
];

const AUDIENCE_OPTIONS = [
  { value: 'all_parents', label: 'All Parents' },
  { value: 'all', label: 'Everyone (parents + staff)' },
  { value: 'all_staff', label: 'Staff Only' },
  { value: 'teachers_only', label: 'Teachers Only' },
  { value: 'class_parents', label: 'Specific Class Parents' },
];

const STATUS_COLORS: Record<string, string> = {
  draft: '#FEF3C7',
  published: '#D1FAE5',
  archived: '#F3F4F6',
};
const STATUS_TEXT: Record<string, string> = {
  draft: '#92400E',
  published: '#065F46',
  archived: '#374151',
};

export default function AdminEventsPage() {
  const { lang } = useLang();
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [form, setForm] = useState({
    title: '', event_type: 'general', event_date: new Date().toISOString().slice(0, 10),
    description: '', audience_type: 'all_parents', allow_download: true,
  });
  const [toast, setToast] = useState('');

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function load() {
    setLoading(true);
    const q = statusFilter === 'all' ? 'all' : statusFilter;
    const res = await fetch(`/api/admin/events/galleries?status=${q}&limit=50`);
    if (res.ok) { const d = await res.json(); setGalleries(d.galleries ?? []); }
    setLoading(false);
  }

  useEffect(() => { load(); }, [statusFilter]);

  async function createGallery() {
    if (!form.title.trim()) return;
    setCreating(true);
    const res = await fetch('/api/admin/events/galleries', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowCreate(false);
      setForm({ title: '', event_type: 'general', event_date: new Date().toISOString().slice(0, 10), description: '', audience_type: 'all_parents', allow_download: true });
      showToast('Gallery created! Now add photos.');
      load();
    }
    setCreating(false);
  }

  async function publish(id: string) {
    const res = await fetch(`/api/admin/events/galleries/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'published' }),
    });
    if (res.ok) { showToast('Gallery published! Parents can now view it.'); load(); }
  }

  async function archive(id: string) {
    const res = await fetch(`/api/admin/events/galleries/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'archived' }),
    });
    if (res.ok) { showToast('Gallery archived.'); load(); }
  }

  const input = { width: '100%', height: 40, borderRadius: 8, border: '1px solid #D1D5DB', background: '#F9FAFB', fontSize: 14, padding: '0 12px', outline: 'none', fontFamily: 'inherit', color: '#111827', boxSizing: 'border-box' as const };

  return (
    <Layout title={T('events_gallery', lang)} subtitle={T('events_gallery', lang)}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: '#15803D', color: '#fff', padding: '12px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          ✓ {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {['all', 'draft', 'published', 'archived'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: statusFilter === s ? '#4F46E5' : '#F3F4F6', color: statusFilter === s ? '#fff' : '#374151' }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <button onClick={() => setShowCreate(true)}
          style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: '#4F46E5', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          + New Gallery
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 20 }}>Create Event Gallery</div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>EVENT NAME *</label>
              <input style={input} placeholder="e.g. Annual Day 2026" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>EVENT TYPE</label>
                <select style={input} value={form.event_type} onChange={e => setForm(p => ({ ...p, event_type: e.target.value }))}>
                  {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>DATE</label>
                <input type="date" style={input} value={form.event_date} onChange={e => setForm(p => ({ ...p, event_date: e.target.value }))} />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>SHARE WITH</label>
              <select style={input} value={form.audience_type} onChange={e => setForm(p => ({ ...p, audience_type: e.target.value }))}>
                {AUDIENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>DESCRIPTION (optional)</label>
              <textarea style={{ ...input, height: 72, padding: '10px 12px', resize: 'vertical' as const }} placeholder="Brief description of the event..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.allow_download} onChange={e => setForm(p => ({ ...p, allow_download: e.target.checked }))} style={{ width: 16, height: 16 }} />
              <span style={{ fontSize: 13, color: '#374151' }}>Allow parents to download photos</span>
            </label>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowCreate(false)}
                style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={createGallery} disabled={creating || !form.title.trim()}
                style={{ flex: 2, padding: '10px', borderRadius: 9, border: 'none', background: creating ? '#818CF8' : '#4F46E5', color: '#fff', fontSize: 14, fontWeight: 700, cursor: creating ? 'not-allowed' : 'pointer' }}>
                {creating ? 'Creating...' : 'Create Gallery →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gallery Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>Loading galleries...</div>
      ) : galleries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📸</div>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#111827', marginBottom: 8 }}>No galleries yet</div>
          <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 24 }}>Create your first event gallery and share school moments with parents.</div>
          <button onClick={() => setShowCreate(true)}
            style={{ padding: '12px 24px', borderRadius: 10, border: 'none', background: '#4F46E5', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Create First Gallery
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {galleries.map(g => (
            <div key={g.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              {/* Thumbnail */}
              <div style={{ height: 140, background: 'linear-gradient(135deg, #EEF2FF, #E0E7FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>
                {EVENT_TYPES.find(t => t.value === g.event_type)?.label.split(' ')[0] ?? '📷'}
              </div>

              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', flex: 1, marginRight: 8 }}>{g.title}</div>
                  <div style={{ padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: STATUS_COLORS[g.status] ?? '#F3F4F6', color: STATUS_TEXT[g.status] ?? '#374151', whiteSpace: 'nowrap' }}>
                    {g.status}
                  </div>
                </div>

                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>
                  {new Date(g.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {' · '}
                  {g.photo_count} photo{g.photo_count !== 1 ? 's' : ''}
                  {g.video_count > 0 && ` · ${g.video_count} video${g.video_count !== 1 ? 's' : ''}`}
                </div>

                <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 12 }}>
                  👥 {AUDIENCE_OPTIONS.find(o => o.value === g.audience_type)?.label ?? g.audience_type}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <a href={`/admin/events/${g.id}`}
                    style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#374151', fontSize: 12, fontWeight: 600, textDecoration: 'none', display: 'block' }}>
                    {g.photo_count === 0 ? '📤 Upload Photos' : '📂 Manage'}
                  </a>
                  {g.status === 'draft' && (
                    <button onClick={() => publish(g.id)}
                      style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: '#D1FAE5', color: '#065F46', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      ✓ Publish
                    </button>
                  )}
                  {g.status === 'published' && (
                    <button onClick={() => archive(g.id)}
                      style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', color: '#6B7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      Archive
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
