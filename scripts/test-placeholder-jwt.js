const https = require('https');
const crypto = require('crypto');

// Jose library simple implementation for HS256 JWT signing
// since we don't want to import jose for a quick script
function base64url(buf) {
  return buf.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJWT(payload, secretStr) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerStr = base64url(Buffer.from(JSON.stringify(header)));
  const payloadStr = base64url(Buffer.from(JSON.stringify(payload)));
  const data = `${headerStr}.${payloadStr}`;
  
  const hmac = crypto.createHmac('sha256', secretStr);
  hmac.update(data);
  const signature = base64url(hmac.digest());
  return `${data}.${signature}`;
}

const secrets = [
  'placeholder_session_secret_32chars_min',
  'placeholder_session_secret_for_build_purposes_only_32_chars'
];

async function checkSecret(secret) {
  const token = signJWT({
    schoolId: '00000000-0000-0000-0000-000000000001',
    schoolName: 'Suchitra Academy',
    schoolSlug: 'suchitra-academy',
    plan: 'campus',
    userId: 'uuid-hod-science',
    userEmail: 'hod.science@edprosys.internal',
    userRole: 'hod',
    userName: 'Dr. Science',
    hod_scope: [
      { school_id: '00000000-0000-0000-0000-000000000001', department: 'science' }
    ]
  }, secret);

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'www.edprosys.com',
      port: 443,
      path: '/api/auth/me',
      method: 'GET',
      headers: {
        'Cookie': `school_session=${token}`
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          body: body
        });
      });
    });
    req.on('error', (e) => {
      resolve({ status: 500, error: e.message });
    });
    req.end();
  });
}

async function run() {
  for (const secret of secrets) {
    console.log(`Trying secret: ${secret}...`);
    const res = await checkSecret(secret);
    console.log(`Status: ${res.status}`);
    console.log(`Body:`, res.body);
  }
}

run();
