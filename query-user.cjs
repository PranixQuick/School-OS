const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.production.local manually
const envPath = '.env.production.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    env[key] = value.trim();
  }
});

const url = env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing URL or Service Key. Env:', env);
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

async function run() {
  const { data: su, error: suErr } = await supabase
    .from('school_users')
    .select('*, staff:staff_id(*)')
    .eq('email', 'demo.accountant@suchitra.edprosys.demo')
    .maybeSingle();

  if (suErr) {
    console.error('Error fetching school_users:', suErr);
    process.exit(1);
  }

  console.log('SCHOOL_USER_DETAILS:', JSON.stringify(su, null, 2));
}

run();
