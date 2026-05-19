import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'EdProSys — School Management Platform for Indian Schools',
  description: 'AI-powered school management for Indian K-12 schools. WhatsApp parent bot, automated report cards, teacher evaluation, attendance, fees — all in one platform.',
};

const FEATURES = [
  { icon: '💬', title: 'WhatsApp Parent Bot', desc: 'Automated attendance alerts, fee reminders, and homework updates sent to parents on WhatsApp — zero manual effort.' },
  { icon: '📄', title: 'AI Report Cards', desc: 'Generate personalised student narratives in seconds using AI. Works in English and Telugu.' },
  { icon: '✅', title: 'Attendance & Marks', desc: 'Teachers mark attendance and enter marks from their phones. Parents see updates instantly.' },
  { icon: '💰', title: 'Fee Management', desc: 'Track fees, send reminders, and manage collections — with Razorpay integration for online payments.' },
  { icon: '🎙', title: 'Teacher Evaluation', desc: 'Upload classroom recordings and get AI coaching scores and feedback automatically.' },
  { icon: '📊', title: 'Principal Briefings', desc: 'Daily AI-generated intelligence briefings for principals covering attendance, fees, risks, and events.' },
];

const INSTITUTION_TYPES = [
  { icon: '🏫', label: 'K-12 Schools', desc: 'CBSE · State Board · ICSE' },
  { icon: '🏛', label: 'Government Schools', desc: 'DISE / UDISE reporting ready' },
  { icon: '📚', label: 'Coaching Centers', desc: 'Batch management · Test scores' },
  { icon: '🎓', label: 'Junior Colleges', desc: 'Class 11-12 · PUC · Intermediate' },
];

export default function HomePage() {
  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#fff', minHeight: '100vh' }}>

      {/* NAV */}
      <nav style={{ padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F3F4F6', position: 'sticky', top: 0, background: '#fff', zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, color: '#fff' }}>E</div>
          <span style={{ fontWeight: 800, fontSize: 17, color: '#111827', letterSpacing: '-0.3px' }}>EdProSys</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link href="/login" style={{ padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#374151', textDecoration: 'none', background: '#F3F4F6' }}>Sign In</Link>
          <Link href="/register" style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', textDecoration: 'none', background: '#4F46E5' }}>Get Started Free →</Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ textAlign: 'center', padding: '72px 24px 60px', background: 'linear-gradient(180deg, #EEF2FF 0%, #fff 100%)' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #E0E7FF', borderRadius: 20, padding: '5px 14px', marginBottom: 24, fontSize: 12, fontWeight: 700, color: '#4F46E5' }}>
          🇮🇳 Built for Indian Schools
        </div>
        <h1 style={{ fontSize: 'clamp(28px, 6vw, 52px)', fontWeight: 900, color: '#111827', letterSpacing: '-1.5px', lineHeight: 1.1, margin: '0 auto 20px', maxWidth: 700 }}>
          The Operating System<br />for Indian Education
        </h1>
        <p style={{ fontSize: 'clamp(15px, 2vw, 18px)', color: '#6B7280', maxWidth: 520, margin: '0 auto 36px', lineHeight: 1.6 }}>
          WhatsApp parent communication, AI report cards, automated attendance — all in one platform designed for how Indian schools actually work.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/register" style={{ padding: '14px 28px', borderRadius: 12, fontSize: 15, fontWeight: 700, color: '#fff', textDecoration: 'none', background: '#4F46E5', boxShadow: '0 4px 16px rgba(79,70,229,0.35)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Start for Free →
          </Link>
          <Link href="/login" style={{ padding: '14px 28px', borderRadius: 12, fontSize: 15, fontWeight: 600, color: '#374151', textDecoration: 'none', background: '#fff', border: '1px solid #E5E7EB', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Sign In to Your School
          </Link>
        </div>
        <p style={{ marginTop: 16, fontSize: 12, color: '#9CA3AF' }}>Free to start · No credit card needed · Set up in 5 minutes</p>
      </section>

      {/* WHO IT'S FOR */}
      <section style={{ padding: '48px 24px', maxWidth: 900, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 800, color: '#111827', marginBottom: 32 }}>Built for every type of institution</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          {INSTITUTION_TYPES.map(t => (
            <div key={t.label} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 14, padding: '20px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{t.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 4 }}>{t.label}</div>
              <div style={{ fontSize: 12, color: '#6B7280' }}>{t.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: '48px 24px', background: '#F9FAFB' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 800, color: '#111827', marginBottom: 8 }}>Everything your school needs</h2>
          <p style={{ textAlign: 'center', color: '#6B7280', fontSize: 15, marginBottom: 40 }}>Designed for the Indian school context — WhatsApp first, mobile first, AI powered.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: '22px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: 24, marginBottom: 10 }}>{f.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 6 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROLE TILES */}
      <section style={{ padding: '48px 24px', maxWidth: 900, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 'clamp(20px, 3vw, 26px)', fontWeight: 800, color: '#111827', marginBottom: 32 }}>One platform. Every stakeholder.</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          {[
            { role: 'Principal', desc: 'Daily AI briefing, staff accountability, risk alerts', icon: '🎓' },
            { role: 'Admin', desc: 'Students, fees, staff, broadcasts — full control', icon: '⚙️' },
            { role: 'Teacher', desc: 'Attendance, marks, homework from their phone', icon: '📝' },
            { role: 'Parent', desc: 'WhatsApp updates, fee tracker, homework alerts', icon: '👨‍👩‍👧' },
            { role: 'Student', desc: 'Timetable, homework, marks — all in one place', icon: '🎒' },
            { role: 'Accountant', desc: 'Fee collection, payroll, reports', icon: '💰' },
          ].map(r => (
            <div key={r.role} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: '16px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{r.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#111827', marginBottom: 4 }}>{r.role}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.4 }}>{r.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '60px 24px', background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(22px, 4vw, 36px)', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', marginBottom: 12 }}>
          Ready to transform your school?
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 15, marginBottom: 32 }}>
          Join schools across India already using EdProSys. Set up in 5 minutes.
        </p>
        <Link href="/register" style={{ padding: '16px 36px', borderRadius: 12, fontSize: 16, fontWeight: 700, color: '#4F46E5', textDecoration: 'none', background: '#fff', display: 'inline-block', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
          Create your school account →
        </Link>
        <p style={{ marginTop: 16, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
          Free forever for schools under 50 students
        </p>
      </section>

      {/* FOOTER — updated with legal links */}
      <footer style={{ padding: '28px 24px 20px', borderTop: '1px solid #F3F4F6' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: '#fff' }}>E</div>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>EdProSys</span>
            <span style={{ color: '#9CA3AF', fontSize: 12 }}>by Pranix AI Labs</span>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <Link href="/login" style={{ color: '#6B7280', fontSize: 13, textDecoration: 'none' }}>Sign In</Link>
            <Link href="/register" style={{ color: '#6B7280', fontSize: 13, textDecoration: 'none' }}>Register</Link>
            <a href="mailto:support@pranixailabs.com" style={{ color: '#6B7280', fontSize: 13, textDecoration: 'none' }}>Support</a>
            <Link href="/privacy" style={{ color: '#6B7280', fontSize: 13, textDecoration: 'none' }}>Privacy</Link>
            <Link href="/terms" style={{ color: '#6B7280', fontSize: 13, textDecoration: 'none' }}>Terms</Link>
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#9CA3AF' }}>
          © 2026 Pranix AI Labs Pvt Ltd · CIN: U62011TS2026PTC209631 · DIPP241828 · UDYAM-TS-02-0307772
        </div>
      </footer>

    </div>
  );
}
