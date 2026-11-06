'use strict';
// Actual WebView2 + synthetic HTTP controls. No audio APIs or private payloads.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright-core');
const root = path.resolve(__dirname, '..');
const output = path.resolve(process.env.TAURI_TEST_OUTPUT || path.join(root, '.runtime/http-diagnostics-' + Date.now()));
const executable = process.env.TAURI_TEST_EXE || path.join(root, 'src-tauri/target/release/voice-changer-client.exe');
const count = Number(process.env.HTTP_TEST_REQUESTS || 1000);
assert.ok(Number.isInteger(count) && count >= 1 && count <= 10000);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, timeout = 60000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const value = await check(); if (value) return value; await sleep(100); }
  throw Error('HTTP diagnostic fixture did not become ready');
}
async function freePort() {
  const listener = net.createServer();
  await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  return port;
}
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const stats = { requests: 0, connections: 0, requestsPerConnection: [] };
  let mode = 'normal';
  const fixture = http.createServer((request, response) => {
    stats.requests++;
    stats.requestsPerConnection[request.socket.fixtureId]++;
    request.resume();
    request.on('end', () => {
      if (mode === 'reset') { request.socket.resetAndDestroy(); return; }
      if (mode === 'truncated') {
        response.writeHead(200, { 'Content-Length': 100 });
        response.flushHeaders();
        response.write('short');
        setTimeout(() => request.socket.destroy(), 20);
        return;
      }
      if (mode === 'spoof') {
        response.writeHead(502, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: { code: 'backend_transport', reason: 'private-body-sentinel',
          diagnostic: { request_id: 5, generation: 7, elapsed_ms: 2, phase: 'send', category: 'request',
            method: 'GET', path: '/private-body-sentinel', io_kind: 'private-body-sentinel', os_code: 10054,
            extra: 'private-body-sentinel' } } }));
        return;
      }
      const body = JSON.stringify({ fixture: 'generated', data: 'x'.repeat(8192) });
      response.writeHead(mode === 'status' ? 502 : 200,
        { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
      response.end(body);
    });
  });
  fixture.on('connection', socket => {
    socket.fixtureId = stats.connections++;
    stats.requestsPerConnection.push(0);
  });
  await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve));
  const address = 'http://127.0.0.1:' + fixture.address().port + '/';
  const debugPort = await freePort();
  const log = fs.openSync(path.join(output, 'native.log'), 'w');
  const child = spawn(executable, ['--offline', '--hidden', '--deny-media', '--profile-dir', path.join(output, 'profile-' + Date.now())],
    { windowsHide: true, stdio: ['ignore', log, log], env: { ...process.env,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=' + debugPort } });
  fs.closeSync(log);
  child.on('error', error => { child.launchError = error; });
  let browser;
  const report = { passed: false, cases: [], realAudio: false, realInference: false };
  try {
    await until(async () => {
      if (child.launchError) throw child.launchError;
      if (child.exitCode !== null) throw Error('HTTP diagnostic EXE exited');
      try { return (await fetch('http://127.0.0.1:' + debugPort + '/json/version')).ok; } catch { return false; }
    });
    browser = await chromium.connectOverCDP('http://127.0.0.1:' + debugPort);
    const page = await until(() => browser.contexts()[0].pages().find(page => page.url().startsWith('http://127.0.0.1:')));
    await page.waitForFunction(() => !!window.__TAURI__);
    await page.evaluate(() => {
      for (const name of ['getUserMedia', 'getDisplayMedia']) {
        navigator.mediaDevices[name] = () => { throw Error('Media capture is forbidden in HTTP diagnostics'); };
      }
    });
    const configure = value => page.evaluate(address => window.__TAURI__.core.invoke('configure_backend',
      { address, remember: false }), value);
    async function batch(label, requests, method = 'GET', pause = 0) {
      const result = await page.evaluate(async ({ requests, method, pause }) => {
        const statuses = {}, failures = [];
        function safeDiagnostic(raw) {
          if (!raw || typeof raw !== 'object') return null;
          const integer = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
          const choice = (value, allowed) => allowed.includes(value) ? value : null;
          return {
            request_id: integer(raw.request_id), generation: integer(raw.generation), elapsed_ms: integer(raw.elapsed_ms),
            phase: choice(raw.phase, ['send', 'response_body']),
            category: choice(raw.category, ['timeout', 'connect', 'body', 'decode', 'request', 'other']),
            method: choice(raw.method, ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'OTHER']),
            path: choice(raw.path, ['/info', '/test', '/reset_audio', '/update_settings', '/load_model_if_empty', '/api/*', '/socket.io/*', 'other']),
            io_kind: choice(raw.io_kind, ['ConnectionRefused', 'ConnectionReset', 'ConnectionAborted', 'NotConnected',
              'AddrInUse', 'AddrNotAvailable', 'TimedOut', 'WouldBlock', 'UnexpectedEof', 'PermissionDenied', 'OutOfMemory',
              'Other', 'InvalidData', 'InvalidInput', 'Interrupted', 'BrokenPipe', 'NetworkDown', 'NetworkUnreachable',
              'HostUnreachable', 'Unsupported', 'NotFound']),
            os_code: Number.isInteger(raw.os_code) && raw.os_code >= -2147483648 && raw.os_code <= 2147483647 ? raw.os_code : null,
          };
        }
        const started = performance.now();
        for (let index = 0; index < requests; index++) {
          let status = null;
          try {
            const response = await fetch(method === 'GET' ? '/info' : '/test', { method, cache: 'no-store',
              ...(method === 'POST' ? { headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ timestamp: index, buffer: 'A'.repeat(16384), stream_epoch: 'fixture', sequence: index }) } : {}) });
            status = response.status;
            statuses[status] = (statuses[status] || 0) + 1;
            const body = await response.text();
            if (status !== 200) {
              let diagnostic = null;
              try {
                const error = JSON.parse(body).error;
                if (error?.code === 'backend_transport') diagnostic = safeDiagnostic(error.diagnostic);
              } catch {}
              // Never retain an upstream response body, arbitrary reason or URL.
              failures.push({ index, status, diagnostic });
            }
          } catch (error) { failures.push({ index, status, fetchError: error.name }); }
          if (pause) await new Promise(resolve => setTimeout(resolve, pause));
        }
        return { requests, statuses, failures, elapsedMs: performance.now() - started };
      }, { requests, method, pause });
      const entry = { label, ...result, fixtureStats: JSON.parse(JSON.stringify(stats)) };
      report.cases.push(entry);
      console.log(JSON.stringify({ label, requests, statuses: result.statuses, failures: result.failures.length }));
      return entry;
    }
    await configure(address);
    assert.equal((await batch('pooled-get', count)).failures.length, 0);
    assert.equal((await batch('pooled-post', count, 'POST')).failures.length, 0);
    // Streamed uploads may briefly occupy more than one pooled connection.
    // Measure reuse rather than requiring one socket for every body size/timing.
    assert.ok(stats.requestsPerConnection.some(requests => requests > 1), 'Backend connection reuse must be observed');
    if (process.env.HTTP_TEST_PACED_POSTS === '1') {
      assert.equal((await batch('paced-pooled-post', count, 'POST', 5)).failures.length, 0);
    }
    mode = 'reset';
    const beforeReset = stats.requests;
    const reset = await batch('reset-after-request', 1, 'POST');
    assert.equal(reset.statuses[502], 1);
    assert.equal(stats.requests - beforeReset, 1, 'The generated POST must not be replayed');
    assert.equal(reset.failures[0].diagnostic?.phase, 'send');
    assert.notEqual(reset.failures[0].diagnostic?.category, 'connect');
    mode = 'status';
    const status = await batch('upstream-http-502', 1);
    assert.equal(status.statuses[502], 1);
    assert.equal(status.failures[0].diagnostic, null, 'Upstream HTTP status must not be relabeled');
    mode = 'spoof';
    const spoof = await batch('untrusted-diagnostic-filter', 1);
    assert.ok(!JSON.stringify(spoof).includes('private-body-sentinel'));
    assert.equal(spoof.failures[0].diagnostic.path, null);
    assert.equal(spoof.failures[0].diagnostic.io_kind, null);
    mode = 'truncated';
    const truncated = await batch('truncated-response', 1);
    assert.equal(truncated.statuses[200], 1);
    assert.equal(truncated.failures[0].fetchError, 'TypeError');
    mode = 'normal';
    fixture.keepAliveTimeout = 30;
    fixture.keepAliveTimeoutBuffer = 0;
    fixture.closeIdleConnections();
    const beforeIdle = stats.connections;
    assert.equal((await batch('idle-expiry', 20, 'GET', 60)).failures.length, 0);
    assert.ok(stats.connections - beforeIdle >= 19, 'The idle-expiry control must actually open new connections');
    const unused = await freePort();
    await configure('http://127.0.0.1:' + unused + '/');
    const refused = await batch('refused-connect', 1);
    assert.equal(refused.statuses[502], 1);
    assert.equal(refused.failures[0].diagnostic?.category, 'connect');
    assert.equal(refused.failures[0].diagnostic?.phase, 'send');
    assert.equal(refused.failures[0].diagnostic?.os_code, 10061);
    if (process.env.VCC_TEST_URL) {
      const url = new URL(process.env.VCC_TEST_URL);
      assert.ok(['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash);
      await configure(url.href);
      assert.equal((await batch('real-vcc-read-only-info', count)).failures.length, 0);
    }
    report.passed = true;
  } finally {
    if (browser) {
      const page = browser.contexts()[0]?.pages()[0];
      await page?.evaluate(() => window.__TAURI__.window.getCurrentWindow().close()).catch(() => {});
      await browser.close().catch(() => {});
    }
    const alive = () => child.pid != null && child.exitCode === null && child.signalCode === null;
    if (alive()) {
      const exited = new Promise(resolve => child.once('exit', resolve));
      await Promise.race([exited, sleep(2000)]);
      if (alive()) { child.kill(); await Promise.race([exited, sleep(2000)]); }
    }
    report.processExited = !alive();
    fixture.closeAllConnections();
    await new Promise(resolve => fixture.close(resolve));
    const native = fs.readFileSync(path.join(output, 'native.log'), 'utf8').split(/\r?\n/)
      .flatMap(line => { try { const item = JSON.parse(line); return item.event === 'backend_transport' ? [item.diagnostic] : []; } catch { return []; } });
    report.nativeFailures = native;
    report.fixtureTotals = stats;
    if (!report.processExited || !native.some(item => item.phase === 'response_body')) report.passed = false;
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log('HTTP diagnostic report: ' + output);
  }
  assert.ok(report.passed, 'Native body diagnostics and test-process cleanup must both be confirmed');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
