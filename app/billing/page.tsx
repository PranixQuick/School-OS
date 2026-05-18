'use client';
import Layout from '@/components/Layout';
import Link from 'next/link';
export default function BillingPage() {
  return (
    <Layout title="Billing" subtitle="Subscription and plan management">
      <div style={{ background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: 12, padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>💳</div>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#92400E', marginBottom: 8 }}>Billing Module</div>
        <div style={{ fontSize: 13, color: '#92400E', marginBottom: 16 }}>Subscription management is handled directly by the Pranix team during the pilot phase. Contact us at <strong>support@pranixailabs.com</strong> for any billing queries.</div>
        <Link href="/dashboard" className="btn btn-primary btn-sm">← Back to Dashboard</Link>
      </div>
    </Layout>
  );
}
