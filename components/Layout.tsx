'use client';
// [head trimmed for reading]
const NAV_BY_ROLE: Record<string, NavGroup[]> = {
  // [accountant#1 + admin groups overview..records trimmed for reading]
    { groupKey: 'account', items: [
      { key: 'settings',      href: '/settings',                     icon: '⚙️' },
    ]},
  ],

  // P3: admin role for anganwadi institutions. Resolved automatically when
  // role === 'admin' && institution_type === 'anganwadi'. The role token in
  // the session is still 'admin' — only the rendering changes — so no auth
  // model changes are needed.
  anganwadi_admin: [
    { groupKey: 'overview', items: [
      { key: 'dashboard',     href: '/anganwadi',                    icon: '🏠' },
    ]},
    { groupKey: 'school', items: [
      { key: 'register_beneficiaries', href: '/anganwadi/beneficiaries', icon: '👶' },
      { key: 'staff',         href: '/admin/staff',                  icon: '👥' },
    ]},
    { groupKey: 'operations', items: [
      { key: 'health',        href: '/admin/health-incidents',       icon: '🏥' },
      { key: 'sanitary',      href: '/admin/sanitary-inventory',     icon: '🧼' },
    ]},
    { groupKey: 'academics', items: [
      { key: 'age_groups_generic',  href: '/anganwadi/growth',       icon: '📏' },
      { key: 'immunization',  href: '/anganwadi/immunization',       icon: '💉' },
      { key: 'nutrition',     href: '/anganwadi/nutrition',          icon: '🍎' },
      { key: 'mdm-stock',     href: '/anganwadi/mdm-stock',          icon: '📦' },
    ]},
    { groupKey: 'communication', items: [
      { key: 'broadcasts',    href: '/admin/broadcasts',             icon: '📢' },
    ]},
    { groupKey: 'account', items: [
      { key: 'settings',      href: '/settings',                     icon: '⚙️' },
    ]},
  ],

  admin_staff: [
    { groupKey: 'overview', items: [
      { key: 'dashboard',     href: '/dashboard',   icon: '🏠' },
    ]},
    { groupKey: 'school', items: [
      { key: 'students',      href: '/students',    icon: '👨‍🎓' },
      { key: 'staff',         href: '/admin/staff', icon: '👥' },
    ]},
    { groupKey: 'finance', items: [
      { key: 'fees',          href: '/admin/fees',  icon: '💰',
        showFor: (ctx) => !ctx.isGovernment && !ctx.isAnganwadi },
    ]},
    { groupKey: 'communication', items: [
      { key: 'broadcasts',    href: '/admin/broadcasts', icon: '📢' },
      { key: 'events_gallery',href: '/admin/events',     icon: '📸' },
      { key: 'parents',       href: '/admin/parents',    icon: '👨‍👩‍👧',
        showFor: (ctx) => !ctx.isCoaching && !ctx.isHigherEducation },
    ]},
    { groupKey: 'records', items: [
      { key: 'transfer_certs',href: '/admin/transfer-certificates', icon: '📋',
        showFor: (ctx) => !ctx.isAnganwadi && !ctx.isCoaching },
      { key: 'vendors',       href: '/admin/vendors', icon: '🤝',
        showFor: (ctx) => !ctx.isGovernment && !ctx.isAnganwadi },
      { key: 'upload',        href: '/admin/import',  icon: '📥' },
    ]},
    { groupKey: 'account', items: [
      { key: 'settings',      href: '/settings', icon: '⚙️' },
    ]},
  ],
  accountant: [
    { groupKey: 'finance', items: [
      { key: 'dashboard',     href: '/dashboard',   icon: '🏠' },
      { key: 'fees',          href: '/admin/fees',  icon: '💰' },
      { key: 'payroll',       href: '/admin/payroll', icon: '💼' },
      { key: 'students',      href: '/students',    icon: '👨‍🎓' },
    ]},
    { groupKey: 'account', items: [
      { key: 'settings',      href: '/settings', icon: '⚙️' },
    ]},
  ],
  principal: [
    { groupKey: 'overview', items: [
      { key: 'dashboard',     href: '/principal',   icon: '🏠' },
      { key: 'students',      href: '/students',    icon: '👨‍🎓' },
      { key: 'staff',         href: '/admin/staff', icon: '👥' },
    ]},
    { groupKey: 'operations', items: [
      { key: 'leave',         href: '/principal/leave-approvals', icon: '📅' },
      { key: 'complaints',    href: '/admin/complaints',          icon: '📩' },
      { key: 'health',        href: '/admin/health-incidents',    icon: '🏥' },
    ]},
    { groupKey: 'academics', items: [
      { key: 'promotion',     href: '/admin/promotion',           icon: '🎓' },
    ]},
    { groupKey: 'ai_tools', items: [
      { key: 'teacher_eval',  href: '/teacher-eval',  icon: '🎙' },
      { key: 'report_cards',  href: '/report-cards',  icon: '📄' },
      { key: 'analytics',     href: '/analytics',     icon: '📊' },
    ]},
    { groupKey: 'account', items: [
      { key: 'settings',      href: '/settings', icon: '⚙️' },
    ]},
  ],
  owner: [
    { groupKey: 'overview', items: [
      { key: 'dashboard',     href: '/owner',       icon: '🏠' },
      { key: 'students',      href: '/students',    icon: '👨‍🎓' },
      { key: 'staff',         href: '/admin/staff', icon: '👥' },
    ]},
    { groupKey: 'finance', items: [
      { key: 'fees',          href: '/admin/fees',  icon: '💰',
        showFor: (ctx) => !ctx.isGovernment && !ctx.isAnganwadi },
      { key: 'payroll',       href: '/admin/payroll', icon: '💼',
        showFor: (ctx) => !ctx.isAnganwadi },
    ]},
    { groupKey: 'ai_tools', items: [
      { key: 'analytics',     href: '/analytics',   icon: '📊' },
    ]},
    { groupKey: 'records', items: [
      { key: 'upload',        href: '/admin/import', icon: '📥' },
    ]},
    { groupKey: 'account', items: [
      { key: 'settings',      href: '/settings',    icon: '⚙️' },
    ]},
  ],
  teacher: [
    { groupKey: 'overview', items: [
      { key: 'dashboard',     href: '/teacher',          icon: '🏠' },
      { key: 'checkin',       href: '/teacher/check-in', icon: '📍' },
    ]},
    { groupKey: 'my_classes', items: [
      { key: 'attendance',    href: '/teacher/attendance',    icon: '✅' },
      { key: 'homework',      href: '/teacher/homework',      icon: '📚' },
      { key: 'reports',       href: '/teacher/marks',         icon: '📝' },
      { key: 'timetable',     href: '/teacher/lesson-plans',  icon: '📖' },
      { key: 'meal_attendance',href: '/teacher/meal-attendance',icon: '🍽️' },
    ]},
    { groupKey: 'operations', items: [
      { key: 'leave',         href: '/teacher/leave',     icon: '📅' },
    ]},
  ],
  meo: [
    { groupKey: 'governance', items: [
      { key: 'dashboard',     href: '/meo/dashboard',     icon: '🏛️' },
      { key: 'inspections',   href: '/meo/inspections',   icon: '🔍' },
    ]},
    { groupKey: 'account', items: [
      { key: 'settings',      href: '/settings', icon: '⚙️' },
    ]},
  ],
  deo: [
    { groupKey: 'governance', items: [
      { key: 'district',      href: '/deo/dashboard',     icon: '🏛️' },
      { key: 'meo_view',      href: '/meo/dashboard',     icon: '📊' },
    ]},
    { groupKey: 'account', items: [
      { key: 'settings',      href: '/settings', icon: '⚙️' },
    ]},
  ],
  hod: [
    { groupKey: 'overview', items: [
      { key: 'dashboard',     href: '/hod/dashboard',     icon: '🏠' },
      { key: 'students',      href: '/students',           icon: '👨‍🎓' },
    ]},
    { groupKey: 'higher_ed', items: [
      { key: 'assessments',   href: '/admin/assessments',  icon: '📝' },
      { key: 'internships',   href: '/admin/internships',  icon: '🏭' },
      { key: 'placement',     href: '/admin/placement',    icon: '💼' },
      { key: 'accreditation', href: '/admin/accreditation',icon: '🏛️' },
    ]},
    { groupKey: 'account', items: [
      { key: 'settings',      href: '/settings', icon: '⚙️' },
    ]},
  ],
  registrar: [
    { groupKey: 'overview', items: [
      { key: 'dashboard',     href: '/registrar/dashboard', icon: '🏠' },
    ]},
    { groupKey: 'examinations', items: [
      { key: 'assessments',   href: '/admin/assessments',   icon: '📅' },
      { key: 'results',       href: '/admin/results',        icon: '📊' },
    ]},
    { groupKey: 'account', items: [
      { key: 'settings',      href: '/settings', icon: '⚙️' },
    ]},
  ],
  viewer: [
    { groupKey: 'overview', items: [
      { key: 'dashboard',     href: '/dashboard', icon: '🏠' },
    ]},
  ],
  counsellor: [
    { groupKey: 'overview', items: [
      { key: 'dashboard',     href: '/dashboard', icon: '🏠' },
      { key: 'students',      href: '/students',  icon: '👨‍🎓' },
    ]},
  ],
};

