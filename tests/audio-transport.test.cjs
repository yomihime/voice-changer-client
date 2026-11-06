'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const modules = Promise.all([import('../src/audio/AudioTransport.js'), import('../src/api/BackendClient.js')]);
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const settings = { protocol: 'rest', sendingMode: 'single', sampleRate: 48000, legacyRate: 48000,
  legacyBackend: 'legacy', expectedSamplesPolicy: 'same' };

function owner(protocol = 'legacy-vcc') {
  const audioListeners = new Set();
  const invalidators = new Set();
  return {
    generation: 0, state: { protocol }, audioState: { revision: 0, blocked: false },
    requests: [], resetCount: 0, busy: false,
    onInvalidate(callback) { invalidators.add(callback); return () => invalidators.delete(callback); },
    onAudioChange(callback) { audioListeners.add(callback); callback(this.audioState); return () => audioListeners.delete(callback); },
    clearAudioError() { return !this.busy; },
    block(value) {
      this.audioState = { revision: this.audioState.revision + 1, blocked: value };
      for (const callback of audioListeners) callback(this.audioState);
    },
    invalidate() { this.generation++; for (const callback of invalidators) callback(); },
    async json(path, options) {
      this.requests.push({ path, options });
      assert.equal(path, '/reset_audio');
      assert.equal(options.body, '{}');
      return { stream_epoch: 'synthetic-epoch-' + ++this.resetCount };
    },
    async request(path, options) {
      this.requests.push({ path, options });
      return options.consume(new Response(new Float32Array([0.1, 0.2, 0.3, 0.4]).buffer));
    }
  };
}

test('slow HTTP retains one in-flight and one latest pending chunk, with observable drops', async () => {
  const [{ AudioTransport }] = await modules;
  const client = owner();
  const conversions = [];
  const outputs = [];
  let now = 10;
  const transport = new AudioTransport({ client, clock: () => now, onOutput: data => outputs.push(data[0]),
    convert: (data, options) => { const result = deferred(); conversions.push({ data, options, result }); return result.promise; } });
  assert.equal(await transport.start(settings), true);
  const first = transport.send(new Float32Array(4).fill(1));
  const discarded = transport.send(new Float32Array(4).fill(2));
  const latest = transport.send(new Float32Array(4).fill(3));
  assert.equal(await discarded, false);
  assert.equal(conversions.length, 1);
  assert.equal(transport.getMetrics().inFlight, 1);
  assert.equal(transport.getMetrics().pendingChunks, 1);
  assert.equal(transport.getMetrics().droppedInputFrames, 4);
  assert.equal(transport.getMetrics().overloadEvents, 1);
  now = 35;
  conversions[0].result.resolve(new Float32Array(4).fill(1));
  assert.equal(await first, true);
  assert.equal(conversions.length, 2);
  assert.equal(conversions[1].data[0], 3);
  assert.equal(conversions[0].options.sequence, 0);
  assert.equal(conversions[1].options.sequence, 1);
  now = 50;
  conversions[1].result.resolve(new Float32Array(4).fill(3));
  assert.equal(await latest, true);
  assert.deepEqual(outputs, [1, 3]);
  assert.equal(transport.getMetrics().maxRoundTripMs, 25);
  assert.equal(transport.getMetrics().pendingFrames, 0);
  transport.dispose();
});

test('stop aborts immediately and an older response cannot play after the new epoch', async () => {
  const [{ AudioTransport }] = await modules;
  const conversions = [];
  const outputs = [];
  const transport = new AudioTransport({ client: owner(), onOutput: data => outputs.push(data[0]),
    convert: (data, options) => { const result = deferred(); conversions.push({ options, result }); return result.promise; } });
  await transport.start(settings);
  const old = transport.send(new Float32Array(4).fill(1));
  transport.stop();
  assert.equal(await old, false);
  assert.equal(conversions[0].options.signal.aborted, true);
  await transport.start(settings);
  const fresh = transport.send(new Float32Array(4).fill(2));
  conversions[1].result.resolve(new Float32Array(4).fill(2));
  assert.equal(await fresh, true);
  conversions[0].result.resolve(new Float32Array(4).fill(1));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(outputs, [2]);
  assert.equal(conversions[1].options.streamEpoch, 'synthetic-epoch-2');
  assert.equal(transport.getMetrics().staleResponses, 1);
  transport.dispose();
});

