'use client';

// PATH: app/billing/page.tsx
// Real Razorpay checkout integration — replaces manual upgrade request form

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';

interface School { name: string; plan: string; trial_ends_at: string | null; billing_email: string | null; created_at: string; }
interface Usage {
  reports_generated: number; evaluations_done: number; broadcasts_sent: number; leads_scored: number;
  max_reports_per_month: number; max_evaluations_per_month: number; max_broadcasts_per_month: number; max_students: number;
  reset_at: string; plan: string;
}

const PLANS = [
  {
    id: 'starter', name: 'Starter', price: '₹4,999', period: 'per month',
    color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB',
    limits: ['100 reports/mo', '10 evaluations', '20 broadcasts', '500 students'],
  },
  {
    id: 'growth', name: 'Growth', price: '₹12,999', period: 'per month',
    color: '#4F46E5', bg: '#EEF2FF', border: '#818CF8',
    limits: ['500 reports/mo', '50 evaluations', '100 broadcasts', '2,000 students', 'WhatsApp + Risk + PTM'],
    badge: 'Recommended',
  },
  {
    id: 'campus', name: 'Campus', price: '₹24,999', period: 'per month',
    color: '#065F46', bg: '#ECFDF5', border: '#6EE7B7',
    limits: ['Unlimited everything', 'API access', 'Custom branding', 'SLA + dedicated support'],
  },
];

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open(): void };
  }
}

