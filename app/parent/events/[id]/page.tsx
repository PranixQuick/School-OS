'use client';
// app/parent/events/[id]/page.tsx
// Parent gallery detail — view event photos emotionally, download if allowed

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Gallery {
  id: string; title: string; description?: string;
  event_type: string; event_date: string; status: string;
  photo_count: number; video_count: number;
  featured_image_url?: string; allow_download: boolean;
}
interface MediaItem {
  id: string; media_type: string; file_name: string;
  storage_path: string; caption?: string;
  upload_status: string; view_count: number;
}

const EVENT_ICONS: Record<string, string> = {
  annual_day: '🎭', sports_day: '🏃', farewell: '👋', science_fair: '🔬',
  cultural: '🎨', trip: '🚌', ptm: '👨‍👩‍👧', competition: '🏆',
  celebration: '🎉', seminar: '📚', general: '📷',
};

export default function ParentGalleryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/parent/events/${id}`);
    if (!res.ok) { router.back(); return; }
    const d = await res.json();
    setGallery(d.gallery);
    setMedia(d.media ?? []);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, sans-serif' }}>
        <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  if (!gallery) return null;

  const readyMedia = media.filter(m => m.upload_status === 'ready');

  return (
    <div style={{ minHeight: '100vh', background: '#111827', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', paddingBottom: 80 }}>
      {/* Hero header */}
      <div style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', padding: '20px 16px 28px', position: 'relative' }}>
        <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '6px 12px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 14 }}>
          ← Back
        </button>
        <div style={{ fontSize: 30, marginBottom: 10 }}>{EVENT_ICONS[gallery.event_type] ?? '📷'}</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 6 }}>{gallery.title}</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
          {new Date(gallery.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          {' · '}
          {readyMedia.length > 0 ? `${readyMedia.length} photo${readyMedia.length !== 1 ? 's' : ''}` : 'No photos yet'}
        </div>
        {gallery.description && (
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 10, lineHeight: 1.5 }}>{gallery.description}</div>
        )}
      </div>

      {/* Photo grid */}
      <div style={{ padding: '16px 12px' }}>
        {readyMedia.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 16px', color: '#6B7280' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📷</div>
            <div style={{ fontWeight: 700, color: '#9CA3AF', marginBottom: 4 }}>No photos yet</div>
            <div style={{ fontSize: 13, color: '#6B7280' }}>Your school hasn't uploaded photos for this event yet.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
            {readyMedia.map((m, idx) => (
              <div key={m.id}
                onClick={() => setActiveIdx(idx)}
                style={{ aspectRatio: '1', background: 'linear-gradient(135deg, #EEF2FF, #E0E7FF)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 24, position: 'relative' }}>
                {m.media_type === 'video' ? '🎥' : '📷'}
                {m.caption && (
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.6))', padding: '10px 4px 4px', fontSize: 9, color: '#fff', borderRadius: '0 0 4px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.caption}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {gallery.allow_download && readyMedia.length > 0 && (
          <div style={{ marginTop: 20, padding: '12px 16px', background: '#1F2937', borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 6 }}>Photos can be downloaded individually</div>
            <div style={{ fontSize: 11, color: '#6B7280' }}>Tap a photo to view, then hold to save</div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {activeIdx !== null && (
        <div onClick={() => setActiveIdx(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: 20 }}>
          <div style={{ fontSize: 72, marginBottom: 16 }}>{readyMedia[activeIdx]?.media_type === 'video' ? '🎥' : '📷'}</div>
          {readyMedia[activeIdx]?.caption && (
            <div style={{ color: '#fff', fontSize: 14, textAlign: 'center', maxWidth: 300, lineHeight: 1.5 }}>{readyMedia[activeIdx].caption}</div>
          )}
          <div style={{ position: 'absolute', bottom: 40, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 32 }}>
            {activeIdx > 0 && (
              <button onClick={e => { e.stopPropagation(); setActiveIdx(activeIdx - 1); }}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10, padding: '10px 20px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                ‹ Prev
              </button>
            )}
            {activeIdx < readyMedia.length - 1 && (
              <button onClick={e => { e.stopPropagation(); setActiveIdx(activeIdx + 1); }}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10, padding: '10px 20px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                Next ›
              </button>
            )}
          </div>
          <button onClick={() => setActiveIdx(null)}
            style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 36, height: 36, color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
