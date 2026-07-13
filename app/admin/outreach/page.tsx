'use client'

import { useState, useEffect } from 'react'

const tokens = {
  ink: '#1C1917',
  textSecondary: '#6B7280',
  accent: '#0D9488',
  caution: '#D97706',
  surface: '#F9FAFB',
  card: '#FFFFFF',
  border: '#E5E7EB',
}

interface SchoolDraft {
  schoolId: string
  schoolName: string
  contactName: string
  language: string
  phone: string
  email: string
  videoUrl: string
  emailDraft: {
    subject: string
    body: string
  }
  whatsappDraft: {
    body: string
  }
}

export default function OutreachPage() {
  const [drafts, setDrafts] = useState<SchoolDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSchool, setSelectedSchool] = useState<SchoolDraft | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  async function fetchPipeline() {
    try {
      const res = await fetch('/api/outreach/pipeline?dryRun=true')
      const data = await res.json()
      if (res.ok && data.success) {
        setDrafts(data.outreachBatch)
        if (data.outreachBatch.length > 0) {
          setSelectedSchool(data.outreachBatch[0])
        }
      } else {
        setErrorMsg(data.error || 'Failed to fetch pipeline drafts')
      }
    } catch {
      setErrorMsg('Failed to reach outreach pipeline API')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPipeline()
  }, [])

  const containerStyle = {
    background: tokens.surface,
    minHeight: '100vh',
    padding: '32px 24px',
    fontFamily: 'system-ui, sans-serif',
    color: tokens.ink,
  }

  const badgeStyle = {
    background: '#FEF3C7',
    color: '#D97706',
    padding: '3px 8px',
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 600,
    display: 'inline-block',
    marginBottom: 16,
  }

  const listCardStyle = {
    background: tokens.card,
    border: `1px solid ${tokens.border}`,
    borderRadius: 8,
    padding: 16,
    cursor: 'pointer',
    marginBottom: 12,
    transition: 'all 0.2s',
  }

  const detailCardStyle = {
    background: tokens.card,
    border: `1px solid ${tokens.border}`,
    borderRadius: 12,
    padding: 24,
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
  }

  const textPreviewStyle = {
    background: tokens.surface,
    border: `1px solid ${tokens.border}`,
    borderRadius: 6,
    padding: 16,
    fontSize: 13,
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap' as const,
    color: '#374151',
    lineHeight: '1.5',
    marginTop: 8,
    maxHeight: 300,
    overflowY: 'auto' as const,
  }

  return (
    <div style={containerStyle}>
      <div style={badgeStyle}>
        DRY RUN ONLY &bull; SANDBOX ENVIRONMENT
      </div>
      
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.025em' }}>
        Institution Outreach Pipeline
      </h1>
      <p style={{ color: tokens.textSecondary, fontSize: 14, margin: '0 0 32px', maxWidth: 640 }}>
        Draft and review custom email & WhatsApp pilot campaign messages targeting region schools. Custom explainers are mapped using the VIDYA-GRID pipeline parameters.
      </p>

      {errorMsg && (
        <div style={{ background: '#FEE2E2', color: '#991B1B', padding: 16, borderRadius: 8, marginBottom: 24, fontSize: 14 }}>
          {errorMsg}
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: 14, color: tokens.textSecondary }}>Loading pipeline drafts…</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 24 }}>
          {/* Left: Schools List */}
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px' }}>Target Institutions</h2>
            {drafts.map((draft) => {
              const isSelected = selectedSchool?.schoolId === draft.schoolId
              return (
                <div
                  key={draft.schoolId}
                  onClick={() => setSelectedSchool(draft)}
                  style={{
                    ...listCardStyle,
                    borderColor: isSelected ? tokens.accent : tokens.border,
                    boxShadow: isSelected ? '0 0 0 2px rgba(13,148,136,0.15)' : 'none',
                  }}
                >
                  <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>{draft.schoolName}</p>
                  <p style={{ fontSize: 12, color: tokens.textSecondary, margin: '0 0 8px' }}>
                    Contact: {draft.contactName} &bull; Lang: {draft.language.toUpperCase()}
                  </p>
                  <span style={{
                    fontSize: 10,
                    background: draft.language === 'te' ? '#E0F2FE' : '#ECFDF5',
                    color: draft.language === 'te' ? '#0369A1' : '#047857',
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontWeight: 600
                  }}>
                    {draft.language === 'te' ? 'Telugu Voice-Out' : 'English Voice-Out'}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Right: Previews */}
          {selectedSchool && (
            <div style={detailCardStyle}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px' }}>
                Outreach Preview: {selectedSchool.schoolName}
              </h3>
              
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: tokens.textSecondary, margin: '0 0 4px' }}>
                  Customized Video Explainer URL
                </p>
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  style={{ fontSize: 13, color: tokens.accent, fontWeight: 500, textDecoration: 'underline' }}
                >
                  {selectedSchool.videoUrl}
                </a>
              </div>

              {/* Email Section */}
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>📧 Email Template</span>
                  <span style={{ fontSize: 11, color: tokens.textSecondary, fontWeight: 400 }}>
                    Subject: {selectedSchool.emailDraft.subject}
                  </span>
                </h4>
                <div style={textPreviewStyle}>{selectedSchool.emailDraft.body}</div>
              </div>

              {/* WhatsApp Section */}
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px' }}>
                  💬 WhatsApp Push Message (Aaria Audio Intro Ref)
                </h4>
                <div style={textPreviewStyle}>{selectedSchool.whatsappDraft.body}</div>
              </div>

              {/* Guard Action */}
              <div style={{ borderTop: `1px solid ${tokens.border}`, paddingTop: 20, marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  disabled
                  style={{
                    background: '#E5E7EB',
                    color: '#9CA3AF',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: 6,
                    cursor: 'not-allowed',
                    fontSize: 13,
                    fontWeight: 600
                  }}
                >
                  Dispatch Campaign (Locked)
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
