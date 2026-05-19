'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import Link from 'next/link';

interface Gallery {
  id: string; title: string; description?: string;
  event_type: string; event_date: string; status: string;
  photo_count: number; video_count: number;
  featured_image_url?: string; allow_download: boolean; audience_type: string;
}
interface MediaItem {
  id: string; media_type: string; file_name: string;
  storage_path: string; caption?: string; is_featured: boolean;
  upload_status: string; view_count: number; download_count: number; uploaded_at: string;
}

interface UploadState {
  id: string; file: File; progress: number;
  status: 'queued' | 'uploading' | 'done' | 'error';
  error?: string;
}

const AUDIENCE_LABELS: Record<string, string> = {
  all: 'Everyone', all_parents: 'All Parents', all_students: 'All Students',
  all_staff: 'All Staff', class_parents: 'Class Parents', teachers_only: 'Teachers Only',
};

export default function GalleryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/events/galleries/${id}`);
    if (!res.ok) { router.push('/admin/events'); return; }
    const d = await res.json();
    setGallery(d.gallery);
    setMedia(d.media ?? []);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  async function uploadFile(file: File) {
    const upId = Math.random().toString(36).slice(2);
    const up: UploadState = { id: upId, file, progress: 0, status: 'queued' };

    setUploads(prev => [...prev, up]);

    try {
      // Get signed upload URL
      const regRes = await fetch(`/api/admin/events/galleries/${id}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_name: file.name,
          mime_type: file.type,
          file_size_bytes: file.size,
          media_type: file.type.startsWith('video/') ? 'video' : 'photo',
        }),
      });

      if (!regRes.ok) throw new Error('Failed to register upload');
      const { upload_url, media_item } = await regRes.json();

      setUploads(prev => prev.map(u => u.id === upId ? { ...u, status: 'uploading', progress: 10 } : u));

      // Upload directly to Supabase Storage
      const putRes = await fetch(upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!putRes.ok) throw new Error('Storage upload failed');

      setUploads(prev => prev.map(u => u.id === upId ? { ...u, progress: 90 } : u));

      // Mark as ready
      await fetch(`/api/admin/events/galleries/${id}/media`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ media_item_id: media_item.id, status: 'ready' }),
      });

      setUploads(prev => prev.map(u => u.id === upId ? { ...u, status: 'done', progress: 100 } : u));

      // Reload media
      setTimeout(() => load(), 500);

    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed';
      setUploads(prev => prev.map(u => u.id === upId ? { ...u, status: 'error', error: msg, progress: 0 } : u));
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const accepted = Array.from(files).filter(f =>
      f.type.startsWith('image/') || f.type.startsWith('video/')
    );
    if (accepted.length === 0) { showToast('Only images and videos are supported.'); return; }
    accepted.forEach(uploadFile);
  }

  async function publishGallery() {
    if (media.length === 0) { showToast('Add at least one photo before publishing.'); return; }
    setPublishing(true);
    const res = await fetch(`/api/admin/events/galleries/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'published' }),
    });
    if (res.ok) {
      showToast('Gallery published! Parents can now view it.');
      load();
    }
    setPublishing(false);
  }

  async function deleteMedia(mediaId: string) {
    await fetch(`/api/admin/events/galleries/${id}/media?media_id=${mediaId}`, { method: 'DELETE' });
    setMedia(prev => prev.filter(m => m.id !== mediaId));
  }

  const pendingUploads = uploads.filter(u => u.status !== 'done' && u.status !== 'error');
  const failedUploads = uploads.filter(u => u.status === 'error');

  if (loading) {
    return (
      <Layout title="Gallery" subtitle="Loading…">
        <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>Loading gallery…</div>
      </Layout>
    );
  }

  if (!gallery) return null;

  return (
    <Layout
      title={gallery.title}
      subtitle={`${new Date(gallery.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · ${AUDIENCE_LABELS[gallery.audience_type] ?? gallery.audience_type}`}
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/admin/events" style={{ padding: '8px 14px', background: '#F3F4F6', color: '#374151', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>← Back</Link>
          {gallery.status === 'draft' && (
            <button onClick={publishGallery} disabled={publishing || media.length === 0}
              style={{ padding: '8px 16px', background: publishing ? '#818CF8' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {publishing ? 'Publishing…' : '✓ Publish'}
            </button>
          )}
        </div>
      }
    >
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: '#15803D', color: '#fff', padding: '12px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          ✓ {toast}
        </div>
      )}

      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        .drop-zone{border:2px dashed #C7D2FE;border-radius:14px;padding:32px;text-align:center;cursor:pointer;transition:background 0.2s,border-color 0.2s}
        .drop-zone.over{background:#EEF2FF;border-color:#4F46E5}
        .drop-zone:hover{background:#F5F3FF;border-color:#6366F1}
        .media-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}
        @media(max-width:480px){.media-grid{grid-template-columns:repeat(2,1fr)}}
      `}</style>

      {/* Status badge */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20 }}>
        <div style={{ padding: '4px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700,
          background: gallery.status === 'published' ? '#D1FAE5' : gallery.status === 'archived' ? '#F3F4F6' : '#FEF9C3',
          color: gallery.status === 'published' ? '#065F46' : gallery.status === 'archived' ? '#374151' : '#92400E',
        }}>
          {gallery.status.toUpperCase()}
        </div>
        <div style={{ fontSize: 13, color: '#6B7280' }}>
          {gallery.photo_count} photo{gallery.photo_count !== 1 ? 's' : ''}
          {gallery.video_count > 0 && ` · ${gallery.video_count} video${gallery.video_count !== 1 ? 's' : ''}`}
          {!gallery.allow_download && ' · Download disabled'}
        </div>
      </div>

      {/* Upload zone */}
      {gallery.status !== 'archived' && (
        <div
          ref={dropRef}
          className={`drop-zone${dragOver ? ' over' : ''}`}
          style={{ marginBottom: 20 }}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        >
          <div style={{ fontSize: 32, marginBottom: 10 }}>📤</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 4 }}>
            Upload photos or videos
          </div>
          <div style={{ fontSize: 13, color: '#6B7280' }}>
            Tap to select files · Drag &amp; drop · Camera roll supported
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>
            JPG, PNG, WebP, MP4, MOV supported
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            capture="environment"
            style={{ display: 'none' }}
            onChange={e => handleFiles(e.target.files)}
          />
        </div>
      )}

      {/* Active uploads */}
      {pendingUploads.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Uploading {pendingUploads.length} file{pendingUploads.length !== 1 ? 's' : ''}…
          </div>
          {pendingUploads.map(u => (
            <div key={u.id} style={{ background: '#F9FAFB', borderRadius: 10, padding: '10px 14px', marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>{u.file.name}</div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>{u.progress}%</div>
              </div>
              <div style={{ background: '#E5E7EB', borderRadius: 3, height: 5 }}>
                <div style={{ width: `${u.progress}%`, background: '#4F46E5', height: 5, borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Failed uploads */}
      {failedUploads.length > 0 && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#B91C1C', marginBottom: 6 }}>
            ⚠️ {failedUploads.length} upload{failedUploads.length !== 1 ? 's' : ''} failed
          </div>
          {failedUploads.map(u => (
            <div key={u.id} style={{ fontSize: 12, color: '#991B1B', marginBottom: 2 }}>
              {u.file.name}: {u.error}
            </div>
          ))}
          <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 6 }}>
            Note: Uploads require the &apos;event-media&apos; Supabase Storage bucket to be created.
          </div>
        </div>
      )}

      {/* Media grid */}
      {media.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 16px', background: '#F9FAFB', borderRadius: 14 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📷</div>
          <div style={{ fontWeight: 700, color: '#374151', marginBottom: 6 }}>No photos yet</div>
          <div style={{ fontSize: 13, color: '#9CA3AF' }}>Upload photos to populate this gallery.</div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Gallery ({media.length} item{media.length !== 1 ? 's' : ''})
          </div>
          <div className="media-grid">
            {media.map(m => (
              <div key={m.id} style={{ position: 'relative', background: '#F3F4F6', borderRadius: 10, overflow: 'hidden', aspectRatio: '1' }}>
                {m.upload_status === 'ready' ? (
                  <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #EEF2FF, #E0E7FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
                    {m.media_type === 'video' ? '🎥' : '📷'}
                  </div>
                ) : (
                  <div style={{ width: '100%', height: '100%', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulse 1.5s infinite' }}>
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>{m.upload_status}</div>
                  </div>
                )}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.6))', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 8, opacity: 0, transition: 'opacity 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                >
                  <div style={{ fontSize: 10, color: '#fff', marginBottom: 4 }}>{m.file_name.slice(0, 20)}</div>
                  <button onClick={() => deleteMedia(m.id)}
                    style={{ background: 'rgba(239,68,68,0.85)', border: 'none', borderRadius: 5, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: '3px 7px' }}>
                    Remove
                  </button>
                </div>
                {m.is_featured && (
                  <div style={{ position: 'absolute', top: 6, left: 6, background: '#F59E0B', borderRadius: 4, fontSize: 9, fontWeight: 700, color: '#fff', padding: '2px 5px' }}>COVER</div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </Layout>
  );
}
