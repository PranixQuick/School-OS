'use client';
import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import EntityDetailCard from '@/components/EntityDetailCard';
import { T } from '@/lib/i18n';
import { useLang } from '@/lib/useLang';

interface StaffMember {
  id: string; name: string; role: string; email?: string; phone?: string;
  subject?: string; is_active: boolean; joined_at?: string; designation?: string;
  invite_status?: string; auth_verified?: boolean; last_login?: string; first_login_at?: string;
}

const ROLE_LABEL: Record<string, string> = {
  teacher: 'ov_teacher', principal: 'ov_principal', admin_staff: 'ov_admin_staff',
  accountant: 'ov_accountant', librarian: 'ov_librarian', owner: 'ov_owner', admin: 'ov_admin',
};
const ROLE_COLOR: Record<string, string> = {
  teacher: '#4F46E5', principal: '#065F46', admin_staff: '#9333EA',
  accountant: '#B45309', librarian: '#0369A1', owner: '#B91C1C', admin: '#374151',
};

// invite_status → display config
const INVITE_BADGE: Record<string, { label: string; bg: string; color: string; icon: string }> = {
  pending:  { label: 'ov_not_invited', bg: '#F3F4F6', color: '#6B7280', icon: '⏳' },
  invited:  { label: 'ov_invited',     bg: '#FFF7ED', color: '#D97706', icon: '📧' },
  accepted: { label: 'ov_setup_done',  bg: '#EFF6FF', color: '#2563EB', icon: '✔' },
  verified: { label: 'ov_logged_in',   bg: '#F0FDF4', color: '#15803D', icon: '✅' },
  failed:   { label: 'ov_failed',      bg: '#FEF2F2', color: '#B91C1C', icon: '❌' },
};

