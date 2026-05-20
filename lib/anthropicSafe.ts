// lib/anthropicSafe.ts
// Graceful degradation wrapper for Anthropic API calls.
// Returns a typed error when credits are depleted or API is unavailable,
// instead of hanging the UI with an endless spinner.
// Usage: const { text, error } = await anthropicSafe(messages, options);

import Anthropic from '@anthropic-ai/sdk';

export interface AnthropicSafeResult {
  text: string | null;
  error: string | null;
  error_code: 'credits_depleted' | 'rate_limited' | 'model_error' | 'network' | null;
  available: boolean;
}

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

export async function anthropicSafe(
  messages: Anthropic.MessageParam[],
  opts: {
    model?: string;
    max_tokens?: number;
    system?: string;
  } = {}
): Promise<AnthropicSafeResult> {
  const model      = opts.model ?? 'claude-sonnet-4-20250514';
  const max_tokens = opts.max_tokens ?? 1000;

  try {
    const params: Anthropic.MessageCreateParamsNonStreaming = {
      model,
      max_tokens,
      messages,
    };
    if (opts.system) params.system = opts.system;

    const response = await getClient().messages.create(params);
    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as Anthropic.TextBlock).text)
      .join('');

    return { text, error: null, error_code: null, available: true };

  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; error?: { type?: string } };

    // Credits depleted / billing issue
    if (e.status === 529 || e.status === 402 ||
        e.message?.includes('credit') || e.message?.includes('billing')) {
      console.error('[anthropicSafe] Credits depleted:', e.message);
      return {
        text: null,
        error: 'AI features are temporarily unavailable. Anthropic API credits need to be topped up. Please contact your school administrator.',
        error_code: 'credits_depleted',
        available: false,
      };
    }

    // Rate limit
    if (e.status === 429) {
      return {
        text: null,
        error: 'AI features are busy right now. Please try again in a few minutes.',
        error_code: 'rate_limited',
        available: false,
      };
    }

    // Model error
    if (e.status === 400 || e.status === 422) {
      return {
        text: null,
        error: 'AI could not process this request. Please try again or contact support.',
        error_code: 'model_error',
        available: false,
      };
    }

    // Network / unknown
    console.error('[anthropicSafe] Unknown error:', e);
    return {
      text: null,
      error: 'AI features are temporarily unavailable. Please try again in a moment.',
      error_code: 'network',
      available: false,
    };
  }
}

// Quick health check — does NOT consume credits (minimal 1-token call)
export async function checkAnthropicAvailable(): Promise<{ available: boolean; error?: string }> {
  try {
    await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    });
    return { available: true };
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    if (e.status === 529 || e.status === 402 || e.message?.includes('credit')) {
      return { available: false, error: 'credits_depleted' };
    }
    if (e.status === 429) {
      return { available: false, error: 'rate_limited' };
    }
    return { available: false, error: 'unknown' };
  }
}
