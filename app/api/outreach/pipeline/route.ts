import { NextRequest, NextResponse } from 'next/server'
import { targetSchools } from '@/lib/outreach/schools'
import { outreachTemplates } from '@/lib/outreach/templates'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const dryRun = searchParams.get('dryRun') !== 'false'

    // Build the dry-run outreach batch payload
    const batch = targetSchools.map(school => {
      const templates = outreachTemplates[school.lang]
      const simulatedVideoUrl = `https://vidya-grid.vercel.app/videos/outreach_${school.id}.mp4`

      // Compile Email
      const emailSubject = templates.email.subject.replace('{name}', school.name)
      const emailBody = templates.email.body
        .replace('{contactPerson}', school.contactPerson)
        .replace('{role}', school.role)
        .replace('{name}', school.name)
        .replace('{district}', school.district)
        .replace('{videoUrl}', simulatedVideoUrl)

      // Compile WhatsApp
      const whatsappBody = templates.whatsapp.body
        .replace('{contactPerson}', school.contactPerson)
        .replace('{role}', school.role)
        .replace('{name}', school.name)
        .replace('{videoUrl}', simulatedVideoUrl)

      return {
        schoolId: school.id,
        schoolName: school.name,
        contactName: school.contactPerson,
        language: school.lang,
        phone: school.phone,
        email: school.email,
        videoUrl: simulatedVideoUrl,
        emailDraft: {
          subject: emailSubject,
          body: emailBody
        },
        whatsappDraft: {
          body: whatsappBody
        }
      }
    })

    return NextResponse.json({
      success: true,
      dryRun,
      message: dryRun
        ? "DRY RUN MODE: No real emails or WhatsApp messages were dispatched. Displaying compiled previews only."
        : "CRITICAL: Real dispatch is BLOCKED. Founder approval required to run in live mode.",
      timestamp: new Date().toISOString(),
      schoolsCount: batch.length,
      outreachBatch: batch
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { schoolId, sendReal } = body

    if (sendReal === true) {
      return NextResponse.json({
        success: false,
        error: "FORBIDDEN: Live outreach dispatch is blocked. Mr. Prashanth Rao (Founder) must approve payment-onboarding and SMTP credentials on the control plane first."
      }, { status: 403 })
    }

    const school = targetSchools.find(s => s.id === schoolId)
    if (!school) {
      return NextResponse.json({ success: false, error: "School not found" }, { status: 404 })
    }

    const templates = outreachTemplates[school.lang]
    const simulatedVideoUrl = `https://vidya-grid.vercel.app/videos/outreach_${school.id}.mp4`

    return NextResponse.json({
      success: true,
      dryRun: true,
      message: "Generated custom outreach preview for single school.",
      data: {
        school,
        videoUrl: simulatedVideoUrl,
        email: {
          subject: templates.email.subject.replace('{name}', school.name),
          body: templates.email.body
            .replace('{contactPerson}', school.contactPerson)
            .replace('{role}', school.role)
            .replace('{name}', school.name)
            .replace('{district}', school.district)
            .replace('{videoUrl}', simulatedVideoUrl)
        },
        whatsapp: {
          body: templates.whatsapp.body
            .replace('{contactPerson}', school.contactPerson)
            .replace('{role}', school.role)
            .replace('{name}', school.name)
            .replace('{videoUrl}', simulatedVideoUrl)
        }
      }
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
