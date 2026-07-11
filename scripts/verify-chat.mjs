import { chromium } from 'playwright';

const BASE = 'http://localhost:6100';
const errors = [];

const browser = await chromium.launch({ headless: true });

try {
  // ── Setup: dev-login via browser context ──
  console.log('1. Dev login...');
  const context = await browser.newContext();
  const setupPage = await context.newPage();
  await setupPage.goto(BASE, { waitUntil: 'commit' });
  
  const loginRes = await setupPage.evaluate(async (base) => {
    const r = await fetch(base + '/api/auth/dev-login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 'testuser', role: 'admin' })
    });
    return { status: r.status, ok: r.ok };
  }, BASE);
  console.log('   Login response:', JSON.stringify(loginRes));
  await setupPage.close();

  const page = await context.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push('CONSOLE ERROR: ' + msg.text());
    }
  });
  page.on('pageerror', err => {
    errors.push('PAGE ERROR: ' + err.message);
  });

  // ── 2. Visit /chat ──
  console.log('2. Navigating to /chat...');
  const response = await page.goto(BASE + '/chat', { waitUntil: 'networkidle', timeout: 15000 });
  console.log('   HTTP status:', response.status());
  console.log('   URL:', page.url());

  await page.waitForTimeout(2000);

  // ── 3. Content check ──
  const bodyText = await page.textContent('body');
  console.log('   Body length:', bodyText.length);

  if (bodyText.includes('TypeError') || bodyText.includes('is not a function')) {
    errors.push('RUNTIME ERROR: ' + bodyText.substring(0, 300));
  }

  // ── 4. Components ──
  console.log('3. Components:');
  console.log('   Sidebar:', (await page.$('[class*="sidebar"]')) ? '✅' : '❌');
  console.log('   Chat area:', (await page.$('[class*="chat"]')) ? '✅' : '❌');
  console.log('   Composer:', (await page.$('textarea, [contenteditable], [role="textbox"]')) ? '✅' : '❌');

  // ── 5. App cards in sidebar ──
  const appCards = await page.$$('[class*="AppCard"], [class*="appCard"], [class*="app-card"]');
  console.log('   AppCards:', appCards.length);

  // ── 6. Empty state ──
  console.log('   Has EmptyState:', bodyText.includes('开始') || bodyText.includes('新会话'));

  // ── 7. WebSocket ──
  console.log('4. WebSocket:');
  const wsInfo = await page.evaluate(() => {
    return {
      wsAvailable: typeof WebSocket !== 'undefined',
      agentWsUrl: process?.env?.NEXT_PUBLIC_AGENT_WS_URL || 'unknown'
    };
  });
  console.log('   WS API:', wsInfo.wsAvailable ? '✅' : '❌');

  // ── 8. Screenshot ──
  await page.screenshot({ path: '/tmp/chat-verify.png', fullPage: true });
  console.log('5. Screenshot: /tmp/chat-verify.png');

  // ── 9. Check for conn state indicator ──
  await page.waitForTimeout(1500);
  const connText = await page.textContent('body');
  if (connText.includes('连接中') || connText.includes('已连接') || connText.includes('connecting') || connText.includes('ok')) {
    console.log('6. Connection indicator visible');
  }

  console.log('\n═══════════════════════════════════');
  if (errors.length === 0) {
    console.log('✅ /chat 页面正常工作，无 JS 错误');
  } else {
    console.log('❌ ' + errors.length + ' 个错误:');
    errors.forEach((e, i) => console.log('   ' + (i+1) + '. ' + e));
  }
  console.log('═══════════════════════════════════');

} catch (e) {
  console.error('FATAL:', e.message);
} finally {
  await browser.close();
}
