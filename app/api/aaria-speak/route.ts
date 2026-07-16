import { NextRequest, NextResponse } from "next/server";
import { aariaSpeak, AariaClientError } from "@/lib/aaria-client";

// ── Aaria visual-companion slice (additive) ──────────────────────────────────
// Standalone TTS + visual-companion endpoint. Takes a short confirmation
// string and returns Aaria's synthesized audio plus its visual_companion
// metadata (avatar_state / expression / caption timing) when present.
//
// This route is intentionally SEPARATE from app/api/voice-query/route.ts
// (School-OS's primary Aaria /understand integration, which is large and
// dense with auth/permission/RLS logic). Keeping the visual-companion call
// here means the wrapper lib/aaria-client.ts is now actually wired in with a
// small, self-contained diff that touches no auth code.
//
// NOTE FOR REVIEW: this endpoint is additive and does not read user data or
// the database; it only forwards a caller-supplied string to Aaria's TTS.
// If the founder wants it session-gated like the rest of app/api before it
// ships, that guard should be added at merge time — this PR deliberately
// does not touch School-OS auth code.

export const dynamic = "force-dynamic";

const MAX_TEXT_LENGTH = 500;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text.trim() : "";

    if (!text) {
      return NextResponse.json(
        { success: false, error: "text_required" },
        { status: 400 }
      );
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        { success: false, error: "text_too_long", max: MAX_TEXT_LENGTH },
        { status: 400 }
      );
    }

    const lang = body?.lang === "te" ? "te" : "en";
    const qualityTier =
      typeof body?.quality_tier === "string" ? body.quality_tier : "standard";

    const speak = await aariaSpeak(text, { lang, qualityTier });

    return NextResponse.json({
      success: true,
      audio_base64: speak.audio_base64,
      lang: speak.lang,
      engine_used: speak.engine_used,
      visual_companion: speak.visual_companion ?? null,
    });
  } catch (err: unknown) {
    if (err instanceof AariaClientError) {
      return NextResponse.json(
        { success: false, error: "aaria_request_failed", detail: err.message },
        { status: err.status ?? 502 }
      );
    }
    const message = err instanceof Error ? err.message : "aaria_speak_failed";
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
