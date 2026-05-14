import Link from 'next/link';

const FEATURES = [
  { icon: '📄', title: 'AI Report Cards', desc: 'Generate personalised narrative reports for every student in seconds using Claude AI.' },
  { icon: '🎙', title: 'Teacher Evaluation', desc: 'Record classroom audio, transcribe with Whisper, and get AI coaching scores and feedback.' },
  { icon: '👥', title: 'Admissions CRM', desc: 'Score leads automatically, track the full pipeline, and never miss a high-priority enquiry.' },
  { icon: '⚡', title: 'Automation Layer', desc: 'Fee reminders, risk detection, and principal briefings — all running automatically every day.' },
  { icon: '📢', title: 'Smart Broadcasts', desc: 'AI-written WhatsApp messages to parents for fees, homework, events, and PTM reminders.' },
  { icon: '📊', title: 'Analytics Dashboard', desc: 'Real-time KPIs: attendance trends, fee collection, admissions funnel, and teacher performance.' },
  { icon: '⚠️', title: 'At-Risk Detection', desc: 'Automatically flag students with low attendance, poor scores, or overdue fees before they drop out.' },
  { icon: '📱', title: 'Parent Portal', desc: 'Mobile-first portal for parents to check attendance, fees, and report narratives anytime.' },
];

// PLANS aligned with billing API (app/api/billing/create-order/route.ts)
// starter=₹4,999 | growth=₹12,999 | campus=₹24,999
// Free plan is onboarded via /register with plan:'free' (no billing)
const PLANS = [
  {
    name: 'Free',
    price: '₹0',
    period: 'forever',
    color: '#6B7280',
    bg: '#F9FAFB',
    border: '#E5E7EB',
    cta: 'Start Free',
    ctaStyle: { background: '#F3F4F6', color: '#374151', border: '1px solid #D1D5DB' },
    features: ['Up to 100 students', '20 AI reports/month', '5 teacher evaluations', '10 broadcasts', 'Basic dashboard'],
    note: 'No credit card required',
  },
  {
    name: 'Starter',
    price: '₹4,999',
    period: 'per month',
    color: '#4F46E5',
    bg: '#EEF2FF',
    border: '#818CF8',
    cta: 'Get Started',
    ctaStyle: { background: '#4F46E5', color: '#fff' },
    badge: null as string | null,
    features: ['Up to 500 students', 'WhatsApp bot — 3 intents', 'AI report cards', 'Basic dashboard', 'CSV import', 'Email support'],
    note: 'Cancel anytime',
  },
  {
    name: 'Growth',
    price: '₹12,999',
    period: 'per month',
    color: '#4F46E5',
    bg: '#EEF2FF',
    border: '#818CF8',
    cta: 'Start Growth',
    ctaStyle: { background: '#4F46E5', color: '#fff' },
    badge: 'Most Popular' as string | null,
    features: ['Up to 2,000 students', 'Full WhatsApp bot', 'Teacher eval AI', 'Lead scoring + call analysis', 'Fee reminders + broadcasts', 'Power BI dashboards'],
    note: 'Cancel anytime',
  },
  {
    name: 'Campus',
    price: '₹24,999',
    period: 'per month',
    color: '#065F46',
    bg: '#ECFDF5',
    border: '#6EE7B7',
    cta: 'Contact Us',
    ctaStyle: { background: '#065F46', color: '#fff' },
    badge: null as string | null,
    features: ['Unlimited students + campuses', 'All Growth features', 'Custom ERP integration', 'Dedicated onboarding', 'SLA guarantee', 'White-label option'],
    note: 'Custom contracts available',
  },
];

