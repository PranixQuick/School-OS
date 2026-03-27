'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#F8F7F4',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <nav style={{
        background: '#fff',
        borderBottom: '1px solid #E8E6DF',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        padding: '0 32px',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: '#0F6E56',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>S</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#1A1A18', letterSpacing: '-0.3px' }}>
            School OS
          </span>
        </div>
        <span style={{ fontSize: 13, color: '#888780' }}>Suchitra Academy · Admin</span>
      </nav>

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '60px 24px', textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: '#E1F5EE', borderRadius: 20,
          padding: '5px 14px', marginBottom: 24,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#0F6E56' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#0F6E56', letterSpacing: '0.05em' }}>
            AI-FIRST SCHOOL PLATFORM
          </span>
        </div>

        <h1 style={{
          fontSize: 44, fontWeight: 800, color: '#1A1A18',
          letterSpacing: '-1px', lineHeight: 1.15,
          marginBottom: 16, maxWidth: 580,
        }}>
          The Operating System for Modern Schools
        </h1>

        <p style={{
          fontSize: 17, color: '#5F5E5A', lineHeight: 1.7,
          maxWidth: 480, marginBottom: 48,
        }}>
          AI-powered tools for report cards, teacher evaluation,
          admissions, and parent communication.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 16, maxWidth: 640, width: '100%',
        }}>
          {[
            { title: 'Report Cards', desc: 'AI narratives + download', href: '/report-cards', color: '#0F6E56', bg: '#E1F5EE', status: 'Live' },
            { title: 'Teacher Eval', desc: 'Audio to coaching report', href: '/teacher-eval', color: '#854F0B', bg: '#FAEEDA', status: 'Soon' },
            { title: 'Admissions', desc: 'Lead scoring + CRM', href: '/admissions', color: '#3C3489', bg: '#EEEDFE', status: 'Soon' },
            { title: 'WhatsApp Bot', desc: 'Parent assistant 24/7', href: '/whatsapp', color: '#993C1D', bg: '#FAECE7', status: 'Deployed' },
          ].map(card => (
            <Link key={card.href} href={card.href} style={{ textDecoration: 'none' }}>
              <div style={{
                background: '#fff',
                border: '1px solid #E8E6DF',
                borderRadius: 14, padding: '22px 20px',
                textAlign: 'left', cursor: 'pointer',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: card.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, fontWeight: 700, color: card.color,
                  }}>
                    {card.title[0]}
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: card.color,
                    background: card.bg, borderRadius: 10,
                    padding: '2px 8px', alignSelf: 'flex-start',
                  }}>
                    {card.status}
                  </span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#1A1A18', marginBottom: 4 }}>
                  {card.title}
                </div>
                <div style={{ fontSize: 13, color: '#888780' }}>{card.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