test('one native gateway error drops the frame without replay, while consecutive failures stop', async () => {
  const [{ AudioTransport }, { BackendError }] = await modules;
  const client = owner();
  const gateway = () => new BackendError('backend_transport', 'Proxy failed', { status: 502 });
  const attempts = [];
  const outputs = [];
  const errors = [];
  const transport = new AudioTransport({ client, onOutput: output => outputs.push(output[0]),
    onError: error => errors.push(error), convert: async (data, options) => {
      attempts.push([options.streamEpoch, options.sequence]);
      if (data[0] === 0) throw gateway();
      return data;
    } });
  await transport.start(settings);
  const send = value => transport.send(new Float32Array(4).fill(value));
  assert.equal(await send(0), false);
  assert.equal(transport.state, 'running');
  assert.equal(transport.getMetrics().lastError, null);
  assert.equal(await send(1), true);
  assert.equal(await send(0), false);
  assert.equal(transport.state, 'running');
  assert.equal(await send(0), false);
  assert.equal(transport.state, 'stopped');
  assert.equal(client.resetCount, 1);
  assert.deepEqual(attempts, [0, 1, 2, 3].map(sequence => ['synthetic-epoch-1', sequence]));
  assert.deepEqual(outputs, [1]);
  assert.equal(transport.getMetrics().gatewayDrops, 2);
  assert.equal(transport.getMetrics().droppedInputChunks, 2);
  assert.equal(errors.length, 1);
  transport.dispose();
});

test('an upstream 502 or a renderer failure is still fatal', async () => {
  const [{ AudioTransport }, { BackendError }] = await modules;
  const upstream = new BackendError('http_error', 'Upstream 502', { status: 502 });
  const renderer = new BackendError('backend_transport', 'Render failure', { status: 502 });
  for (const patch of [
    { convert: async () => { throw upstream; } },
    { convert: async data => data, onOutput: () => { throw renderer; } },
  ]) {
    const transport = new AudioTransport({ client: owner(), ...patch });
    await transport.start(settings);
    assert.equal(await transport.send(new Float32Array(4)), false);
    assert.equal(transport.state, 'stopped');
    assert.equal(transport.getMetrics().gatewayDrops, 0);
    transport.dispose();
  }
});

test('late reset handshakes cannot overwrite the current server epoch', async () => {
  const [{ AudioTransport }] = await modules;
  const client = owner();
  const oldReset = deferred();
  const ready = client.json.bind(client);
  let calls = 0;
  client.json = (...args) => calls++ === 0 ? oldReset.promise : ready(...args);
  const transport = new AudioTransport({ client });
  const old = transport.start(settings);
  assert.equal(transport.start(settings), old);
  transport.stop();
  assert.equal(await transport.start(settings), true);
  assert.equal(transport.streamEpoch, 'synthetic-epoch-1');
  oldReset.resolve({ stream_epoch: 'obsolete' });
  assert.equal(await old, false);
  assert.equal(transport.streamEpoch, 'synthetic-epoch-1');
  assert.equal(transport.state, 'running');
  transport.dispose();
});

test('configuration blocking stops the session and unblocking does not silently restart it', async () => {
  const [{ AudioTransport }] = await modules;
  const client = owner();
  const errors = [];
  const pending = deferred();
  const transport = new AudioTransport({ client, onError: error => errors.push(error), convert: () => pending.promise });
  await transport.start(settings);
  const request = transport.send(new Float32Array(4));
  client.block(true);
  assert.equal(await request, false);
  client.block(false);
  assert.equal(transport.state, 'stopped');
  assert.equal(await transport.send(new Float32Array(4)), false);
  client.busy = true;
  await assert.rejects(transport.start(settings), error => error.code === 'busy');
  assert.equal(client.resetCount, 1);
  assert.equal(errors.length, 1);
  client.busy = false;
  assert.equal(await transport.start(settings), true);
  client.invalidate();
  assert.equal(transport.state, 'disposed');
});

