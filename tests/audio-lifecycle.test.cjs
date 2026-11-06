'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Synthetic browser resources only. These tests never open devices or a server.
function loadSource(relative, exported, globals) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', relative), 'utf8')
    .replace(/^import .*;\r?\n/gm, '')
    .replace(/^export .*;\r?$/gm, '')
    .replaceAll('import.meta.url', JSON.stringify('file:///synthetic/' + relative));
  const context = { console: { log() {}, warn() {}, error() {} }, Promise, Float32Array, Uint8Array,
    ArrayBuffer, AbortController, Blob, FormData, ...globals };
  vm.runInNewContext(source + '\nglobalThis.subject = ' + exported, context, { filename: relative });
  return context.subject;
}
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function connectionOwner() {
  const listeners = new Set();
  const audioListeners = new Set();
  return {
    onInvalidate(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    invalidate() { for (const listener of listeners) listener(); },
    audioState: { revision: 0, blocked: false }, state: { protocol: 'vcc-2x' },
    onAudioChange(listener) { audioListeners.add(listener); listener(this.audioState); return () => audioListeners.delete(listener); },
    changeAudio(blocked) { this.audioState = { revision: this.audioState.revision + 1, blocked }; for (const listener of audioListeners) listener(this.audioState); },
    listeners, audioListeners
  };
}
function stream(deviceId = 'synthetic-microphone') {
  const events = new Map();
  const track = { stopped: false, readyState: 'live', stop() { this.stopped = true; this.readyState = 'ended'; },
    getSettings: () => ({ deviceId }), addEventListener: (name, listener) => events.set(name, listener),
    removeEventListener: name => events.delete(name), end() { this.readyState = 'ended'; events.get('ended')?.(); } };
  return { track, getTracks: () => [track], getAudioTracks: () => [track] };
}
class SyntheticNode {
  constructor() { this.gain = { value: 0 }; this.stream = stream(); this.disconnected = false; }
  connect() {}
  disconnect() { this.disconnected = true; }
}
function audioContext(addModule = async () => {}) {
  const nodes = [];
  const createNode = () => { const node = new SyntheticNode(); nodes.push(node); return node; };
  return { nodes, sampleRate: 48000, audioWorklet: { addModule }, createGain: createNode, createAnalyser: createNode,
    createMediaStreamDestination: createNode, createMediaStreamSource: createNode };
}
function clientClass(owner, mediaDevices = {}) {
  const created = [];
  class Worklet extends SyntheticNode {
    constructor() { super(); created.push(this); }
    async updateSetting() {}
    async updateWorkletSetting() {}
    setStatusListener() {}
    setExceptionListener() {}
    async start() { this.started = true; return true; }
    async stop() { this.started = false; }
    async resetBuffer() {}
    quiesceForRecording() { this.quiesced = true; return true; }
    async startInputRecording() {}
    async startOutputRecording() {}
    async stopInputRecording() { return new Float32Array(0); }
    async stopOutputRecording() { return new Float32Array(0); }
    getAudioMetrics() { return { processor: {} }; }
    dispose() { this.disposed = true; this.disconnect(); }
  }
  const BlockingQueue = loadSource('audio/BlockingQueue.js', 'BlockingQueue', {});
  const revoked = [];
  const Client = loadSource('audio/VoiceChangerClient.js', 'VoiceChangerClient', {
    workerjs: '', log() {}, buildExports: {}, BlockingQueue, VoiceChangerWorkletNode: Worklet,
    backendClient: owner, navigator: { mediaDevices },
    URL: { createObjectURL: () => 'blob:synthetic', revokeObjectURL: value => revoked.push(value) }
  });
  return { Client, created, revoked };
}

test('invalidating a client releases adopted tracks and nodes and permits a fresh initialization', async () => {
  const owner = connectionOwner();
  const { Client, created } = clientClass(owner);
  const client = new Client();
  const context = audioContext();
  assert.equal(await client.initialize(context, false), true);
  const input = stream();
  await client.updateClientSetting({ ...client.setting, audioInput: input });
  assert.equal(client.currentMediaStream, null, 'settings must not implicitly open input');
  await client.start();
  owner.invalidate();
  assert.equal(client.disposed, true);
  assert.equal(input.track.stopped, true);
  assert.ok(context.nodes.every(node => node.disconnected));
  assert.equal(created[0].disposed, true);
  assert.equal(owner.listeners.size, 0);
  assert.equal(client.getPendingRequestCount(), 0);
  assert.equal(await client.initialize(audioContext(), false), true);
  assert.equal(created.length, 2);
  client.dispose();
  client.dispose();
});

test('a late addModule completion cannot replace the new StrictMode session', async () => {
  const owner = connectionOwner();
  const pending = deferred();
  const { Client, created, revoked } = clientClass(owner);
  const client = new Client();
  const previous = client.initialize(audioContext(() => pending.promise), false);
  client.dispose();
  assert.equal(await client.initialize(audioContext(), false), true);
  const currentNode = client.vcInNode;
  pending.resolve();
  assert.equal(await previous, false);
  assert.equal(client.vcInNode, currentNode);
  assert.equal(created.length, 1);
  assert.equal(revoked.length, 2);
  client.dispose();
});

test('device permission resolving after invalidation stops its tracks without reconnecting', async () => {
  const owner = connectionOwner();
  const permission = deferred();
  const requested = deferred();
  const { Client } = clientClass(owner, { getUserMedia: () => { requested.resolve(); return permission.promise; } });
  const client = new Client();
  const context = audioContext();
  await client.initialize(context, false);
  await client.updateClientSetting({ ...client.setting, audioInput: 'synthetic-microphone' });
  const update = client.start();
  await requested.promise;
  const allocatedBeforePermission = context.nodes.length;
  owner.invalidate();
  const input = stream();
  permission.resolve(input);
  await update;
  assert.equal(input.track.stopped, true);
  assert.equal(context.nodes.length, allocatedBeforePermission);
  assert.equal(client.currentMediaStream, null);
});

test('worklet disposal aborts transport, closes its port and ignores late PCM', async () => {
  const response = deferred();
  const calls = [];
  const owner = connectionOwner();
  class Transport {
    constructor({ onOutput }) { this.onOutput = onOutput; this.epoch = 0; this.state = 'stopped'; }
    async start() { this.state = 'running'; return true; }
    async send() {
      this.controller = new AbortController();
      calls.push(this.controller);
      await response.promise;
      if (this.state === 'disposed' || this.controller.signal.aborted) return false;
      await this.onOutput(new Float32Array([0.1, 0.2]), { epoch: this.epoch });
      return true;
    }
    stop() { this.epoch++; this.controller?.abort(); this.state = 'stopped'; }
    dispose() { this.stop(); this.state = 'disposed'; }
    getMetrics() { return { inFlight: this.controller && !this.controller.signal.aborted ? 1 : 0 }; }
  }
  class AudioWorkletNode extends SyntheticNode {
    constructor() {
      super();
      this.messages = [];
      this.port = { onmessage: null, postMessage: message => {
        this.messages.push(message);
        queueMicrotask(() => this.port.onmessage?.({ data: { ...message, status: 'ok' } }));
      }, close: () => { this.port.closed = true; } };
    }
  }
  const Worklet = loadSource('audio/VoiceChangerWorkletNode.js', 'VoiceChangerWorkletNode', {
    AudioWorkletNode, AudioTransport: Transport, backendClient: owner, setTimeout, clearTimeout,
    BackendError: class extends Error {}
  });
  const worklet = new Worklet({ sampleRate: 48000 }, {});
  await worklet.start();
  const audio = worklet.sendBuffer(new Float32Array(16));
  assert.equal(calls.length, 1);
  worklet.dispose();
  assert.equal(calls[0].signal.aborted, true);
  assert.equal(worklet.port.closed, true);
  assert.equal(worklet.port.onmessage, null);
  assert.equal(owner.listeners.size, 0);
  assert.equal(owner.audioListeners.size, 0);
  const posted = worklet.messages.length;
  response.resolve();
  await audio;
  await worklet.sendBuffer(new Float32Array(16));
  assert.equal(worklet.messages.length, posted);
  assert.equal(calls.length, 1);
});

test('audio configuration enumerates without permission and closes a late explicit context', async () => {
  const effects = [];
  const states = [];
  const events = new Map();
  const contexts = [];
  const enumeration = deferred();
  const resumed = deferred();
  let captureCount = 0;
  const owner = connectionOwner();
  const ReactRuntime = {
    useState: initial => [initial, value => states.push(value)], useRef: value => ({ current: value }),
    useCallback: callback => callback, useEffect: callback => effects.push(callback)
  };
  class AudioContext {
    constructor() { this.state = 'suspended'; contexts.push(this); }
    resume() { return resumed.promise; }
    async close() { this.state = 'closed'; }
  }
  const useAudioConfig = loadSource('hooks/useAudioConfig.js', 'useAudioConfig', {
    ReactRuntime, useTranslation: () => ({ t: value => value }), logMessage() {}, backendClient: owner,
    AudioContext, URL, window: { location: { href: 'http://synthetic.invalid/' } },
    navigator: { mediaDevices: { getUserMedia: () => { captureCount++; }, enumerateDevices: () => enumeration.promise,
      addEventListener: (name, callback) => events.set(name, callback), removeEventListener: name => events.delete(name) } }
  });
  const api = useAudioConfig({ createAudioContextDelay: 100 });
  const cleanup = effects[0]();
  assert.equal(contexts.length, 0, 'enumeration must not allocate AudioContext');
  assert.equal(captureCount, 0);
  cleanup();
  const cleanupAgain = effects[0]();
  const pending = api.ensureAudioContext();
  await Promise.resolve();
  assert.equal(contexts.length, 1);
  owner.invalidate();
  resumed.resolve();
  enumeration.resolve([]);
  assert.equal(await pending, null);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(contexts[0].state, 'closed');
  assert.equal(states.length, 0);
  assert.equal(captureCount, 0);
  assert.equal(events.size, 0);
  cleanupAgain();
  assert.equal(owner.listeners.size, 0);
});

function hookFixture({ started = false, mode = 'client', modelReady = true, serverActive = false,
  context = { sampleRate: 48000 }, outputRate = 48000, delayedInitialize = false,
  inputType = 'microphone', inputAudio = 'synthetic-microphone', outputAudio = 'synthetic-output', monitorAudio = 'none' } = {}) {
  const effects = [];
  const writes = [];
  const startedWrites = [];
  const initializations = [];
  const clients = [];
  const toasts = [];
  const owner = connectionOwner();
  owner.state.protocol = 'legacy-vcc';
  const deviceEvents = new Map();
  const deviceList = { value: [] };
  let contextsRequested = 0;
  class Client {
    constructor() { clients.push(this); this.disposed = true; this.generation = 0; }
    initialize() {
      this.disposed = false;
      if (delayedInitialize) { const pending = deferred(); initializations.push(pending); return pending.promise; }
      initializations.push(true);
      return Promise.resolve(true);
    }
    setVoiceChangerExceptionListener() {}
    async updateNodeSetting() {}
    async updateWorkletSetting() {}
    async updateClientSetting(value) { this.setting = value; }
    async start() { this.desiredRunning = true; this.isVoiceChanging = true; return true; }
    async stop() { this.desiredRunning = false; this.stopCount = (this.stopCount || 0) + 1; }
    async stopOutputRecording() { return new Float32Array(0); }
    dispose() { this.disposed = true; this.desiredRunning = false; this.isVoiceChanging = false; this.generation++; }
    getAudioMetrics() { return {}; }
  }
  const ReactRuntime = {
    useMemo: factory => factory(), useState: initial => [initial, value => writes.push(value)],
    useRef: value => ({ current: value }), useEffect: callback => effects.push(callback), useCallback: callback => callback
  };
  const useClient = loadSource('hooks/useVoiceChangerClient.js', 'useVoiceChangerClient', {
    ReactRuntime, backendClient: owner, VCRestClient: { getInstance: () => ({ getCapabilities: () => ({ clientAudio: { supported: true } }) }) },
    useAppRoot: () => ({ currentSlotInfo: modelReady ? { voice_changer_type: 'RVC', runtime_available: true, chunk_sec: 0.2 } : null,
      serverConfiguration: { voice_changer_input_mode: mode, input_sample_rate: 48000, output_sample_rate: outputRate, rvc_backend: 'legacy' },
      localVoiceChangerInterfaceInfo: { local_voice_changer_interface_active: serverActive },
      ensureAudioContext: async () => { contextsRequested++; return context; }, reloadLocalVoiceChangerInterfaceInfo() {} }),
    VoiceChangerClient: Client, OutputDeviceRouter: class {},
    navigator: { mediaDevices: { addEventListener: (name, listener) => deviceEvents.set(name, listener),
      removeEventListener: name => deviceEvents.delete(name), enumerateDevices: async () => deviceList.value } },
    setInterval, clearInterval, setTimeout, clearTimeout
  });
  useClient({ ctx: context, triggerToast: (type, message) => toasts.push(message), globaSetting: {
    isStarted: started, inputAudioType: inputType, inputAudio,
    outputAudio, monitorAudio, setIsStarted: value => startedWrites.push(value) } });
  return { effects, writes, startedWrites, initializations, clients, toasts, owner, deviceEvents, deviceList,
    contextsRequested: () => contextsRequested };
}

test('client hook ignores an older initialization result after StrictMode cleanup', async () => {
  const fixture = hookFixture({ started: true, delayedInitialize: true });
  const initialize = fixture.effects.find(effect => effect.toString().includes('voiceChangerClient.initialize'));
  const cleanup = initialize();
  cleanup();
  assert.equal(fixture.clients[0].disposed, true);
  const cleanupAgain = initialize();
  fixture.initializations[0].resolve(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(fixture.writes.filter(value => value === true).length, 0);
  fixture.initializations[1].resolve(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(fixture.writes.filter(value => value === true).length, 1);
  cleanupAgain();
  assert.equal(fixture.clients[0].disposed, true);
});

test('Server Device and stopped Client modes never initialize local PCM', async () => {
  for (const options of [{ started: true, mode: 'server', context: null }, { started: false, context: null }]) {
    const fixture = hookFixture(options);
    const cleanups = fixture.effects.map(effect => effect());
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(fixture.initializations.length, 0);
    assert.equal(fixture.contextsRequested(), 0);
    cleanups.forEach(cleanup => cleanup?.());
  }
});

test('model, server writer, devices and sample-rate preflight reject start before local initialization', async () => {
  for (const options of [{ modelReady: false, context: null }, { serverActive: true }, { outputRate: 44100 }, { inputAudio: 'none', context: null }, { inputAudio: 'none' }, { outputAudio: 'none' }]) {
    const fixture = hookFixture({ started: true, ...options });
    const cleanups = fixture.effects.map(effect => effect());
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(fixture.initializations.length, 0);
    assert.equal(fixture.contextsRequested(), 0);
    assert.ok(fixture.startedWrites.includes(false));
    assert.ok(fixture.toasts.length > 0);
    assert.ok(fixture.writes.some(value => value?.phase === 'failed' && typeof value.error === 'string'), 'failure remains available to the controls after the toast closes');
    cleanups.forEach(cleanup => cleanup?.());
  }
});

test('a monitor-only route can start, while mismatched rates explain both values without opening input', async () => {
  const monitorOnly = hookFixture({ started: true, outputAudio: 'none', monitorAudio: 'synthetic-monitor' });
  const cleanups = monitorOnly.effects.map(effect => effect());
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(monitorOnly.initializations.length, 1);
  assert.equal(monitorOnly.toasts.length, 0);
  assert.ok(monitorOnly.writes.some(value => value?.phase === 'running'));
  cleanups.forEach(cleanup => cleanup?.());

  const mismatch = hookFixture({ started: true, outputRate: 44100 });
  const mismatchCleanups = mismatch.effects.map(effect => effect());
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(mismatch.initializations.length, 0);
  assert.ok(mismatch.toasts.some(message => message.includes('48000 Hz') && message.includes('44100 Hz') && message.includes('音声設定')));
  mismatchCleanups.forEach(cleanup => cleanup?.());
});

test('audio revision synchronously disposes the client and requires another explicit start', () => {
  const fixture = hookFixture();
  const cleanup = fixture.effects[0]();
  fixture.clients[0].disposed = false;
  fixture.clients[0].desiredRunning = true;
  fixture.owner.changeAudio(true);
  assert.equal(fixture.clients[0].disposed, true);
  assert.equal(fixture.clients[0].desiredRunning, false);
  assert.ok(fixture.startedWrites.includes(false));
  const previous = fixture.initializations.length;
  fixture.owner.changeAudio(false);
  assert.equal(fixture.initializations.length, previous);
  cleanup();
});

test('devicechange stops a removed selected input and never restarts it on device return', async () => {
  const fixture = hookFixture();
  const cleanups = fixture.effects.map(effect => effect());
  fixture.clients[0].disposed = false;
  fixture.clients[0].desiredRunning = true;
  fixture.clients[0].setting = { audioInput: 'selected' };
  await fixture.deviceEvents.get('devicechange')();
  assert.equal(fixture.clients[0].disposed, true);
  assert.ok(fixture.startedWrites.includes(false));
  assert.ok(fixture.toasts.some(message => message.includes('入力デバイス')));
  fixture.deviceList.value = [{ kind: 'audioinput', deviceId: 'selected' }];
  await fixture.deviceEvents.get('devicechange')();
  assert.equal(fixture.initializations.length, 0);
  cleanups.forEach(cleanup => cleanup?.());
  assert.equal(fixture.deviceEvents.size, 0);
});

test('exact input constraints are used only after explicit start and stop releases tracks', async () => {
  const owner = connectionOwner();
  const requests = [];
  const input = stream('chosen-microphone');
  const { Client } = clientClass(owner, { getUserMedia: async options => { requests.push(options); return input; } });
  const client = new Client();
  await client.initialize(audioContext(), false);
  await client.updateClientSetting({ ...client.setting, audioInput: 'chosen-microphone' });
  assert.equal(requests.length, 0);
  assert.equal(await client.start(), true);
  assert.equal(requests[0].audio.deviceId.exact, 'chosen-microphone');
  assert.equal(client.currentMediaStream, input);
  const source = client.currentMediaStreamAudioSourceNode;
  const stopping = client.stop();
  assert.equal(input.track.stopped, true);
  assert.equal(source.disconnected, true);
  assert.equal(client.currentMediaStream, null);
  await stopping;
  client.dispose();
});

test('transport warmup completes before exact input is acquired, including settings updates while warming', async () => {
  const warming = deferred();
  const entered = deferred();
  const events = [];
  const { Client } = clientClass(connectionOwner(), { getUserMedia: async options => {
    events.push('capture');
    assert.equal(options.audio.deviceId.exact, 'chosen');
    return stream('chosen');
  } });
  const client = new Client();
  await client.initialize(audioContext(), false);
  await client.updateClientSetting({ ...client.setting, audioInput: 'chosen' });
  client.vcInNode.start = () => { events.push('warming'); entered.resolve(); return warming.promise; };
  const starting = client.start();
  await entered.promise;
  await client.updateClientSetting({ ...client.setting, noiseSuppression: true });
  assert.deepEqual(events, ['warming']);
  assert.equal(client.currentMediaStream, null);
  assert.equal(client.isVoiceChanging, false);
  warming.resolve(true);
  assert.equal(await starting, true);
  assert.deepEqual(events, ['warming', 'capture']);
  assert.equal(client.isVoiceChanging, true);
  client.dispose();
});

test('stopping or disposing during warmup never requests microphone permission', async () => {
  for (const action of ['stop', 'dispose']) {
    let captures = 0;
    const warming = deferred();
    const entered = deferred();
    const { Client } = clientClass(connectionOwner(), { getUserMedia: async () => { captures++; return stream('chosen'); } });
    const client = new Client();
    await client.initialize(audioContext(), false);
    await client.updateClientSetting({ ...client.setting, audioInput: 'chosen' });
    client.vcInNode.start = () => { entered.resolve(); return warming.promise; };
    const starting = client.start();
    await entered.promise;
    await client[action]();
    warming.resolve(true);
    assert.equal(await starting, false);
    assert.equal(captures, 0);
    assert.equal(client.currentMediaStream, null);
    client.dispose();
  }
});

test('input failure after warmup stops the processor instead of publishing ready', async () => {
  const events = [];
  const { Client } = clientClass(connectionOwner(), { getUserMedia: async () => { events.push('capture'); throw new Error('permission rejected'); } });
  const client = new Client();
  await client.initialize(audioContext(), false);
  await client.updateClientSetting({ ...client.setting, audioInput: 'chosen' });
  client.vcInNode.start = async () => { events.push('warm'); return true; };
  client.vcInNode.stop = async () => { events.push('stop'); };
  await assert.rejects(client.start(), /permission rejected/);
  assert.deepEqual(events.slice(0, 2), ['warm', 'capture']);
  assert.ok(events.includes('stop'));
  assert.equal(client.isVoiceChanging, false);
  assert.equal(client.transportReady, false);
  assert.equal(client.currentMediaStream, null);
  client.dispose();
});

test('stopping during permission wait disposes the late stream without adopting it', async () => {
  const owner = connectionOwner();
  const permission = deferred();
  const requested = deferred();
  const { Client } = clientClass(owner, { getUserMedia: () => { requested.resolve(); return permission.promise; } });
  const client = new Client();
  await client.initialize(audioContext(), false);
  await client.updateClientSetting({ ...client.setting, audioInput: 'chosen' });
  const starting = client.start();
  await requested.promise;
  await client.stop();
  const input = stream('chosen');
  permission.resolve(input);
  assert.equal(await starting, false);
  assert.equal(input.track.stopped, true);
  assert.equal(client.currentMediaStream, null);
  client.dispose();
});

test('a mismatched device is stopped instead of falling back to the system default', async () => {
  const { Client } = clientClass(connectionOwner(), { getUserMedia: async () => input });
  const input = stream('unexpected-default');
  const client = new Client();
  await client.initialize(audioContext(), false);
  await client.updateClientSetting({ ...client.setting, audioInput: 'chosen' });
  await assert.rejects(client.start(), /一致しません/);
  assert.equal(input.track.stopped, true);
  assert.equal(client.currentMediaStream, null);
  assert.equal(client.isVoiceChanging, false);
  client.dispose();
});

test('default input is requested explicitly and track removal ends the owned session', async () => {
  const requests = [];
  const input = stream('actual-system-default');
  const { Client } = clientClass(connectionOwner(), { getUserMedia: async options => { requests.push(options); return input; } });
  const client = new Client();
  await client.initialize(audioContext(), false);
  await assert.rejects(client.start(), /入力デバイス/);
  assert.equal(requests.length, 0);
  await client.updateClientSetting({ ...client.setting, audioInput: 'default' });
  const errors = [];
  client.setVoiceChangerExceptionListener({ onException: (code, message) => errors.push({ code, message }) });
  assert.equal(await client.start(), true);
  assert.equal(requests[0].audio.deviceId.exact, 'default');
  input.track.end();
  assert.equal(client.currentMediaStream, null);
  assert.equal(client.isVoiceChanging, false);
  assert.equal(errors[0].code, 'AUDIO_DEVICE_ERROR');
  client.dispose();
});

test('a failed AudioContext construction can be retried explicitly', async () => {
  const effects = [];
  const owner = connectionOwner();
  let attempts = 0;
  const useAudioConfig = loadSource('hooks/useAudioConfig.js', 'useAudioConfig', {
    ReactRuntime: { useState: initial => [initial, () => {}], useRef: value => ({ current: value }),
      useCallback: callback => callback, useEffect: callback => effects.push(callback) },
    useTranslation: () => ({ t: value => value }), logMessage() {}, backendClient: owner,
    AudioContext: class {
      constructor() { if (++attempts === 1) throw new Error('context rejected'); this.state = 'running'; }
      async close() { this.state = 'closed'; }
    },
    URL, window: { location: { href: 'http://synthetic.invalid/' } },
    navigator: { mediaDevices: { enumerateDevices: async () => [], addEventListener() {}, removeEventListener() {} } }
  });
  const api = useAudioConfig({});
  const cleanup = effects[0]();
  await assert.rejects(api.ensureAudioContext(), /context rejected/);
  const context = await api.ensureAudioContext();
  assert.equal(attempts, 2);
  assert.equal(context.state, 'running');
  cleanup();
  assert.equal(context.state, 'closed');
});

test('file and sample inputs may prepare a context without falling back to a microphone', async () => {
  for (const inputType of ['file', 'sample', 'capture']) {
    const fixture = hookFixture({ started: true, inputType, inputAudio: 'none', context: null });
    const cleanups = fixture.effects.map(effect => effect());
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(fixture.contextsRequested(), 1);
    assert.equal(fixture.initializations.length, 0);
    assert.equal(fixture.toasts.length, 0);
    cleanups.forEach(cleanup => cleanup?.());
  }
});

test('ordinary stop releases input immediately and settles an already pending recording exactly once', async () => {
  const input = stream('chosen');
  const { Client } = clientClass(connectionOwner(), { getUserMedia: async () => input });
  const client = new Client();
  await client.initialize(audioContext(), false);
  await client.updateClientSetting({ ...client.setting, audioInput: 'chosen' });
  await client.start();
  await client.startInputRecording();
  await client.startOutputRecording();
  const output = deferred();
  let outputReads = 0;
  client.vcInNode.stopOutputRecording = () => { outputReads++; return output.promise; };
  client.vcInNode.stopInputRecording = async () => Float32Array.of(3, 4);
  const pending = client.stopOutputRecording();
  const finishing = client.finalizeRecording();
  assert.equal(input.track.stopped, true);
  assert.equal(client.currentMediaStream, null);
  assert.equal(client.vcInNode.quiesced, true);
  assert.equal(client.isVoiceChanging, false);
  output.resolve(Float32Array.of(1, 2));
  const result = await finishing;
  await pending;
  assert.equal(outputReads, 1);
  assert.deepEqual(Array.from(result.recordings, clip => clip.kind).sort(), ['input', 'output']);
  assert.equal(result.errors.length, 0);
  assert.equal(client.claimRecording('output', result.recordings.find(clip => clip.kind === 'output').samples), false);
  client.dispose();
});

function hookRenderer() {
  const slots = [];
  const pendingEffects = [];
  let cursor = 0;
  let dirty = false;
  const same = (left, right) => left && right && left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
  const ReactRuntime = {
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: initial };
      return [slots[index].value, value => {
        const next = typeof value === 'function' ? value(slots[index].value) : value;
        if (!Object.is(next, slots[index].value)) { slots[index].value = next; dirty = true; }
      }];
    },
    useRef(value) { return slots[cursor++] ??= { current: value }; },
    useMemo(factory, dependencies) {
      const index = cursor++;
      if (!slots[index] || !same(slots[index].dependencies, dependencies)) slots[index] = { value: factory(), dependencies };
      return slots[index].value;
    },
    useCallback(callback, dependencies) { return this.useMemo(() => callback, dependencies); },
    useEffect(callback, dependencies) {
      const index = cursor++;
      if (!slots[index] || !same(slots[index].dependencies, dependencies)) {
        const previous = slots[index];
        slots[index] = { dependencies, cleanup: previous?.cleanup };
        pendingEffects.push(() => { slots[index].cleanup?.(); slots[index].cleanup = callback(); });
      }
    }
  };
  return {
    ReactRuntime,
    render(callback) {
      cursor = 0;
      dirty = false;
      const value = callback();
      while (pendingEffects.length) pendingEffects.shift()();
      return value;
    },
    get dirty() { return dirty; },
    cleanup() { slots.forEach(slot => slot?.cleanup?.()); }
  };
}

test('a rendered hook stops capture immediately and saves a pending recording before disposal', { timeout: 3000 }, async () => {
  const owner = connectionOwner();
  owner.state.protocol = 'legacy-vcc';
  const input = stream('chosen');
  let captureCount = 0;
  const mediaDevices = { getUserMedia: async () => { captureCount++; return input; }, addEventListener() {}, removeEventListener() {} };
  const { Client, created } = clientClass(owner, mediaDevices);
  const runner = hookRenderer();
  const downloads = [];
  const toasts = [];
  const settings = { isStarted: false, inputAudioType: 'microphone', inputAudio: 'chosen', protocol: 'rest',
    nodeInputGain: 1, nodeOutputGain: 1, nodeMonitorGain: 0, isOutputRecording: false, outputAudio: 'synthetic-output', monitorAudio: 'none' };
  settings.setIsStarted = value => { settings.isStarted = value; };
  settings.setIsOutputRecording = value => { settings.isOutputRecording = value; };
  const context = audioContext();
  const root = { currentSlotInfo: { voice_changer_type: 'RVC', runtime_available: true, chunk_sec: 0.2 },
    serverConfiguration: { voice_changer_input_mode: 'client', input_sample_rate: 48000, output_sample_rate: 48000, rvc_backend: 'legacy' } };
  const useClient = loadSource('hooks/useVoiceChangerClient.js', 'useVoiceChangerClient', {
    ReactRuntime: runner.ReactRuntime, backendClient: owner, VoiceChangerClient: Client,
    VCRestClient: { getInstance: () => ({ getCapabilities: () => ({ clientAudio: { supported: true } }) }) },
    useAppRoot: () => root, OutputDeviceRouter: class {}, navigator: { mediaDevices },
    downloadAsWav: (samples, name) => downloads.push({ samples, name }), generateTimestamp: () => 'fixture',
    setInterval, clearInterval, setTimeout, clearTimeout
  });
  const triggerToast = (type, text) => toasts.push({ type, text });
  const render = () => runner.render(() => useClient({ ctx: context, globaSetting: settings, triggerToast }));
  render();
  assert.equal(captureCount, 0);
  settings.isStarted = true;
  render();
  await new Promise(resolve => setImmediate(resolve));
  while (runner.dirty) render();
  assert.equal(captureCount, 1);
  assert.equal(created[0].disposed, undefined);
  settings.isOutputRecording = true;
  render();
  await new Promise(resolve => setImmediate(resolve));
  const clip = deferred();
  created[0].stopOutputRecording = () => clip.promise;
  created[0].getAudioMetrics = () => ({ processor: { outputRecordingTruncated: true } });
  settings.isStarted = false;
  render();
  assert.equal(input.track.stopped, true);
  assert.equal(created[0].quiesced, true);
  assert.equal(created[0].disposed, undefined, 'recording must settle before closing its port');
  clip.resolve(Float32Array.of(1, 2, 3));
  await new Promise(resolve => setImmediate(resolve));
  while (runner.dirty) render();
  assert.equal(created[0].disposed, true);
  assert.equal(downloads.length, 1);
  assert.equal(downloads[0].samples.length, 3);
  assert.ok(toasts.some(toast => toast.type === 'warning'));
  runner.cleanup();
});
