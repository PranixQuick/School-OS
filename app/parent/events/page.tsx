'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Gallery {
  id: string; title: string; description?: string;
  event_type: string; event_date: string;
  photo_count: number; video_count: number;
  featured_image_url?: string; allow_download: boolean;
}

const EVENT_ICONS: Record<string, string> = {
  annual_day: '🎭', sports_day: '🏃', farewell: '👋', science_fair: '🔬',
  cultural: '🎨', trip: '🚌', ptm: '👨‍👩‍👧', competition: '🏆',
  celebration: '🎉', seminar: '📚', general: '📷',
};

export default function ParentEventsPage() {
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/parent/events')
      .then(r => r.ok ? r.json() : { galleries: [] })
      .then(d => setGalleries(d.galleries ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#4F46E5', padding: '16px 16px 20px' }}>
        <Link href="/parent" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, textDecoration: 'none', display: 'block', marginBottom: 8 }}>← Back</Link>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>School Events</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>Photos from your child's school</div>
      </div>

      <div style={{ padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>Loading events...</div>
        ) : galleries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📸</div>
            <div style={{ fontWeight: 700, color: '#374151', marginBottom: 6 }}>No events shared yet</div>
            <div style={{ fontSize: 13, color: '#9CA3AF' }}>Your school hasn't shared any event photos yet. Check back after the next school event.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {galleries.map(g => (
              <Link key={g.id} href={`/parent/events/${g.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                  {/* Color banner */}
                  <div style={{ height: 120, background: 'linear-gradient(135deg, #EEF2FF, #E0E7FF)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: 52 }}>{EVENT_ICONS[g.event_type] ?? '📷'}</div>
                  </div>
                  <div style={{ padding: '14px 16px' }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: '#111827', marginBottom: 4 }}>{g.title}</div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>
                      {new Date(g.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                    {g.description && (
                      <div style={{ fontSize: 13, color: '#374151', marginTop: 6, lineHeight: 1.5 }}>{g.description}</div>
                    )}
                    <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ fontSize: 13, color: '#4F46E5', fontWeight: 600 }}>
                        {g.photo_count} photo{g.photo_count !== 1 ? 's' : ''}
                        {g.video_count > 0 && ` · ${g.video_count} videos`}
                      </div>
                      <div style={{ fontSize: 12, color: '#4F46E5', marginLeft: 'auto' }}>View →</div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