export default function LandingPage() {
  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif', color: '#111827', background: '#fff', minHeight: '100vh' }}>

      {/* Nav */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #F3F4F6', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff' }}>S</div>
          <span style={{ fontWeight: 800, fontSize: 17, color: '#111827', letterSpacing: '-0.3px' }}>School OS</span>
          <span style={{ fontSize: 11, fontWeight: 700, background: '#DCFCE7', color: '#15803D', padding: '2px 8px', borderRadius: 20, marginLeft: 4 }}>BETA</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link href="/login" style={{ padding: '7px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600, color: '#374151', textDecoration: 'none' }}>
            Sign In
          </Link>
          <Link href="/parent/login" style={{ padding: '8px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600, color: '#6B7280', textDecoration: 'none', border: '1px solid #E5E7EB' }}>
            Parent / Student
          </Link>
          <Link href="/register" style={{ padding: '8px 18px', borderRadius: 9, fontSize: 14, fontWeight: 700, background: '#4F46E5', color: '#fff', textDecoration: 'none' }}>
            Start Free →
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ paddingTop: 120, paddingBottom: 80, textAlign: 'center', padding: '120px 24px 80px', background: 'linear-gradient(180deg, #FAFAFE 0%, #fff 100%)' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 20, padding: '5px 14px', fontSize: 13, fontWeight: 600, color: '#4338CA', marginBottom: 24 }}>
          🤖 Powered by Claude AI + Whisper
        </div>
        <h1 style={{ fontSize: 56, fontWeight: 900, color: '#0F172A', letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: 20, maxWidth: 780, margin: '0 auto 20px' }}>
          The AI Operating System<br />
          <span style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            for Indian Schools
          </span>
        </h1>
        <p style={{ fontSize: 19, color: '#6B7280', maxWidth: 580, margin: '0 auto 36px', lineHeight: 1.65 }}>
          Automate report cards, teacher evaluations, fee reminders, and parent communication — all from one intelligent platform.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/register" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 28px', borderRadius: 12, fontSize: 16, fontWeight: 700, background: '#4F46E5', color: '#fff', textDecoration: 'none', boxShadow: '0 4px 20px rgba(79,70,229,0.35)' }}>
            Start Free — No Credit Card →
          </Link>
          <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 28px', borderRadius: 12, fontSize: 16, fontWeight: 700, background: '#F9FAFB', color: '#374151', textDecoration: 'none', border: '1px solid #E5E7EB' }}>
            View Demo
          </Link>
        </div>
        <p style={{ marginTop: 16, fontSize: 13, color: '#9CA3AF' }}>Free forever on the Free plan · Built for Indian schools</p>
      </section>

      {/* Beta pill — replaced fabricated stats per Phase C */}
      <section style={{ background: '#0F172A', padding: '16px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(79,70,229,0.2)', border: '1px solid rgba(79,70,229,0.4)', borderRadius: 20, padding: '8px 20px', fontSize: 14, color: '#A5B4FC', fontWeight: 600 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#818CF8', display: 'inline-block' }} />
            Beta · Now onboarding schools across Hyderabad
          </span>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#4F46E5', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Everything You Need</div>
          <h2 style={{ fontSize: 38, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.8px', marginBottom: 12 }}>Built for how schools actually work</h2>
          <p style={{ fontSize: 17, color: '#6B7280', maxWidth: 500, margin: '0 auto' }}>Eight AI-powered modules working together, so you can focus on education.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: '22px 20px', transition: 'box-shadow 0.15s' }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#0F172A', marginBottom: 8 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ background: '#F9FAFB', padding: '80px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#4F46E5', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Simple Setup</div>
          <h2 style={{ fontSize: 36, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.8px', marginBottom: 48 }}>Up and running in 3 minutes</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {[
              { step: '01', title: 'Create your school', desc: 'Enter school name and email. Your account is ready instantly with demo data pre-loaded.' },
              { step: '02', title: 'Import your students', desc: 'Upload a CSV with student names, class, and parent phone numbers. That\'s all we need.' },
              { step: '03', title: 'Let AI do the work', desc: 'Reports, reminders, briefings, and risk alerts run automatically every day from 2am.' },
            ].map((s, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 14, padding: '28px 24px', border: '1px solid #E5E7EB', textAlign: 'left' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#4F46E5', letterSpacing: '0.1em', marginBottom: 14 }}>STEP {s.step}</div>
                <div style={{ fontWeight: 700, fontSize: 17, color: '#0F172A', marginBottom: 10 }}>{s.title}</div>
                <div style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.65 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ padding: '80px 24px', maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#4F46E5', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Pricing</div>
          <h2 style={{ fontSize: 38, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.8px', marginBottom: 12 }}>Simple, transparent pricing</h2>
          <p style={{ fontSize: 16, color: '#6B7280' }}>Start free. Upgrade when you need more.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          {PLANS.map((plan, i) => (
            <div key={i} style={{ background: plan.bg, border: `2px solid ${plan.border}`, borderRadius: 18, padding: '28px 24px', position: 'relative' }}>
              {plan.badge && (
                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#4F46E5', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 14px', borderRadius: 20, whiteSpace: 'nowrap', letterSpacing: '0.05em' }}>
                  {plan.badge}
                </div>
              )}
              <div style={{ fontWeight: 800, fontSize: 20, color: plan.color, marginBottom: 6 }}>{plan.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                <span style={{ fontSize: 36, fontWeight: 900, color: '#0F172A', letterSpacing: '-1px' }}>{plan.price}</span>
                <span style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 500 }}>/{plan.period}</span>
              </div>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 22 }}>{plan.note}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 24 }}>
                {plan.features.map((f, j) => (
                  <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151' }}>
                    <span style={{ color: plan.color, fontWeight: 700, fontSize: 15, flexShrink: 0 }}>✓</span>
                    {f}
                  </div>
                ))}
              </div>
              <Link href={plan.name === 'Campus' ? '/register?plan=campus' : '/register'} style={{ display: 'block', textAlign: 'center', padding: '12px', borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: 'none', ...plan.ctaStyle }}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section style={{ background: '#0F172A', padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 580, margin: '0 auto' }}>
          <h2 style={{ fontSize: 38, fontWeight: 900, color: '#fff', letterSpacing: '-1px', marginBottom: 16, lineHeight: 1.15 }}>
            Ready to modernise your school?
          </h2>
          <p style={{ fontSize: 17, color: '#94A3B8', marginBottom: 32, lineHeight: 1.6 }}>
            Join schools across Hyderabad using AI to save time, improve outcomes, and impress parents.
          </p>
          <Link href="/register" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '15px 32px', borderRadius: 12, fontSize: 17, fontWeight: 700, background: '#4F46E5', color: '#fff', textDecoration: 'none', boxShadow: '0 4px 24px rgba(79,70,229,0.4)' }}>
            Create Free Account →
          </Link>
          <p style={{ marginTop: 16, fontSize: 13, color: '#64748B' }}>No credit card · 14-day trial on Pro · Cancel anytime</p>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#0F172A', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: '#475569' }}>
          © 2025 School OS by Pranix AI Labs · Built for Indian schools
          <span style={{ margin: '0 10px', opacity: 0.3 }}>·</span>
          <Link href="/login" style={{ color: '#64748B', textDecoration: 'none' }}>Login</Link>
          <span style={{ margin: '0 10px', opacity: 0.3 }}>·</span>
          <Link href="/parent/login" style={{ color: '#64748B', textDecoration: 'none' }}>Parent Portal</Link>
          <span style={{ margin: '0 10px', opacity: 0.3 }}>·</span>
          <Link href="/student/login" style={{ color: '#64748B', textDecoration: 'none' }}>Student Portal</Link>
          <span style={{ margin: '0 10px', opacity: 0.3 }}>·</span>
          <Link href="/register" style={{ color: '#64748B', textDecoration: 'none' }}>Register</Link>
        </div>
      </footer>
    </div>
  );
}
