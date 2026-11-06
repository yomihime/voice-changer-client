// Actual packaged client against an explicitly selected, model-free VCC test server.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright-core');

const root = path.resolve(__dirname, '..');
const output = path.resolve(process.env.TAURI_TEST_OUTPUT || path.join(root, '.runtime/vcc-smoke'));
const backend = process.env.VCC_TEST_URL;
const exe = process.env.TAURI_TEST_EXE || path.join(root, 'src-tauri/target/release/voice-changer-client.exe');
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function until(predicate, description) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await delay(100);
  }
  throw new Error(description);
}
async function run() {
  assert.ok(backend, 'VCC_TEST_URL must select an owned empty test instance');
  const info = await (await fetch(new URL('info', backend))).json();
  assert.equal(info.serverAudioStated, 0);
  assert.equal(info.serverDeviceRuntimeInfo.active, false);
  assert.ok(info.modelSlots.every(slot => slot.voiceChangerType == null));
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const cdpPort = server.address().port;
  await new Promise(resolve => server.close(resolve));
  fs.mkdirSync(output, { recursive: true });
  const log = fs.openSync(path.join(output, 'process.log'), 'w');
  const child = spawn(exe, ['--profile-dir', path.join(output, 'profile-' + Date.now()), '--deny-media'], {
    stdio: ['ignore', log, log], windowsHide: false,
    env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=' + cdpPort }
  });
  fs.closeSync(log);
  let browser, page;
  const errors = [];
  try {
    await until(async () => {
      if (child.exitCode !== null) throw Error('Client exited ' + child.exitCode);
      try { return (await fetch('http://127.0.0.1:' + cdpPort + '/json/version')).ok; }
      catch { return false; }
    }, 'WebView2 debug endpoint missing');
    browser = await chromium.connectOverCDP('http://127.0.0.1:' + cdpPort);
    await until(() => {
      page = browser.contexts()[0].pages().find(item => item.url().startsWith('http://127.0.0.1:'));
      return !!page;
    }, 'Client page missing');
    page.on('pageerror', error => errors.push(error.message));
    await page.locator('#backend-address:not([disabled])').waitFor();
    await page.locator('#backend-address').fill(backend);
    await page.getByRole('button', { name: '接続', exact: true }).click();
    await page.locator('#root h2').waitFor();
    await page.locator('.backend-status').waitFor();
    await until(async () => {
      const state = await page.evaluate(async () => {
        const { VCRestClient } = await import('/src/api/VoiceChangerApiClient.js');
        const api = VCRestClient.getInstance();
        return { count: (await api.getServerSlotInfos()).length,
          capabilities: api.getCapabilities(), config: await api.getServerConfiguration() };
      });
      return state.count === 500 && state.config.current_slot_index === -1
        && state.capabilities.initializeServer.supported === false;
    }, 'Live VCC state did not reach the packaged page');
    assert.ok(await page.locator('button[disabled][title*="初期化操作"]').count());
    assert.ok(await page.locator('button[disabled][title*="ダウンロード API"]').count());
    const uploadButton = page.getByTestId('upload-empty-slot');
    await until(() => uploadButton.isEnabled(), 'The main upload entry must be enabled after capability discovery');
    await uploadButton.click();
    const dialog = page.getByRole('dialog', { name: 'モデルをアップロード' });
    await dialog.waitFor();
    const firstUiSlot = await dialog.getAttribute('data-slot-index');
    await dialog.locator('input[type="file"]').first().setInputFiles({ name: 'ui-invalid.pth',
      mimeType: 'application/octet-stream', buffer: Buffer.from('owned invalid UI checkpoint') });
    const responsePromise = page.waitForResponse(response => response.url().endsWith('/load_model_if_empty'));
    await page.getByTestId('submit-model-upload').click();
    const failedResponse = await responsePromise;
    assert.equal(failedResponse.status(), 422);
    assert.equal((await failedResponse.json()).error.code, 'model_load_failed');
    await until(() => page.getByTestId('submit-model-upload').isEnabled(), 'Failed import must leave a recoverable UI');
    await dialog.getByRole('button', { name: '閉じる', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await uploadButton.click();
    await dialog.waitFor();
    const nextUiSlot = await dialog.getAttribute('data-slot-index');
    assert.notEqual(nextUiSlot, firstUiSlot, 'Normal upload must skip the preserved partial slot');
    await dialog.getByRole('button', { name: '閉じる', exact: true }).click();
    const registration = await page.evaluate(async () => {
      const { VCRestClient } = await import('/src/api/VoiceChangerApiClient.js');
      const api = VCRestClient.getInstance();
      const available = (await api.getServerSlotInfos()).find(slot => slot.registration_available);
      if (!available) throw Error('No available test slot');
      const importFixture = () => api.uploadRVCModelFile(available.slot_index,
        new File(['owned invalid packaged fixture'], 'invalid-packaged.pth'), null, null, () => {});
      let failed, conflict;
      try { await importFixture(); } catch (error) { failed = error.code; }
      try { await importFixture(); } catch (error) { conflict = error.code; }
      const remaining = (await api.getServerSlotInfos()).find(slot => slot.registration_available);
      return { failed, conflict, previousSlot: available.slot_index, nextSlot: remaining?.slot_index };
    });
    assert.equal(registration.failed, 'model_load_failed');
    assert.equal(registration.conflict, 'slot_occupied');
    assert.notEqual(registration.nextSlot, registration.previousSlot);
    const live = await page.evaluate(async () => {
      const { VCRestClient } = await import('/src/api/VoiceChangerApiClient.js');
      const api = VCRestClient.getInstance();
      return { config: await api.getServerConfiguration(), local: await api.getLocalVoiceChangerInterfaceInfo(),
        slots: (await api.getServerSlotInfos()).length, capabilities: api.getCapabilities() };
    });
    assert.equal(live.local.local_voice_changer_interface_active, false);
    assert.equal(live.capabilities.uploadRVCModelFile.supported, true);
    assert.match(await page.locator('.backend-status').innerText(), /未準備/);
    await page.screenshot({ path: path.join(output, 'vcc-controls.png'), animations: 'disabled', fullPage: true });
    assert.deepEqual(errors, []);
    const result = { passed: true, actualPackagedWebView2: true, actualVcc: true,
      actualModelSlots: live.slots, unsupportedControlsDisabled: true, serverDeviceActive: false,
      safeRegistrationViaNativeProxy: registration,
      normalUploadFailureRecovery: { firstUiSlot, nextUiSlot },
      pageErrors: errors, realAudio: false, actualAudioCapture: false, realModelInference: false };
    const exited = new Promise(resolve => child.once('exit', resolve));
    await page.evaluate(() => window.__TAURI__.window.getCurrentWindow().close()).catch(error => {
      if (!page.isClosed() && child.exitCode === null) throw error;
    });
    await exited;
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    if (page && !page.isClosed()) {
      await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
      fs.writeFileSync(path.join(output, 'failure.json'), JSON.stringify({ error: error.message,
        pageErrors: errors, body: await page.locator('body').innerText() }, null, 2));
    }
    throw error;
  } finally {
    if (child.exitCode === null) child.kill();
    await browser?.close();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
