const axios = require('axios');

const BASE_URL = 'https://www.edprosys.com';

async function run() {
  try {
    console.log('Fetching main page HTML...');
    const htmlRes = await axios.get(`${BASE_URL}/login`);
    const html = htmlRes.data;

    // Search for next static script paths
    const scriptRegex = /_next\/static\/chunks\/[^"]+\.js/g;
    const scripts = [...new Set(html.match(scriptRegex))];

    console.log(`Found ${scripts.length} script bundles. Searching for keys...`);

    // Also search in main HTML directly
    const urlMatchDirect = html.match(/https:\/\/[a-z0-9]+\.supabase\.co/i);
    const anonMatchDirect = html.match(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/);
    if (urlMatchDirect && anonMatchDirect) {
      console.log('Found keys in HTML directly!');
      console.log(`SUPABASE_URL: ${urlMatchDirect[0]}`);
      console.log(`SUPABASE_ANON_KEY: ${anonMatchDirect[0]}`);
      return;
    }

    for (const src of scripts) {
      const jsUrl = `${BASE_URL}/${src}`;
      const jsRes = await axios.get(jsUrl);
      const js = jsRes.data;

      const urlMatch = js.match(/https:\/\/[a-z0-9]+\.supabase\.co/i);
      const anonMatch = js.match(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/);

      if (urlMatch && anonMatch) {
        console.log(`Found keys in script: ${src}`);
        console.log(`SUPABASE_URL: ${urlMatch[0]}`);
        console.log(`SUPABASE_ANON_KEY: ${anonMatch[0]}`);
        return;
      }
    }

    console.log('Keys not found in script bundles.');
  } catch (err) {
    console.error('Extraction failed:', err.message);
  }
}

run();
