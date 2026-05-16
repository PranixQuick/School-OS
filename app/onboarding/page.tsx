'use client';
// PATH: app/onboarding/page.tsx
// Item: Institution Onboarding Wizard
// 7-step state machine. Each step saves independently; wizard can be resumed.
// CSV parsing uses papaparse (already in project via npm).
// No new dependencies.
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// ─── Types ───────────────────────────────────────────────────────────────────
interface ClassRow { grade: string; sections: string }
interface BatchRow { label: string; entry_year: string; capacity: string }
interface GroupRow { code: string; name: string }
interface StaffRow { name: string; role: string; email: string; phone: string }
interface FeeDefault { fee_type: string; amount: string; due_date: string; class: string }
interface StudentRow { student_name: string; class: string; section: string; parent_name: string; parent_phone: string; parent_email: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────
const STEP_LABELS = ['Profile','Classes','Staff','Fees','Razorpay','Students','Activate'];
// K1: Dynamic step 2 label based on institution type
function getStep2Label(t: string): string {
  if (isCoaching(t)) return 'Batches';
  if (isCollege(t)) return 'Departments';
  return 'Classes';
}
const ROLES = ['teacher','admin','principal','counsellor'];

// K1: Institution type helpers for wizard branching
function isCoaching(t: string) { return t === 'coaching'; }
function isCollege(t: string) { return ['junior_college','degree_college','engineering','mba','medical','polytechnic'].includes(t); }
function isGovt(t: string) { return ['govt_school','govt_aided_school','welfare_school','anganwadi'].includes(t); }

async function post(path: string, body: unknown) {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { ok: res.ok, data: await res.json() };
}

function parseCSV(text: string): Record<string,string>[] {
  const lines = text.trim().split('\n').map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g,'')));
  if (lines.length < 2) return [];
  const headers = lines[0].map(h => h.toLowerCase().replace(/\s+/g,'_'));
  return lines.slice(1).map(row => Object.fromEntries(headers.map((h,i) => [h, row[i] ?? ''])));
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [stepError, setStepError] = useState<string|null>(null);
  const [stepSuccess, setStepSuccess] = useState<string|null>(null);

  // Step 1: Profile
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [board, setBoard] = useState('');
  const [instType, setInstType] = useState('school_k10');
  const [ownerType, setOwnerType] = useState('private');
  const [phone, setPhone] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  // PR-2: GPS geofence for K6 bus arrival detection.
  // Stored as schools.lat / schools.lng (decimal degrees, WGS84).
  // Both required together OR both empty. Existing school_geofences polygon
  // table is left as an advanced-override path for power users.
  const [schoolLat, setSchoolLat] = useState('');
  const [schoolLng, setSchoolLng] = useState('');
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  // Note: not a React hook — regular handler. Avoids react-hooks/rules-of-hooks false positive.
  function fetchCurrentLocation() {
    setGeoError(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError('Geolocation is not supported by this browser. Please enter lat/lng manually or use Google Maps.');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setSchoolLat(pos.coords.latitude.toFixed(6));
        setSchoolLng(pos.coords.longitude.toFixed(6));
        setGeoLoading(false);
      },
      err => {
        setGeoError(
          err.code === 1 ? 'Location permission denied. Please grant access or enter manually.' :
          err.code === 2 ? 'Location unavailable. Try moving outdoors or enter manually.' :
          err.code === 3 ? 'Location request timed out. Try again or enter manually.' :
          'Could not get current location.'
        );
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  // Step 2: Classes
  const [classes, setClasses] = useState<ClassRow[]>([{ grade: '', sections: 'A' }]);
  const [batches, setBatches] = useState<BatchRow[]>([{ label: '', entry_year: String(new Date().getFullYear() + 1), capacity: '60' }]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>(['MPC', 'BiPC']);

  // Step 3: Staff
  const [staffList, setStaffList] = useState<StaffRow[]>([{ name: '', role: 'teacher', email: '', phone: '' }]);
  const [staffCsvText, setStaffCsvText] = useState('');
  const staffFileRef = useRef<HTMLInputElement>(null);

  // Step 4: Fees
  const [feeDefaults, setFeeDefaults] = useState<FeeDefault[]>([{ fee_type: 'tuition', amount: '', due_date: '', class: '' }]);

  // Item #3 DPDP: legal acceptance state for Step 7
  interface LegalDoc { id: string; doc_type: string; title: string; content_url: string; accepted: boolean; accepted_at: string|null; }
  const [legalDocs, setLegalDocs] = useState<LegalDoc[]>([]);
  const [legalDocsLoading, setLegalDocsLoading] = useState(false);
  const [legalChecked, setLegalChecked] = useState<Record<string,boolean>>({});
  const allLegalChecked = legalDocs.length > 0 && legalDocs.every(d => d.accepted || legalChecked[d.id]);

  // Step 5: Razorpay
  const [rzpKeyId, setRzpKeyId] = useState('');
  const [rzpKeySecret, setRzpKeySecret] = useState('');
  const [onlinePayment, setOnlinePayment] = useState(false);

  // Step 6: Students
  const [studentRows, setStudentRows] = useState<StudentRow[]>([]);
  const [studentCsvText, setStudentCsvText] = useState('');
  const studentFileRef = useRef<HTMLInputElement>(null);

  const cardStyle = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16 };
  const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: 13, boxSizing: 'border-box' as const };
  const labelStyle = { fontSize: 11, fontWeight: 600 as const, color: '#6B7280', marginBottom: 4, display: 'block' as const };
  const btnPrimary = { padding: '10px 20px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700 as const, cursor: 'pointer' };
  const btnSecondary = { padding: '10px 20px', background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600 as const, cursor: 'pointer' };

  useEffect(() => {
    if (step === 7 && legalDocs.length === 0) {
      setLegalDocsLoading(true);
      fetch('/api/admin/legal/documents').then(async r => {
        if (r.ok) {
          const d = await r.json();
          setLegalDocs(d.documents ?? []);
          // Pre-check already-accepted docs
          const pre: Record<string,boolean> = {};
          for (const doc of (d.documents ?? [])) if (doc.accepted) pre[doc.id] = true;
          setLegalChecked(pre);
        }
      }).finally(() => setLegalDocsLoading(false));
    }
  }, [step]);

  async function saveStep() {
    setSaving(true); setStepError(null); setStepSuccess(null);
    try {
      let result;
      if (step === 1) {
        result = await post('/api/admin/onboarding/1-profile', { name, address, board, institution_type: instType, ownership_type: ownerType, phone, logo_url: logoUrl, lat: schoolLat || null, lng: schoolLng || null });
      } else if (step === 2) {
        // K2: coaching uses 2-batches, others use 2-classes
        if (isCoaching(instType)) {
          const batchList = batches.filter(b => b.label.trim()).map(b => ({ label: b.label.trim(), entry_year: parseInt(b.entry_year) || new Date().getFullYear() + 1, capacity: parseInt(b.capacity) || null }));
          result = await post('/api/admin/onboarding/2-batches', { batches: batchList });
        } else if (isCollege(instType)) {
          // K5: create group batches for junior college
          const groupBatches = selectedGroups.map(code => ({ label: code, entry_year: new Date().getFullYear() + 1, group_code: code }));
          result = await post('/api/admin/onboarding/2-batches', { batches: groupBatches });
        } else {
          const parsed = classes.filter(c => c.grade.trim()).map(c => ({ grade: c.grade.trim(), sections: c.sections.split(',').map(s => s.trim()).filter(Boolean) }));
          result = await post('/api/admin/onboarding/2-classes', { classes: parsed });
        }
      } else if (step === 3) {
        const staff = staffCsvText.trim() ? parseCSV(staffCsvText).map(r => ({ name: r.name??'', role: r.role??'teacher', email: r.email??'', phone: r.phone??'' })) : staffList.filter(s => s.name.trim());
        result = await post('/api/admin/onboarding/3-staff', { staff });
      } else if (step === 4) {
        const fees = feeDefaults.filter(f => f.fee_type && f.amount && f.due_date).map(f => ({ fee_type: f.fee_type, amount: parseFloat(f.amount), due_date: f.due_date, ...(f.class ? { class: f.class } : {}) }));
        result = await post('/api/admin/onboarding/4-fee-defaults', { fee_defaults: fees });
      } else if (step === 5) {
        // K1: Skip Razorpay for govt schools
        if (isGovt(instType)) {
          setStep(s => s + 1); setSaving(false); return;
        }
        result = await post('/api/admin/onboarding/5-razorpay', { razorpay_key_id: rzpKeyId, razorpay_key_secret: rzpKeySecret, online_payment_enabled: onlinePayment });
      } else if (step === 6) {
        const students = studentCsvText.trim()
          ? parseCSV(studentCsvText).map(r => ({ student_name: r.student_name??r.name??'', class: r.class??'', section: r.section??'A', parent_name: r.parent_name??'', parent_phone: r.parent_phone??r.phone??'', parent_email: r.parent_email??r.email??'' }))
          : studentRows.filter(r => r.student_name.trim());
        result = await post('/api/admin/onboarding/6-students', { students });
      } else if (step === 7) {
        // DPDP: accept any unchecked docs first
        const unaccepted = legalDocs.filter(d => !d.accepted && legalChecked[d.id]).map(d => d.id);
        if (unaccepted.length > 0) {
          const acceptRes = await post('/api/admin/legal/accept', { doc_type_ids: unaccepted });
          if (!acceptRes.ok) { setStepError(acceptRes.data?.error ?? 'Legal acceptance failed'); setSaving(false); return; }
        }
        result = await post('/api/admin/onboarding/7-activate', {});
        if (result.ok) { router.push('/dashboard'); return; }
      }
      if (!result?.ok) { setStepError(result?.data?.error ?? 'Save failed'); return; }
      setStepSuccess('Saved ✓');
      if (step < 7) setTimeout(() => { setStepSuccess(null); setStep(s => s + 1); }, 600);
    } catch(e) { setStepError(String(e)); }
    finally { setSaving(false); }
  }

  // ── Step renders ────────────────────────────────────────────────────────────
  function renderStep() {
    if (step === 1) return (
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <div><label style={labelStyle}>School Name *</label><input style={inputStyle} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Suchitra Academy" /></div>
        <div><label style={labelStyle}>Address</label><input style={inputStyle} value={address} onChange={e=>setAddress(e.target.value)} placeholder="Full address" /></div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div><label style={labelStyle}>Board</label><input style={inputStyle} value={board} onChange={e=>setBoard(e.target.value)} placeholder="CBSE / ICSE / State" /></div>
          <div><label style={labelStyle}>Institution Type</label>
            <select style={inputStyle} value={instType} onChange={e=>setInstType(e.target.value)}>
              {[
                {value:'school_k10',label:'School - Classes 1 to 10 (CBSE/ICSE/State)'},
                {value:'school_k12',label:'School - Classes 1 to 12'},
                {value:'govt_school',label:'Government School'},
                {value:'govt_aided_school',label:'Aided School'},
                {value:'junior_college',label:'Junior College (11-12)'},
                {value:'degree_college',label:'Degree College'},
                {value:'coaching',label:'Coaching / Tuition Centre'},
                {value:'engineering',label:'Engineering College'},
                {value:'mba',label:'MBA / Business School'},
                {value:'medical',label:'Medical College'},
                {value:'vocational',label:'Vocational / ITI'},
                {value:'polytechnic',label:'Polytechnic'},
                {value:'anganwadi',label:'Anganwadi / Preschool'},
                {value:'welfare_school',label:'Welfare / Residential School'},
              ].map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div><label style={labelStyle}>Ownership Type</label>
            <select style={inputStyle} value={ownerType} onChange={e=>setOwnerType(e.target.value)}>
              {['private','government','aided','franchise'].map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+91 9XXXXXXXXX" /></div>
          <div><label style={labelStyle}>Logo URL</label><input style={inputStyle} value={logoUrl} onChange={e=>setLogoUrl(e.target.value)} placeholder="https://..." /></div>
        </div>
        {/* PR-2: School location for GPS geofence (optional, can be set later in Settings) */}
        <div style={{ marginTop: 6, padding: 12, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#065F46', marginBottom: 4 }}>📍 School Location (for Bus GPS)</div>
          <div style={{ fontSize: 11, color: '#374151', marginBottom: 10, lineHeight: 1.5 }}>
            Used to detect when school buses are arriving. Optional — you can set this later in Settings.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={labelStyle}>Latitude</label>
              <input style={inputStyle} value={schoolLat}
                onChange={e => { setSchoolLat(e.target.value); setGeoError(null); }}
                placeholder="17.385044" inputMode="decimal" />
            </div>
            <div>
              <label style={labelStyle}>Longitude</label>
              <input style={inputStyle} value={schoolLng}
                onChange={e => { setSchoolLng(e.target.value); setGeoError(null); }}
                placeholder="78.486671" inputMode="decimal" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => fetchCurrentLocation()} disabled={geoLoading}
              style={{ flex: '1 1 auto', padding: '8px 12px', background: geoLoading ? '#9CA3AF' : '#065F46', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: geoLoading ? 'wait' : 'pointer' }}>
              {geoLoading ? 'Getting location…' : '📍 Use Current Location'}
            </button>
            <a href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer"
              style={{ flex: '1 1 auto', padding: '8px 12px', background: '#fff', color: '#065F46', border: '1px solid #065F46', borderRadius: 6, fontSize: 11, fontWeight: 600, textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}>
              🗺️ Open Google Maps
            </a>
          </div>
          {geoError && <div style={{ marginTop: 8, padding: '6px 10px', background: '#FEE2E2', color: '#991B1B', borderRadius: 5, fontSize: 11 }}>{geoError}</div>}
          <div style={{ marginTop: 8, fontSize: 10, color: '#6B7280', lineHeight: 1.5 }}>
            <strong>Tip:</strong> On Google Maps, right-click your school&apos;s exact location → click the coordinates that appear (e.g. <code>17.385044, 78.486671</code>) to copy → paste into the fields above.
          </div>
        </div>
      </div>
    );

    // K1: Branch step 2 by institution type
    if (step === 2 && isCoaching(instType)) return (
      <div>
        <div style={{ fontSize:13, fontWeight:600, color:'#374151', marginBottom:8 }}>Add Batches</div>
        <div style={{ fontSize:12, color:'#6B7280', marginBottom:12 }}>Add batches (e.g. JEE 2027 Morning, NEET 2027 Evening). You can add more after setup.</div>
        {batches.map((b, i) => (
          <div key={i} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr auto', gap:8, marginBottom:8, alignItems:'center' }}>
            <input
              placeholder='Batch name (e.g. JEE 2027 Morning)'
              style={inputStyle}
              value={b.label}
              onChange={e => setBatches(prev => prev.map((x,j) => j===i ? {...x, label: e.target.value} : x))}
            />
            <input
              type='number'
              placeholder='Year'
              style={inputStyle}
              value={b.entry_year}
              onChange={e => setBatches(prev => prev.map((x,j) => j===i ? {...x, entry_year: e.target.value} : x))}
            />
            <input
              type='number'
              placeholder='Capacity'
              style={inputStyle}
              value={b.capacity}
              onChange={e => setBatches(prev => prev.map((x,j) => j===i ? {...x, capacity: e.target.value} : x))}
            />
            <button
              onClick={() => setBatches(prev => prev.filter((_,j) => j !== i))}
              style={{ padding:'8px 12px', background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:6, color:'#B91C1C', cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}
            >×</button>
          </div>
        ))}
        <button
          onClick={() => setBatches(prev => [...prev, { label: '', entry_year: String(new Date().getFullYear() + 1), capacity: '60' }])}
          style={{ padding:'8px 16px', background:'#F9FAFB', border:'1px solid #D1D5DB', borderRadius:6, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}
        >+ Add Batch</button>
      </div>
    );

    if (step === 2 && isCollege(instType)) return (
      <div>
        <div style={{ fontSize:13, fontWeight:600, color:'#374151', marginBottom:8 }}>Add Groups</div>
        <div style={{ fontSize:12, color:'#6B7280', marginBottom:12 }}>Select the groups offered at your institution. Each group creates a batch students can be enrolled into.</div>
        {[['MPC','Maths, Physics, Chemistry'],['BiPC','Biology, Physics, Chemistry'],['CEC','Commerce, Economics, Civics'],['MEC','Maths, Economics, Commerce'],['HEC','History, Economics, Civics']].map(([code,label]) => (
          <label key={code} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', marginBottom:6, background: selectedGroups.includes(code) ? '#EEF2FF' : '#F9FAFB', border:`1px solid ${selectedGroups.includes(code) ? '#A5B4FC' : '#E5E7EB'}`, borderRadius:8, cursor:'pointer' }}>
            <input type='checkbox' checked={selectedGroups.includes(code)}
              onChange={e => setSelectedGroups(prev => e.target.checked ? [...prev, code] : prev.filter(g => g !== code))}
              style={{ width:16, height:16, cursor:'pointer' }} />
            <div><div style={{ fontWeight:700, fontSize:13 }}>{code}</div><div style={{ fontSize:11, color:'#6B7280' }}>{label}</div></div>
          </label>
        ))}
      </div>
    );

    if (step === 2) return (
      <div>
        <div style={{ fontSize:12, color:'#6B7280', marginBottom:12 }}>Add each grade and its sections (comma-separated). E.g. Grade 5 with sections A,B,C.</div>
        {classes.map((c,i)=>(
          <div key={i} style={{ display:'flex', gap:8, marginBottom:8, alignItems:'center' }}>
            <input style={{ ...inputStyle, width:80 }} value={c.grade} onChange={e=>setClasses(cl=>{const n=[...cl]; n[i]={...n[i],grade:e.target.value}; return n;})} placeholder="Grade" />
            <input style={{ ...inputStyle, flex:1 }} value={c.sections} onChange={e=>setClasses(cl=>{const n=[...cl]; n[i]={...n[i],sections:e.target.value}; return n;})} placeholder="A,B,C" />
            <button onClick={()=>setClasses(cl=>cl.filter((_,j)=>j!==i))} style={{ background:'none', border:'none', color:'#991B1B', cursor:'pointer', fontSize:16 }}>×</button>
          </div>
        ))}
        <button onClick={()=>setClasses(c=>[...c,{grade:'',sections:'A'}])} style={{ ...btnSecondary, marginTop:4, fontSize:12 }}>+ Add Grade</button>
      </div>
    );

    if (step === 3) return (
      <div>
        <div style={{ fontSize:12, color:'#6B7280', marginBottom:10 }}>Upload a CSV (name, role, email, phone) or add staff manually.</div>
        <div style={{ marginBottom:12 }}>
          <label style={labelStyle}>CSV Upload (optional)</label>
          <input ref={staffFileRef} type="file" accept=".csv" style={{ fontSize:12 }}
            onChange={e=>{ const f=e.target.files?.[0]; if(f){ const r=new FileReader(); r.onload=ev=>setStaffCsvText(ev.target?.result as string); r.readAsText(f); }}} />
          {staffCsvText && <div style={{ fontSize:11, color:'#065F46', marginTop:4 }}>CSV loaded: {parseCSV(staffCsvText).length} rows</div>}
        </div>
        {!staffCsvText && (<>
          {staffList.map((s,i)=>(
            <div key={i} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 2fr 2fr auto', gap:6, marginBottom:6 }}>
              <input style={inputStyle} value={s.name} onChange={e=>setStaffList(l=>{const n=[...l]; n[i]={...n[i],name:e.target.value}; return n;})} placeholder="Name" />
              <select style={inputStyle} value={s.role} onChange={e=>setStaffList(l=>{const n=[...l]; n[i]={...n[i],role:e.target.value}; return n;})}>
                {ROLES.map(r=><option key={r} value={r}>{r}</option>)}
              </select>
              <input style={inputStyle} value={s.email} onChange={e=>setStaffList(l=>{const n=[...l]; n[i]={...n[i],email:e.target.value}; return n;})} placeholder="email" />
              <input style={inputStyle} value={s.phone} onChange={e=>setStaffList(l=>{const n=[...l]; n[i]={...n[i],phone:e.target.value}; return n;})} placeholder="phone" />
              <button onClick={()=>setStaffList(l=>l.filter((_,j)=>j!==i))} style={{ background:'none', border:'none', color:'#991B1B', cursor:'pointer' }}>×</button>
            </div>
          ))}
          <button onClick={()=>setStaffList(l=>[...l,{name:'',role:'teacher',email:'',phone:''}])} style={{ ...btnSecondary, fontSize:12 }}>+ Add Staff</button>
        </>)}
      </div>
    );

    if (step === 4) return (
      <div>
        <div style={{ fontSize:12, color:'#6B7280', marginBottom:10 }}>Optional. Set default fee amounts per type. Leave blank to skip.</div>
        {feeDefaults.map((f,i)=>(
          <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr auto', gap:6, marginBottom:6 }}>
            <input style={inputStyle} value={f.fee_type} onChange={e=>setFeeDefaults(d=>{const n=[...d]; n[i]={...n[i],fee_type:e.target.value}; return n;})} placeholder="tuition" />
            <input style={inputStyle} type="number" value={f.amount} onChange={e=>setFeeDefaults(d=>{const n=[...d]; n[i]={...n[i],amount:e.target.value}; return n;})} placeholder="Amount ₹" />
            <input style={inputStyle} type="date" value={f.due_date} onChange={e=>setFeeDefaults(d=>{const n=[...d]; n[i]={...n[i],due_date:e.target.value}; return n;})} />
            <input style={inputStyle} value={f.class} onChange={e=>setFeeDefaults(d=>{const n=[...d]; n[i]={...n[i],class:e.target.value}; return n;})} placeholder="Class (optional)" />
            <button onClick={()=>setFeeDefaults(d=>d.filter((_,j)=>j!==i))} style={{ background:'none', border:'none', color:'#991B1B', cursor:'pointer' }}>×</button>
          </div>
        ))}
        <button onClick={()=>setFeeDefaults(d=>[...d,{fee_type:'',amount:'',due_date:'',class:''}])} style={{ ...btnSecondary, fontSize:12 }}>+ Add Fee Type</button>
      </div>
    );

    if (step === 5) return (
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {isGovt(instType) && (
          <div style={{ background:'#ECFDF5', border:'1px solid #BBF7D0', borderRadius:8, padding:'12px 14px', fontSize:13 }}>
            <strong>Government school:</strong> Online payments and Razorpay are not applicable. Click <strong>Next</strong> to continue.
          </div>
        )}
        {!isGovt(instType) && <div style={{ background:'#EFF6FF', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#1E40AF' }}>Razorpay credentials are stored securely in your institution settings. Leave blank to skip online payments.</div>}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid #F3F4F6' }}>
          <span style={{ fontWeight:600, fontSize:13 }}>Enable Online Payments</span>
          <button onClick={()=>setOnlinePayment(v=>!v)}
            style={{ padding:'4px 12px', background: onlinePayment ? '#065F46' : '#E5E7EB', color: onlinePayment ? '#fff' : '#374151', border:'none', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer' }}>
            {onlinePayment ? 'ON' : 'OFF'}
          </button>
        </div>
        {onlinePayment && (<>
          <div><label style={labelStyle}>Razorpay Key ID</label><input style={inputStyle} value={rzpKeyId} onChange={e=>setRzpKeyId(e.target.value)} placeholder="rzp_live_..." /></div>
          <div><label style={labelStyle}>Razorpay Key Secret</label><input style={{ ...inputStyle, WebkitTextSecurity:'disc' } as React.CSSProperties} value={rzpKeySecret} onChange={e=>setRzpKeySecret(e.target.value)} placeholder="••••••••••••••••" /></div>
        </>)}
      </div>
    );

    if (step === 6) return (
      <div>
        <div style={{ fontSize:12, color:'#6B7280', marginBottom:10 }}>Upload a CSV or add students manually. CSV columns: student_name, class, section, parent_name, parent_phone, parent_email</div>
        <div style={{ marginBottom:12 }}>
          <label style={labelStyle}>CSV Upload</label>
          <input ref={studentFileRef} type="file" accept=".csv" style={{ fontSize:12 }}
            onChange={e=>{ const f=e.target.files?.[0]; if(f){ const r=new FileReader(); r.onload=ev=>{ const txt=ev.target?.result as string; setStudentCsvText(txt); const rows=parseCSV(txt); setStudentRows(rows as unknown as StudentRow[]); }; r.readAsText(f); }}} />
          {studentRows.length > 0 && <div style={{ fontSize:11, color:'#065F46', marginTop:4 }}>{studentRows.length} student{studentRows.length!==1?'s':''} parsed from CSV</div>}
        </div>
        {studentRows.length > 0 && (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', fontSize:11, borderCollapse:'collapse' }}>
              <thead><tr style={{ background:'#F9FAFB' }}>{['Name','Class','Section','Parent','Phone'].map(h=><th key={h} style={{ padding:'6px 8px', textAlign:'left', color:'#6B7280' }}>{h}</th>)}</tr></thead>
              <tbody>{studentRows.slice(0,5).map((r,i)=><tr key={i} style={{ borderBottom:'1px solid #F3F4F6' }}><td style={{padding:'5px 8px'}}>{r.student_name}</td><td style={{padding:'5px 8px'}}>{r.class}</td><td style={{padding:'5px 8px'}}>{r.section}</td><td style={{padding:'5px 8px'}}>{r.parent_name}</td><td style={{padding:'5px 8px'}}>{r.parent_phone}</td></tr>)}</tbody>
            </table>
            {studentRows.length > 5 && <div style={{ fontSize:11, color:'#9CA3AF', padding:'4px 8px' }}>…and {studentRows.length-5} more</div>}
          </div>
        )}
        {!studentCsvText && (
          <button onClick={()=>setStudentRows(r=>[...r,{student_name:'',class:'',section:'A',parent_name:'',parent_phone:'',parent_email:''}])} style={{ ...btnSecondary, fontSize:12 }}>+ Add Student</button>
        )}
      </div>
    );

    if (step === 7) return (
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:8, padding:'14px 16px' }}>
          <div style={{ fontWeight:700, fontSize:15, color:'#065F46', marginBottom:8 }}>Review + Legal Acceptance</div>
          <div style={{ fontSize:13, color:'#374151' }}>Your school profile, classes, staff, and students are configured.<br />Please review and accept the legal documents below before activating.</div>
        </div>
        {/* Legal acceptance checklist */}
        <div style={{ border:'1px solid #E5E7EB', borderRadius:8, overflow:'hidden' }}>
          <div style={{ padding:'10px 14px', background:'#F9FAFB', fontSize:11, fontWeight:700, color:'#6B7280', borderBottom:'1px solid #E5E7EB' }}>LEGAL DOCUMENTS (DPDP COMPLIANCE)</div>
          {legalDocsLoading ? <div style={{ padding:16, color:'#6B7280', fontSize:12 }}>Loading documents...</div> : (
            <div>
              {legalDocs.map(doc => (
                <div key={doc.id} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 14px', borderBottom:'1px solid #F3F4F6' }}>
                  {doc.accepted ? (
                    <span style={{ fontSize:16, marginTop:1 }}>✅</span>
                  ) : (
                    <input type="checkbox" checked={!!legalChecked[doc.id]} onChange={e => setLegalChecked(prev => ({ ...prev, [doc.id]: e.target.checked }))}
                      style={{ marginTop:3, flexShrink:0, width:15, height:15 }} />
                  )}
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600 }}>{doc.title}</div>
                    {doc.accepted && doc.accepted_at ? (
                      <div style={{ fontSize:10, color:'#065F46', marginTop:1 }}>Accepted {new Date(doc.accepted_at).toLocaleDateString('en-IN')}</div>
                    ) : (
                      <a href={doc.content_url} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize:10, color:'#4F46E5', textDecoration:'none' }}>Read document ↗</a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {!allLegalChecked && legalDocs.length > 0 && (
          <div style={{ fontSize:11, color:'#991B1B', textAlign:'center' }}>Please read and accept all legal documents to proceed.</div>
        )}
        {/* TODO(item-3-renewal): re-acceptance prompt on new document version */}
        <div style={{ fontSize:11, color:'#6B7280' }}>You can update settings later from the admin dashboard.</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:'100vh', background:'#F9FAFB', padding:'20px 16px' }}>
      <div style={{ maxWidth:600, margin:'0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#4F46E5', letterSpacing:1, marginBottom:4 }}>SCHOOL OS SETUP</div>
          <div style={{ fontSize:22, fontWeight:800, color:'#111827' }}>Onboarding Wizard</div>
        </div>

        {/* Step indicators */}
        <div style={{ display:'flex', gap:4, marginBottom:20, overflowX:'auto' }}>
          {STEP_LABELS.map((label,i)=>{
            const n=i+1; const active=n===step; const done=n<step;
            return (
              <div key={n} onClick={()=>n<step&&setStep(n)} style={{ display:'flex', flexDirection:'column', alignItems:'center', flex:1, cursor:n<step?'pointer':'default', minWidth:60 }}>
                <div style={{ width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700,
                  background: done?'#065F46': active?'#4F46E5':'#E5E7EB', color: (done||active)?'#fff':'#9CA3AF', marginBottom:4 }}>
                  {done ? '✓' : n}
                </div>
                <div style={{ fontSize:9, fontWeight:600, color: active?'#4F46E5': done?'#065F46':'#9CA3AF', textAlign:'center' }}>{label}</div>
              </div>
            );
          })}
        </div>

        {/* Step card */}
        <div style={cardStyle}>
          <div style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>Step {step}: {step === 2 ? getStep2Label(instType) : STEP_LABELS[step-1]}</div>
          {step===4&&<div style={{ fontSize:11, color:'#92400E', marginBottom:10 }}>Optional — you can skip this step</div>}
          {step===5&&<div style={{ fontSize:11, color:'#92400E', marginBottom:10 }}>Optional — you can skip this step</div>}
          <div style={{ marginTop:14 }}>{renderStep()}</div>

          {stepError && <div style={{ marginTop:12, padding:'8px 12px', background:'#FEF2F2', borderRadius:6, fontSize:12, color:'#991B1B' }}>{stepError}</div>}
          {stepSuccess && <div style={{ marginTop:12, padding:'8px 12px', background:'#F0FDF4', borderRadius:6, fontSize:12, color:'#065F46' }}>{stepSuccess}</div>}

          <div style={{ display:'flex', gap:10, marginTop:18 }}>
            {step > 1 && <button onClick={()=>setStep(s=>s-1)} style={btnSecondary}>← Back</button>}
            {(step===4||step===5) && step<7 && (
              <button onClick={()=>setStep(s=>s+1)} style={{ ...btnSecondary, marginLeft:'auto' }}>Skip</button>
            )}
            <button onClick={()=>void saveStep()} disabled={saving || (step===7 && !allLegalChecked)}
              style={{ ...btnPrimary, marginLeft:'auto', opacity: (saving || (step===7 && !allLegalChecked)) ? 0.5 : 1 }}>
              {saving ? 'Saving...' : step===7 ? '🎓 Activate School' : 'Save & Continue →'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
