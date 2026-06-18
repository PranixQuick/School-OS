'use client';
// app/admin/role-permissions/page.tsx
// ISS-6 (#6) — Super-admin editor for the global role_permissions matrix.

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

interface Perm {
  id: string; role: string; module: string;
  can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean;
}
type Action = 'can_view' | 'can_create' | 'can_edit' | 'can_delete';
const ACTIONS: { k: Action; label: string }[] = [
  { k: 'can_view', label: 'View' }, { k: 'can_create', label: 'Create' },
  { k: 'can_edit', label: 'Edit' }, { k: 'can_delete', label: 'Delete' },
];

export default function RolePermissionsPage() {
  const [perms, setPerms] = useState<Perm[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/admin/role-permissions')
      .then(r => { if (r.status === 403) { setForbidden(true); return null; } return r.ok ? r.json() : null; })
      .then((d: { permissions?: Perm[] } | null) => { if (d?.permissions) setPerms(d.permissions); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function toggle(p: Perm, action: Action) {
    const next = { ...p, [action]: !p[action] };
    setPerms(prev => prev.map(x => (x.id === p.id ? next : x)));  // optimistic
    setMsg(null);
    try {
      const r = await fetch('/api/admin/role-permissions', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: p.role, module: p.module, can_view: next.can_view, can_create: next.can_create, can_edit: next.can_edit, can_delete: next.can_delete }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setMsg({ kind: 'err', text: d.error ?? 'Save failed — reverted.' });
        setPerms(prev => prev.map(x => (x.id === p.id ? p : x)));  // revert
      } else {
        setMsg({ kind: 'ok', text: `Saved: ${p.role} · ${p.module}` });
      }
    } catch {
      setMsg({ kind: 'err', text: 'Network error — reverted.' });
      setPerms(prev => prev.map(x => (x.id === p.id ? p : x)));
    }
  }

  const roles = Array.from(new Set(perms.map(p => p.role))).sort();

  return (
    <Layout title="Role Permissions" subtitle="Global permission matrix · super-admin">
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
      ) : forbidden ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#B91C1C', fontWeight: 600 }}>Super-admin access only.</div>
      ) : (
        <>
          {msg && (
            <div style={{ marginBottom: 12, fontSize: 13, padding: '8px 12px', borderRadius: 8, background: msg.kind === 'ok' ? '#F0FDF4' : '#FEF2F2', color: msg.kind === 'ok' ? '#065F46' : '#B91C1C' }}>{msg.text}</div>
          )}
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 14, lineHeight: 1.5 }}>
            Changes save immediately. They take effect only where permission enforcement has been wired; the built-in role rules remain the baseline, so clearing a box never removes access that the baseline still grants.
          </div>
          {roles.map(role => (
            <div key={role} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', textTransform: 'capitalize', marginBottom: 6 }}>{role}</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8 }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB' }}>
                      <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #E5E7EB', fontWeight: 700, color: '#374151' }}>Module</th>
                      {ACTIONS.map(a => <th key={a.k} style={{ padding: '8px 6px', borderBottom: '1px solid #E5E7EB', textAlign: 'center', fontWeight: 700, color: '#374151' }}>{a.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {perms.filter(p => p.role === role).sort((a, b) => a.module.localeCompare(b.module)).map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={{ padding: '6px 10px', fontWeight: 600, color: '#374151' }}>{p.module}</td>
                        {ACTIONS.map(a => (
                          <td key={a.k} style={{ padding: '6px', textAlign: 'center' }}>
                            <input type="checkbox" checked={!!p[a.k]} onChange={() => void toggle(p, a.k)} style={{ cursor: 'pointer', width: 16, height: 16 }} aria-label={`${p.role} ${p.module} ${a.label}`} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}
    </Layout>
  );
}
