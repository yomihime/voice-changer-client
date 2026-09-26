'use strict';
// Offline UI integration: no real backend, model, microphone or native shell.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { startFrontend } = require('../server.cjs');

async function run() {
  const directory = process.env.CLIENT_TEST_DIST || path.join(__dirname, '../dist');
  const output = path.resolve(process.env.CLIENT_TEST_OUTPUT || path.join(__dirname, '../.runtime/browser-smoke'));
  fs.mkdirSync(output, { recursive: true });
  const service = await startFrontend({ directory, port: 0 });
  let browser;
  try {
    browser = await chromium.launch({ headless: true,
      ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }),
    });
    const context = await browser.newContext({ viewport: { width: 1280, height: 960 }, permissions: [] });
    await context.addInitScript(() => {
      localStorage.setItem('i18nextLng', 'zh');
      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Offline UI test', 'NotAllowedError'));
        navigator.mediaDevices.enumerateDevices = async () => [];
      }
    });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      return url.hostname === '127.0.0.1' || url.protocol === 'data:' ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(service.url);
    await page.locator('#root h2').waitFor();
    await page.locator('#backend-status:not([hidden])').waitFor();
    const initialText = await page.locator('#root').innerText();
    assert.match(initialText, /Realtime Voice Changer Client/);
    await page.screenshot({ path: path.join(output, 'dashboard.png'), fullPage: true });
    for (const label of ['高级设置', '按键设置']) {
      await page.locator('button').filter({ hasText: new RegExp(`^${label}$`) }).click();
      await page.getByRole('dialog').waitFor();
      assert.ok((await page.getByRole('dialog').innerText()).length > 10, `${label} must render`);
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
    }
    await page.locator('button').filter({ hasText: /^上传$/ }).click();
    const uploadTitle = page.getByRole('heading', { name: '模型上传', exact: true });
    await uploadTitle.waitFor();
    await page.getByText('选择模型文件', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(output, 'upload.png'), fullPage: true });
    await page.mouse.click(5, 5);
    await uploadTitle.waitFor({ state: 'hidden' });
    const opened = page.waitForEvent('popup');
    await page.getByRole('button', { name: '日志', exact: true }).click();
    const logs = await opened;
    logs.on('pageerror', error => errors.push(error.message));
    await logs.waitForLoadState();
    await logs.waitForFunction(() => document.querySelector('#root')?.textContent.length > 10);
    assert.equal(new URL(logs.url()).searchParams.get('app_mode'), 'LogViewer');
    await logs.screenshot({ path: path.join(output, 'logs.png'), fullPage: true });
    await logs.close();
    assert.equal(page.isClosed(), false);
    assert.deepEqual(errors, [], 'UI must not throw uncaught module/render errors');
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ passed: true,
      pages: ['dashboard', 'advanced settings', 'upload', 'shortcuts', 'logs'],
      initialText, errors, actualAudioCapture: false, backend: 'offline' }, null, 2));
    console.log(`Browser UI checks passed: ${output}`);
  } finally {
    await browser?.close();
    await service.close();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
