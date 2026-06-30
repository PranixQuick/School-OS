import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const DISPATCH_SECRET = Deno.env.get('DISPATCH_SECRET') ?? '';
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

// --- HTML notice extractor (generic, works across Indian edu sites) ---
function extractNotices(html: string): Array<{ title: string; url: string; dateText: string }> {
  const notices: Array<{ title: string; url: string; dateText: string }> = [];
  const linkPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]{10,200})<\/a>/gi;
  const datePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s+\w+\s+\d{4})/i;

  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    const url = match[1];
    const title = match[2].replace(/\s+/g, ' ').trim();
    if (title.length < 15 || title.length > 300) continue;
    if (/^(home|about|contact|login|register|back|next|prev|skip|read more|click here|download|menu|search)/i.test(title)) continue;
    if (url.includes('javascript:') || url === '#' || url.startsWith('mailto:')) continue;
    const start = Math.max(0, match.index - 200);
    const end = Math.min(html.length, match.index + 400);
    const context = html.slice(start, end);
    const dateMatch = context.match(datePattern);
    notices.push({ title, url, dateText: dateMatch?.[0] ?? '' });
  }

  const seen = new Set<string>();
  return notices.filter(n => {
    const key = n.title.toLowerCase().slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 20);
}

// --- Date parser ---
function parseDate(dateText: string): string | null {
  if (!dateText) return null;
  try {
    const d = new Date(dateText);
    if (!isNaN(d.getTime()) && d.getFullYear() > 2000) return d.toISOString();
  } catch { /* */ }
  // Try DD/MM/YYYY
  const dmy = dateText.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (dmy) {
    const d = new Date(`${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

// --- Claude Haiku classifier ---
async function classifyNotice(title: string): Promise<{ notice_type: string; priority: string; summary: string }> {
  if (!ANTHROPIC_API_KEY) return { notice_type: 'general', priority: 'normal', summary: title.slice(0, 80) };
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        messages: [{ role: 'user', content:
          `Classify this Indian educational notice. Respond with ONLY valid JSON, no markdown.\nNotice: "${title.slice(0,200)}"\nReturn: {"notice_type":"circular|exam_schedule|syllabus_update|result|hall_ticket|scholarship_deadline|compliance_deadline|fee_regulation|accreditation|grant|general","priority":"urgent|high|normal|low","summary":"one sentence max 80 chars"}\nurgent if exam or deadline within 7 days. high if compliance/scholarship/accreditation.`
        }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
    const data = await res.json();
    const text = (data.content?.[0]?.text ?? '{}').replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);
    return {
      notice_type: parsed.notice_type ?? 'general',
      priority: parsed.priority ?? 'normal',
      summary: (parsed.summary ?? title).slice(0, 200),
    };
  } catch (e) {
    console.warn('[Classifier] Error:', String(e).slice(0, 100));
    return { notice_type: 'general', priority: 'normal', summary: title.slice(0, 80) };
  }
}

// --- Per-source scraper ---
async function scrapeSource(
  supabase: ReturnType<typeof createClient>,
  source: { source_code: string; scrape_url: string; base_url: string }
): Promise<{ inserted: number; errors: string[] }> {
  const errors: string[] = [];
  let inserted = 0;

  try {
    const res = await fetch(source.scrape_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SchoolOS-Bot/1.0; +https://pranixailabs.com)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      errors.push(`HTTP ${res.status} from ${source.source_code}`);
      return { inserted, errors };
    }
    const html = await res.text();
    const rawNotices = extractNotices(html);

    for (const raw of rawNotices) {
      try {
        // Build absolute URL
        let absoluteUrl = raw.url;
        if (!raw.url.startsWith('http')) {
          try { absoluteUrl = new URL(raw.url, source.base_url).href; }
          catch { absoluteUrl = source.base_url + (raw.url.startsWith('/') ? '' : '/') + raw.url; }
        }

        // Generate stable dedup key from source + title
        const rawKey = source.source_code + ':' + raw.title.toLowerCase().trim().slice(0, 80);
        const external_id = btoa(rawKey).replace(/[^a-zA-Z0-9]/g, '').slice(0, 64);

        // Skip if already stored
        const { data: existing } = await supabase
          .from('regulatory_notices').select('id')
          .eq('source_code', source.source_code)
          .eq('external_id', external_id)
          .maybeSingle();
        if (existing) continue;

        // Classify with Claude Haiku
        const classified = await classifyNotice(raw.title);

        const { error } = await supabase.from('regulatory_notices').insert({
          source_code: source.source_code,
          external_id,
          title: raw.title,
          summary: classified.summary,
          url: absoluteUrl,
          published_at: parseDate(raw.dateText),
          scraped_at: new Date().toISOString(),
          notice_type: classified.notice_type,
          priority: classified.priority,
          raw_content: raw.title,
        });
        if (!error) inserted++;
        else errors.push(`Insert: ${error.message.slice(0, 80)}`);
      } catch (e) {
        errors.push(`Record error: ${String(e).slice(0, 80)}`);
      }
    }

    // Mark source as scraped
    await supabase.from('regulatory_sources')
      .update({ last_scraped_at: new Date().toISOString() })
      .eq('source_code', source.source_code);

  } catch (e) {
    errors.push(`Fetch error for ${source.source_code}: ${String(e).slice(0, 80)}`);
  }

  return { inserted, errors };
}

// --- Main handler ---
Deno.serve(async (req: Request) => {
  // Authenticate
  const secret = req.headers.get('X-DISPATCH-SECRET') ?? '';
  if (secret !== DISPATCH_SECRET || !DISPATCH_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const forceAll = body.force === true;

  // Get active sources
  const { data: sources, error: sourcesErr } = await supabase
    .from('regulatory_sources')
    .select('source_code, scrape_url, base_url, scrape_interval_minutes, last_scraped_at')
    .eq('active', true);

  if (sourcesErr) {
    return new Response(JSON.stringify({ error: sourcesErr.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!sources?.length) {
    return new Response(JSON.stringify({ message: 'No active sources', sources_scraped: 0 }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Filter to sources due for scraping (unless force=true)
  const due = forceAll ? sources : sources.filter(s => {
    if (!s.last_scraped_at) return true;
    const intervalMs = (s.scrape_interval_minutes ?? 360) * 60 * 1000;
    return Date.now() - new Date(s.last_scraped_at).getTime() > intervalMs;
  });

  const summary: Record<string, { inserted: number; errors: string[] }> = {};
  for (const source of due) {
    summary[source.source_code] = await scrapeSource(supabase, source as { source_code: string; scrape_url: string; base_url: string });
    // Polite delay between sources
    await new Promise(r => setTimeout(r, 1500));
  }

  const totalInserted = Object.values(summary).reduce((a, b) => a + b.inserted, 0);
  const totalErrors = Object.values(summary).reduce((a, b) => a + b.errors.length, 0);
  console.log(`[regulatory-scraper] ${due.length} sources, ${totalInserted} new notices, ${totalErrors} errors`);

  return new Response(
    JSON.stringify({ sources_scraped: due.length, total_inserted: totalInserted, summary }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
