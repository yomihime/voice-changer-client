'use strict';
// Headless application integration. Every media API below is a synthetic stub;
// no microphone, AudioContext, sink playback or inference backend is opened.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require('playwright-core');
const { startFrontend } = require('../server.cjs');

async function run() {
  const output = path.resolve(process.env.CLIENT_TEST_OUTPUT || path.join(__dirname, '../.runtime/start-parameter-browser'));
  fs.mkdirSync(output, { recursive: true });
  const state = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/legacy-vcc-info.json'), 'utf8'));
  state.clientCapabilities.audioEpoch = true;
  Object.assign(state, { modelSlotIndex: 0, inputSampleRate: 48000, outputSampleRate: 48000,
    serverReadChunkSize: 48, gpu: 0, tran: 0, indexRatio: 0.30000000000000004, protect: 0.5,
    dstId: 0, f0Detector: 'rmvpe_onnx', rvcBackend: 'legacy', silentThreshold: 0.00001,
    extraConvertSize: 16384, crossFadeOverlapSize: 4096, pipelineInfo: { ready: true, backend: 'legacy' }, backendError: null });
  Object.assign(state.modelSlots[0], { voiceChangerType: 'RVC', name: 'Synthetic model', modelFile: 'synthetic.pth',
    indexFile: 'synthetic.index', defaultTune: 0, defaultIndexRatio: 0.3, defaultProtect: 0.5,
    isONNX: false, modelType: 'pyTorchRVCv2', samplingRate: 48000, f0: true, embChannels: 768,
    embedder: 'hubert_base', version: 'v2' });
  const directory = process.env.CLIENT_TEST_DIST || path.join(__dirname, '../dist');
  const service = await startFrontend({ directory, port: 0 });
  let browser, page, releaseWarmup;
  let warmupMode = 'hold', epochs = 0;
  const calls = [], errors = [];
  const observations = {};
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }) });
    const context = await browser.newContext({ viewport: { width: 1280, height: 960 }, permissions: [] });
    await context.addInitScript(() => {
      localStorage.setItem('i18nextLng', 'ja');
      const key = 'synthetic-start-settings';
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ selectedLanguage: 'ja',
        selectedInputAudioDeviceId: 'none', outputAudio: 'none', monitorAudio: 'none', inputAudioType: 'microphone',
        nodeInputGain: 0.35, nodeOutputGain: 0.30000000000000004, nodeMonitorGain: 0, protocol: 'rest' }));
      window.__syntheticMedia = { contexts: 0, captures: 0, activeCaptures: 0, stoppedTracks: 0, plays: 0 };
      const stats = window.__syntheticMedia;
      const track = (capture = false) => ({ readyState: 'live', stop() {
        if (this.readyState !== 'ended') { stats.stoppedTracks++; if (capture) stats.activeCaptures--; }
        this.readyState = 'ended'; },
        getSettings: () => ({ deviceId: 'synthetic-microphone', sampleRate: 48000, channelCount: 1 }),
        addEventListener() {}, removeEventListener() {} });
      const stream = (capture = false) => { const item = track(capture); return { getTracks: () => [item], getAudioTracks: () => [item] }; };
      const node = () => ({ connect() {}, disconnect() {}, gain: { value: 1 }, fftSize: 2048,
        getFloatTimeDomainData: values => values.fill(0), stream: stream() });
      window.AudioContext = class {
        constructor() { stats.contexts++; this.sampleRate = 48000; this.state = 'running'; this.audioWorklet = { addModule: async () => {} }; }
        async resume() {} async close() { this.state = 'closed'; }
        createGain() { return node(); } createAnalyser() { return node(); }
        createMediaStreamDestination() { return node(); } createMediaStreamSource() { return node(); }
      };
      window.AudioWorkletNode = class {
        constructor() { this.port = { onmessage: null, close() {}, postMessage: message => queueMicrotask(() =>
          this.port.onmessage?.({ data: { ...message, status: 'ok' } })) }; }
        connect() {} disconnect() {}
      };
      Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', { value: async () => [
        { kind: 'audioinput', deviceId: 'synthetic-microphone', label: 'Synthetic microphone' },
        { kind: 'audiooutput', deviceId: 'synthetic-output', label: 'Synthetic output' }
      ] });
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async options => {
        if (options?.audio?.deviceId?.exact !== 'synthetic-microphone') throw new DOMException('Synthetic selected input is unavailable', 'NotFoundError');
        stats.captures++; stats.activeCaptures++; return stream(true);
      } });
      Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', { value: async () => { throw Error('System capture forbidden in this fixture'); } });
      Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', { configurable: true,
        get() { return this.__syntheticStream || null; }, set(value) { this.__syntheticStream = value; } });
      Object.defineProperty(HTMLMediaElement.prototype, 'sinkId', { configurable: true, get() { return this.__syntheticSink || ''; } });
      HTMLMediaElement.prototype.setSinkId = async function(value) { this.__syntheticSink = value; };
      HTMLMediaElement.prototype.play = async function() { stats.plays++; };
      HTMLMediaElement.prototype.pause = function() {};
      window.__TAURI__ = { core: { invoke: async (command, args) => {
        if (command === 'get_connection_profile') return { offline: false };
        if (command === 'load_global_settings') return JSON.parse(localStorage.getItem(key));
        if (command === 'save_global_settings') { localStorage.setItem(key, JSON.stringify(args.settings)); return; }
        if (command === 'get_shortcut_settings') return { enabled: false, shortcuts: [] };
        if (command === 'configure_backend') return;
        throw Error('Unexpected synthetic native command: ' + command);
      } }, event: { listen: async () => () => {} } };
    });
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== new URL(service.url).origin) return route.abort();
      if (url.pathname === '/info') return route.fulfill({ json: state });
      if (url.pathname === '/reset_audio') {
        calls.push({ path: url.pathname, method: request.method() });
        return route.fulfill({ json: { stream_epoch: 'synthetic-' + ++epochs } });
      }
      if (url.pathname === '/test') {
        calls.push({ path: url.pathname, method: request.method() });
        const data = request.postDataJSON();
        if (warmupMode === 'hold') await new Promise(resolve => { releaseWarmup = resolve; });
        if (warmupMode === 'fail') return route.fulfill({ status: 503, json: { error: { code: 'fixture_failure', reason: 'Synthetic warmup failure' } } });
        return route.fulfill({ json: { timestamp: data.timestamp, stream_epoch: data.stream_epoch,
          sequence: data.sequence, changedVoiceBase64: data.buffer } }).catch(() => {});
      }
      if (url.pathname === '/update_settings') {
        const body = request.postData() || '';
        const field = name => body.match(new RegExp('name="' + name + '"\\r\\n\\r\\n([^\\r]+)'))?.[1];
        const key = field('key'), value = field('val');
        assert.ok(key && value != null, 'Synthetic multipart update must contain key and val');
        state[key] = ['f0Detector', 'rvcBackend'].includes(key) ? value : Number(value);
        calls.push({ path: url.pathname, key, value: state[key] });
        return route.fulfill({ json: state });
      }
      return route.continue();
    });
    page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(service.url);
    const start = page.getByRole('button', { name: '変換を開始', exact: true });
    const stop = page.getByRole('button', { name: '変換を停止', exact: true });
    await start.waitFor();
    await page.getByLabel('chunkSec', { exact: true }).waitFor();
    await page.getByText('0.35', { exact: true }).waitFor();
    await page.getByText('0.30', { exact: true }).first().waitFor();
    observations.initialChunk = await page.getByLabel('chunkSec', { exact: true }).locator('option:checked').innerText();
    assert.match(observations.initialChunk, /128 ms.*6144 frames.*カスタム/);
    await start.click();
    await page.getByRole('alert').filter({ hasText: /^開始できませんでした.*入力デバイス/ }).waitFor();
    assert.deepEqual(await page.evaluate(() => ({ contexts: window.__syntheticMedia.contexts, captures: window.__syntheticMedia.captures })), { contexts: 0, captures: 0 });
    observations.freshNoneFailure = true;
    await page.screenshot({ path: path.join(output, 'fresh-none.png'), fullPage: true });
    const configure = async values => {
      await page.getByRole('button', { name: '音声設定', exact: true }).click();
      const dialog = page.getByRole('dialog'); await dialog.waitFor();
      for (const [label, value] of Object.entries(values)) await page.getByLabel(label, { exact: true }).selectOption(value);
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
    };
    await configure({ 'Client 監視': 'synthetic-output' });
    await page.getByTestId('monitor-volume-hint').waitFor();
    assert.equal(await start.isEnabled(), true, 'monitor volume hint is nonblocking');
    await page.getByTestId('monitor-volume-hint').screenshot({ path: path.join(output, 'monitor-volume-hint.png') });
    await configure({ 'Client 監視': 'none' });
    assert.equal(await page.getByTestId('monitor-volume-hint').count(), 0);
    observations.monitorZeroHintIsNonblocking = true;
    await configure({ 'Client 入力': 'synthetic-microphone' });
    await start.click();
    await page.getByRole('alert').filter({ hasText: /^開始できませんでした.*出力またはモニター/ }).waitFor();
    assert.equal(await page.evaluate(() => window.__syntheticMedia.contexts), 0);
    observations.noneOutputFailure = true;
    await configure({ 'Client 出力': 'synthetic-output' });
    await start.click();
    await page.waitForFunction(() => document.querySelector('button[aria-label="変換を開始"]')?.getAttribute('aria-busy') === 'true');
    await page.waitForFunction(() => document.querySelector('.backend-status')?.textContent.includes('モデルを準備中'));
    assert.equal(await start.isDisabled(), true);
    assert.equal(await page.evaluate(() => window.__syntheticMedia.captures), 0);
    await page.screenshot({ path: path.join(output, 'warming.png'), fullPage: true });
    await start.scrollIntoViewIfNeeded();
    await start.locator('xpath=../..').screenshot({ path: path.join(output, 'warming-controls.png') });
    await stop.click();
    await page.waitForFunction(() => document.querySelector('button[aria-label="変換を開始"]')?.disabled === false);
    warmupMode = 'pass'; releaseWarmup?.();
    await page.waitForTimeout(50);
    assert.equal(await page.evaluate(() => window.__syntheticMedia.captures), 0, 'cancelled warmup never reaches even synthetic capture');
    observations.cancelDuringWarmup = true;
    warmupMode = 'fail'; await start.click();
    await page.getByRole('alert').filter({ hasText: /^開始できませんでした.*Synthetic warmup failure/ }).waitFor();
    assert.equal(await start.isEnabled(), true);
    warmupMode = 'pass'; await start.click();
    await page.getByRole('status').filter({ hasText: /^変換中/ }).waitFor();
    assert.equal(await page.evaluate(() => window.__syntheticMedia.captures), 1);
    await stop.click();
    await page.waitForFunction(() => document.querySelector('button[aria-label="変換を開始"]')?.disabled === false);
    assert.equal(await page.evaluate(() => window.__syntheticMedia.activeCaptures), 0);
    observations.errorAndExplicitRestart = true;
    observations.mediaBeforeReload = await page.evaluate(() => window.__syntheticMedia);
    const chunk = page.getByLabel('chunkSec', { exact: true });
    const preset = await chunk.locator('option').evaluateAll(options => options.find(item => item.textContent.includes('0.1 s プリセット'))?.value);
    assert.ok(preset); await chunk.selectOption(preset);
    await page.waitForFunction(value => document.querySelector('select[aria-label="chunkSec"]')?.value === value, preset);
    assert.equal(state.serverReadChunkSize, 38);
    observations.selectedChunk = await chunk.locator('option:checked').innerText();
    assert.match(observations.selectedChunk, /101\.333 ms.*4864 frames.*0\.1 s プリセット/);
    await page.reload(); await start.waitFor();
    await page.waitForFunction(() => document.querySelector('select[aria-label="chunkSec"] option:checked')?.textContent.includes('4864 frames'));
    await page.getByText('0.35', { exact: true }).waitFor();
    await page.getByText('0.30', { exact: true }).first().waitFor();
    await configure({});
    observations.reopenWithoutDrift = true;
    await page.screenshot({ path: path.join(output, 'parameters-after-reopen.png'), fullPage: true });
    await chunk.locator('..').screenshot({ path: path.join(output, 'chunk-details.png') });
    await page.getByText('0.35', { exact: true }).locator('..').screenshot({ path: path.join(output, 'input-volume-details.png') });
    await page.getByText('0.30', { exact: true }).first().locator('..').screenshot({ path: path.join(output, 'output-volume-details.png') });
    // Simulate an origin/device identity change in this disposable fixture profile.
    await page.evaluate(() => {
      const key = 'synthetic-start-settings', saved = JSON.parse(localStorage.getItem(key));
      saved.selectedInputAudioDeviceId = 'synthetic-stale-input-id'; localStorage.setItem(key, JSON.stringify(saved));
    });
    await page.reload(); await start.waitFor(); await start.click();
    await page.getByRole('alert').filter({ hasText: /^開始できませんでした.*Synthetic selected input is unavailable/ }).waitFor();
    assert.equal(await page.evaluate(() => window.__syntheticMedia.captures), 0);
    await configure({ 'Client 入力': 'synthetic-microphone' });
    await start.click(); await page.getByRole('status').filter({ hasText: /^変換中/ }).waitFor();
    await stop.click();
    await page.waitForFunction(() => document.querySelector('button[aria-label="変換を開始"]')?.disabled === false);
    assert.equal(await page.evaluate(() => window.__syntheticMedia.activeCaptures), 0);
    observations.staleInputErrorAndReselectionRecovery = true;
    assert.deepEqual(errors, []);
    const media = await page.evaluate(() => window.__syntheticMedia);
    const report = { passed: true, headless: true, syntheticBackend: true, syntheticMediaOnly: true,
      actualAudioCapture: false, actualAudioPlayback: false, realModelInference: false, realBackendModified: false,
      observations, safeRequestCounts: { reset: calls.filter(call => call.path === '/reset_audio').length,
        warmup: calls.filter(call => call.path === '/test').length, settings: calls.filter(call => call.path === '/update_settings') },
      finalSyntheticMediaAfterReload: media, pageErrors: errors,
      distSourceDigests: Object.fromEntries(['src/hooks/useVoiceChangerClient.js', 'src/features/audio-controls/MainControls.js',
        'src/features/audio-controls/VolumeControls.js', 'src/features/voice/VoiceControls.js', 'src/domain/numeric-display.js',
        'src/domain/legacy-chunk.js', 'src/components/common/BackendStatus.js'].map(relative => [relative,
        crypto.createHash('sha256').update(fs.readFileSync(path.join(directory, relative))).digest('hex')])) };
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    if (page && !page.isClosed()) {
      await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
      fs.writeFileSync(path.join(output, 'failure.json'), JSON.stringify({ error: error.message,
        errors, body: await page.locator('body').innerText() }, null, 2));
    }
    throw error;
  } finally { releaseWarmup?.(); await browser?.close(); await service.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
