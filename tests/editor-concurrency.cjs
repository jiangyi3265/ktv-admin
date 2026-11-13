const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

// Logs in normally, then intercepts EVERY KTV business request. No products, images,
// room codes or other business records are written to the server by these checks.
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/o4AAAAASUVORK5CYII=', 'base64');
const oldImage = '/ktv-api/assets/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png';
const newImage = '/ktv-api/assets/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.png';
const file = name => ({ name, mimeType: 'image/png', buffer: pixel });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

(async () => {
  assert(process.env.KTV_TEST_ACCESS, 'Set KTV_TEST_ACCESS to a credentials JSON outside Git');
  const access = JSON.parse(await fs.readFile(process.env.KTV_TEST_ACCESS, 'utf8'));
  const output = process.env.KTV_TEST_OUTPUT || '.local/editor-concurrency';
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  page.setDefaultTimeout(30000);
  const errors = [], unexpected = [], checks = [], uploads = [], writes = [], codes = [];
  page.on('pageerror', e => errors.push(e.message));
  let heldWrites = false, heldCodes = false;
  const waitFor = async predicate => {
    const end = Date.now() + 5000;
    while (!predicate()) { assert(Date.now() < end, 'Expected test request did not arrive'); await new Promise(r => setTimeout(r, 20)); }
  };
  const settle = async () => { await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); };
  const visibleDialog = () => page.locator('.el-dialog:visible');
  const close = async () => {
    const button = visibleDialog().locator('.el-dialog__headerbtn');
    if (await button.isVisible()) await button.click({ timeout: 1000 }).catch(async e => { if (await button.isVisible()) throw e; });
    await visibleDialog().waitFor({ state: 'hidden' });
  };
  const finish = async (job, response) => { job.gate.resolve(response); await job.done.promise; await settle(); };
  const check = async (name, test) => {
    try { await test(); checks.push({ name, passed: true }); }
    catch (e) { checks.push({ name, passed: false, error: e.message }); await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true }); }
    finally { console.log(JSON.stringify(checks.at(-1))); await close(); }
  };
  try {
    const captcha = page.waitForResponse(r => r.url().includes('/captchaImage'), { timeout: 60000 });
    await page.goto((process.env.KTV_PC_URL || 'http://127.0.0.1:5190') + '/login');
    assert.equal((await (await captcha).json()).captchaEnabled, false);
    await page.getByPlaceholder('验证码').waitFor({ state: 'hidden' });
    await page.getByPlaceholder('账号').fill(access.pc.username);
    await page.getByPlaceholder('密码').fill(access.pc.password);
    const stateReady = page.waitForResponse(r => r.url().includes('/ktv-api/state')); stateReady.catch(() => {});
    const loginReady = page.waitForResponse(r => r.url().endsWith('/login') && r.request().method() === 'POST');
    await page.getByRole('button', { name: /登\s*录/ }).click();
    const loginResponse = await loginReady; assert.equal(loginResponse.status(), 200, 'Login HTTP status');
    const login = await loginResponse.json(); assert.equal(login.code, 200, login.msg);
    const state = await (await stateReady).json();
    await page.getByRole('heading', { name: '包厢餐食工作台' }).waitFor();
    assert(state.products.length >= 2 && state.rooms.length >= 2);
    // Fixtures retain real IDs for UI navigation, but all subsequent operations stay in memory.
    state.products.forEach(p => { p.customImage = ''; });
    await page.route('**/ktv-api/**', async route => {
      const url = new URL(route.request().url()), pathname = url.pathname.split('/ktv-api')[1];
      const method = route.request().method();
      if (method === 'GET' && pathname === '/state') return route.fulfill({ json: state });
      if (method === 'GET' && pathname.startsWith('/assets/')) return route.fulfill({ contentType: 'image/png', body: pixel });
      if (method === 'GET' && pathname === '/readiness') return route.fulfill({ json: {} });
      if (method === 'POST' && pathname === '/images') {
        const job = { gate: deferred(), done: deferred() }; uploads.push(job);
        try { const result = await job.gate.promise; await route.fulfill(result); } finally { job.done.resolve(); }
        return;
      }
      if (method === 'PUT' && pathname.startsWith('/products/')) {
        const body = route.request().postDataJSON();
        const job = { body, gate: deferred(), done: deferred() }; writes.push(job);
        try {
          if (heldWrites) await job.gate.promise;
          const item = state.products.find(p => p.id === body.id); Object.assign(item, body, { version: body.version + 1 }); state.revision++;
          await route.fulfill({ json: { id: body.id } });
        } finally { job.done.resolve(); }
        return;
      }
      if (method === 'POST' && /^\/rooms\/[^/]+\/qr$/.test(pathname)) {
        const room = decodeURIComponent(pathname.split('/')[2]);
        const job = { room, type: url.searchParams.get('type'), gate: deferred(), done: deferred() }; codes.push(job);
        try {
          if (heldCodes) await job.gate.promise;
          await route.fulfill({ json: { room, image: 'data:image/png;base64,' + pixel.toString('base64'), ...(job.type === 'h5' ? { url: 'https://example.invalid/?scene=' + room } : {}) } });
        } finally { job.done.resolve(); }
        return;
      }
      unexpected.push({ method, pathname });
      await route.fulfill({ status: 503, json: { message: 'Unexpected business request blocked by test' } });
    });
    await page.getByRole('button', { name: '刷新数据', exact: true }).click();
    await page.locator('.el-loading-mask:visible').waitFor({ state: 'hidden' });
    await page.getByRole('tab', { name: '餐品', exact: true }).click();
    const edit = async index => { await page.locator('.el-tab-pane:visible .el-table__body tbody tr').nth(index).getByRole('button', { name: '编辑', exact: true }).click(); await visibleDialog().waitFor(); };
    await check('upload-blocks-premature-save', async () => {
      await edit(0); const n = uploads.length;
      await visibleDialog().locator('input[type=file]').setInputFiles(file('pending.png')); await waitFor(() => uploads.length === n + 1);
      try { assert(await visibleDialog().getByRole('button', { name: '保存', exact: true }).isDisabled(), 'Save was enabled while the chosen image was still uploading'); }
      finally { await finish(uploads[n], { json: { url: oldImage } }); }
    });
    await check('latest-image-wins', async () => {
      await edit(0); const n = uploads.length;
      await visibleDialog().locator('input[type=file]').setInputFiles(file('old.png')); await waitFor(() => uploads.length === n + 1);
      await visibleDialog().locator('input[type=file]').setInputFiles(file('new.png')); await waitFor(() => uploads.length === n + 2);
      await finish(uploads[n + 1], { json: { url: newImage } });
      assert((await visibleDialog().locator('.food-preview').getAttribute('src')).endsWith(newImage));
      await finish(uploads[n], { json: { url: oldImage } });
      assert((await visibleDialog().locator('.food-preview').getAttribute('src')).endsWith(newImage), 'Old upload overwrote the latest selected image');
      const count = writes.length; await visibleDialog().getByRole('button', { name: '保存', exact: true }).click(); await waitFor(() => writes.length > count);
      assert.equal(writes[count].body.customImage, newImage);
      await visibleDialog().waitFor({ state: 'hidden' });
    });
    await check('upload-cannot-cross-editors', async () => {
      await edit(0); const n = uploads.length;
      await visibleDialog().locator('input[type=file]').setInputFiles(file('closed.png')); await waitFor(() => uploads.length === n + 1);
      await close(); await edit(1);
      const before = await visibleDialog().locator('.food-preview').count();
      await finish(uploads[n], { json: { url: oldImage } });
      assert.equal(await visibleDialog().locator('.food-preview').count(), before, 'Late upload from another dish changed this editor');
    });
    await check('failed-upload-can-retry', async () => {
      await edit(1); const n = uploads.length;
      await visibleDialog().locator('input[type=file]').setInputFiles(file('retry.png')); await waitFor(() => uploads.length === n + 1);
      await finish(uploads[n], { status: 503, json: { message: '测试上传失败' } });
      await visibleDialog().locator('.error').waitFor();
      assert.equal(await visibleDialog().locator('input[type=file]').inputValue(), '', 'File input retained its value, so choosing the same file may not trigger retry');
      await visibleDialog().locator('input[type=file]').setInputFiles(file('retry.png')); await waitFor(() => uploads.length === n + 2);
      await finish(uploads[n + 1], { json: { url: newImage } });
      assert.equal(await visibleDialog().locator('.error').count(), 0, 'Upload error remained after a successful retry');
    });
    await check('save-cannot-close-next-editor', async () => {
      await edit(0); heldWrites = true; const n = writes.length;
      await visibleDialog().getByRole('button', { name: '保存', exact: true }).click(); await waitFor(() => writes.length === n + 1);
      await close(); await edit(1);
      await finish(writes[n]); heldWrites = false;
      await page.waitForTimeout(500);
      assert.equal(await visibleDialog().count(), 1, 'Previous save closed the next dish editor');
    });
    await page.getByRole('tab', { name: '包厢与点餐码', exact: true }).click();
    const code = (index, name) => page.locator('.el-tab-pane:visible .el-table__body tbody tr').nth(index).getByRole('button', { name, exact: true }).click();
    await check('mini-code-clears-previous-web-link', async () => {
      await code(0, '网页码'); await visibleDialog().locator('a[download]').waitFor();
      await close(); await code(1, '小程序码'); await visibleDialog().locator('a[download]').waitFor();
      assert.doesNotMatch(await visibleDialog().innerText(), /example\.invalid/, 'Mini-program QR dialog retained another room’s web URL');
      assert.match(await visibleDialog().innerText(), new RegExp(state.rooms[1].id));
    });
    await check('late-code-cannot-reopen-old-room', async () => {
      heldCodes = true; const n = codes.length;
      await code(0, '网页码'); await waitFor(() => codes.length === n + 1); await close();
      await code(1, '小程序码'); await waitFor(() => codes.length === n + 2);
      await finish(codes[n + 1]); await visibleDialog().locator('a[download]').waitFor();
      await finish(codes[n]); heldCodes = false;
      assert.equal(await visibleDialog().locator('a[download]').getAttribute('download'), state.rooms[1].id + '-qrcode.png', 'An earlier QR request replaced the latest room');
      await page.screenshot({ path: path.join(output, 'qr-latest.png'), fullPage: true });
    });
    assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
    const report = { checks, errors, unexpected, businessRequestsIntercepted: true, productionBusinessWrites: false };
    await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
    assert(checks.every(x => x.passed), 'One or more editor/QR regressions failed');
  } finally {
    for (const job of [...uploads, ...writes, ...codes]) job.gate.resolve({ status: 499, json: {} });
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