test('unsupported SIO, rate mismatch and undeclared variable output never send audio', async () => {
  const [{ AudioTransport }] = await modules;
  for (const [patch, code] of [[{ protocol: 'sio' }, 'unsupported'],
    [{ sampleRate: 44100 }, 'sample_rate_mismatch'], [{ expectedSamplesPolicy: 'variable' }, 'invalid_audio_configuration']]) {
    const client = owner();
    const transport = new AudioTransport({ client });
    await assert.rejects(transport.start({ ...settings, ...patch }), error => error.code === code);
    assert.equal(client.requests.length, 0);
    transport.dispose();
  }
  let expected;
  const transport = new AudioTransport({ client: owner(), convert: async (samples, options) => {
    expected = options.expectedSamples; return samples;
  } });
  await transport.start({ ...settings, legacyBackend: 'official', expectedSamplesPolicy: 'variable' });
  await transport.send(new Float32Array(4));
  assert.equal(expected, null);
  transport.dispose();
});

test('2.x keeps multipart Float32 endpoints and local passthrough makes no backend requests', async () => {
  const [{ AudioTransport }] = await modules;
  for (const mode of ['single', 'bulk']) {
    const client = owner('vcc-2x');
    const transport = new AudioTransport({ client });
    await transport.start({ ...settings, sendingMode: mode });
    assert.equal(await transport.send(new Float32Array([1, 0, -1, 0.5])), true);
    assert.equal(client.requests.length, 1);
    assert.equal(client.requests[0].path, '/api/voice-changer/convert_chunk' + (mode === 'bulk' ? '_bulk' : ''));
    assert.deepEqual(new Float32Array(await client.requests[0].options.body.get('waveform').arrayBuffer()), new Float32Array([1, 0, -1, 0.5]));
    transport.dispose();
  }
  const client = owner();
  const local = new AudioTransport({ client });
  assert.equal(await local.start({ ...settings, localPassthrough: true }), true);
  assert.equal(await local.send(new Float32Array(4)), false);
  assert.equal(client.requests.length, 0);
  local.dispose();
});

test('4/5-second legacy chunks fit the codec and oversized legacy configuration is rejected before reset', async () => {
  const [{ AudioTransport }] = await modules;
  for (const seconds of [4, 5]) {
    const outputs = [];
    const transport = new AudioTransport({ client: owner(), convert: async samples => samples,
      onOutput: samples => outputs.push(samples) });
    assert.equal(await transport.start({ ...settings, sendingChunkSec: seconds }), true);
    const samples = new Float32Array(48000 * seconds).fill(0.25);
    assert.equal(await transport.send(samples), true);
    assert.deepEqual(outputs[0], samples);
    assert.equal(transport.getMetrics().droppedInputFrames, 0);
    transport.dispose();
  }
  for (const patch of [{ sendingChunkSec: 5.01 },
    { sampleRate: 96000, legacyRate: 96000, sendingChunkSec: 5 }]) {
    const client = owner();
    const transport = new AudioTransport({ client });
    await assert.rejects(transport.start({ ...settings, ...patch }), error => error.code === 'invalid_audio_configuration');
    assert.equal(client.requests.length, 0);
    transport.dispose();
  }
});

test('2.x five-second input and response bounds follow the actual 96k sample rate', async () => {
  const [{ AudioTransport }] = await modules;
  const client = owner('vcc-2x');
  const samples = new Float32Array(96000 * 5).fill(0.25);
  client.request = async (path, options) => {
    assert.equal((await options.body.get('waveform').arrayBuffer()).byteLength, samples.byteLength);
    return options.consume(new Response(samples.buffer));
  };
  const outputs = [];
  const transport = new AudioTransport({ client, onOutput: output => outputs.push(output) });
  assert.equal(await transport.start({ ...settings, sampleRate: 96000, sendingChunkSec: 5 }), true);
  assert.equal(await transport.send(samples), true);
  assert.deepEqual(outputs[0], samples);
  assert.equal(await transport.send(new Float32Array(samples.length + 1)), false);
  assert.equal(transport.getMetrics().lastError.code, 'invalid_audio');
  transport.dispose();
});

