// lib/anthropicSafe.ts
// Graceful degradation wrapper for Anthropic API calls.
// Uses fetch() directly — @anthropic-ai/sdk is NOT installed in this project.
// Returns a typed error when credits are depleted or API is unavailable,
// instead of hanging the UI with an endless spinner.
// Usage: const { text, error } = await anthropicSafe(messages, options);

export interface AnthropicSafeResult {
  text: string | null;
  error: string | null;
  error_code: 'credits_depleted' | 'rate_limited' | 'model_error' | 'network' | null;
  available: boolean;
}

interface AnthropicMessage { role: 'user' | 'assistant'; content: string; }
interface AnthropicBlock { type: string; text?: string; }

export async function anthropicSafe(
  messages: AnthropicMessage[],
  opts: { model?: string; max_tokens?: number; system?: string } = {}
): Promise<AnthropicSafeResult> {
  const model      = opts.model      ?? 'claude-sonnet-4-20250514';
  const max_tokens = opts.max_tokens ?? 1000;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { text: null, error: 'Anthropic API key not configured.', error_code: 'network', available: false };
  }

  try {
    const body: Record<string, unknown> = { model, max_tokens, messages };
    if (opts.system) body.system = opts.system;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    // Credits / billing error
    if (res.status === 402 || res.status === 529) {
      return { text: null, error: 'AI features are temporarily unavailable. Anthropic API credits need to be topped up. Please contact your school administrator.', error_code: 'credits_depleted', available: false };
    }
    // Rate limit
    if (res.status === 429) {
      return { text: null, error: 'AI features are busy right now. Please try again in a few minutes.', error_code: 'rate_limited', available: false };
    }
    // Model / request error
    if (res.status === 400 || res.status === 422) {
      return { text: null, error: 'AI could not process this request. Please try again or contact support.', error_code: 'model_error', available: false };
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({})) as { error?: { message?: string } };
      const msg = errBody?.error?.message ?? `HTTP ${res.status}`;
      return { text: null, error: `AI error: ${msg}`, error_code: 'network', available: false };
    }

    const data = await res.json() as { content?: AnthropicBlock[] };
    const text = (data.content ?? [])
      .filter(b => b.type === 'text' && b.text)
      .map(b => b.text!)
      .join('');

    return { text, error: null, error_code: null, available: true };

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[anthropicSafe]', msg);
    return { text: null, error: 'AI features are temporarily unavailable. Please try again in a moment.', error_code: 'network', available: false };
  }
}

// Quick health check — does NOT consume significant credits
export async function checkAnthropicAvailable(): Promise<{ available: boolean; error?: string }> {
  const result = await anthropicSafe(
    [{ role: 'user', content: 'hi' }],
    { model: 'claude-haiku-4-5-20251001', max_tokens: 1 }
  );
  if (result.available) return { available: true };
  return { available: false, error: result.error_code ?? 'unknown' };
}
