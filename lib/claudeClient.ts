// lib/claudeClient.ts
// OPS-2: Typed ClaudeCreditsError so callers can detect credit exhaustion specifically
// NVIDIA fallback: when Anthropic credits are exhausted, falls back to NVIDIA Build API
// (OpenAI-compatible, free tier, model: meta/llama-3.1-70b-instruct)
// Set NVIDIA_API_KEY env var to enable fallback. If unset, throws ClaudeCreditsError.

export class ClaudeCreditsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClaudeCreditsError';
  }
}

// Wraps fetch with an AbortController timeout
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 8000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const NVIDIA_MODEL = 'meta/llama-3.1-70b-instruct';

async function callNvidia(systemPrompt: string, userMessage: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new ClaudeCreditsError('NVIDIA_API_KEY not set — no fallback available');

  const response = await fetchWithTimeout(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: NVIDIA_MODEL,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
      max_tokens: maxTokens, temperature: 0.7,
    }),
  }, 20000); // 20s for NVIDIA (slower inference)

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`NVIDIA API error: ${response.status} - ${err.slice(0, 200)}`);
  }

  const data = await response.json() as { choices: { message: { content: string } }[] };
  return data.choices?.[0]?.message?.content ?? '';
}

export async function callClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 400,
  model = 'claude-sonnet-4-20250514'
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return callNvidia(systemPrompt, userMessage, maxTokens);
  }

  const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model, max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  }, 8000); // 8s timeout — prevents 504 when Anthropic API hangs on credit error

  if (!response.ok) {
    const err = await response.text();
    if (err.includes('credit balance is too low') || err.includes('credit_balance')) {
      const nvidiaKey = process.env.NVIDIA_API_KEY;
      if (nvidiaKey) {
        console.log('[callClaude] Anthropic credits exhausted — falling back to NVIDIA Build API');
        return callNvidia(systemPrompt, userMessage, maxTokens);
      }
      throw new ClaudeCreditsError(
        'Claude API credit balance too low. Top up at console.anthropic.com/settings/plans. Set NVIDIA_API_KEY for fallback.'
      );
    }
    throw new Error(`Claude API error: ${response.status} - ${err}`);
  }

  const data = await response.json() as { content: { text: string }[] };
  return data.content?.[0]?.text ?? '';
}
