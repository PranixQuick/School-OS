'use client';
import Layout from '@/components/Layout';
export default function LibrarianPage() {
  return (
    <Layout title="Library" subtitle="Book catalog, issuance and returns">
      <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 12, padding: 20, textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📚</div>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#4338CA', marginBottom: 8 }}>Library Module — Coming Soon</div>
        <div style={{ fontSize: 13, color: '#4338CA' }}>Book catalog, student issuance and return tracking will be available in the next release.</div>
      </div>
      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: '#374151', marginBottom: 8 }}>Planned features</div>
        {['Book catalog with ISBN search', 'Issue / Return tracking per student', 'Overdue alerts to parents via WhatsApp', 'Fine calculation and collection'].map(f => (
          <div key={f} style={{ fontSize: 13, color: '#6B7280', padding: '6px 0', borderBottom: '1px solid #F3F4F6' }}>✦ {f}</div>
        ))}
      </div>
    </Layout>
  );
}