test('legacy transport uses the shared codec and validates epoch/sequence over synthetic JSON', async () => {
  const [{ AudioTransport }, { backendClient }] = await modules;
  const prior = { state: backendClient.state, fetcher: backendClient.fetcher };
  const calls = [];
  const outputs = [];
  try {
    backendClient.state = { phase: 'ready', protocol: 'legacy-vcc', address: 'http://synthetic.invalid/' };
    backendClient.fetcher = async (url, options) => {
      const body = JSON.parse(options.body);
      calls.push({ path: new URL(url).pathname, body });
      if (calls.at(-1).path === '/reset_audio') return new Response(JSON.stringify({ stream_epoch: 'synthetic-wire' }));
      return new Response(JSON.stringify({ timestamp: body.timestamp, stream_epoch: body.stream_epoch,
        sequence: body.sequence, changedVoiceBase64: body.buffer }));
    };
    const transport = new AudioTransport({ onOutput: data => outputs.push(data) });
    await transport.start(settings);
    assert.equal(await transport.send(new Float32Array([-1, -0.5, 0, 1])), true);
    assert.deepEqual(calls.map(call => call.path), ['/reset_audio', '/test']);
    assert.equal(calls[1].body.stream_epoch, 'synthetic-wire');
    assert.equal(calls[1].body.sequence, 0);
    assert.equal(outputs[0][0], -1);
    assert.equal(outputs[0][3], 1);
    backendClient.fetcher = async () => new Response(JSON.stringify({ error: { code: 'stale_session', reason: 'Synthetic old epoch' } }), { status: 409 });
    assert.equal(await transport.send(new Float32Array(4)), false);
    assert.equal(transport.getMetrics().lastError.code, 'stale_session');
    assert.equal(transport.state, 'stopped');
    transport.dispose();
  } finally { backendClient.state = prior.state; backendClient.fetcher = prior.fetcher; }
});

test('worklet commands have independent acknowledgements and disposal settles all waiters without a socket', async () => {
  const [, { backendClient }] = await modules;
  const prior = { AudioWorkletNode: global.AudioWorkletNode, state: backendClient.state, fetcher: backendClient.fetcher };
  const sent = [];
  class FakeNode {
    constructor() {
      this.port = { onmessage: null, postMessage: message => sent.push(message), close: () => { this.closed = true; } };
    }
    disconnect() { this.disconnected = true; }
  }
  global.AudioWorkletNode = FakeNode;
  backendClient.state = { phase: 'ready', protocol: 'vcc-2x', address: 'http://synthetic.invalid/' };
  backendClient.fetcher = async () => { throw new Error('No audio request expected'); };
  try {
    const { VoiceChangerWorkletNode } = await import('../src/audio/VoiceChangerWorkletNode.js');
    const node = new VoiceChangerWorkletNode({ sampleRate: 48000 }, {});
    assert.equal(node.getSocketId(), undefined);
    assert.equal(sent.length, 0);
    const first = node.configure({ sendingChunkSec: 0.1 });
    const second = node.configure({ sendingChunkSec: 0.3 });
    const configMessages = sent.slice();
    assert.deepEqual(configMessages.map(message => message.chunkFrames), [4800, 14400]);
    for (const message of configMessages.reverse()) node.port.onmessage({ data: { ...message, status: 'ok' } });
    await Promise.all([first, second]);
    assert.equal(node.currentWorkletSetting.sendingChunkSec, 0.3);
    const start = node.start();
    assert.equal(node.start(), start);
    await new Promise(resolve => setImmediate(resolve));
    const startMessage = sent.at(-1);
    assert.equal(startMessage.commandType, 'start');
    node.port.onmessage({ data: { ...startMessage, status: 'ok' } });
    assert.equal(await start, true);
    const stop = node.stop();
    const reset = node.resetBuffer();
    const recording = node.stopOutputRecording();
    assert.equal(node.getPendingRequestCount(), 0);
    node.dispose();
    await Promise.all([stop, reset, recording]);
    assert.equal(node.commands.size, 0);
    assert.equal(node.closed, true);
    assert.equal(node.disconnected, true);
    assert.equal(await node.sendBuffer(new Float32Array(4)), false);
    const noAck = new VoiceChangerWorkletNode({ sampleRate: 48000 }, {});
    await assert.rejects(noAck.updateSetting({ sampleRate: 44100 }), error => error.code === 'sample_rate_mismatch');
    await assert.rejects(noAck.start(), error => error.code === 'audio_ack_timeout');
    assert.equal(noAck.transport.state, 'stopped');
    noAck.dispose();
  } finally {
    backendClient.state = prior.state;
    backendClient.fetcher = prior.fetcher;
    if (prior.AudioWorkletNode) global.AudioWorkletNode = prior.AudioWorkletNode;
    else delete global.AudioWorkletNode;
  }
});