export default function AdminStaffPage() {
  const { lang } = useLang();
  const roleLabel = (r: string) => ROLE_LABEL[r] ? T(ROLE_LABEL[r], lang) : r;
  const [staff, setStaff]     = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [bulkInviting, setBulkInviting]  = useState(false);
  const [invitingId, setInvitingId]      = useState<string | null>(null);
  const [bulkResult, setBulkResult]      = useState<string>('');
  const [form, setForm] = useState({ name: '', email: '', role: 'teacher', subject: '', phone: '', designation: '' });

  const loadStaff = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/staff');
      if (res.ok) { const d = await res.json() as { staff?: StaffMember[] }; setStaff(d.staff ?? []); }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { void loadStaff(); }, [loadStaff]);

  async function addStaff() {
    if (!form.name || !form.email) return;
    setSaving(true);
    try {
      await fetch('/api/admin/staff', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setForm({ name: '', email: '', role: 'teacher', subject: '', phone: '', designation: '' });
      setShowAdd(false);
      await loadStaff();
    } catch { /* ignore */ }
    setSaving(false);
  }

  async function deactivate(id: string) {
    if (!confirm(T('ov_confirm_deactivate', lang))) return;
    await fetch('/api/admin/staff', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: false }),
    });
    await loadStaff();
  }

  async function sendInvite(staffUserId: string, email: string) {
    setInvitingId(staffUserId);
    try {
      const res = await fetch('/api/admin/staff/invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_user_id: staffUserId }),
      });
      const d = await res.json() as { message?: string; error?: string };
      alert(res.ok ? (d.message ?? T('ov_invitation_sent_to', lang).replace('{email}', email)) : (T('ov_error_prefix', lang) + (d.error ?? T('ov_failed', lang))));
      await loadStaff();
    } catch { alert(T('ov_network_error_invite', lang)); }
    setInvitingId(null);
  }

  async function sendAllInvites() {
    if (!confirm(T('ov_confirm_send_all', lang))) return;
    setBulkInviting(true);
    setBulkResult('');
    try {
      const res = await fetch('/api/admin/staff/invite?bulk=1', { method: 'POST' });
      const d = await res.json() as { message?: string; invited?: number; failed?: number };
      setBulkResult(d.message ?? T('ov_invited_failed_count', lang).replace('{ok}', String(d.invited ?? 0)).replace('{fail}', String(d.failed ?? 0)));
      await loadStaff();
    } catch { setBulkResult(T('ov_network_retry', lang)); }
    setBulkInviting(false);
  }

  const uninvitedCount = staff.filter(s =>
    s.is_active && (!s.invite_status || s.invite_status === 'pending' || s.invite_status === 'failed')
  ).length;

  const roles = ['all', ...Array.from(new Set(staff.map(s => s.role)))];
  const visible = staff.filter(s => {
    if (roleFilter !== 'all' && s.role !== roleFilter) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) &&
        !(s.email ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const headerActions = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {uninvitedCount > 0 && (
        <button onClick={() => void sendAllInvites()} disabled={bulkInviting}
          style={{ padding: '7px 14px', background: bulkInviting ? '#9CA3AF' : '#15803D', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: bulkInviting ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
          {bulkInviting ? T('ov_sending', lang) : `📧 ${T('ov_send_all_invitations', lang).replace('{n}', String(uninvitedCount))}`}
        </button>
      )}
      <button onClick={() => setShowAdd(true)} style={{ padding: '7px 14px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
        + {T('ov_add_staff', lang)}
      </button>
    </div>
  );

  return (
    <Layout title={T('staff_management', lang)} subtitle={T('ov_n_staff', lang).replace('{n}', String(staff.length))}
      actions={headerActions}>

      {/* Bulk invite result banner */}
      {bulkResult && (
        <div style={{ background: '#F0FDF4', border: '1px solid #D1FAE5', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#15803D', fontWeight: 600 }}>
          ✅ {bulkResult}
          <button onClick={() => setBulkResult('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 14 }}>×</button>
        </div>
      )}

      {/* Auth status summary */}
      {!loading && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {Object.entries(INVITE_BADGE).map(([status, cfg]) => {
            const count = staff.filter(s => (s.invite_status ?? 'pending') === status).length;
            if (count === 0) return null;
            return (
              <div key={status} style={{ padding: '5px 12px', borderRadius: 8, background: cfg.bg, border: `1px solid ${cfg.color}30`, fontSize: 12, fontWeight: 600, color: cfg.color }}>
                {cfg.icon} {T(cfg.label, lang)}: {count}
              </div>
            );
          })}
        </div>
      )}

      {/* Search + filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={T('ov_search_name_email', lang)}
          style={{ flex: 1, minWidth: 160, height: 36, fontSize: 13, borderRadius: 8, border: '1px solid #D1D5DB', padding: '0 12px', outline: 'none', fontFamily: 'inherit' }} />
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          style={{ height: 36, borderRadius: 8, border: '1px solid #D1D5DB', padding: '0 10px', fontSize: 13, background: '#fff', color: '#374151', fontFamily: 'inherit' }}>
          {roles.map(r => <option key={r} value={r}>{r === 'all' ? T('ov_all_roles', lang) : roleLabel(r)}</option>)}
        </select>
      </div>

      {/* Add form */}
      {showAdd && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>{T('ov_add_new_staff', lang)}</div>
          <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#92400E' }}>
            <strong>{T('ov_email_must_correct', lang)}</strong> — {T('ov_email_warning_detail', lang)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { key: 'name',        label: 'ov_full_name',   placeholder: 'Ravi Kumar' },
              { key: 'email',       label: 'ov_email',       placeholder: 'ravi@school.edu.in' },
              { key: 'phone',       label: 'ov_phone',       placeholder: '+91 98765 43210' },
              { key: 'designation', label: 'ov_designation', placeholder: 'Class Teacher' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{T(f.label, lang)}</label>
                <input
                  value={form[f.key as keyof typeof form]}
                  onChange={e => setForm({ ...form, [f.key]: f.key === 'email' ? e.target.value.replace(/\s+/g,'').toLowerCase() : e.target.value })}
                  placeholder={f.placeholder}
                  autoCorrect={f.key === 'email' ? 'off' : undefined}
                  autoCapitalize={f.key === 'email' ? 'none' : undefined}
                  spellCheck={f.key === 'email' ? false : undefined}
                  style={{ width: '100%', height: 34, fontSize: 13, borderRadius: 8, border: '1px solid #D1D5DB', padding: '0 10px', outline: 'none', fontFamily: f.key === 'email' ? 'monospace' : 'inherit', boxSizing: 'border-box' }} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{T('ov_role', lang)}</label>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                style={{ width: '100%', height: 34, borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 13, padding: '0 8px', boxSizing: 'border-box', fontFamily: 'inherit' }}>
                {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{T(v, lang)}</option>)}
              </select>
            </div>
            {form.role === 'teacher' && (
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{T('ov_subject', lang)}</label>
                <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}
                  placeholder="Mathematics"
                  style={{ width: '100%', height: 34, fontSize: 13, borderRadius: 8, border: '1px solid #D1D5DB', padding: '0 10px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowAdd(false)} style={{ padding: '7px 14px', background: '#F3F4F6', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{T('ov_cancel', lang)}</button>
            <button onClick={() => void addStaff()} disabled={saving} style={{ padding: '7px 14px', background: saving ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {saving ? T('ov_adding', lang) : T('ov_add_staff', lang)}
            </button>
          </div>
        </div>
      )}

      {/* Staff list */}
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>{T('ov_loading_staff', lang)}</div>
      ) : visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>👥</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#374151' }}>{T('ov_no_staff_found', lang)}</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>{T('ov_add_first_staff', lang)}</div>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
          {visible.map((s, i) => {
            const inviteStatus = s.invite_status ?? 'pending';
            const badge = INVITE_BADGE[inviteStatus] ?? INVITE_BADGE.pending;
            const canInvite = !s.auth_verified && inviteStatus !== 'accepted';
            return (
              <div key={s.id} style={{ padding: '12px 16px', borderBottom: i < visible.length-1 ? '1px solid #F3F4F6' : 'none', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                {/* Avatar */}
                <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: (ROLE_COLOR[s.role] ?? '#6B7280') + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: ROLE_COLOR[s.role] ?? '#6B7280', marginTop: 2 }}>
                  {s.name[0].toUpperCase()}
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>
                    {s.email ? <span style={{ fontFamily: 'monospace' }}>{s.email}</span> : <em>{T('ov_no_email', lang)}</em>}
                    {s.subject ? ` · ${s.subject}` : ''}
                  </div>
                  {/* Invite status badge */}
                  <div style={{ marginTop: 5, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, background: (ROLE_COLOR[s.role] ?? '#6B7280') + '18', color: ROLE_COLOR[s.role] ?? '#6B7280', fontSize: 11, fontWeight: 700 }}>
                      {roleLabel(s.role)}
                    </span>
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, background: badge.bg, color: badge.color, fontSize: 11, fontWeight: 600 }}>
                      {badge.icon} {T(badge.label, lang)}
                    </span>
                    {s.first_login_at && (
                      <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                        {T('ov_first_login', lang)} {new Date(s.first_login_at).toLocaleDateString('en-IN')}
                      </span>
                    )}
                  </div>
                </div>
                {/* Actions */}
                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                  {canInvite && s.email && (
                    <button
                      onClick={() => void sendInvite(s.id, s.email!)}
                      disabled={invitingId === s.id}
                      style={{ padding: '5px 10px', background: invitingId === s.id ? '#9CA3AF' : '#EEF2FF', color: invitingId === s.id ? '#fff' : '#4F46E5', border: '1px solid #C7D2FE', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: invitingId === s.id ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                      {invitingId === s.id ? T('ov_sending', lang) : inviteStatus === 'failed' ? `↩ ${T('ov_resend', lang)}` : `📧 ${T('ov_invite', lang)}`}
                    </button>
                  )}
                  <button onClick={() => void deactivate(s.id)}
                    style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 11, cursor: 'pointer', padding: '2px 0', fontFamily: 'inherit' }}>
                    {T('ov_remove', lang)}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
