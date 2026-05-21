'use client';
// Admin Invite Management — solve the demo email problem
//
// Problem: Magic-link emails fail for *.edu.in domain addresses because
// Supabase built-in SMTP rejects them. This page gives the admin an
// ALTERNATIVE ACTIVATION PATH: generate a temporary login link and copy it.
//
// This is SAFE because:
// - Only admins can access this page
// - Links expire in 1 hour (Supabase default)
// - Each link is single-use
// - The user still sets their own password after first login

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface StaffUser {
  id: string; email: string; name: string; role: string;
  invite_status: string; auth_verified: boolean;
  last_login: string | null; invited_at: string | null;
}

interface ActivationLink { email: string; link: string; expires_at: string; }

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  verified:  { bg: '#F0FDF4', color: '#15803D', label: '✅ Active' },
  pending:   { bg: '#FFF7ED', color: '#D97706', label: '⏳ Invite Pending' },
  accepted:  { bg: '#EFF6FF', color: '#2563EB', label: '📬 Accepted (needs activation)' },
  sent:      { bg: '#F5F3FF', color: '#7C3AED', label: '📧 Invite Sent' },
};

export default function InviteManagementPage() {
  const [staff, setStaff]       = useState<StaffUser[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<'all'|'pending'|'verified'>('pending');
  const [generating, setGenerating] = useState<string | null>(null);
  const [links, setLinks]       = useState<Record<string, ActivationLink>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [toast, setToast]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/invite-management');
      if (r.ok) { const d = await r.json() as { staff?: StaffUser[] }; setStaff(d.staff ?? []); }
    } catch {/**/}
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3500); }

  async function generateLink(userId: string, email: string) {
    setGenerating(userId);
    try {
      const r = await fetch('/api/admin/invite-management/generate-link', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, email }),
      });
      const d = await r.json() as { link?: string; expires_at?: string; error?: string };
      if (r.ok && d.link) {
        setLinks(prev => ({ ...prev, [userId]: { email, link: d.link!, expires_at: d.expires_at ?? '' } }));
      } else {
        showToast(`Failed: ${d.error ?? 'Unknown error'}`);
      }
    } catch { showToast('Network error'); }
    setGenerating(null);
  }

  async function copyLink(userId: string) {
    const linkData = links[userId];
    if (!linkData) return;
    try {
      await navigator.clipboard.writeText(linkData.link);
      setCopiedId(userId);
      showToast('✅ Link copied! Send it to the staff member via WhatsApp or email.');
      setTimeout(() => setCopiedId(null), 3000);
    } catch {
      // Fallback for devices where clipboard API isn't available
      showToast('Copy this link manually: ' + linkData.link.slice(0, 60) + '…');
    }
  }

  async function resendInvite(userId: string, email: string) {
    setResending(userId);
    try {
      const r = await fetch('/api/admin/invite-management/resend', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, email }),
      });
      const d = await r.json() as { success?: boolean; error?: string };
      if (r.ok) { showToast(`✅ Invitation resent to ${email}`); void load(); }
      else showToast(`Failed: ${d.error ?? 'Unknown error'}`);
    } catch { showToast('Network error'); }
    setResending(null);
  }

  const filteredStaff = staff.filter(s => {
    if (filter === 'pending') return s.invite_status !== 'verified' && s.invite_status !== 'accepted';
    if (filter === 'verified') return s.invite_status === 'verified';
    return true;
  });

  const pendingCount  = staff.filter(s => s.invite_status === 'pending').length;
  const verifiedCount = staff.filter(s => s.invite_status === 'verified').length;

  return (
    <Layout title="Invite Management" subtitle="Staff onboarding and activation">
      {toast && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: '#111827', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, maxWidth: '90vw', wordBreak: 'break-all' }}>
          {toast}
        </div>
      )}

      {/* Onboarding health */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Active Staff', value: verifiedCount, color: '#15803D', bg: '#F0FDF4' },
          { label: 'Pending', value: pendingCount, color: pendingCount > 0 ? '#D97706' : '#15803D', bg: pendingCount > 0 ? '#FFF7ED' : '#F0FDF4' },
          { label: 'Total', value: staff.length, color: '#4F46E5', bg: '#EEF2FF' },
        ].map(k => (
          <div key={k.label} style={{ background: k.bg, borderRadius: 11, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Email domain warning */}
      <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#92400E', lineHeight: 1.6 }}>
        <strong>⚠️ Email Domain Note:</strong> Magic-link emails may fail for <code>*.edu.in</code> addresses due to Supabase built-in SMTP restrictions. For affected staff, use <strong>"Generate Activation Link"</strong> and share it directly via WhatsApp. This link works exactly the same as the email — the staff member clicks it and logs in immediately.
        <br /><strong>For gmail.com addresses</strong> (ZPHS, Anganwadi staff) — regular email invites work normally.
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {([['pending',`⏳ Pending (${pendingCount})`],['verified','✅ Active'],['all','All']] as [typeof filter, string][]).map(([f, l]) => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 12px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: filter===f ? '#4F46E5' : '#F3F4F6', color: filter===f ? '#fff' : '#374151', fontFamily: 'inherit' }}>
            {l}
          </button>
        ))}
        <button onClick={() => void load()} style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 20, border: '1px solid #E5E7EB', background: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          🔄
        </button>
      </div>

      {loading ? <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div> :
      filteredStaff.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', background: '#F0FDF4', borderRadius: 12 }}>
          ✅ {filter === 'pending' ? 'All staff are active!' : 'No staff in this category'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredStaff.map(s => {
            const ss = STATUS_STYLE[s.invite_status] ?? STATUS_STYLE.pending;
            const hasLink = !!links[s.id];
            const isEduIn = s.email.endsWith('.edu.in');
            return (
              <div key={s.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '12px 14px' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{s.name || s.email}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1, fontFamily: 'monospace' }}>{s.email}</div>
                    <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>{s.role}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: ss.bg, color: ss.color }}>
                      {ss.label}
                    </span>
                    {isEduIn && (
                      <div style={{ fontSize: 10, color: '#D97706', marginTop: 3 }}>⚠ .edu.in — use link</div>
                    )}
                  </div>
                </div>

                {/* Activation link section */}
                {hasLink ? (
                  <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#15803D', marginBottom: 4 }}>
                      ✅ Activation link generated — expires {links[s.id].expires_at ? new Date(links[s.id].expires_at).toLocaleTimeString('en-IN') : '1 hour'}
                    </div>
                    <div style={{ fontSize: 10, color: '#6B7280', wordBreak: 'break-all', background: '#fff', borderRadius: 6, padding: '6px 8px', border: '1px solid #E5E7EB', fontFamily: 'monospace', marginBottom: 8 }}>
                      {links[s.id].link.slice(0, 80)}…
                    </div>
                    <button onClick={() => void copyLink(s.id)}
                      style={{ width: '100%', height: 40, borderRadius: 8, border: 'none', background: copiedId === s.id ? '#15803D' : '#4F46E5', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {copiedId === s.id ? '✅ Copied!' : '📋 Copy Link'}
                    </button>
                    <div style={{ fontSize: 11, color: '#6B7280', marginTop: 6, textAlign: 'center' }}>
                      Share this link directly via WhatsApp or SMS. Single-use, expires in 1 hour.
                    </div>
                  </div>
                ) : null}

                {/* Action buttons */}
                {s.invite_status !== 'verified' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => void generateLink(s.id, s.email)}
                      disabled={generating === s.id}
                      style={{ flex: 1, height: 40, borderRadius: 8, border: 'none', background: generating === s.id ? '#9CA3AF' : '#4F46E5', color: '#fff', fontSize: 12, fontWeight: 700, cursor: generating === s.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                      {generating === s.id ? '…' : hasLink ? '🔄 New Link' : '🔗 Generate Activation Link'}
                    </button>
                    {!isEduIn && (
                      <button
                        onClick={() => void resendInvite(s.id, s.email)}
                        disabled={resending === s.id}
                        style={{ flex: 1, height: 40, borderRadius: 8, border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#374151', fontSize: 12, fontWeight: 600, cursor: resending === s.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                        {resending === s.id ? '…' : '📧 Resend Email'}
                      </button>
                    )}
                  </div>
                )}

                {s.last_login && (
                  <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 8 }}>
                    Last login: {new Date(s.last_login).toLocaleString('en-IN')}
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