test('recording quiescence aborts HTTP immediately and preserves an older in-flight recording reply', async () => {
  const [, { backendClient }] = await modules;
  const { workerjs } = await import('../src/audio/worker-source.js');
  const prior = { AudioWorkletNode: global.AudioWorkletNode, state: backendClient.state, fetcher: backendClient.fetcher };
  const replies = [];
  const http = deferred();
  let signal;
  let Processor;
  let node;
  class BaseProcessor { constructor() { this.port = { postMessage: message => replies.push(message) }; } }
  class BaseNode {
    constructor() { this.port = { onmessage: null, postMessage() {}, close() {} }; }
    disconnect() {}
  }
  global.AudioWorkletNode = BaseNode;
  backendClient.state = { phase: 'ready', protocol: 'vcc-2x', address: 'http://synthetic.invalid/' };
  backendClient.fetcher = (url, options) => { signal = options.signal; return http.promise; };
  try {
    vm.runInNewContext(workerjs, { AudioWorkletProcessor: BaseProcessor, Float32Array, sampleRate: 48000,
      registerProcessor: (name, value) => { Processor = value; } });
    const processor = new Processor();
    const { VoiceChangerWorkletNode } = await import('../src/audio/VoiceChangerWorkletNode.js?recording-quiesce');
    node = new VoiceChangerWorkletNode({ sampleRate: 48000 }, {});
    node.port.postMessage = message => processor.handleMessage(message);
    const starting = node.start();
    await new Promise(resolve => setImmediate(resolve));
    for (const reply of replies.splice(0)) node.port.onmessage({ data: reply });
    assert.equal(await starting, true);
    const pcm = node.sendBuffer(new Float32Array(4));
    processor.inputRecording = [new Float32Array([0.1, 0.2])];
    processor.inputRecordingFrames = 2;
    processor.outputRecording = [new Float32Array([0.3, 0.4, 0.5])];
    processor.outputRecordingFrames = 3;
    const output = node.stopOutputRecording();
    // The processor has already cleared its array, but the reply has not reached the main thread.
    assert.equal(processor.outputRecording.length, 0);
    const queuedPoll = node.getOutputBufferSize();
    const oldEpoch = node.transport.epoch;
    assert.equal(node.quiesceForRecording(), true);
    assert.ok(node.transport.epoch > oldEpoch);
    assert.equal(signal.aborted, true);
    assert.equal(await pcm, false);
    assert.equal(await queuedPoll, 0);
    assert.equal(processor.isStarted, false);
    assert.equal(node.commands.size, 1);
    const input = node.stopInputRecording();
    for (const reply of replies.splice(0).reverse()) node.port.onmessage({ data: reply });
    assert.deepEqual(await output, new Float32Array([0.3, 0.4, 0.5]));
    assert.deepEqual(await input, new Float32Array([0.1, 0.2]));
    assert.equal(node.commands.size, 0);
    assert.equal(processor.inputRecording.length, 0);
    http.resolve(new Response(new Float32Array(4).buffer));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(node.getAudioMetrics().queuedFrames, 0);
    node.dispose();
  } finally {
    node?.dispose();
    backendClient.state = prior.state;
    backendClient.fetcher = prior.fetcher;
    if (prior.AudioWorkletNode) global.AudioWorkletNode = prior.AudioWorkletNode;
    else delete global.AudioWorkletNode;
  }
});

