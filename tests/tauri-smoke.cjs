'use strict';
// Exercises the actual packaged WebView2 app with a local synthetic backend.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const vm = require('node:vm');
const { spawn, execFileSync } = require('node:child_process');
const { chromium } = require('playwright-core');
const { WebSocketServer } = require('ws');
const root = path.resolve(__dirname, '..');
const output = path.resolve(process.env.TAURI_TEST_OUTPUT || path.join(root, '.runtime/tauri-smoke'));
const executable = process.env.TAURI_TEST_EXE || path.join(root, 'src-tauri/target/release/voice-changer-client.exe');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitUntil(check, message, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { try { const value = await check(); if (value) return value; } catch {} await delay(100); }
  throw new Error(message);
}
async function freePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function closeWindow(page, clear = false) {
  const closed = page.waitForEvent('close');
  // Destroying WebView2 can close CDP before the invoke promise gets its reply.
  await page.evaluate(clear => clear ? window.__TAURI__.core.invoke('set_clear_site_data_and_stop_app') : window.__TAURI__.window.getCurrentWindow().close(), clear).catch(error => {
    if (!page.isClosed()) throw error;
  });
  await closed;
}
async function mockBackend() {
  const configSource = fs.readFileSync(path.join(root, 'src/hooks/useServerConfig.js'), 'utf8').match(/const DefaultServerConfiguration = (\{[\s\S]*?\n\});/)[1];
  let configuration = vm.runInNewContext(`(${configSource})`);
  const requests = [];
  const server = http.createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    requests.push({ method: req.method, url: req.url, body });
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/vcclient.log') { res.end('2026-09-27 INFO synthetic backend ready\n'); return; }
    if (url.pathname.startsWith('/api/voice-changer/convert_chunk')) {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.end(Buffer.from(new Float32Array(960).fill(0.05).buffer)); return;
    }
    let value = [];
    if (url.pathname === '/api/configuration-manager/configuration') {
      if (req.method === 'PUT') configuration = JSON.parse(body.toString());
      value = configuration;
    } else if (url.pathname === '/api/local-voice-changer-interface/information') {
      value = { local_voice_changer_interface_active: false };
    } else if (req.method !== 'GET') value = { status: 'ok' };
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value));
  });
  const sockets = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => sockets.handleUpgrade(req, socket, head, peer => {
    peer.on('message', (data, binary) => peer.send(data, { binary }));
  }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}/`, requests,
    close: async () => { for (const socket of sockets.clients) socket.terminate(); sockets.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } };
}
async function run() {
  fs.mkdirSync(output, { recursive: true });
  const backend = await mockBackend();
  const port = await freePort(), cdpPort = await freePort();
  const profile = path.join(output, `profile-${Date.now()}`);
  const options = ['--backend', backend.url, '--port', String(port), '--profile-dir', profile, '--hidden', '--deny-media'];
  const errors = [];
  let launchNumber = 0;
  const launch = () => {
    const log = fs.openSync(path.join(output, `process-${++launchNumber}.log`), 'w');
    try {
      return spawn(executable, options, { windowsHide: true, stdio: ['ignore', log, log], env: { ...process.env,
        WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${cdpPort}`,
      } });
    } finally { fs.closeSync(log); }
  };
  let child = launch();
  let browser;
  try {
    child.on('error', error => errors.push(error.message));
    await waitUntil(async () => { if (child.exitCode !== null) throw new Error(`Exited ${child.exitCode}`); return (await fetch(`http://127.0.0.1:${cdpPort}/json/version`)).ok; }, 'WebView2 debugging endpoint did not start', 60000);
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);
    const context = browser.contexts()[0];
    const page = await waitUntil(() => context.pages().find(page => page.url().startsWith(`http://127.0.0.1:${port}/`)), 'Client window not found');
    page.on('pageerror', error => errors.push(error.message));
    await page.locator('#root h2').waitFor();
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'zh'));
    await page.reload();
    await page.getByRole('button', { name: '高级设置', exact: true }).waitFor();
    await waitUntil(() => page.locator('#backend-status').evaluate(element => element.hidden), 'Mock backend not recognized');
    assert.equal(await page.evaluate(() => typeof window.__TAURI__?.core?.invoke), 'function');
    assert.equal(await page.evaluate(() => isSecureContext), true);
    await page.screenshot({ path: path.join(output, 'dashboard.png'), animations: 'disabled' });
    for (const label of ['高级设置', '按键设置']) {
      await page.getByRole('button', { name: label, exact: true }).click();
      await page.getByRole('dialog').waitFor();
      if (label === '按键设置') await page.screenshot({ path: path.join(output, 'shortcuts.png'), animations: 'disabled' });
      await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'hidden' });
    }
    await page.locator('button').filter({ hasText: /^上传$/ }).click();
    await page.getByRole('heading', { name: '模型上传', exact: true }).waitFor();
    await page.locator('input[type=file]').first().setInputFiles({ name: 'synthetic-test.pth', mimeType: 'application/octet-stream', buffer: Buffer.from('synthetic fixture; this is not a model') });
    await page.locator('button').filter({ hasText: /^上传$/ }).last().click();
    await waitUntil(() => backend.requests.some(req => req.method === 'POST' && req.url === '/api/slot-manager/slots'), 'UI upload did not reach backend');
    assert.ok(backend.requests.some(req => req.url.includes('upload_file_chunk') && req.body.includes('synthetic fixture')));
    await page.reload(); await page.locator('#root h2').waitFor();

    const apiResult = await page.evaluate(async () => {
      const { VCRestClient } = await import('/src/api/VoiceChangerApiClient.js');
      const api = new VCRestClient(); const config = await api.getServerConfiguration();
      config.pass_through = true; await api.updateServerConfiguration(config);
      return (await api.getServerConfiguration()).pass_through;
    });
    assert.equal(apiResult, true);
    const socketResult = await page.evaluate(() => new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://${location.host}/socket.io/?synthetic=1`); ws.binaryType = 'arraybuffer';
      ws.onopen = () => ws.send(new Uint8Array([4, 8, 15, 16, 23, 42]));
      ws.onmessage = event => { resolve(Array.from(new Uint8Array(event.data))); ws.close(); };
      ws.onerror = () => reject(new Error('WebSocket echo failed'));
    }));
    assert.deepEqual(socketResult, [4, 8, 15, 16, 23, 42]);
    const mediaDenied = await page.evaluate(() => navigator.mediaDevices.getUserMedia({audio:true}).then(stream => { stream.getTracks().forEach(track => track.stop()); return 'unexpected'; }, error => error.name));
    assert.equal(mediaDenied, 'NotAllowedError');
    const audio = await page.evaluate(async () => {
      const { workerjs } = await import('/src/audio/worker-source.js');
      const audio = new AudioContext({ sampleRate: 48000 }); await audio.resume();
      const url = URL.createObjectURL(new Blob([workerjs], {type:'text/javascript'}));
      await audio.audioWorklet.addModule(url); URL.revokeObjectURL(url);
      const node = new AudioWorkletNode(audio, 'voice-changer-worklet-processor', {outputChannelCount:[1]});
      const oscillator = audio.createOscillator(), mute = audio.createGain(); mute.gain.value = 0;
      oscillator.connect(node); node.connect(mute); mute.connect(audio.destination);
      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('AudioWorklet did not process synthetic audio')), 10000);
        let sent = false, samples = 0;
        node.port.onmessage = async event => {
          if (event.data.commandType === 'sendOriginalVoice' && !sent) {
            sent = true; samples = event.data.voice.length;
            const form = new FormData(); form.append('waveform', new Blob([event.data.voice.buffer]), 'waveform.bin');
            const response = await fetch('/api/voice-changer/convert_chunk', {method:'POST', body:form});
            node.port.postMessage({commandType:'sendConvertedVoice', voice:new Float32Array(await response.arrayBuffer())});
          } else if (event.data.commandType === 'sendConvertedVoice') { clearTimeout(timeout); resolve({samples, returned:true, sampleRate:audio.sampleRate}); }
        };
        node.port.postMessage({commandType:'config', config:{realtimeOutputStatusEnabled:false,isPassthroughEnabled:false,realtimeOutputStatusSendIntervalSec:1,sendingChunkSec:0.02}});
        node.port.postMessage({commandType:'start'}); oscillator.start();
      });
      oscillator.stop(); node.disconnect(); mute.disconnect(); await audio.close(); return result;
    });
    assert.ok(audio.samples > 0 && audio.returned);
    const shortcut = await page.evaluate(async () => {
      const invoke = window.__TAURI__.core.invoke;
      const config = await invoke('get_shortcut_settings');
      config.enabled = true; config.shortcuts = [{...config.shortcuts[0], shortcut:'control+alt+shift+F9'}];
      await window.__TAURI__.event.listen('shortcut-action', event => window.__shortcutReceived = event.payload);
      await invoke('update_shortcut_settings', {configDto:config}); await invoke('register_shortcuts');
      return await invoke('get_shortcut_settings');
    });
    assert.equal(shortcut.enabled, true);
    let osShortcutDelivered = false;
    if (process.env.TAURI_TEST_SEND_KEYS === '1') {
      execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'send-shortcut.ps1')], {windowsHide:true});
      await page.waitForFunction(() => window.__shortcutReceived?.action === 'ShowStatus');
      osShortcutDelivered = true;
    }
    await page.evaluate(async () => {
      await window.__TAURI__.event.listen('native-notification', event => window.__nativeNotice = event.payload);
      await window.__TAURI__.core.invoke('show_notification_window_with_message', {params:{message:'Synthetic native event'}});
    });
    await page.waitForFunction(() => window.__nativeNotice?.message === 'Synthetic native event');
    await page.evaluate(async () => { const config = await window.__TAURI__.core.invoke('get_shortcut_settings'); config.enabled=false; await window.__TAURI__.core.invoke('update_shortcut_settings',{configDto:config}); localStorage.setItem('tauri-smoke-persistence','verified'); });
    await page.reload(); assert.equal(await page.evaluate(() => localStorage.getItem('tauri-smoke-persistence')), 'verified');
    await page.getByRole('button', {name:'日志',exact:true}).click();
    const logs = await waitUntil(() => context.pages().find(candidate => candidate.url().includes('app_mode=LogViewer')), 'Log window did not open');
    logs.on('pageerror', error => errors.push(error.message));
    await logs.getByText(/synthetic backend ready/).waitFor();
    await logs.screenshot({path:path.join(output,'logs.png'), animations:'disabled'});
    const blocked = await logs.evaluate(() => window.__TAURI__.core.invoke('get_shortcut_settings').then(() => false, () => true));
    assert.equal(blocked, true);
    await closeWindow(logs);
    await waitUntil(() => logs.isClosed(), 'Log window failed to close');
    assert.equal(page.isClosed(), false);
    assert.deepEqual(errors, []);
    await closeWindow(page);
    await waitUntil(() => child.exitCode !== null, 'Client process failed to exit');
    assert.equal(child.exitCode, 0);
    await waitUntil(async () => { try { await fetch(`http://127.0.0.1:${port}/`); return false; } catch { return true; } }, 'Proxy remained alive');
    await browser.close(); browser = undefined;
    child = launch();
    await waitUntil(async () => (await fetch(`http://127.0.0.1:${cdpPort}/json/version`)).ok, 'Restart did not initialize WebView2');
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);
    const restarted = await waitUntil(() => browser.contexts()[0].pages().find(page => page.url().startsWith(`http://127.0.0.1:${port}/`)), 'Restarted window not found');
    await restarted.locator('#root h2').waitFor();
    assert.equal(await restarted.evaluate(() => localStorage.getItem('tauri-smoke-persistence')), 'verified');
    const saved = await restarted.evaluate(() => window.__TAURI__.core.invoke('get_shortcut_settings'));
    assert.equal(saved.enabled, false); assert.equal(saved.shortcuts[0].shortcut, 'control+alt+shift+F9');
    await closeWindow(restarted, true);
    await waitUntil(() => child.exitCode !== null, 'Restarted client failed to exit');
    assert.equal(child.exitCode, 0);
    await browser.close(); browser = undefined;
    child = launch();
    await waitUntil(async () => (await fetch(`http://127.0.0.1:${cdpPort}/json/version`)).ok, 'Clean profile did not initialize');
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);
    const cleared = await waitUntil(() => browser.contexts()[0].pages().find(page => page.url().startsWith(`http://127.0.0.1:${port}/`)), 'Clean window not found');
    await cleared.locator('#root h2').waitFor();
    assert.equal(await cleared.evaluate(() => localStorage.getItem('tauri-smoke-persistence')), null);
    assert.equal((await cleared.evaluate(() => window.__TAURI__.core.invoke('get_shortcut_settings'))).shortcuts[0].shortcut, 'control+alt+shift+F9');
    await closeWindow(cleared);
    await waitUntil(() => child.exitCode !== null, 'Clean client failed to exit');
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({passed:true, executable, audio, errors,
      checks:['WebView2 render','settings dialogs','synthetic UI upload','API update','binary WebSocket','microphone denial','synthetic AudioWorklet roundtrip','global shortcut registration','native event delivery','restart persistence','isolated logs','clear site data across restart','clean process/proxy exit'], osShortcutDelivered, actualAudioCapture:false, realInference:false},null,2));
    console.log(`Tauri integration passed: ${output}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (child.exitCode === null && child.pid) { try { execFileSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'}); } catch {} }
    await backend.close();
  }
}
run().catch(error => { console.error(error); process.exitCode=1; });
