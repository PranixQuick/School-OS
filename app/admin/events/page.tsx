'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { T } from '@/lib/i18n';
import { useLang } from '@/lib/useLang';

interface Gallery {
  id: string; title: string; description?: string;
  event_type: string; event_date: string; status: string;
  photo_count: number; video_count: number;
  featured_image_url?: string; allow_download: boolean; audience_type: string;
}

// EVENT_TYPES and AUDIENCE_OPTIONS are now rendered via T() keys
const EVENT_TYPE_KEYS: { value: string; icon: string; key: string }[] = [
  { value: 'annual_day',   icon: '🎭', key: 'et_annual_day' },
  { value: 'sports_day',   icon: '🏃', key: 'et_sports_day' },
  { value: 'farewell',     icon: '👋', key: 'et_farewell' },
  { value: 'science_fair', icon: '🔬', key: 'et_cultural' },
  { value: 'cultural',     icon: '🎨', key: 'et_cultural' },
  { value: 'trip',         icon: '🚌', key: 'et_general' },
  { value: 'ptm',          icon: '👨‍👩‍👧', key: 'ptm' },
  { value: 'competition',  icon: '🏆', key: 'et_general' },
  { value: 'celebration',  icon: '🎉', key: 'et_annual_day' },
  { value: 'seminar',      icon: '📚', key: 'et_general' },
  { value: 'general',      icon: '📷', key: 'et_general' },
];

const AUDIENCE_KEYS: { value: string; key: string }[] = [
  { value: 'all_parents',   key: 'aud_all_parents' },
  { value: 'all',           key: 'aud_all' },
  { value: 'all_staff',     key: 'aud_staff_only' },
  { value: 'teachers_only', key: 'aud_teachers_only' },
  { value: 'class_parents', key: 'aud_class_parents' },
];

const STATUS_COLORS: Record<string, string> = {
  draft:     '#FEF3C7',
  published: '#D1FAE5',
  archived:  '#F3F4F6',
};
const STATUS_TEXT: Record<string, string> = {
  draft:     '#92400E',
  published: '#065F46',
  archived:  '#374151',
};
const STATUS_KEYS: Record<string, string> = {
  all:       'all_filter',
  draft:     'status_draft',
  published: 'status_published',
  archived:  'status_archived',
};