test('explicit startup warmup is nonzero, bounded, discarded and followed by a fresh epoch', async () => {
  const [{ AudioTransport }] = await modules;
  const client = owner();
  const warm = deferred();
  const warming = deferred();
  const calls = [];
  const outputs = [];
  let now = 100;
  const transport = new AudioTransport({ client, clock: () => now, onOutput: samples => outputs.push(samples),
    convert: (samples, options) => {
      calls.push({ samples, options });
      if (calls.length === 1) { warming.resolve(); return warm.promise; }
      return Promise.resolve(samples);
    } });
  const started = transport.start({ ...settings, warmup: true, sendingChunkSec: 0.2, noiseGate: 0.00001 });
  await warming.promise;
  assert.equal(transport.state, 'warming');
  assert.equal(await transport.send(new Float32Array(4)), false);
  assert.equal(calls[0].samples.length, 9600);
  assert.ok(calls[0].samples.some(value => value !== 0));
  assert.ok(calls[0].samples.every(Number.isFinite));
  assert.equal(calls[0].options.timeoutMs, 60000);
  assert.equal(calls[0].options.streamEpoch, 'synthetic-epoch-1');
  assert.equal(calls[0].options.sequence, 0);
  assert.equal(transport.getMetrics().sentFrames, 0);
  assert.equal(transport.getMetrics().receivedFrames, 0);
  assert.equal(transport.getMetrics().lastRoundTripMs, null);
  assert.equal(outputs.length, 0);
  now = 17200;
  warm.resolve(new Float32Array(9600).fill(0.9));
  assert.equal(await started, true);
  assert.equal(client.resetCount, 2);
  assert.equal(outputs.length, 0);
  assert.equal(transport.getMetrics().warmupFrames, 9600);
  assert.equal(transport.getMetrics().warmupMs, 17100);
  assert.equal(await transport.send(new Float32Array(4).fill(0.2)), true);
  assert.equal(calls[1].options.streamEpoch, 'synthetic-epoch-2');
  assert.equal(calls[1].options.sequence, 0);
  assert.equal(calls[1].options.timeoutMs ?? 10000, 10000);
  assert.equal(outputs.length, 1);
  assert.equal(transport.getMetrics().sentFrames, 4);
  assert.equal(transport.getMetrics().receivedFrames, 4);
  transport.dispose();
});

test('cancelled, blocked, invalidated and aborted warmups cannot start or emit their late output', async () => {
  const [{ AudioTransport }] = await modules;
  for (const action of ['stop', 'blocked', 'invalidate', 'controller']) {
    const client = owner();
    const result = deferred();
    const warming = deferred();
    const outputs = [];
    let signal;
    const transport = new AudioTransport({ client, onOutput: samples => outputs.push(samples),
      convert: (samples, options) => { signal = options.signal; warming.resolve(); return result.promise; } });
    const start = transport.start({ ...settings, warmup: true });
    await warming.promise;
    if (action === 'blocked') client.block(true);
    else if (action === 'invalidate') client.invalidate();
    else if (action === 'controller') transport.startController.abort();
    else transport.stop();
    assert.equal(signal.aborted, true);
    result.resolve(new Float32Array(6144).fill(1));
    assert.equal(await start, false);
    assert.equal(outputs.length, 0);
    assert.equal(client.resetCount, 1);
    assert.notEqual(transport.state, 'running');
    assert.notEqual(transport.state, 'warming');
    assert.equal(transport.getMetrics().warmupMs, null);
    assert.equal(transport.getMetrics().sentFrames, 0);
    transport.dispose();
  }
});

test('a late second reset cannot overwrite a newer session or its warmup metrics', async () => {
  const [{ AudioTransport }] = await modules;
  const client = owner();
  const second = deferred();
  const waiting = deferred();
  const original = client.json.bind(client);
  let resets = 0;
  client.json = (...args) => {
    if (++resets === 2) { waiting.resolve(); return second.promise; }
    return original(...args);
  };
  const transport = new AudioTransport({ client, convert: async samples => samples });
  const previous = transport.start({ ...settings, warmup: true });
  await waiting.promise;
  transport.stop();
  assert.equal(await transport.start(settings), true);
  const currentEpoch = transport.streamEpoch;
  second.resolve({ stream_epoch: 'late-warmup-reset' });
  assert.equal(await previous, false);
  assert.equal(transport.streamEpoch, currentEpoch);
  assert.equal(transport.getMetrics().warmupFrames, 0);
  assert.equal(transport.getMetrics().warmupMs, null);
  transport.dispose();
});

