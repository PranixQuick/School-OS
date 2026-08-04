const https = require('https');

const emails = [
  'hod.science@pranix.ai',
  'hod.science@edprosys.internal',
  'hod.commerce@pranix.ai',
  'hod.arts@pranix.ai'
];

const passwords = [
  'Demo@Suchitra#HOD2026',
  'Demo@Suchitra#Teacher2026',
  'Demo@Suchitra#Owner2026',
  'ci_mP7vT4nL6wY1xK9R2qjH3aB5dF8sG0',
  'Demo@Suchitra#Principal2026'
];

async function tryLogin(email, password) {
  return new Promise((resolve) => {
    const data = JSON.stringify({ email, password });
    const req = https.request({
      hostname: 'www.edprosys.com',
      port: 443,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });
    req.on('error', (e) => {
      resolve({ status: 500, error: e.message });
    });
    req.write(data);
    req.end();
  });
}

async function run() {
  for (const email of emails) {
    for (const pw of passwords) {
      console.log(`Trying ${email} with password ${pw}...`);
      const res = await tryLogin(email, pw);
      console.log(`Status: ${res.status}`);
      if (res.status === 200) {
        console.log(`SUCCESS!`, res.body);
        return;
      } else {
        console.log(`Body:`, res.body);
      }
    }
  }
}

run();
