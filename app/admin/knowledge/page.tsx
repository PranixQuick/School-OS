'use client';
// app/admin/knowledge/page.tsx
// Batch 5B — Knowledge base management + RAG query interface.

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface KnowledgeChunk {
  id: string; title: string; content: string; category: string;
  keywords: string[] | null; source_doc: string | null;
  updated_at: string; is_active: boolean;
}

interface RAGResult { answer: string; sources: { title: string; category: string }[]; question: string; }

const CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'admission', label: 'Admission' },
  { value: 'fee_structure', label: 'Fees' },
  { value: 'fees', label: 'Fees (legacy)' },
  { value: 'policy', label: 'Policy' },
  { value: 'academic', label: 'Academic' },
  { value: 'transport', label: 'Transport' },
  { value: 'medical', label: 'Medical' },
  { value: 'circular', label: 'Circulars' },
  { value: 'general', label: 'General' },
];

const CAT_COLOR: Record<string, string> = {
  admission: '#EEF2FF', fee_structure: '#FFF7ED', fees: '#FFF7ED',
  policy: '#F0FDF4', academic: '#EFF6FF', transport: '#FDF4FF',
  medical: '#FEF2F2', circular: '#FFFBEB', general: '#F9FAFB',
};

export default function KnowledgePage() {
  const [chunks, setChunks] = useState<KnowledgeChunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState('all');
  const [searchQ, setSearchQ] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ title: '', content: '', category: 'general', keywords: '', source_doc: '' });
  const [saving, setSaving] = useState(false);

  // RAG state
  const [question, setQuestion] = useState('');
  const [ragResult, setRagResult] = useState<RAGResult | null>(null);
  const [ragLoading, setRagLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterCat !== 'all') params.set('category', filterCat);
    if (searchQ) params.set('search', searchQ);
    const res = await fetch('/api/admin/knowledge?' + params.toString());
    const d = await res.json() as { chunks?: KnowledgeChunk[] };
    setChunks(d.chunks ?? []);
    setLoading(false);
  }, [filterCat, searchQ]);

  useEffect(() => { void load(); }, [load]);

  async function askQuestion() {
    if (!question.trim()) return;
    setRagLoading(true);
    setRagResult(null);
    const res = await fetch('/api/admin/knowledge/query', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    const d = await res.json() as RAGResult;
    setRagResult(d);
    setRagLoading(false);
  }

  async function saveChunk() {
    setSaving(true);
    const keywords = addForm.keywords ? addForm.keywords.split(',').map(k => k.trim()).filter(Boolean) : [];
    const res = await fetch('/api/admin/knowledge', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...addForm, keywords, source_doc: addForm.source_doc || null }),
    });
    if (res.ok) { setShowAdd(false); setAddForm({ title: '', content: '', category: 'general', keywords: '', source_doc: '' }); void load(); }
    setSaving(false);
  }

  async function deleteChunk(id: string) {
    await fetch(`/api/admin/knowledge/${id}`, { method: 'DELETE' });
    setChunks(prev => prev.filter(c => c.id !== id));
  }

  const cardStyle = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, marginBottom: 14 };
  const inputStyle = { width: '100%', padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' as const, marginTop: 3 };
  const labelStyle = { fontSize: 11, fontWeight: 700, color: '#6B7280' } as const;

  return (
    <Layout title="Knowledge Base" subtitle="School documents for AI-powered answers">

      {/* RAG query box */}
      <div style={{ ...cardStyle, background: '#F0F9FF', borderColor: '#BAE6FD' }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12, color: '#0369A1' }}>
          💬 Ask a question about your school
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void askQuestion(); }}
            placeholder='e.g. "What is the fee structure?" or "Transport routes?"'
            style={{ ...inputStyle, marginTop: 0, flex: 1 }}
          />
          <button onClick={() => void askQuestion()} disabled={ragLoading || !question.trim()}
            style={{ padding: '7px 16px', background: '#0369A1', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
            {ragLoading ? '⏳' : 'Ask →'}
          </button>
        </div>
        {ragResult && (
          <div style={{ marginTop: 14 }}>
            <div style={{ background: '#fff', borderRadius: 8, padding: '12px 16px', border: '1px solid #BAE6FD', fontSize: 13, lineHeight: 1.7, color: '#0C4A6E', whiteSpace: 'pre-wrap' }}>
              {ragResult.answer}
            </div>
            {ragResult.sources.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 11, color: '#6B7280' }}>
                Sources: {ragResult.sources.map(s => s.title).join(' · ')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add document + filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CATEGORIES.filter(c => c.value !== 'fees').map(c => (
            <button key={c.value} onClick={() => setFilterCat(c.value)}
              style={{ padding: '4px 12px', border: `1px solid ${filterCat === c.value ? '#4F46E5' : '#E5E7EB'}`, borderRadius: 20, fontSize: 11, fontWeight: filterCat === c.value ? 700 : 400, color: filterCat === c.value ? '#4F46E5' : '#6B7280', background: filterCat === c.value ? '#EEF2FF' : '#fff', cursor: 'pointer' }}>
              {c.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search…"
            style={{ padding: '5px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 12, width: 160 }} />
          <button onClick={() => setShowAdd(true)}
            style={{ padding: '6px 16px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            + Add Document
          </button>
        </div>
      </div>

      {/* Document list */}
      {loading ? (
        <div style={{ color: '#9CA3AF', textAlign: 'center', padding: 40 }}>Loading…</div>
      ) : chunks.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📚</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 8 }}>
            {searchQ || filterCat !== 'all' ? 'No documents match' : 'Add your first knowledge document'}
          </div>
          <div style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.7 }}>
            Examples: Fee structure, Admission policy, School rules, Transport routes
          </div>
          {!searchQ && filterCat === 'all' && (
            <button onClick={() => setShowAdd(true)} style={{ marginTop: 16, padding: '8px 20px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              + Add First Document
            </button>
          )}
        </div>
      ) : (
        <div>
          {chunks.map(c => (
            <div key={c.id} style={{ ...cardStyle, borderLeft: `3px solid ${CAT_COLOR[c.category] ? '#D1D5DB' : '#E5E7EB'}`, background: CAT_COLOR[c.category] ?? '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 5, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, fontWeight: 800, background: '#fff', padding: '2px 7px', borderRadius: 4, color: '#374151', border: '1px solid #E5E7EB' }}>
                      {c.category.replace('_', ' ').toUpperCase()}
                    </span>
                    {c.source_doc && <span style={{ fontSize: 9, color: '#9CA3AF' }}>{c.source_doc}</span>}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{c.title}</div>
                  <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {c.content}
                  </div>
                  {c.keywords?.length ? (
                    <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {c.keywords.slice(0, 5).map(k => (
                        <span key={k} style={{ fontSize: 9, background: '#EEF2FF', color: '#4F46E5', padding: '1px 5px', borderRadius: 3 }}>{k}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 10, color: '#9CA3AF' }}>{new Date(c.updated_at).toLocaleDateString('en-IN')}</span>
                  <button onClick={() => void deleteChunk(c.id)}
                    style={{ fontSize: 10, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>✕</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add document modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 520, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 18 }}>Add Knowledge Document</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><div style={labelStyle}>TITLE *</div>
                <input value={addForm.title} onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} placeholder="e.g. Annual Fee Structure 2025-26" /></div>
              <div><div style={labelStyle}>CATEGORY *</div>
                <select value={addForm.category} onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))} style={inputStyle}>
                  {CATEGORIES.filter(c => c.value !== 'all' && c.value !== 'fees').map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div><div style={labelStyle}>CONTENT *</div>
                <textarea value={addForm.content} onChange={e => setAddForm(f => ({ ...f, content: e.target.value }))}
                  rows={6} style={{ ...inputStyle, resize: 'vertical' }}
                  placeholder="Paste or type the document content here…" /></div>
              <div><div style={labelStyle}>KEYWORDS (comma-separated)</div>
                <input value={addForm.keywords} onChange={e => setAddForm(f => ({ ...f, keywords: e.target.value }))} style={inputStyle} placeholder="fees, tuition, 2025, cbse" /></div>
              <div><div style={labelStyle}>SOURCE DOCUMENT NAME</div>
                <input value={addForm.source_doc} onChange={e => setAddForm(f => ({ ...f, source_doc: e.target.value }))} style={inputStyle} placeholder="Fee Circular 2025-26.pdf" /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: '8px', background: '#F3F4F6', border: 'none', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => void saveChunk()} disabled={saving || !addForm.title || !addForm.content}
                style={{ flex: 2, padding: '8px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {saving ? 'Saving…' : 'Save Document'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
