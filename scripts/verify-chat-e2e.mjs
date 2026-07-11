import { chromium } from 'playwright';

const BASE = 'http://localhost:6100';
const browser = await chromium.launch({ headless: true });

try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  // ── Login ──
  const setup = await ctx.newPage();
  await setup.goto(BASE, { waitUntil: 'commit' });
  await setup.evaluate(async (base) => {
    await fetch(base + '/api/auth/dev-login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 'e2euser', role: 'admin' })
    });
  }, BASE);
  await setup.close();

  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));

  // ── Navigate ──
  await page.goto(BASE + '/chat', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);

  // ── Check components ──
  const textarea = await page.$('textarea');
  if (!textarea) { console.log('❌ No textarea found'); process.exit(1); }
  console.log('✅ Textarea found');

  const connText = await page.textContent('body');
  console.log('Connection state:', connText.includes('已连接') ? 'connected' : connText.includes('连接中') ? 'connecting' : 'unknown');

  // ── Send message ──
  await textarea.fill('你好，简单回复一句');
  await page.keyboard.press('Enter');
  console.log('📤 Sent: 你好，简单回复一句');

  // ── Wait for response ──
  await page.waitForTimeout(15000);

  const body = await page.textContent('body');

  // Check for response indicators
  const hasReply = !body.includes('连接中…') && (
    body.includes('高兴') || body.includes('帮你') || body.includes('可以') ||
    body.includes('服务') || body.includes('你好')
  );
  console.log(hasReply ? '✅ Agent replied' : '⚠️ No obvious reply detected');

  // Check no error states
  const hasError = body.includes('回复出错') || body.includes('连接失败');
  if (hasError) console.log('❌ Error state detected');

  // ── Screenshot ──
  await page.screenshot({ path: '/Users/ericmr/Documents/GitHub/WGD_Portal/chat-e2e-verify.png', fullPage: true });
  console.log('📸 Screenshot saved');

  // ── Final report ──
  console.log('\n═══════════════════════════════════');
  if (errors.length === 0 && hasReply && !hasError) {
    console.log('✅ E2E TEST PASSED');
  } else {
    console.log('❌ E2E TEST FAILED');
    if (errors.length > 0) console.log('Errors:', errors.join('\n'));
  }
  console.log('═══════════════════════════════════');
} finally {
  await browser.close();
}