export default function AdminEventsPage() {
  const { lang } = useLang();
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [form, setForm] = useState({
    title: '', event_type: 'general',
    event_date: new Date().toISOString().slice(0, 10),
    description: '', audience_type: 'all_parents', allow_download: true,
  });
  const [toast, setToast] = useState('');

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/events/galleries?status=${statusFilter}&limit=50`);
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
      showToast(T('gallery_created', lang as never));
      load();
    }
    setCreating(false);
  }

  async function publish(id: string) {
    const res = await fetch(`/api/admin/events/galleries/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'published' }),
    });
    if (res.ok) { showToast(T('gallery_published', lang as never)); load(); }
  }

  async function archive(id: string) {
    const res = await fetch(`/api/admin/events/galleries/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'archived' }),
    });
    if (res.ok) { showToast(T('gallery_archived', lang as never)); load(); }
  }

  const inp = { width: '100%', height: 40, borderRadius: 8, border: '1px solid #D1D5DB', background: '#F9FAFB', fontSize: 14, padding: '0 12px', outline: 'none', fontFamily: 'inherit', color: '#111827', boxSizing: 'border-box' as const };

  return (
    <Layout title={T('events_gallery', lang as never)} subtitle={T('events_gallery', lang as never)}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: '#15803D', color: '#fff', padding: '12px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          ✓ {toast}
        </div>
      )}

      {/* Header row: status filters + new gallery button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['all', 'draft', 'published', 'archived'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: statusFilter === s ? '#4F46E5' : '#F3F4F6',
                color: statusFilter === s ? '#fff' : '#374151' }}>
              {T(STATUS_KEYS[s], lang as never)}
            </button>
          ))}
        </div>
        <button onClick={() => setShowCreate(true)}
          style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: '#4F46E5', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          {T('new_gallery', lang as never)}
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 20 }}>
              {T('events_gallery', lang as never)}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                {T('event_name_label', lang as never)}
              </label>
              <input style={inp} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  {T('event_type_label', lang as never)}
                </label>
                <select style={inp} value={form.event_type} onChange={e => setForm(p => ({ ...p, event_type: e.target.value }))}>
                  {EVENT_TYPE_KEYS.map(t => (
                    <option key={t.value} value={t.value}>
                      {t.icon} {T(t.key, lang as never)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  {T('date', lang as never)}
                </label>
                <input type="date" style={inp} value={form.event_date} onChange={e => setForm(p => ({ ...p, event_date: e.target.value }))} />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                {T('share_with', lang as never)}
              </label>
              <select style={inp} value={form.audience_type} onChange={e => setForm(p => ({ ...p, audience_type: e.target.value }))}>
                {AUDIENCE_KEYS.map(o => (
                  <option key={o.value} value={o.value}>
                    {T(o.key, lang as never)}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                {T('event_description', lang as never)}
              </label>
              <textarea style={{ ...inp, height: 72, padding: '10px 12px', resize: 'vertical' as const }}
                value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.allow_download}
                onChange={e => setForm(p => ({ ...p, allow_download: e.target.checked }))}
                style={{ width: 16, height: 16 }} />
              <span style={{ fontSize: 13, color: '#374151' }}>{T('allow_download', lang as never)}</span>
            </label>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowCreate(false)}
                style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {T('cancel', lang as never)}
              </button>
              <button onClick={createGallery} disabled={creating || !form.title.trim()}
                style={{ flex: 2, padding: '10px', borderRadius: 9, border: 'none', background: creating ? '#818CF8' : '#4F46E5', color: '#fff', fontSize: 14, fontWeight: 700, cursor: creating ? 'not-allowed' : 'pointer' }}>
                {creating ? T('loading', lang as never) : T('create_gallery', lang as never)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gallery Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>{T('loading', lang as never)}</div>
      ) : galleries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📸</div>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#111827', marginBottom: 8 }}>{T('no_galleries', lang as never)}</div>
          <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 24 }}>{T('share_moments', lang as never)}</div>
          <button onClick={() => setShowCreate(true)}
            style={{ padding: '12px 24px', borderRadius: 10, border: 'none', background: '#4F46E5', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            {T('create_first_gallery', lang as never)}
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {galleries.map(g => {
            const typeIcon = EVENT_TYPE_KEYS.find(t => t.value === g.event_type)?.icon ?? '📷';
            const audienceLabel = AUDIENCE_KEYS.find(o => o.value === g.audience_type);
            return (
              <div key={g.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ height: 140, background: 'linear-gradient(135deg, #EEF2FF, #E0E7FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>
                  {typeIcon}
                </div>
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', flex: 1, marginRight: 8 }}>{g.title}</div>
                    <div style={{ padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                      background: STATUS_COLORS[g.status] ?? '#F3F4F6',
                      color: STATUS_TEXT[g.status] ?? '#374151', whiteSpace: 'nowrap' }}>
                      {T(STATUS_KEYS[g.status] ?? 'status_draft', lang as never)}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>
                    {new Date(g.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}{g.photo_count} {g.photo_count !== 1 ? T('reports', lang as never) : T('reports', lang as never)}
                  </div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 12 }}>
                    👥 {audienceLabel ? T(audienceLabel.key, lang as never) : g.audience_type}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <a href={`/admin/events/${g.id}`}
                      style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#374151', fontSize: 12, fontWeight: 600, textDecoration: 'none', display: 'block' }}>
                      {g.photo_count === 0 ? T('upload_photos', lang as never) : T('manage_gallery', lang as never)}
                    </a>
                    {g.status === 'draft' && (
                      <button onClick={() => publish(g.id)}
                        style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: '#D1FAE5', color: '#065F46', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        {T('publish_gallery', lang as never)}
                      </button>
                    )}
                    {g.status === 'published' && (
                      <button onClick={() => archive(g.id)}
                        style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', color: '#6B7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        {T('archive_gallery', lang as never)}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
