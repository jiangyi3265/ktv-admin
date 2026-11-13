const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

// Only reads the backend. Delayed/error financial responses are browser fixtures.
(async () => {
  assert(process.env.KTV_TEST_ACCESS, 'Set KTV_TEST_ACCESS to isolated test credentials');
  const access = JSON.parse(await fs.readFile(process.env.KTV_TEST_ACCESS, 'utf8'));
  const output = process.env.KTV_TEST_OUTPUT || '.local/finance-concurrency';
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.setDefaultTimeout(15000);
  let releaseOld, oldFinished;
  try {
    const captchaReady = page.waitForResponse(r => r.url().includes('/captchaImage'));
    await page.goto((process.env.KTV_PC_URL || 'http://127.0.0.1:5190') + '/login');
    assert.equal((await (await captchaReady).json()).captchaEnabled, false);
    await page.getByPlaceholder('验证码').waitFor({ state: 'hidden' });
    await page.getByPlaceholder('账号').fill(access.pc.username);
    await page.getByPlaceholder('密码').fill(access.pc.password);
    const loginResponse = page.waitForResponse(r => r.url().endsWith('/login') && r.request().method() === 'POST');
    await page.getByRole('button', { name: /登\s*录/ }).click();
    const login = await (await loginResponse).json();
    assert.equal(login.code, 200, login.msg);
    await page.getByRole('heading', { name: '包厢餐食工作台' }).waitFor();
    const ledgerReady = page.waitForResponse(r => r.url().includes('/ktv-api/finance/ledger'));
    await page.getByRole('tab', { name: '收支总账', exact: true }).click();
    await ledgerReady;
    const panel = page.locator('.finance-panel');
    await panel.locator('.el-loading-mask:visible').waitFor({ state: 'hidden' });
    const originalSummary = await panel.locator('.finance-summary').innerText();
    let dailyCount = 0, firstSeen;
    const firstRequested = new Promise(r => { firstSeen = r; });
    const oldGate = new Promise(r => { releaseOld = r; });
    let finishOld;
    oldFinished = new Promise(r => { finishOld = r; });
    await page.route('**/ktv-api/finance/daily*', async route => {
      const first = ++dailyCount === 1;
      if (first) { firstSeen(); await oldGate; }
      try {
        await route.fulfill({ json: [{ date: '2026-11-13', count: 1, receiptCents: first ? 1100 : 2200, refundCents: 0, netCents: first ? 1100 : 2200 }] });
      } finally { if (first) finishOld(); }
    });
    await page.getByRole('tab', { name: '按日汇总', exact: true }).click();
    await firstRequested;
    await panel.getByRole('button', { name: '刷新', exact: true }).click();
    const daily = panel.locator('.el-tab-pane:visible');
    await daily.getByText('¥22.00', { exact: true }).first().waitFor();
    releaseOld(); await oldFinished; await page.waitForTimeout(350);
    assert.match(await daily.innerText(), /¥22\.00/, 'A late response overwrote newer daily totals');
    assert.doesNotMatch(await daily.innerText(), /¥11\.00/);
    await page.unroute('**/ktv-api/finance/daily*');

    // A failed newer summary must also invalidate an older in-flight daily request.
    let sawOld;
    const waiting = new Promise(r => { sawOld = r; });
    const gate = new Promise(r => { releaseOld = r; });
    oldFinished = new Promise(r => { finishOld = r; });
    await page.route('**/ktv-api/finance/daily*', async route => {
      sawOld(); await gate;
      try { await route.fulfill({ json: [{ date: '2026-11-13', count: 1, receiptCents: 3300, refundCents: 0, netCents: 3300 }] }); }
      finally { finishOld(); }
    });
    await page.getByRole('tab', { name: '收支明细', exact: true }).click();
    await page.getByRole('tab', { name: '按日汇总', exact: true }).click();
    await waiting;
    await page.route('**/ktv-api/finance/ledger*', route => route.fulfill({ status: 503, json: { message: '测试：账单暂不可用' } }));
    await panel.getByRole('button', { name: '刷新', exact: true }).click();
    await panel.locator('.el-alert').waitFor();
    releaseOld(); await oldFinished; await page.waitForTimeout(350);
    assert.doesNotMatch(await daily.innerText(), /¥33\.00/, 'A failed refresh showed stale daily totals');
    await page.getByRole('tab', { name: '收支明细', exact: true }).click();
    await page.getByRole('tab', { name: '按日汇总', exact: true }).click();
    await page.waitForTimeout(350);
    assert.doesNotMatch(await daily.innerText(), /¥33\.00/, 'Changing tabs revived totals after a failed summary');
    await page.screenshot({ path: path.join(output, 'daily-error.png'), fullPage: true });
    await page.unroute('**/ktv-api/finance/ledger*');
    await page.unroute('**/ktv-api/finance/daily*');
    await panel.getByRole('button', { name: '刷新', exact: true }).click();
    await panel.locator('.el-loading-mask:visible').waitFor({ state: 'hidden' });
    assert.equal(await panel.locator('.finance-summary').innerText(), originalSummary);
    assert.equal(await panel.locator('.el-alert').count(), 0);
    await page.screenshot({ path: path.join(output, 'daily-recovered.png'), fullPage: true });
    assert.deepEqual(errors, []);
    const report = { lateDailyCannotOverwriteLatest: true, failedSummaryClearsDaily: true, tabChangeKeepsFailureState: true, refreshRecoversRealTotals: true, responsesMocked: true, errors };
    await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } catch (e) {
    await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
    throw e;
  } finally {
    releaseOld?.();
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
