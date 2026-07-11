import { chromium } from 'playwright';

const BASE = 'http://localhost:6100';

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const setupPage = await context.newPage();
  await setupPage.goto(BASE, { waitUntil: 'commit' });
  await setupPage.evaluate(async (base) => {
    await fetch(base + '/api/auth/dev-login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 'testuser', role: 'admin' })
    });
  }, BASE);
  await setupPage.close();

  const page = await context.newPage();
  
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));

  await page.goto(BASE + '/chat', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);

  // Dump page HTML structure
  const html = await page.content();
  console.log('Page HTML length:', html.length);
  console.log('HTML preview:', html.substring(0, 1500));
  
  // Check for all major CSS classes in the DOM
  const classes = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*')).map(el => el.className).filter(Boolean);
    const unique = [...new Set(all.flatMap(c => typeof c === 'string' ? c.split(/\s+/) : []))];
    return unique.filter(c => 
      c.includes('sidebar') || c.includes('chat') || c.includes('composer') || 
      c.includes('empty') || c.includes('message') || c.includes('session') ||
      c.includes('app') || c.includes('brand') || c.includes('send') ||
      c.includes('footer') || c.includes('header') || c.includes('root')
    );
  });
  console.log('Relevant CSS classes:', JSON.stringify(classes, null, 2));

  // Screenshot
  await page.screenshot({ path: '/Users/ericmr/Documents/GitHub/WGD_Portal/chat-verify.png', fullPage: true });
  console.log('\nScreenshot: chat-verify.png');

  console.log('\n═══════════════════════════════════');
  if (errors.length === 0) {
    console.log('✅ /chat 页面正常 - 无 JS 错误');
  } else {
    console.log('❌ ' + errors.length + ' 个 JS 错误:');
    errors.forEach(e => console.log('   -', e.substring(0, 150)));
  }
  console.log('═══════════════════════════════════');
} catch (e) {
  console.error('FATAL:', e.message);
} finally {
  await browser.close();
}