export default function BillingPage() {
  const [school, setSchool] = useState<School | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null); // plan id being paid
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('growth');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [razorpayAvailable, setRazorpayAvailable] = useState(false);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then((d: { school: School; usage: Usage }) => {
      setSchool(d.school); setUsage(d.usage); setLoading(false);
    });
    // Load Razorpay script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => setRazorpayAvailable(true);
    document.head.appendChild(script);
    return () => { try { document.head.removeChild(script); } catch {} };
  }, []);

  function pct(used: number, max: number) {
    if (max <= 0) return 0;
    return Math.min(100, Math.round((used / max) * 100));
  }

  async function handlePayment(planId: string) {
    setPaying(planId);
    try {
      const res = await fetch('/api/billing/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      });
      const order = await res.json() as { order_id?: string; amount?: number; currency?: string; key_id?: string; plan_name?: string; prefill?: { name: string }; error?: string; setup?: string[] };

      if (!res.ok || !order.order_id) {
        // Razorpay not configured — show manual fallback
        if (order.setup) {
          alert(`Payment gateway not yet configured.\n\nTo enable:\n${order.setup.join('\n')}\n\nContact support to upgrade manually.`);
        } else {
          alert(order.error ?? 'Payment setup failed.');
        }
        setPaying(null);
        return;
      }

      if (!razorpayAvailable || !window.Razorpay) {
        alert('Payment window could not be opened. Please try again or contact support.');
        setPaying(null);
        return;
      }

      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency ?? 'INR',
        name: 'School OS',
        description: order.plan_name,
        order_id: order.order_id,
        prefill: { name: order.prefill?.name ?? school?.name ?? '', email: school?.billing_email ?? '' },
        theme: { color: '#4F46E5' },
        handler: () => {
          // Payment captured — webhook will update the plan
          setPaymentSuccess(true);
          setShowUpgrade(false);
          setPaying(null);
          // Refresh usage after 2s to reflect new plan
          setTimeout(() => {
            fetch('/api/settings').then(r => r.json()).then((d: { school: School; usage: Usage }) => {
              setSchool(d.school); setUsage(d.usage);
            });
          }, 2000);
        },
        modal: {
          ondismiss: () => setPaying(null),
        },
      });

      rzp.open();
    } catch (err) {
      alert(`Error: ${String(err)}`);
      setPaying(null);
    }
  }

  const trialDaysLeft = school?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(school.trial_ends_at).getTime() - Date.now()) / 86400000))
    : null;
  const currentPlanMeta = PLANS.find(p => p.id === school?.plan) ?? PLANS[0];

  return (
    <Layout title="Billing & Plan" subtitle="Manage your subscription and usage">

      {paymentSuccess && (
        <div className="alert alert-info" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, background: '#DCFCE7', border: '1px solid #BBF7D0' }}>
          <span style={{ fontSize: 22 }}>🎉</span>
          <div><div style={{ fontWeight: 700, color: '#15803D' }}>Payment Successful!</div><div style={{ fontSize: 13, color: '#166534' }}>Your plan has been upgraded. New limits are active.</div></div>
        </div>
      )}

      {loading ? (
        <div className="card"><div className="empty-state"><div className="empty-state-icon">💳</div><div className="empty-state-title">Loading billing info...</div></div></div>
      ) : (
        <>
          {trialDaysLeft !== null && trialDaysLeft <= 14 && school?.plan === 'free' && (
            <div style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', borderRadius: 14, padding: '18px 24px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 3 }}>
                  {trialDaysLeft > 0 ? `${trialDaysLeft} days left in your trial` : 'Your trial has ended'}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>Upgrade to Growth to keep all features running.</div>
              </div>
              <button onClick={() => { setSelectedPlan('growth'); setShowUpgrade(true); }}
                style={{ background: '#fff', color: '#4F46E5', border: 'none', borderRadius: 9, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                Upgrade Now →
              </button>
            </div>
          )}

          <div className="card" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: currentPlanMeta.bg, border: `2px solid ${currentPlanMeta.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>💳</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', marginBottom: 2 }}>CURRENT PLAN</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: currentPlanMeta.color, textTransform: 'capitalize' }}>{school?.plan}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Link href="/settings" className="btn btn-ghost btn-sm">Settings</Link>
              <button onClick={() => setShowUpgrade(true)} className="btn btn-primary btn-sm">Upgrade Plan</button>
            </div>
          </div>

          {usage && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 20 }}>
              {[
                { label: 'Reports Generated', used: usage.reports_generated, max: usage.max_reports_per_month, icon: '📄', color: '#4F46E5' },
                { label: 'Teacher Evaluations', used: usage.evaluations_done, max: usage.max_evaluations_per_month, icon: '🎙', color: '#A16207' },
                { label: 'Broadcasts Sent', used: usage.broadcasts_sent, max: usage.max_broadcasts_per_month, icon: '📢', color: '#B91C1C' },
                { label: 'Students (max)', used: 0, max: usage.max_students, icon: '👨‍🎓', color: '#15803D' },
              ].map(item => {
                const p = pct(item.used, item.max);
                const isWarning = p >= 80;
                return (
                  <div key={item.label} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 18 }}>{item.icon}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{item.label}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isWarning ? '#B91C1C' : '#374151' }}>{item.used}/{item.max}</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: '#F3F4F6', overflow: 'hidden', marginBottom: 6 }}>
                      <div style={{ height: '100%', width: `${p}%`, background: isWarning ? '#EF4444' : item.color, borderRadius: 4, transition: 'width 0.5s' }} />
                    </div>
                    {isWarning && <div style={{ fontSize: 11, color: '#B91C1C', fontWeight: 600 }}>{p >= 100 ? '⛔ Limit reached — upgrade to continue' : `⚠️ ${p}% used`}</div>}
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 14 }}>Compare Plans</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
            {PLANS.map(plan => {
              const isCurrent = plan.id === school?.plan;
              const isLoading = paying === plan.id;
              return (
                <div key={plan.id} style={{ background: plan.bg, border: `2px solid ${isCurrent ? plan.color : plan.border}`, borderRadius: 14, padding: '20px', position: 'relative' }}>
                  {isCurrent && <div style={{ position: 'absolute', top: -10, right: 14, fontSize: 10, fontWeight: 800, background: plan.color, color: '#fff', padding: '3px 10px', borderRadius: 10 }}>CURRENT</div>}
                  {'badge' in plan && !isCurrent && <div style={{ position: 'absolute', top: -10, right: 14, fontSize: 10, fontWeight: 800, background: '#4F46E5', color: '#fff', padding: '3px 10px', borderRadius: 10 }}>{(plan as typeof plan & { badge: string }).badge}</div>}
                  <div style={{ fontWeight: 800, fontSize: 16, color: plan.color, marginBottom: 4 }}>{plan.name}</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#111827', marginBottom: 14 }}>{plan.price}<span style={{ fontSize: 12, fontWeight: 500, color: '#9CA3AF' }}>/{plan.period}</span></div>
                  {plan.limits.map((l, i) => <div key={i} style={{ fontSize: 12, color: '#374151', marginBottom: 5, display: 'flex', gap: 6 }}><span style={{ color: plan.color, fontWeight: 700 }}>✓</span>{l}</div>)}
                  {!isCurrent && (
                    <button
                      onClick={() => handlePayment(plan.id)}
                      disabled={isLoading || !!paying}
                      style={{ marginTop: 14, width: '100%', height: 40, borderRadius: 8, border: `1.5px solid ${plan.color}`, background: isLoading ? plan.bg : 'transparent', color: plan.color, fontSize: 13, fontWeight: 700, cursor: paying ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: paying && !isLoading ? 0.5 : 1 }}
                    >
                      {isLoading ? 'Opening payment...' : 'Upgrade →'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {showUpgrade && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: '28px', maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#111827', marginBottom: 4 }}>Choose a Plan</div>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>Select a plan to proceed with secure Razorpay checkout.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {PLANS.filter(p => p.id !== school?.plan).map(p => (
                <button key={p.id} type="button" onClick={() => setSelectedPlan(p.id)}
                  style={{ width: '100%', padding: '14px 16px', borderRadius: 10, border: `2px solid ${selectedPlan === p.id ? p.color : '#E5E7EB'}`, background: selectedPlan === p.id ? p.bg : '#fff', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: p.color, fontSize: 15 }}>{p.name}</span>
                  <span style={{ fontWeight: 800, color: '#111827', fontSize: 16 }}>{p.price}<span style={{ fontSize: 11, fontWeight: 400, color: '#9CA3AF' }}>/mo</span></span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowUpgrade(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
              <button onClick={() => { setShowUpgrade(false); handlePayment(selectedPlan); }} className="btn btn-primary" style={{ flex: 2 }}>
                Pay with Razorpay →
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
          }