test('warmup waveforms remain bounded above the gate and are skipped for 2.x/local sessions', async () => {
  const [{ AudioTransport }, { MAX_LEGACY_SAMPLES }] = await Promise.all([
    import('../src/audio/AudioTransport.js'), import('../src/api/LegacyPcmCodec.js')]);
  const transport = new AudioTransport({ client: owner() });
  const samples = transport.warmupSamples({ ...settings, sendingChunkSec: 99, noiseGate: 0.8 });
  assert.equal(samples.length, MAX_LEGACY_SAMPLES);
  assert.ok(Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length) > 0.8);
  assert.ok(samples.every(value => Math.abs(value) <= 1));
  assert.throws(() => transport.warmupSamples({ ...settings, noiseGate: 1 }), error => error.code === 'invalid_audio_configuration');
  transport.dispose();
  for (const local of [false, true]) {
    const client = owner(local ? 'legacy-vcc' : 'vcc-2x');
    let converted = 0;
    const session = new AudioTransport({ client, convert: async () => { converted++; } });
    assert.equal(await session.start({ ...settings, warmup: true, localPassthrough: local }), true);
    assert.equal(converted, 0);
    assert.equal(client.requests.length, 0);
    session.dispose();
  }
});

test('production legacy worklet warms before enabling processor input and never posts warmup PCM', async () => {
  const [, { backendClient }] = await modules;
  const prior = { AudioWorkletNode: global.AudioWorkletNode, state: backendClient.state, fetcher: backendClient.fetcher };
  const requests = [];
  const messages = [];
  let resets = 0;
  let node;
  class BaseNode {
    constructor() {
      this.port = { onmessage: null, close() {}, postMessage: message => {
        messages.push(message);
        if (message.requestId) queueMicrotask(() => this.port.onmessage?.({ data: { ...message, status: 'ok' } }));
      } };
    }
    disconnect() {}
  }
  global.AudioWorkletNode = BaseNode;
  backendClient.state = { phase: 'ready', protocol: 'legacy-vcc', address: 'http://synthetic.invalid/' };
  backendClient.fetcher = async (url, options) => {
    const route = new URL(url).pathname;
    requests.push(route);
    const body = JSON.parse(options.body);
    if (route === '/reset_audio') return new Response(JSON.stringify({ stream_epoch: 'production-' + ++resets }));
    return new Response(JSON.stringify({ timestamp: body.timestamp, stream_epoch: body.stream_epoch,
      sequence: body.sequence, changedVoiceBase64: body.buffer }));
  };
  try {
    const { VoiceChangerWorkletNode } = await import('../src/audio/VoiceChangerWorkletNode.js?startup-warmup');
    node = new VoiceChangerWorkletNode({ sampleRate: 48000 }, {});
    assert.equal(await node.start(), true);
    assert.deepEqual(requests, ['/reset_audio', '/test', '/reset_audio']);
    assert.deepEqual(messages.map(message => message.commandType), ['start']);
    assert.equal(node.getAudioMetrics().warmupFrames, 9600);
    assert.equal(node.getAudioMetrics().sentFrames, 0);
    assert.equal(node.getAudioMetrics().receivedFrames, 0);
    for (const seconds of [4, 5]) {
      await node.stop();
      await node.configure({ sendingChunkSec: seconds });
      const configuration = messages.findLast(message => message.commandType === 'config');
      assert.equal(configuration.chunkFrames, 48000 * seconds);
      assert.equal(await node.start(), true);
      assert.equal(node.transport.geometry.chunkFrames, configuration.chunkFrames);
      assert.equal(node.getAudioMetrics().warmupFrames, configuration.chunkFrames);
      assert.equal(node.getAudioMetrics().sentFrames, 0);
    }
  } finally {
    node?.dispose();
    backendClient.state = prior.state;
    backendClient.fetcher = prior.fetcher;
    if (prior.AudioWorkletNode) global.AudioWorkletNode = prior.AudioWorkletNode;
    else delete global.AudioWorkletNode;
  }
});
