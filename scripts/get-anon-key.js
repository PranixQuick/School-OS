const { chromium } = require('playwright');

async function run() {
  console.log('Launching browser to capture Supabase Anon Key...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('request', request => {
    console.log('REQUEST:', request.url());
    const headers = request.headers();
    if (headers['apikey']) {
      console.log('FOUND APIKEY HEADER IN REQUEST TO:', request.url(), 'KEY:', headers['apikey']);
    }
  });

  try {
    await page.goto('https://www.edprosys.com/login');
    await page.waitForTimeout(10000);
  } catch (e) {
    console.log('Error:', e.message);
  }

  await browser.close();
}

run();
