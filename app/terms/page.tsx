import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service — EdProSys',
  description: 'EdProSys terms of service for school management platform by Pranix AI Labs Pvt Ltd.',
};

export default function TermsPage() {
  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', maxWidth: 780, margin: '0 auto', padding: '40px 24px 80px', color: '#374151' }}>
      <div style={{ marginBottom: 32 }}>
        <Link href="/" style={{ color: '#4F46E5', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>← EdProSys</Link>
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 900, color: '#111827', marginBottom: 8 }}>Terms of Service</h1>
      <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 32 }}>Last updated: May 2026 · Pranix AI Labs Pvt Ltd (DIPP241828)</p>

      {[
        { title: '1. Acceptance', body: 'By accessing or using EdProSys ("the Platform"), you agree to these Terms of Service. If you are using EdProSys on behalf of an educational institution, you represent that you have authority to bind that institution to these terms.' },
        { title: '2. Service Description', body: 'EdProSys is a cloud-based school management platform providing features including student information management, attendance tracking, fee management, parent communication via WhatsApp, AI-generated report cards, teacher evaluation, and event gallery management.' },
        { title: '3. Account Responsibilities', body: 'School administrators are responsible for: maintaining the security of login credentials; ensuring accuracy of student and staff data entered into the platform; obtaining necessary consents from parents and staff; complying with applicable data protection laws; using the platform in accordance with these terms.' },
        { title: '4. Data Ownership', body: 'All student, staff, and institutional data entered into EdProSys remains the property of the school institution. Pranix AI Labs processes this data solely to provide the platform services. We do not claim ownership of any data you enter.' },
        { title: '5. AI Features', body: 'AI-generated content (report card narratives, teacher evaluations, principal briefings) is provided as-is and must be reviewed by qualified educators before use. Pranix AI Labs does not guarantee the accuracy of AI-generated content and is not liable for decisions made solely on the basis of AI-generated outputs.' },
        { title: '6. WhatsApp Communications', body: 'Schools using the WhatsApp integration are responsible for: ensuring parent consent for WhatsApp communications; compliance with WhatsApp Business policies; accuracy of automated message content. Pranix AI Labs provides the technical infrastructure; the school institution is responsible for message content and appropriate use.' },
        { title: '7. Subscription and Payment', body: 'EdProSys offers a free plan and paid plans. Free plan limitations apply as displayed in the platform. Paid plan fees are charged as per the pricing displayed at the time of subscription. All fees are in Indian Rupees (INR) and exclusive of applicable taxes.' },
        { title: '8. Limitation of Liability', body: 'To the maximum extent permitted by law, Pranix AI Labs shall not be liable for indirect, incidental, or consequential damages. Our total liability is limited to the fees paid by you in the preceding 3 months.' },
        { title: '9. Governing Law', body: 'These terms are governed by the laws of India. Any disputes shall be subject to the jurisdiction of courts in Hyderabad, Telangana.' },
        { title: '10. Contact', body: 'For legal questions, contact: legal@pranixailabs.com · Pranix AI Labs Pvt Ltd · Hyderabad, Telangana, India · CIN: U62011TS2026PTC209631' },
      ].map(s => (
        <div key={s.title} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#111827', marginBottom: 8 }}>{s.title}</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: '#4B5563' }}>{s.body}</p>
        </div>
      ))}
    </div>
  );
}
