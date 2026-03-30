export async function callClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 400,
  // Optional model override. Defaults to Sonnet for quality-critical calls.
  // Pass 'claude-haiku-4-5-20251001' for high-volume low-complexity calls
  // (report card narratives, briefings, WhatsApp responses, broadcasts).
  model = 'claude-sonnet-4-20250514'
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${err}`);
  }

  const data = await response.json() as { content: { text: string }[] };
  return data.content?.[0]?.text ?? '';
}
