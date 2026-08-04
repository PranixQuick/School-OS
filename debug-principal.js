const { chromium } = require('playwright');

const PROD_BASE = 'https://www.edprosys.com';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER_LOG:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER_ERROR:', err));
  page.on('requestfailed', req => console.error('REQUEST_FAILED:', req.url(), req.failure().errorText));
  page.on('response', res => {
    if (res.status() >= 400) {
      console.error('BAD_RESPONSE:', res.url(), res.status());
    }
  });

  console.log('Logging in as Principal...');
  await page.goto(`${PROD_BASE}/login`);
  await page.fill('input[type="email"]', 'demo.principal@suchitra.edprosys.demo');
  await page.fill('input[type="password"]', 'Demo@Suchitra#Principal2026');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/principal', { timeout: 30000 });
  console.log('Logged in successfully, current URL:', page.url());

  console.log('Navigating to /students...');
  const res = await page.goto(`${PROD_BASE}/students`);
  console.log('Response status:', res.status());
  await page.waitForTimeout(5000);
  console.log('Final URL:', page.url());
  const body = await page.innerHTML('body');
  console.log('BODY_CONTENT:', body);

  await browser.close();
}

run().catch(console.error);
