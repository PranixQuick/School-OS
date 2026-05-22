'use client';
// app/onboarding/page.tsx
// First-run school onboarding checklist.
// Shows when school has 0 students OR incomplete setup.
// 10-step guided flow. Progress stored in localStorage.
// Dismissible. Role-aware. Mobile-first. Telugu-compatible via T().
//
// P1 polymorphism: steps are filtered and re-labelled based on the
// institution's type (govt school, anganwadi, pre-primary, coaching,
// higher-ed, K-12 private). Suchitra Academy (school_k12 / private)
// sees the unchanged flow.

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { T } from '@/lib/i18n';
import { useLang } from '@/lib/useLang';

const STORAGE_KEY = 'edprosys_onboarding_v1';

interface OnboardingContext {
  school_id: string;
  school_name: string;
  institution_type: string;
  ownership_type: string;
  is_government: boolean;
  is_higher_education: boolean;
  is_pre_primary: boolean;
  is_coaching: boolean;
  is_anganwadi: boolean;
}

// Default context — matches Suchitra (school_k12 / private). Used as a
// fallback if /api/onboarding/context fails or hasn't loaded yet, so the
// wizard never blocks rendering and never silently mis-classifies.
const DEFAULT_CTX: OnboardingContext = {
  school_id: '',
  school_name: '',
  institution_type: 'school_k12',
  ownership_type: 'private',
  is_government: false,
  is_higher_education: false,
  is_pre_primary: false,
  is_coaching: false,
  is_anganwadi: false,
};

interface Step {
  id: string;
  icon: string;
  titleKey: string;
  // Per-flag title overrides. Precedence (highest first):
  //   is_anganwadi > is_pre_primary > is_coaching > is_higher_education > is_government
  titleOverrideKey?: Partial<Record<
    'is_anganwadi' | 'is_pre_primary' | 'is_coaching' | 'is_higher_education' | 'is_government',
    string
  >>;
  descKey: string;
  href: string;
  // Whether to show this step at all for the given institution context.
  showFor: (ctx: OnboardingContext) => boolean;
  // Whether this step is *required* (vs optional) for the given context.
  // Implies showFor — if showFor is false, requiredFor must also be false.
  requiredFor: (ctx: OnboardingContext) => boolean;
}

const ALWAYS = (_ctx: OnboardingContext) => true;
const NEVER = (_ctx: OnboardingContext) => false;

const STEPS: Step[] = [
  {
    id: 'school_info',
    icon: '🏫',
    titleKey: 'school_information',
    descKey: 'school_name_label',
    href: '/settings',
    showFor: ALWAYS,
    requiredFor: ALWAYS,
  },
  {
    id: 'classes',
    icon: '📚',
    titleKey: 'classes_grades_s',
    titleOverrideKey: {
      is_anganwadi: 'age_groups_anganwadi',
      is_pre_primary: 'age_groups_generic',
      is_coaching: 'batches_coaching',
      is_higher_education: 'programmes_and_batches',
    },
    descKey: 'school_config',
    href: '/settings#config',
    showFor: ALWAYS,
    requiredFor: ALWAYS,
  },
  {
    id: 'staff',
    icon: '👩‍🏫',
    titleKey: 'add_staff',
    descKey: 'staff_management',
    href: '/admin/staff',
    showFor: ALWAYS,
    requiredFor: ALWAYS,
  },
  {
    id: 'students',
    icon: '🎒',
    titleKey: 'add_student',
    titleOverrideKey: {
      is_anganwadi: 'register_beneficiaries',
    },
    descKey: 'student_management',
    href: '/students',
    showFor: ALWAYS,
    requiredFor: ALWAYS,
  },
  {
    id: 'fee_templates',
    icon: '💰',
    titleKey: 'fee_categories_config',
    descKey: 'fee_management',
    href: '/settings#config',
    // Hide fee templates for government and anganwadi institutions — they
    // typically don't run a fee structure through the platform.
    showFor: (ctx) => !ctx.is_government && !ctx.is_anganwadi,
    requiredFor: (ctx) => !ctx.is_government && !ctx.is_anganwadi,
  },
  {
    id: 'academic_year',
    icon: '📅',
    titleKey: 'academic_terms_label',
    descKey: 'academic_year',
    href: '/settings#config',
    // Anganwadi and coaching don't run academic-year cycles the same way;
    // higher-ed uses semesters covered under programmes & batches.
    showFor: (ctx) => !ctx.is_anganwadi && !ctx.is_coaching && !ctx.is_higher_education,
    requiredFor: NEVER,
  },
  {
    id: 'broadcast',
    icon: '📢',
    titleKey: 'new_announcement',
    descKey: 'broadcasts',
    href: '/admin/broadcasts',
    showFor: ALWAYS,
    requiredFor: NEVER,
  },
  {
    id: 'parents',
    icon: '👨‍👩‍👧',
    titleKey: 'parents',
    descKey: 'add_student',
    href: '/admin/parents',
    // Coaching and higher-ed deal directly with the student/trainee — no
    // separate parent portal step in the initial setup.
    showFor: (ctx) => !ctx.is_coaching && !ctx.is_higher_education,
    requiredFor: NEVER,
  },
  {
    id: 'import',
    icon: '📥',
    titleKey: 'upload',
    descKey: 'student_management',
    href: '/admin/import',
    showFor: ALWAYS,
    requiredFor: NEVER,
  },
  {
    id: 'report_cards',
    icon: '📄',
    titleKey: 'report_cards',
    descKey: 'generate_all_reports',
    href: '/report-cards',
    // Report cards don't apply to anganwadi (developmental tracking only) or
    // coaching (assessment is short-form / per-batch).
    showFor: (ctx) => !ctx.is_anganwadi && !ctx.is_coaching,
    requiredFor: NEVER,
  },
];

