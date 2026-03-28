'use client';

import { useState, useEffect, FormEvent } from 'react';
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
    id: 'free', name: 'Free', price: '₹0', period: 'forever',
    color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB',
    limits: ['20 reports/mo', '5 evaluations', '10 broadcasts', '100 students'],
  },
  {
    id: 'pro', name: 'Pro', price: '₹2,999', period: 'per month',
    color: '#4F46E5', bg: '#EEF2FF', border: '#818CF8',
    limits: ['200 reports/mo', '50 evaluations', '100 broadcasts', '500 students', 'WhatsApp + Risk + PTM'],
    badge: 'Recommended',
  },
  {
    id: 'enterprise', name: 'Enterprise', price: '₹7,999', period: 'per month',
    color: '#065F46', bg: '#ECFDF5', border: '#6EE7B7',
    limits: ['Unlimited everything', 'API access', 'Custom branding', 'SLA + dedicated support'],
  },
];

export default function BillingPage() {
  const [school, setSchool] = useState<School | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('pro');
  const [upgradeMsg, setUpgradeMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then((d: { school: School; usage: Usage }) => {
      setSchool(d.school);
      setUsage(d.usage);
      setLoading(false);
    });
  }, []);

  function pct(used: number, max: number) {
    if (max === -1) return 0;
    return Math.min(100, Math.round((used / max) * 100));
  }

  async function handleUpgradeRequest(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch('/api/billing/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requested_plan: selectedPlan, message: upgradeMsg }),
      });
      setSubmitted(true);
    } finally { setSubmitting(false); }
  }

  const trialDaysLeft = school?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(school.trial_ends_at).getTime() - Date.now()) / 86400000))
    : null;

  const currentPlanMeta = PLANS.find(p => p.id === school?.plan) ?? PLANS[0];

  return (
    <Layout title="Billing & Plan" subtitle="Manage your subscription and usage">

      {loading ? (
        <div className="card"><div className="empty-state"><div className="empty-state-icon">💳</div><div className="empty-state-title">Loading billing info...</div></div></div>
      ) : (
        <>
          {/* Trial banner */}
          {trialDaysLeft !== null && trialDaysLeft <= 14 && school?.plan !== 'enterprise' && (
            <div style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', borderRadius: 14, padding: '18px 24px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 3 }}>
                  {trialDaysLeft > 0 ? `${trialDaysLeft} days left in your trial` : 'Your trial has ended'}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>Upgrade to Pro to keep all features running.</div>
              </div>
              <button onClick={() => setShowUpgrade(true)} style={{ background: '#fff', color: '#4F46E5', border: 'none', borderRadius: 9, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                Upgrade Now →
              </button>
            </div>
          )}

          {/* Current plan */}
          <div className="card" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: currentPlanMeta.bg, border: `2px solid ${currentPlanMeta.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>💳</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', marginBottom: 2 }}>CURRENT PLAN</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: currentPlanMeta.color, textTransform: 'capitalize' }}>{school?.plan}</div>
                {trialDaysLeft !== null && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>Trial ends in {trialDaysLeft} days</div>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Link href="/settings" className="btn btn-ghost btn-sm">Settings</Link>
              <button onClick={() => setShowUpgrade(true)} className="btn btn-primary btn-sm">Upgrade Plan</button>
            </div>
          </div>

          {/* Usage meters */}
          {usage && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 20 }}>
              {[
                { label: 'Reports Generated', used: usage.reports_generated, max: usage.max_reports_per_month, icon: '📄', color: '#4F46E5' },
                { label: 'Teacher Evaluations', used: usage.evaluations_done, max: usage.max_evaluations_per_month, icon: '🎙', color: '#A16207' },
                { label: 'Broadcasts Sent', used: usage.broadcasts_sent, max: usage.max_broadcasts_per_month, icon: '📢', color: '#B91C1C' },
                { label: 'Students Tracked', used: 0, max: usage.max_students, icon: '👨‍🎓', color: '#15803D' },
              ].map(item => {
                const p = pct(item.used, item.max);
                const isUnlimited = item.max === -1;
                const isWarning = p >= 80;
                return (
                  <div key={item.label} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 18 }}>{item.icon}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{item.label}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isWarning ? '#B91C1C' : '#374151' }}>
                        {item.used}{!isUnlimited && `/${item.max}`}
                      </span>
                    </div>
                    {!isUnlimited ? (
                      <>
                        <div style={{ height: 8, borderRadius: 4, background: '#F3F4F6', overflow: 'hidden', marginBottom: 6 }}>
                          <div style={{ height: '100%', width: `${p}%`, background: isWarning ? '#EF4444' : item.color, borderRadius: 4, transition: 'width 0.5s' }} />
                        </div>
                        {isWarning && (
                          <div style={{ fontSize: 11, color: '#B91C1C', fontWeight: 600 }}>
                            {p >= 100 ? '⛔ Limit reached — upgrade to continue' : `⚠️ ${p}% used`}
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>Unlimited on this plan</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Plan comparison */}
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 14 }}>Compare Plans</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
            {PLANS.map(plan => {
              const isCurrent = plan.id === school?.plan;
              return (
                <div key={plan.id} style={{ background: plan.bg, border: `2px solid ${isCurrent ? plan.color : plan.border}`, borderRadius: 14, padding: '20px', position: 'relative' }}>
                  {isCurrent && (
                    <div style={{ position: 'absolute', top: -10, right: 14, fontSize: 10, fontWeight: 800, background: plan.color, color: '#fff', padding: '3px 10px', borderRadius: 10 }}>CURRENT</div>
                  )}
                  {'badge' in plan && !isCurrent && (
                    <div style={{ position: 'absolute', top: -10, right: 14, fontSize: 10, fontWeight: 800, background: '#4F46E5', color: '#fff', padding: '3px 10px', borderRadius: 10 }}>{plan.badge}</div>
                  )}
                  <div style={{ fontWeight: 800, fontSize: 16, color: plan.color, marginBottom: 4 }}>{plan.name}</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#111827', marginBottom: 14 }}>{plan.price}<span style={{ fontSize: 12, fontWeight: 500, color: '#9CA3AF' }}>/{plan.period}</span></div>
                  {plan.limits.map((l, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#374151', marginBottom: 5, display: 'flex', gap: 6 }}>
                      <span style={{ color: plan.color, fontWeight: 700 }}>✓</span>{l}
                    </div>
                  ))}
                  {!isCurrent && (
                    <button onClick={() => { setSelectedPlan(plan.id); setShowUpgrade(true); }}
                      style={{ marginTop: 14, width: '100%', height: 36, borderRadius: 8, border: `1.5px solid ${plan.color}`, background: 'transparent', color: plan.color, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {plan.id === 'enterprise' ? 'Contact Sales' : 'Upgrade'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Upgrade modal */}
          {showUpgrade && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <div style={{ background: '#fff', borderRadius: 18, padding: '28px', maxWidth: 440, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                {submitted ? (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <div style={{ fontSize: 40, marginBottom: 16 }}>🎉</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 8 }}>Request Received!</div>
                    <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 24 }}>Our team will contact you within 24 hours to complete your upgrade.</div>
                    <button onClick={() => { setShowUpgrade(false); setSubmitted(false); }} className="btn btn-primary" style={{ width: '100%' }}>Done</button>
                  </div>
                ) : (
                  <>
                    <div style={{ fontWeight: 800, fontSize: 18, color: '#111827', marginBottom: 4 }}>Upgrade your plan</div>
                    <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>Select a plan and we'll contact you to complete the upgrade.</div>

                    <form onSubmit={handleUpgradeRequest}>
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>SELECT PLAN</label>
                        <div style={{ display: 'flex', gap: 10 }}>
                          {['pro', 'enterprise'].map(p => (
                            <button key={p} type="button" onClick={() => setSelectedPlan(p)}
                              style={{ flex: 1, height: 42, borderRadius: 9, border: `2px solid ${selectedPlan === p ? '#4F46E5' : '#E5E7EB'}`, background: selectedPlan === p ? '#EEF2FF' : '#fff', color: selectedPlan === p ? '#4F46E5' : '#374151', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize' }}>
                              {p} {p === 'pro' ? '₹2,999' : '₹7,999'}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div style={{ marginBottom: 20 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>MESSAGE (optional)</label>
                        <textarea value={upgradeMsg} onChange={e => setUpgradeMsg(e.target.value)} rows={3}
                          placeholder="Any specific requirements or questions?"
                          style={{ width: '100%', borderRadius: 9, border: '1px solid #D1D5DB', background: '#F9FAFB', fontSize: 14, padding: '10px 14px', outline: 'none', fontFamily: 'inherit', color: '#111827', boxSizing: 'border-box', resize: 'vertical' }} />
                      </div>

                      <div style={{ display: 'flex', gap: 10 }}>
                        <button type="button" onClick={() => setShowUpgrade(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
                        <button type="submit" disabled={submitting} className="btn btn-primary" style={{ flex: 2 }}>
                          {submitting ? 'Sending...' : 'Request Upgrade →'}
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