const DEFAULT_NAV: NavGroup[] = [
  { groupKey: 'overview', items: [
    { key: 'dashboard', href: '/dashboard', icon: '🏠' },
    { key: 'settings',  href: '/settings',  icon: '⚙️' },
  ]},
];

// P3: pick the effective nav-role to render. For an admin user at an anganwadi
// institution, return the dedicated anganwadi_admin nav. Otherwise return the
// session role as-is.
function resolveNavRole(role: string, ctx: InstitutionContext): string {
  if (role === 'admin' && ctx.isAnganwadi) return 'anganwadi_admin';
  return role;
}

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function Layout({ children, title, subtitle, actions }: LayoutProps) {
  const pathname = usePathname();
  const { lang, setLang } = useLang();
  const [role, setRole] = useState<string>('admin');
  const [userName, setUserName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [institutionCtx, setInstitutionCtx] = useState<InstitutionContext>(DEFAULT_CTX);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => {
      if (d) {
        setRole(d.role ?? 'admin');
        setUserName(d.name ?? d.email ?? '');
        setSchoolName(d.school_name ?? '');
        // P3: receive institution_type/ownership_type and build context.
        if (d.institution_type || d.ownership_type) {
          setInstitutionCtx(buildInstitutionContext(
            d.institution_type ?? 'school_k12',
            d.ownership_type ?? 'private',
          ));
        }
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sidebarOpen && sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) setSidebarOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [sidebarOpen]);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  // P3: resolve nav-role considering institution context (e.g. admin at an
  // anganwadi institution gets the anganwadi_admin nav), then filter each
  // item's showFor predicate.
  const effectiveRole = resolveNavRole(role, institutionCtx);
  const rawNavGroups = NAV_BY_ROLE[effectiveRole] ?? DEFAULT_NAV;
  const navGroups: NavGroup[] = rawNavGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => (item.showFor ?? ALWAYS_SHOW)(institutionCtx)),
    }))
    .filter(group => group.items.length > 0);

  const isActive = (href: string) =>
    pathname === href ||
    (href !== '/dashboard' && href !== '/teacher' && href !== '/principal' && href !== '/owner' && href !== '/hod/dashboard' && href !== '/registrar/dashboard' && href !== '/meo/dashboard' && href !== '/deo/dashboard' && href !== '/anganwadi' && pathname.startsWith(href));

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F9FAFB', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 39 }} />
      )}

      <div ref={sidebarRef} style={{
        width: 240, background: '#fff', borderRight: '1px solid #E5E7EB',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 40,
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.22s ease', overflowY: 'auto',
      }} className="sidebar-desktop-visible">

        {/* School branding */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #F3F4F6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/brand/icon.svg" alt="School OS" style={{ width: 40, height: 25, objectFit: 'contain', flexShrink: 0, display: 'block' }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#111827', lineHeight: 1.2 }}>EdProSys</div>
              {schoolName && <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1, lineHeight: 1 }}>{schoolName}</div>}
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '8px 8px 0', overflowY: 'auto' }}>
          {navGroups.map(group => (
            <div key={group.groupKey} style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.08em', padding: '8px 10px 4px', textTransform: 'uppercase' }}>
                {T(group.groupKey, lang)}
              </div>
              {group.items.map(item => {
                const active = isActive(item.href);
                return (
                  <Link key={item.href + item.key} href={item.href} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 10px', borderRadius: 9, marginBottom: 2,
                    textDecoration: 'none', minHeight: 40,
                    background: active ? '#EEF2FF' : 'transparent',
                    color: active ? '#4F46E5' : '#374151',
                    fontWeight: active ? 700 : 500, fontSize: 13,
                  }}>
                    <span style={{ fontSize: 16, flexShrink: 0, width: 20, textAlign: 'center' }}>{item.icon}</span>
                    <span>{T(item.key, lang)}</span>
                    {active && <span style={{ marginLeft: 'auto', width: 4, height: 4, borderRadius: '50%', background: '#4F46E5' }} />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div style={{ padding: '10px 12px 14px', borderTop: '1px solid #F3F4F6' }}>
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <button onClick={() => setShowLangPicker(!showLangPicker)}
              style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'inherit' }}
              aria-label={T('change_language', lang)}>
              <span>🌐 {LANG_LABELS[lang as Lang] ?? 'English'}</span>
              <span style={{ color: '#9CA3AF', fontSize: 10 }}>{showLangPicker ? '▲' : '▼'}</span>
            </button>
            {showLangPicker && (
              <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 50, marginBottom: 4, overflow: 'hidden' }}>
                {(Object.entries(LANG_LABELS) as [Lang, string][]).map(([code, label]) => (
                  <button key={code} onClick={() => { setLang(code); setShowLangPicker(false); }}
                    style={{ width: '100%', padding: '8px 12px', border: 'none', background: code === lang ? '#EEF2FF' : '#fff', color: code === lang ? '#4F46E5' : '#374151', fontSize: 13, fontWeight: code === lang ? 700 : 500, cursor: 'pointer', textAlign: 'left', display: 'block', fontFamily: 'inherit' }}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#EEF2FF', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#4F46E5', fontSize: 12 }}>
              {userName ? userName[0].toUpperCase() : 'U'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName || 'User'}</div>
              <div style={{ fontSize: 10, color: '#9CA3AF' }}>{role}</div>
            </div>
          </div>
          <button onClick={handleLogout} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', color: '#6B7280', fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
            {T('sign_out', lang)} →
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, marginLeft: 0 }} className="main-with-sidebar">
        <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 30, flexShrink: 0 }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="mobile-menu-btn"
            style={{ width: 40, height: 40, borderRadius: 8, border: 'none', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, padding: 0, fontSize: 18 }}>
            ☰
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            {title && <div style={{ fontWeight: 800, fontSize: 16, color: '#111827', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>}
            {subtitle && <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>}
          </div>
          {actions && <div style={{ flexShrink: 0 }}>{actions}</div>}
        </div>
        <main style={{ flex: 1, padding: '20px 16px 80px', maxWidth: 1100, width: '100%', boxSizing: 'border-box' }}>
          {children}
        </main>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .sidebar-desktop-visible { transform: translateX(0) !important; }
          .main-with-sidebar { margin-left: 240px !important; }
          .mobile-menu-btn { display: none !important; }
        }
        @media (max-width: 767px) { .main-with-sidebar { margin-left: 0 !important; } }
      `}</style>
    </div>
  );
}
