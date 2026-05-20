'use client';
// app/anganwadi/beneficiaries/page.tsx
// Anganwadi beneficiary management.
// AWW manages pregnant women and lactating mothers.
// Mobile-first, Telugu UI, large touch targets.

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface Beneficiary {
  id: string; name: string; phone?: string; age_years?: number;
  beneficiary_type: string; trimester?: number;
  nutrition_status?: string; next_checkup_date?: string; status: string;
  husband_name?: string; edd_date?: string;
}

const TYPE_LABELS: Record<string, string> = {
  pregnant: 'గర్భిణీ మహిళ', lactating: 'బాలింత', adolescent_girl: 'కిశోరి'
};
const NUTR_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  normal:      { label: 'Normal',    color: '#15803D', bg: '#F0FDF4' },
  anaemic:     { label: 'Anaemic',   color: '#D97706', bg: '#FFF7ED' },
  malnourished:{ label: 'Malnourished', color: '#B91C1C', bg: '#FEF2F2' },
};

interface FormData {
  name: string; phone: string; age_years: string; beneficiary_type: string;
  trimester: string; husband_name: string; next_checkup_date: string;
  nutrition_status: string; address: string;
}
const BLANK: FormData = {
  name:'', phone:'', age_years:'', beneficiary_type:'pregnant', trimester:'2',
  husband_name:'', next_checkup_date:'', nutrition_status:'normal', address:'',
};

