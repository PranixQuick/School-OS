'use client';
// components/GlobalSearch.tsx
// ISS-2 (#2) — Role-scoped global search box for the shared admin Layout.
// Debounced query against /api/admin/search; grouped dropdown; click navigates.

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Hit { id: string; label: string; sub: string; href: string }

function ResultRow({ hit, onSelect }: { hit: Hit; onSelect: () => void }) {
  return (
    <button onClick={onSelect}
      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{hit.label}</div>
      <div style={{ fontSize: 11, color: '#6B7280' }}>{hit.sub}</div>
    </button>
  );
}

export default function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [students, setStudents] = useState<Hit[]>([]);
  const [staff, setStaff] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setStudents([]); setStaff([]); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/admin/search?q=${encodeURIComponent(term)}`)
        .then(r => r.ok ? r.json() : { students: [], staff: [] })
        .then((d: { students?: Hit[]; staff?: Hit[] }) => { setStudents(d.students ?? []); setStaff(d.staff ?? []); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  function go(href: string) { setOpen(false); setQ(''); setStudents([]); setStaff([]); router.push(href); }

  const hasResults = students.length > 0 || staff.length > 0;

  return (
    <div ref={boxRef} style={{ position: 'relative', flexShrink: 0 }}>
      <input
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search…"
        aria-label="Search students and staff"
        style={{ width: 150, padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', background: '#F9FAFB' }}
      />
      {open && q.trim().length >= 2 && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 280, maxHeight: 360, overflowY: 'auto', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 60 }}>
          {loading && !hasResults ? (
            <div style={{ padding: 12, fontSize: 13, color: '#9CA3AF' }}>Searching…</div>
          ) : !hasResults ? (
            <div style={{ padding: 12, fontSize: 13, color: '#9CA3AF' }}>No matches.</div>
          ) : (
            <>
              {students.length > 0 && (
                <div>
                  <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Students</div>
                  {students.map(h => <ResultRow key={'s' + h.id} hit={h} onSelect={() => go(h.href)} />)}
                </div>
              )}
              {staff.length > 0 && (
                <div>
                  <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Staff</div>
                  {staff.map(h => <ResultRow key={'t' + h.id} hit={h} onSelect={() => go(h.href)} />)}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
