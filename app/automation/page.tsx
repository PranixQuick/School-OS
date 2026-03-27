'use client';

import { useState } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';

const MODULES = [
  { title: 'Fee Reminders', desc: 'AI-written broadcast messages for pending/overdue fees', href: '/automation/broadcasts', icon: '💳', color: '#B91C1C', bg: '#FEF2F2', count: null, badge: 'Broadcast' },
  { title: 'Homework Broadcast', desc: 'Send homework updates to parents by class', href: '/automation/broadcasts?type=homework', icon: '📚', color: '#1D4ED8', bg: '#DBEAFE', count: null, badge: 'Broadcast' },
  { title: 'Principal Briefing', desc: 'Daily AI-generated school intelligence report', href: '/automation/briefing', icon: '📋', color: '#065F46', bg: '#ECFDF5', count: null, badge: 'Daily' },
  { title: 'PTM Scheduler', desc: 'Schedule parent-teacher meetings and manage slots', href: '/automation/ptm', icon: '🗓', color: '#6D28D9', bg: '#F5F3FF', count: null, badge: 'Schedule' },
  { title: 'At-Risk Students', desc: 'AI detects students with attendance/grade/fee issues', href: '/automation/risk', icon: '⚠️', color: '#B45309', bg: '#FFFBEB', count: null, badge: 'AI Alert' },
  { title: 'Teacher Attendance', desc: 'Mark and track daily teacher attendance', href: '/automation/teacher-attendance', icon: '✅', color: '#15803D', bg: '#F0FDF4', count: null, badge: 'Daily' },
];

export default function AutomationPage() {
  return (
    <Layout title="Automation" subtitle="Phase 2 — AI-powered school operations">
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#EEF2FF', borderRadius: 20, padding: '5px 14px', marginBottom: 16 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4F46E5' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#4F46E5', letterSpacing: '0.05em' }}>PHASE 2 — AUTOMATION LAYER</span>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111827', margin: '0 0 6px', letterSpacing: '-0.5px' }}>
          Automation Control Centre
        </h1>
        <p style={{ fontSize: 14, color: '#6B7280', margin: 0 }}>
          AI-powered broadcast, scheduling, detection, and daily intelligence tools.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {MODULES.map(mod => (
          <Link key={mod.title} href={mod.href} style={{ textDecoration: 'none' }}>
            <div className="card" style={{ cursor: 'pointer', transition: 'box-shadow 0.15s, transform 0.1s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = ''; (e.currentTarget as HTMLDivElement).style.transform = ''; }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: mod.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                  {mod.icon}
                </div>
                <span className="badge badge-indigo" style={{ fontSize: 10 }}>{mod.badge}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 6 }}>{mod.title}</div>
              <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.55, marginBottom: 16 }}>{mod.desc}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: mod.color }}>Open module →</div>
            </div>
          </Link>
        ))}
      </div>
    </Layout>
  );
}
