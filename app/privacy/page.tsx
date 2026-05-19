import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy — EdProSys',
  description: 'EdProSys privacy policy for school management platform by Pranix AI Labs Pvt Ltd.',
};

export default function PrivacyPage() {
  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', maxWidth: 780, margin: '0 auto', padding: '40px 24px 80px', color: '#374151' }}>
      <div style={{ marginBottom: 32 }}>
        <Link href="/" style={{ color: '#4F46E5', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>← EdProSys</Link>
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 900, color: '#111827', marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 32 }}>Last updated: May 2026 · Pranix AI Labs Pvt Ltd (DIPP241828)</p>

      {[
        { title: '1. Information We Collect', body: 'We collect information necessary to provide school management services. This includes: institutional data (school name, contact details, institution type); staff and administrator data (name, email, role); student data (name, class, section, attendance, marks, fee records) provided by the school institution; parent contact information (phone number, email) provided by the school; and usage data (login events, feature usage) for service improvement.' },
        { title: '2. How We Use Information', body: 'We use collected information solely to: provide and improve the EdProSys platform; send automated school communications (attendance alerts, fee reminders) as configured by the institution; generate AI-powered reports and insights for school management; enable WhatsApp-based parent communication as configured by the school admin. We do not sell personal data to third parties.' },
        { title: '3. Data Storage', body: 'All data is stored on Supabase infrastructure hosted on AWS (Sydney region). Data is encrypted at rest and in transit using industry-standard TLS 1.2+. Database access is restricted using Row Level Security (RLS), ensuring complete tenant isolation — each school can only access its own data.' },
        { title: '4. WhatsApp Communications', body: 'EdProSys uses Twilio\'s WhatsApp Business API to send automated notifications to parents on behalf of schools. Message content is determined by the school institution. Parents can opt out by contacting their school directly. We do not send unsolicited marketing messages via WhatsApp.' },
        { title: '5. AI Features', body: 'EdProSys uses AI services (Anthropic Claude API) to generate report card narratives, teacher evaluation scores, and principal briefings. No student personally identifiable information is sent to AI providers beyond what is necessary to generate the requested output. AI-generated content is always reviewed by school administrators before use.' },
        { title: '6. Children\'s Privacy', body: 'EdProSys processes student data on behalf of educational institutions under their direction. Schools are responsible for obtaining necessary consents from parents/guardians as required by applicable law. We process student data only as a data processor under the school institution\'s instructions.' },
        { title: '7. Data Retention', body: 'We retain data as long as the school\'s account is active. Upon account termination, data is archived for 30 days and then permanently deleted. Schools can request data export at any time by contacting support@pranixailabs.com.' },
        { title: '8. Your Rights', body: 'Individuals whose data is processed by EdProSys may request access, correction, or deletion of their data by contacting their school institution, which controls the data. Schools may also contact us directly at support@pranixailabs.com.' },
        { title: '9. Security', body: 'We implement industry-standard security measures including: TLS encryption for all data in transit; AES-256 encryption for data at rest; Row Level Security (RLS) for database access control; regular security monitoring; Aadhaar data masking (last 8 digits only stored). We hold DPIIT recognition and comply with applicable Indian data protection requirements.' },
        { title: '10. Contact', body: 'For privacy questions, contact us at: privacy@pranixailabs.com · Pranix AI Labs Pvt Ltd · Hyderabad, Telangana, India · CIN: U62011TS2026PTC209631' },
      ].map(s => (
        <div key={s.title} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#111827', marginBottom: 8 }}>{s.title}</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: '#4B5563' }}>{s.body}</p>
        </div>
      ))}
    </div>
  );
}