export default function AnganwadiBeneficiariesPage() {
  const [benes, setBenes]       = useState<Beneficiary[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState<FormData>(BLANK);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [filter, setFilter]     = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/anganwadi/beneficiaries');
      if (r.ok) { const d = await r.json() as { beneficiaries?: Beneficiary[] }; setBenes(d.beneficiaries ?? []); }
    } catch {/* ignore */}
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save() {
    if (!form.name.trim()) { alert('పేరు తప్పనిసరి'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/anganwadi/beneficiaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          age_years: form.age_years ? parseInt(form.age_years) : null,
          trimester: form.beneficiary_type === 'pregnant' ? parseInt(form.trimester || '1') : null,
        }),
      });
      if (res.ok) {
        setSaved(true); setForm(BLANK); setShowForm(false);
        setTimeout(() => setSaved(false), 3000);
        await load();
      } else {
        const d = await res.json() as { error?: string };
        alert(d.error ?? 'Save failed');
      }
    } catch { alert('Network error'); }
    setSaving(false);
  }

  async function updateCheckup(id: string, date: string) {
    await fetch(`/api/anganwadi/beneficiaries/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ next_checkup_date: date }),
    });
    await load();
  }

  const visible = filter === 'all' ? benes : benes.filter(b => b.beneficiary_type === filter);
  const active  = benes.filter(b => b.status === 'active');
  const pregnant = active.filter(b => b.beneficiary_type === 'pregnant');
  const dueSoon = benes.filter(b => {
    if (!b.next_checkup_date) return false;
    const diff = (new Date(b.next_checkup_date).getTime() - Date.now()) / (1000*60*60*24);
    return diff >= 0 && diff <= 3;
  });

  const inp = { width:'100%', height:46, fontSize:15, borderRadius:10, border:'1px solid #D1D5DB', padding:'0 14px', outline:'none', fontFamily:'inherit', boxSizing:'border-box' as const, background:'#F9FAFB' };
  const lbl = { fontSize:13, fontWeight:700 as const, color:'#374151', display:'block' as const, marginBottom:6 };

  return (
    <Layout title="గ్రహీత నిర్వహణ" subtitle="Beneficiary Management">
      {saved && (
        <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:10, padding:'12px 16px', marginBottom:14, fontSize:14, fontWeight:600, color:'#15803D' }}>
          ✅ సేవ్ అయింది!
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16 }}>
        {[
          { label:'మొత్తం', value:active.length, color:'#4F46E5' },
          { label:'గర్భిణీ', value:pregnant.length, color:'#BE185D' },
          { label:'చెక్అప్ రేపు', value:dueSoon.length, color:dueSoon.length > 0 ? '#B91C1C' : '#15803D' },
        ].map(c => (
          <div key={c.label} style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:12, padding:'12px 10px', textAlign:'center' }}>
            <div style={{ fontSize:22, fontWeight:800, color:c.color }}>{c.value}</div>
            <div style={{ fontSize:11, color:'#6B7280', marginTop:2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Add button + filter */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        <button onClick={() => setShowForm(true)}
          style={{ padding:'9px 16px', background:'#BE185D', color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          + కొత్త గ్రహీత
        </button>
        {['all','pregnant','lactating'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding:'7px 12px', background:filter===f ? '#111827' : '#F3F4F6', color:filter===f ? '#fff' : '#374151', border:'none', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
            {f === 'all' ? 'అందరూ' : TYPE_LABELS[f] ?? f}
          </button>
        ))}
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:14, padding:18, marginBottom:16 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#111827', marginBottom:14 }}>కొత్త గ్రహీత నమోదు</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            <div>
              <label style={lbl}>పేరు *</label>
              <input value={form.name} onChange={e => setForm(f => ({...f, name:e.target.value}))}
                placeholder="సావిత్రమ్మ" style={inp} />
            </div>
            <div>
              <label style={lbl}>ఫోన్</label>
              <input type="tel" value={form.phone} onChange={e => setForm(f => ({...f, phone:e.target.value}))}
                placeholder="+91 XXXXXXXXXX" style={inp} />
            </div>
            <div>
              <label style={lbl}>రకం</label>
              <select value={form.beneficiary_type} onChange={e => setForm(f => ({...f, beneficiary_type:e.target.value}))} style={{...inp, height:46}}>
                <option value="pregnant">గర్భిణీ</option>
                <option value="lactating">బాలింత</option>
                <option value="adolescent_girl">కిశోరి</option>
              </select>
            </div>
            {form.beneficiary_type === 'pregnant' && (
              <div>
                <label style={lbl}>త్రైమాసికం</label>
                <select value={form.trimester} onChange={e => setForm(f => ({...f, trimester:e.target.value}))} style={{...inp, height:46}}>
                  <option value="1">1వ త్రైమాసికం (1-3 నెలలు)</option>
                  <option value="2">2వ త్రైమాసికం (4-6 నెలలు)</option>
                  <option value="3">3వ త్రైమాసికం (7-9 నెలలు)</option>
                </select>
              </div>
            )}
            <div>
              <label style={lbl}>పోషణ స్థితి</label>
              <select value={form.nutrition_status} onChange={e => setForm(f => ({...f, nutrition_status:e.target.value}))} style={{...inp, height:46}}>
                <option value="normal">Normal</option>
                <option value="anaemic">Anaemic</option>
                <option value="malnourished">Malnourished</option>
              </select>
            </div>
            <div>
              <label style={lbl}>తదుపరి తనిఖీ తేదీ</label>
              <input type="date" value={form.next_checkup_date}
                onChange={e => setForm(f => ({...f, next_checkup_date:e.target.value}))} style={inp} />
            </div>
          </div>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <button onClick={() => setShowForm(false)} style={{ padding:'8px 16px', background:'#F3F4F6', border:'none', borderRadius:8, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
            <button onClick={() => void save()} disabled={saving}
              style={{ padding:'8px 18px', background:saving ? '#9CA3AF' : '#BE185D', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:saving ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}>
              {saving ? 'సేవ్…' : '💾 సేవ్ చేయి'}
            </button>
          </div>
        </div>
      )}

      {/* Beneficiary list */}
      {loading ? (
        <div style={{ padding:20, textAlign:'center', color:'#9CA3AF' }}>Loading…</div>
      ) : visible.length === 0 ? (
        <div style={{ padding:32, textAlign:'center', color:'#9CA3AF', fontSize:13 }}>
          గ్రహీతలు ఎవరూ లేరు. &apos;+ కొత్త గ్రహీత&apos; నొక్కండి.
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {visible.map(b => {
            const nutr = NUTR_STATUS[b.nutrition_status ?? 'normal'];
            const isDueSoon = b.next_checkup_date && (new Date(b.next_checkup_date).getTime() - Date.now()) / (1000*60*60*24) <= 3;
            return (
              <div key={b.id} style={{ background:'#fff', border:`1px solid ${isDueSoon ? '#FECACA' : '#E5E7EB'}`, borderRadius:14, padding:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:'#111827' }}>{b.name}</div>
                    <div style={{ fontSize:12, color:'#6B7280', marginTop:2 }}>
                      {TYPE_LABELS[b.beneficiary_type] ?? b.beneficiary_type}
                      {b.trimester ? ` · ${b.trimester}వ త్రైమాసికం` : ''}
                      {b.phone ? ` · ${b.phone}` : ''}
                    </div>
                  </div>
                  <span style={{ padding:'3px 10px', borderRadius:8, fontSize:11, fontWeight:700, background:nutr.bg, color:nutr.color }}>
                    {nutr.label}
                  </span>
                </div>
                {b.next_checkup_date && (
                  <div style={{ fontSize:12, color:isDueSoon ? '#B91C1C' : '#6B7280', fontWeight:isDueSoon ? 700 : 400 }}>
                    {isDueSoon ? '⚠️ ' : ''}తదుపరి తనిఖీ: {new Date(b.next_checkup_date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