function loadCompleted(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch { return {}; }
}

function saveCompleted(completed: Record<string, boolean>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(completed)); } catch { /* noop */ }
}

// Resolve the title key for a step given the current institution context.
// Returns the first matching override key in precedence order, or the
// step's default titleKey.
function resolveTitle(step: Step, ctx: OnboardingContext): string {
  const overrides = step.titleOverrideKey;
  if (!overrides) return step.titleKey;
  if (ctx.is_anganwadi && overrides.is_anganwadi) return overrides.is_anganwadi;
  if (ctx.is_pre_primary && overrides.is_pre_primary) return overrides.is_pre_primary;
  if (ctx.is_coaching && overrides.is_coaching) return overrides.is_coaching;
  if (ctx.is_higher_education && overrides.is_higher_education) return overrides.is_higher_education;
  if (ctx.is_government && overrides.is_government) return overrides.is_government;
  return step.titleKey;
}

export default function OnboardingPage() {
  const { lang } = useLang();
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [dismissed, setDismissed] = useState(false);
  const [ctx, setCtx] = useState<OnboardingContext>(DEFAULT_CTX);
  const [liveData, setLiveData] = useState<{
    hasStudents: boolean; hasStaff: boolean; hasBroadcast: boolean;
  }>({ hasStudents: false, hasStaff: false, hasBroadcast: false });

  // Load from localStorage and fetch live state + institution context
  useEffect(() => {
    setCompleted(loadCompleted());

    // Fetch live completion signals + onboarding context together. We use
    // Promise.allSettled so that a failure of any single endpoint (e.g.
    // /api/onboarding/context on a stale deployment) doesn't break the wizard.
    Promise.allSettled([
      fetch('/api/students?limit=1').then(r => r.ok ? r.json() : null),
      fetch('/api/admin/staff?limit=1').then(r => r.ok ? r.json() : null),
      fetch('/api/broadcasts?limit=1').then(r => r.ok ? r.json() : null),
      fetch('/api/onboarding/context').then(r => r.ok ? r.json() : null),
    ]).then(([studRes, staffRes, bcastRes, ctxRes]) => {
      const hasStudents = studRes.status === 'fulfilled' && studRes.value?.students?.length > 0;
      const hasStaff    = staffRes.status === 'fulfilled' && staffRes.value?.staff?.length > 0;
      const hasBroadcast= bcastRes.status === 'fulfilled' && bcastRes.value?.broadcasts?.length > 0;

      setLiveData({ hasStudents, hasStaff, hasBroadcast });

      if (ctxRes.status === 'fulfilled' && ctxRes.value && typeof ctxRes.value === 'object') {
        const v = ctxRes.value as Partial<OnboardingContext>;
        setCtx({
          school_id: v.school_id ?? DEFAULT_CTX.school_id,
          school_name: v.school_name ?? DEFAULT_CTX.school_name,
          institution_type: v.institution_type ?? DEFAULT_CTX.institution_type,
          ownership_type: v.ownership_type ?? DEFAULT_CTX.ownership_type,
          is_government: !!v.is_government,
          is_higher_education: !!v.is_higher_education,
          is_pre_primary: !!v.is_pre_primary,
          is_coaching: !!v.is_coaching,
          is_anganwadi: !!v.is_anganwadi,
        });
      }

      // Auto-mark steps based on live data
      const autoMarked: Record<string, boolean> = { ...loadCompleted() };
      if (hasStudents) autoMarked.students = true;
      if (hasStaff)    autoMarked.staff = true;
      if (hasBroadcast) autoMarked.broadcast = true;
      setCompleted(autoMarked);
      saveCompleted(autoMarked);
    });
  }, []);

  function toggleStep(id: string) {
    setCompleted(prev => {
      const next = { ...prev, [id]: !prev[id] };
      saveCompleted(next);
      return next;
    });
  }

  // Compute visible steps and required-set polymorphically.
  const visibleSteps = STEPS.filter(s => s.showFor(ctx));
  const requiredSteps = visibleSteps.filter(s => s.requiredFor(ctx));
  const optionalSteps = visibleSteps.filter(s => !s.requiredFor(ctx));

  const doneCount = visibleSteps.filter(s => completed[s.id]).length;
  const requiredDone = requiredSteps.every(s => completed[s.id]);
  const pct = visibleSteps.length === 0
    ? 0
    : Math.round((doneCount / visibleSteps.length) * 100);

  if (dismissed) {
    return (
      <Layout title={T('school_information', lang as never)} subtitle="">
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 8 }}>
            {T('saved_success', lang as never)}
          </div>
          <Link href="/dashboard" style={{ display: 'inline-block', marginTop: 8, padding: '10px 20px', background: '#4F46E5', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>
            {T('dashboard', lang as never)} →
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={T('school_information', lang as never)} subtitle={`${doneCount}/${visibleSteps.length} ${T('total', lang as never)}`}>
      <style>{`
        .ob-step{background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:14px 16px;display:flex;align-items:flex-start;gap:14px;cursor:pointer;transition:border-color 0.15s}
        .ob-step.done{border-color:#D1FAE5;background:#F0FDF4}
        .ob-step:active{transform:scale(0.99)}
        .ob-circle{width:24px;height:24px;border-radius:50%;border:2px solid #D1D5DB;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:13px;margin-top:1px}
        .ob-circle.done{background:#16A34A;border-color:#16A34A;color:#fff}
      `}</style>

      {/* Progress header */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: '18px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>🚀 School Setup</div>
            <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
              {doneCount} / {visibleSteps.length} {T('total', lang as never)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: requiredDone ? '#16A34A' : '#4F46E5' }}>{pct}%</div>
            {requiredDone && (
              <div style={{ fontSize: 11, color: '#16A34A', fontWeight: 700 }}>✓ Ready!</div>
            )}
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ height: 8, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: requiredDone ? '#16A34A' : '#4F46E5', borderRadius: 4, transition: 'width 0.4s' }} />
        </div>
        {!requiredDone && (
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 8 }}>
            Complete required steps (⭐) to activate your school.
          </div>
        )}
      </div>

      {/* Required steps */}
      <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10 }}>
        ⭐ {T('required', lang as never)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {requiredSteps.map(step => (
          <div key={step.id}
            className={`ob-step${completed[step.id] ? ' done' : ''}`}
            onClick={() => toggleStep(step.id)}>
            <div className={`ob-circle${completed[step.id] ? ' done' : ''}`}>
              {completed[step.id] ? '✓' : ''}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: completed[step.id] ? '#15803D' : '#111827' }}>
                  {step.icon} {T(resolveTitle(step, ctx), lang as never)}
                </div>
                <Link
                  href={step.href}
                  onClick={e => e.stopPropagation()}
                  style={{ fontSize: 12, color: '#4F46E5', textDecoration: 'none', fontWeight: 700, whiteSpace: 'nowrap', padding: '4px 10px', background: '#EEF2FF', borderRadius: 6 }}>
                  {T('edit', lang as never)} →
                </Link>
              </div>
              <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>
                {T(step.descKey, lang as never)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Optional steps */}
      <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10 }}>
        {T('other', lang as never)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {optionalSteps.map(step => (
          <div key={step.id}
            className={`ob-step${completed[step.id] ? ' done' : ''}`}
            onClick={() => toggleStep(step.id)}>
            <div className={`ob-circle${completed[step.id] ? ' done' : ''}`}>
              {completed[step.id] ? '✓' : ''}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: completed[step.id] ? '#15803D' : '#111827' }}>
                  {step.icon} {T(resolveTitle(step, ctx), lang as never)}
                </div>
                <Link
                  href={step.href}
                  onClick={e => e.stopPropagation()}
                  style={{ fontSize: 12, color: '#4F46E5', textDecoration: 'none', fontWeight: 700, whiteSpace: 'nowrap', padding: '4px 10px', background: '#EEF2FF', borderRadius: 6 }}>
                  {T('add', lang as never)} →
                </Link>
              </div>
              <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>
                {T(step.descKey, lang as never)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA row */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {requiredDone && (
          <Link href="/dashboard"
            style={{ flex: 1, padding: '13px', background: '#16A34A', color: '#fff', borderRadius: 10, fontSize: 15, fontWeight: 800, textDecoration: 'none', textAlign: 'center', minWidth: 140 }}>
            🎉 {T('dashboard', lang as never)} →
          </Link>
        )}
        <button
          onClick={() => setDismissed(true)}
          style={{ flex: 1, padding: '13px', background: '#F3F4F6', color: '#374151', borderRadius: 10, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', minWidth: 140 }}>
          {T('cancel', lang as never)}
        </button>
      </div>
    </Layout>
  );
}
