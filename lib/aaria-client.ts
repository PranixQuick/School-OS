// ── Aaria voice-control-plane client ─────────────────────────────────────────
// Shared server-side wrapper around Pranix's Aaria voice-assistant engine
// (https://pranix-aaria.onrender.com). Server-only: never import this from a
// "use client" component - call it from route handlers / server actions.
//
// Mirrors the wrapper pattern used in QuickScanZ, EdGridAI (VIDYA-GRID), and
// quietkeep- so the Aaria contract stays consistent across the portfolio.
//
// NOT YET WIRED IN: app/api/voice-query/route.ts already talks to Aaria's
// /api/voice/understand endpoint inline (School-OS's original Aaria
// integration). This wrapper exists so the follow-up visual-companion call
// (POST /api/voice/speak, surfacing avatar_state/expression/captions) can be
// added to that route with a small, reviewable diff instead of hand-written
// inline fetch code.

const AARIA_BASE_URL = process.env.AARIA_BASE_URL || "https://pranix-aaria.onrender.com";

// Must match Aaria's ROUTING_CONFIG key for this product ("EdProSys"), NOT the
// repo name "School-OS". Sending "School-OS" makes Aaria mask every resolved
// intent to "unknown" (understand.py get_allowed_tools -> []). The live inline
// calls in app/api/voice-query/route.ts already correctly send "EdProSys";
// this constant is fixed so that when this wrapper is eventually wired in for
// the visual-companion call it defaults to the same correct key.
export const AARIA_PRODUCT = "EdProSys";

export interface AariaUnderstandResponse {
  intent: string;
  entities: Record<string, unknown>;
  confidence: number;
  engine_used: string;
}

export interface AariaVisualCompanion {
  avatar_state?: string;
  expression?: string;
  captions?: Array<Record<string, unknown>>;
}

export interface AariaSpeakResponse {
  audio_base64: string;
  lang: string;
  engine_used: string;
  // Optional multi-modal companion metadata (avatar_state/expression/captions)
  // returned by pranix-aaria's src/contracts/speak.py. Present on newer
  // responses; may be absent/null on cache hits or older engine paths.
  visual_companion?: AariaVisualCompanion | null;
}

export interface AariaHealthResponse {
  status: string;
  [key: string]: unknown;
}

class AariaClientError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "AariaClientError";
    this.status = status;
  }
}

async function aariaFetch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${AARIA_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // Aaria is a free-tier Render service and can cold-start; give it room.
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    throw new AariaClientError(
      e instanceof Error ? `Failed to reach Aaria: ${e.message}` : "Failed to reach Aaria"
    );
  }

  if (!res.ok) {
    throw new AariaClientError(`Aaria returned status ${res.status}`, res.status);
  }

  return (await res.json()) as T;
}

/**
 * Natural-language understanding: resolves free text to an intent + entities.
 */
export async function aariaUnderstand(
  text: string,
  opts: { langHint?: string; product?: string } = {}
): Promise<AariaUnderstandResponse> {
  return aariaFetch<AariaUnderstandResponse>("/api/voice/understand", {
    text,
    product: opts.product || AARIA_PRODUCT,
    lang_hint: opts.langHint || "en",
  });
}

/**
 * Text-to-speech: turns a spoken-confirmation string into audio, optionally
 * carrying visual_companion (avatar expression + caption timing) metadata.
 */
export async function aariaSpeak(
  text: string,
  opts: { lang?: string; qualityTier?: string; product?: string } = {}
): Promise<AariaSpeakResponse> {
  return aariaFetch<AariaSpeakResponse>("/api/voice/speak", {
    text,
    lang: opts.lang || "en",
    product: opts.product || AARIA_PRODUCT,
    quality_tier: opts.qualityTier || "standard",
  });
}

export { AariaClientError, AARIA_BASE_URL };
