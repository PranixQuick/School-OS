import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Data Deletion — EdProSys',
  description: 'How to request account and data deletion from EdProSys, the school management platform by Pranix AI Labs Pvt Ltd.',
};

export default function DataDeletionPage() {
  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', maxWidth: 780, margin: '0 auto', padding: '40px 24px 80px', color: '#374151' }}>
      <div style={{ marginBottom: 32 }}>
        <Link href="/" style={{ color: '#4F46E5', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>← EdProSys</Link>
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 900, color: '#111827', marginBottom: 8 }}>Data Deletion Policy</h1>
      <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 32 }}>Last updated: June 2026 · Pranix AI Labs Pvt Ltd (DIPP241828)</p>

      {[
        { title: '1. Overview', body: 'EdProSys is a school management platform operated by Pranix AI Labs Pvt Ltd. Schools (the institutions using EdProSys) are the controllers of the data they enter; EdProSys acts as a data processor on their behalf. This page explains how account owners, staff, parents, and students can request deletion of their personal data and accounts.' },
        { title: '2. What Can Be Deleted', body: 'On a valid deletion request we remove: account login credentials and access PINs; staff and administrator profiles; student records (name, class, section, attendance, marks, fee records); and parent contact information (phone number, email). Where you ask us to delete an entire school account, all of the above for that institution is removed.' },
        { title: '3. How to Request Deletion', body: 'Parents and students: contact your school administrator, who controls your data, or email us at support@pranixailabs.com from the contact on file. School owners and administrators: email support@pranixailabs.com from your registered admin email with the subject "Data Deletion Request" and your school name. We may ask you to verify ownership of the account before processing. There is no charge for a deletion request.' },
        { title: '4. What to Include', body: 'To help us locate and verify your records, please include: your name; your role (owner, admin, teacher, parent, or student); your school name; and the email or phone number associated with the account. For a student or parent record, the student admission number (if known) helps us locate the correct record.' },
        { title: '5. Timeline', body: 'We acknowledge deletion requests within 7 business days. For an individual record, deletion is completed within 30 days of verification. For a full school account: upon termination the account data is archived for 30 days (to allow recovery in case of an accidental request) and then permanently deleted from active systems.' },
        { title: '6. Data That May Be Retained', body: 'After deletion we may retain a limited set of information only where required: minimal records needed to comply with legal, tax, or audit obligations; and aggregated or anonymised statistics that can no longer identify an individual. Such retained data is never used to re-identify a deleted individual.' },
        { title: '7. Backups', body: 'Deleted data may persist in encrypted backups for a short period after deletion from active systems. Backups are rotated on a rolling schedule and the deleted data is purged as those backups expire. Restored backups are re-processed to honour prior deletion requests.' },
        { title: '8. Contact', body: 'For data deletion requests or questions, contact us at: support@pranixailabs.com · privacy@pranixailabs.com · Pranix AI Labs Pvt Ltd · Hyderabad, Telangana, India · CIN: U62011TS2026PTC209631' },
      ].map(s => (
        <div key={s.title} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#111827', marginBottom: 8 }}>{s.title}</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: '#4B5563' }}>{s.body}</p>
        </div>
      ))}
    </div>
  );
}
