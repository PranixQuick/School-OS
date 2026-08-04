const { chromium } = require('playwright');

const PROD_BASE = 'https://www.edprosys.com';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Logging in as Accountant...');
  await page.goto(`${PROD_BASE}/login`);
  await page.fill('input[type="email"]', 'demo.accountant@suchitra.edprosys.demo');
  await page.fill('input[type="password"]', 'Demo@Suchitra#Acct2026');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 30000 });
  console.log('Logged in successfully, current URL:', page.url());

  console.log('Navigating to /admin/staff...');
  const res = await page.goto(`${PROD_BASE}/admin/staff`);
  console.log('Response status:', res.status());
  await page.waitForTimeout(5000);
  console.log('Final URL:', page.url());
  const body = await page.innerText('body');
  console.log('BODY_TEXT:', body);

  await browser.close();
}

run().catch(console.error);
