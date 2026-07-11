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

  // Log ALL network requests
  page.on('request', req => {
    if (req.url().includes('/api/') || req.url().includes('/chat')) {
      console.log('REQ:', req.method(), req.url());
    }
  });
  page.on('response', resp => {
    if (resp.url().includes('/api/')) {
      console.log('RES:', resp.status(), resp.url());
    }
  });

  await page.goto(BASE + '/chat', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);

  // Get DOM structure
  const dom = await page.evaluate(() => {
    const root = document.querySelector('.chat-root');
    if (!root) return 'NO .chat-root found';
    const walk = (el, depth = 0) => {
      let s = '  '.repeat(depth) + '<' + el.tagName.toLowerCase();
      const cls = el.className && typeof el.className === 'string' ? el.className : '';
      if (cls) s += ' class="' + cls.substring(0, 80) + '"';
      s += '>\n';
      for (const child of el.children) {
        s += walk(child, depth + 1);
      }
      return s;
    };
    return walk(root);
  });
  console.log('DOM TREE:\n' + dom);

  // Also check body text directly
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('\nBODY TEXT (' + bodyText.length + ' chars):');
  console.log(bodyText.substring(0, 500));

  // Check all API responses
  await page.screenshot({ path: '/Users/ericmr/Documents/GitHub/WGD_Portal/chat-verify3.png', fullPage: true });
  console.log('\nScreenshot saved');

  console.log('\n═══════════════════════════════════');
  if (errors.length === 0) {
    console.log('✅ 无 JS 错误');
  } else {
    console.log('❌ JS 错误:');
    errors.forEach(e => console.log('   -', e.substring(0, 200)));
  }
  console.log('═══════════════════════════════════');
} catch (e) {
  console.error('FATAL:', e.message);
} finally {
  await browser.close();
}
