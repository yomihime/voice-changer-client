'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/legacy-vcc-info.json'), 'utf8'));
const modules = Promise.all([import('../src/api/LegacyVccAdapter.js'), import('../src/api/BackendClient.js')]);
const response = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('partial registration slots remain occupied while other numeric slots stay available', async () => {
  const [{ LegacyVccAdapter }] = await modules;
  const state = structuredClone(fixture);
  state.clientCapabilities = { safeModelRegistration: true };
  state.occupiedModelSlots = [0, 499];
  const adapter = new LegacyVccAdapter({ generation: 0 });
  const slots = adapter.slots(state);
  assert.equal(slots.find(slot => slot.slot_index === 0).registration_available, false);
  assert.match(slots.find(slot => slot.slot_index === 0).registration_error, /保存済み/);
  assert.equal(slots.find(slot => slot.slot_index === 1).registration_available, true);
});

function registerRvc(state, index = 0) {
  const slot = state.modelSlots.find(value => value.slotIndex === index);
  Object.assign(slot, { voiceChangerType: 'RVC', name: 'Synthetic RVC', modelFile: 'synthetic.pth',
    indexFile: 'synthetic.index', defaultTune: 0, defaultIndexRatio: 0, defaultProtect: 0.5,
    isONNX: false, modelType: 'pyTorchRVCv2', samplingRate: 48000, f0: true,
    embChannels: 768, embedder: 'hubert_base', version: 'v2' });
  return slot;
}
function selectRvc(state, index = 0) {
  const slot = state.modelSlots.find(value => value.slotIndex === index);
  Object.assign(state, { modelSlotIndex: index, gpu: -9999, inputSampleRate: 48000, outputSampleRate: 48000,
    tran: slot.defaultTune, indexRatio: slot.defaultIndexRatio, protect: slot.defaultProtect,
    dstId: 0, f0Detector: 'rmvpe_onnx', rvcBackend: 'legacy', silentThreshold: 0.00001,
    extraConvertSize: 4096, crossFadeOverlapSize: 4096, pipelineInfo: { ready: true, backend: 'legacy' }, backendError: null });
}
async function server(options = {}) {
  const [{ LegacyVccAdapter }, { BackendClient }] = await modules;
  const state = structuredClone(fixture);
  const calls = [];
  const uploaded = new Map();
  const owner = new BackendClient({ fetcher: async (url, init) => {
    const pathname = new URL(url).pathname.replace(/^\/base/, '');
    const call = { url, path: pathname, method: init.method || 'GET', body: init.body };
    calls.push(call);
    if (options.onRequest) {
      const overridden = await options.onRequest(call, state, owner);
      if (overridden) return overridden;
    }
    if (pathname === '/info') return response(state);
    if (pathname === '/update_settings') {
      const key = init.body.get('key');
      const raw = init.body.get('val');
      const value = key === 'passThrough' ? raw === 'true' : ['f0Detector', 'rvcBackend'].includes(key) ? raw : Number(raw);
      if (!options.rejectedKeys?.includes(key)) state[key] = value;
      if (key === 'modelSlotIndex') {
        selectRvc(state, value);
        if (options.modelFailure) { state.pipelineInfo.ready = false; state.backendError = 'synthetic load failure'; }
      }
      return response(state);
    }
    if (pathname === '/upload_file') {
      uploaded.set(init.body.get('filename'), Buffer.from(await init.body.get('file').arrayBuffer()));
      return response({ status: 'OK' });
    }
    if (pathname === '/concat_uploaded_file') {
      const name = init.body.get('filename');
      const chunks = Number(init.body.get('filenameChunkNum'));
      uploaded.set(name, Buffer.concat(Array.from({ length: chunks }, (_, index) => uploaded.get(`${name}_${index}`))));
      return response({ status: 'OK' });
    }
    if (pathname === '/load_model_if_empty') {
      if (options.registrationConflict) return response({ error: { code: 'slot_occupied', reason: 'Synthetic concurrent writer' } }, 409);
      if (options.registrationFailure) return response(null);
      const params = JSON.parse(init.body.get('params'));
      const slot = registerRvc(state, params.slot);
      slot.modelFile = params.files.find(file => file.kind === 'rvcModel').name;
      slot.indexFile = params.files.find(file => file.kind === 'rvcIndex')?.name || '';
      return response({ status: 'OK' });
    }
    if (pathname === '/update_model_info') {
      const update = JSON.parse(init.body.get('newData'));
      const slot = state.modelSlots.find(value => value.slotIndex === update.slot);
      slot[update.key] = update.key === 'speakers' ? JSON.parse(update.val) : update.val;
      return response(state);
    }
    if (pathname === '/upload_model_assets') {
      const params = JSON.parse(init.body.get('params'));
      state.modelSlots.find(value => value.slotIndex === params.slot)[params.name] = params.file;
      return response(state);
    }
    throw new Error('Unexpected synthetic request ' + pathname);
  } });
  owner.state = { phase: 'ready', protocol: 'legacy-vcc', address: 'http://first.invalid/base/' };
  return { state, calls, uploaded, owner, adapter: new LegacyVccAdapter(owner, options.adapterOptions) };
}

test('empty-model information preserves unavailable runtime fields and declares unsupported capabilities', async () => {
  const { adapter } = await server();
  assert.equal(adapter.getCapabilities().uploadRVCModelFile.supported, false);
  const config = await adapter.getServerConfiguration();
  assert.equal(config.current_slot_index, -1);
  assert.equal(config.voice_changer_input_mode, 'client');
  assert.equal(config.audio_input_device_gain, 1);
  assert.equal(config.extra_frame_sec, null);
  assert.equal(config.gpu_device_id_int, null);
  assert.equal(config.input_sample_rate, null);
  const caps = adapter.getCapabilities();
  assert.equal(caps.uploadRVCModelFile.supported, true);
  for (const key of ['deleteServerSlotInfo', 'recording', 'downloadServerRecordingFiles', 'downloadNativeClient',
    'slot:override_embedder', 'config:enable_high_pass_filter', 'config:audio_input_device_sample_rate']) {
    assert.equal(caps[key].supported, false, key);
    assert.ok(caps[key].reason, key);
  }
  assert.deepEqual(await adapter.getServerModuleStatus(), []);
  assert.deepEqual(await adapter.getSamples(), []);
  assert.equal((await adapter.getVoiceChangerManagerInfo()).model_status, 'unloaded');
  assert.equal((await adapter.getServerSlotInfos()).length, 3);
  const devices = await adapter.getServerAudioInputDevices();
  assert.equal(devices[0].host_api, 'Windows WASAPI');
  assert.equal(devices[0].scope, 'server');
});

test('config writes use legacy forms, verify fresh readback and preflight unsupported patches', async () => {
  const { adapter, state, calls } = await server();
  assert.equal((await adapter.updateServerConfiguration({ pass_through: true })).pass_through, true);
  assert.equal(state.passThrough, true);
  const write = calls.find(call => call.path === '/update_settings');
  assert.equal(write.body.get('key'), 'passThrough');
  assert.equal(write.body.get('val'), 'true');
  assert.equal(calls.at(-1).path, '/info');
  const before = calls.filter(call => call.method === 'POST').length;
  await assert.rejects(adapter.updateServerConfiguration({ pass_through: false, enable_high_pass_filter: true }),
    error => error.code === 'unsupported' && error.type === 'ERR_HTTP_EXCEPTION');
  assert.equal(calls.filter(call => call.method === 'POST').length, before);
  await assert.rejects(adapter.updateServerConfiguration({ current_slot_index: 0 }), error => error.code === 'invalid_model');
  assert.equal(state.modelSlotIndex, -1);
});

test('Legacy chunk presets and backend readback share the exact device grid', async () => {
  const { chunkDurationOptions, legacyChunkSeconds } = await import('../src/domain/legacy-chunk.js');
  const { adapter, state, calls } = await server({
    onRequest: async call => call.path === '/reset_audio' ? response({ stream_epoch: 'chunk-updated' }) : null,
  });
  registerRvc(state);
  selectRvc(state);
  state.serverReadChunkSize = 48;
  state.clientCapabilities = { audioEpoch: true };
  const initial = (await adapter.getServerSlotInfo(0)).chunk_sec;
  const adjusted = legacyChunkSeconds(38);
  assert.deepEqual(chunkDurationOptions([0.1, 0.2, 6], initial, true), [adjusted, 0.128, 0.2]);
  assert.deepEqual(chunkDurationOptions([0.1, 0.2], initial, false), [0.1, 0.128, 0.2]);
  assert.equal((await adapter.updateServerSlotInfo({ slot_index: 0, chunk_sec: adjusted })).chunk_sec, adjusted);
  assert.equal(state.serverReadChunkSize, 38);
  assert.equal((await adapter.getServerSlotInfo(0)).chunk_sec, adjusted);
  assert.deepEqual(calls.filter(call => call.method === 'POST').map(call => call.path), ['/update_settings', '/reset_audio']);
  state.enableServerAudio = 1;
  state.serverAudioStated = 1;
  await assert.rejects(adapter.updateServerSlotInfo({ slot_index: 0, chunk_sec: 0.2 }), { code: 'busy' });
  state.serverAudioStated = 0;
  for (const chunk_sec of [0.1, 0.016, 6]) {
    await assert.rejects(adapter.updateServerSlotInfo({ slot_index: 0, chunk_sec }), { code: 'invalid_value' });
  }
  assert.equal(state.serverReadChunkSize, 38);
  assert.equal((await adapter.updateServerSlotInfo({ slot_index: 0, chunk_sec: 0.2 })).chunk_sec, 0.2);
  assert.equal(state.serverReadChunkSize, 75);
});

test('an ignored setting and a failed model load cannot become successful UI state', async () => {
  const rejected = await server({ rejectedKeys: ['passThrough'] });
  await assert.rejects(rejected.adapter.updateServerConfiguration({ pass_through: true }), error => error.code === 'setting_rejected');
  const failed = await server({ modelFailure: true });
  registerRvc(failed.state);
  await assert.rejects(failed.adapter.updateServerConfiguration({ current_slot_index: 0 }),
    error => error.code === 'model_unavailable' && /synthetic/.test(error.message));
  const slot = await failed.adapter.getServerSlotInfo(0);
  assert.equal(slot.runtime_available, false);
  assert.equal(slot.runtime_error, 'synthetic load failure');
  assert.equal((await failed.adapter.getVoiceChangerManagerInfo()).model_status, 'failed');
  failed.state.modelSlotIndex = 1;
  failed.state.backendError = null;
  failed.state.pipelineInfo.ready = true; // A legacy external controller can leave an older engine behind.
  assert.equal((await failed.adapter.getServerSlotInfo(1)).runtime_available, false);
  assert.equal((await failed.adapter.getVoiceChangerManagerInfo()).model_loaded, false);
});

test('current RVC values, CPU aliases and metadata edits keep the runtime/default distinction', async () => {
  const { adapter, state, calls } = await server();
  registerRvc(state, 0);
  registerRvc(state, 1);
  selectRvc(state, 0);
  state.tran = 3;
  state.indexRatio = 0.4;
  assert.equal((await adapter.getServerConfiguration()).gpu_device_id_int, -1);
  assert.equal((await adapter.getServerGPUInfo())[0].device_id_int, -1);
  const slots = await adapter.getServerSlotInfos();
  assert.equal(slots[0].pitch_shift, 3);
  assert.equal(slots[1].pitch_shift, 0);
  assert.equal(slots[1].pitch_estimator, null);
  await adapter.updateServerSlotInfo({ ...slots[0], pitch_shift: 5, name: 'Renamed synthetic model' });
  assert.equal(state.tran, 5);
  assert.equal(state.modelSlots[0].name, 'Renamed synthetic model');
  const count = calls.filter(call => call.method === 'POST').length;
  const current = await adapter.getServerSlotInfo(0);
  await assert.rejects(adapter.updateServerSlotInfo({ ...current, name: 'Do not apply', override_embedder: 'contentvec' }),
    error => error.code === 'unsupported');
  assert.equal(calls.filter(call => call.method === 'POST').length, count);
  assert.equal(state.modelSlots[0].name, 'Renamed synthetic model');
  state.modelSlots.push({ slotIndex: 'Beatrice-JVS', voiceChangerType: 'Beatrice', name: 'Synthetic static slot' });
  assert.equal((await adapter.getServerSlotInfo('Beatrice-JVS')).voice_changer_type, 'Beatrice');
});

test('Server Device uses actual runtime state and rejects an unselected mode or missing devices', async () => {
  const { adapter, state } = await server();
  registerRvc(state);
  selectRvc(state);
  await assert.rejects(adapter.startServerDevice(), error => error.code === 'invalid_mode');
  state.enableServerAudio = 1;
  await assert.rejects(adapter.startServerDevice(), error => error.code === 'device_unavailable');
  state.serverInputDeviceId = 3;
  state.serverOutputDeviceId = 5;
  const requested = await adapter.startServerDevice();
  assert.equal(requested.requested_started, true);
  assert.equal(requested.local_voice_changer_interface_active, false);
  assert.equal(requested.state, 'stopped');
  await assert.rejects(adapter.updateServerConfiguration({ voice_changer_input_mode: 'client' }), error => error.code === 'busy');
  state.serverDeviceRuntimeInfo = { ...state.serverDeviceRuntimeInfo, state: 'error', lastLoopError: 'Synthetic unplug' };
  assert.equal((await adapter.getLocalVoiceChangerInterfaceInfo()).error, 'Synthetic unplug');
  assert.equal((await adapter.stopServerDevice()).requested_started, false);
});

test('resource uploads preserve bytes and use the old chunk names and concat field', async () => {
  const { adapter, calls, uploaded } = await server();
  const bytes = new Uint8Array(1024 * 1024 + 7).fill(37);
  const result = await adapter.uploadFile('', new File([bytes], 'synthetic.txt'));
  assert.equal(result.resource_name, result.name);
  assert.notEqual(result.name, 'synthetic.txt');
  assert.deepEqual(uploaded.get(result.name), Buffer.from(bytes));
  const chunks = calls.filter(call => call.path === '/upload_file');
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].body.get('filename'), result.name + '_0');
  assert.equal(chunks[1].body.get('filename'), result.name + '_1');
  assert.equal(chunks[0].body.has('index'), false);
  assert.equal(calls.find(call => call.path === '/concat_uploaded_file').body.get('filenameChunkNum'), '2');
  await assert.rejects(adapter.uploadFile('', new File(['x'], '../escape.pth')), error => error.code === 'invalid_resource');
});

test('model/index registration requires a safe empty-slot API and verifies the registered resources', async () => {
  const { adapter, state, calls } = await server();
  const progress = [];
  const result = await adapter.uploadRVCModelFile(1, new File(['synthetic model bytes'], 'voice.pth'),
    new File(['synthetic index bytes'], 'voice.index'), null, (...value) => progress.push(value));
  assert.equal(result.name, 'voice');
  assert.equal(result.runtime_available, false);
  assert.equal(state.modelSlotIndex, -1);
  const request = calls.find(call => call.path === '/load_model_if_empty');
  const params = JSON.parse(request.body.get('params'));
  assert.equal(params.slot, 1);
  assert.equal(params.isSampleMode, false);
  assert.deepEqual(params.files.map(file => file.kind), ['rvcModel', 'rvcIndex']);
  assert.ok(params.files.every(file => file.dir === '' && file.name.startsWith('vcc-')));
  assert.deepEqual(progress.at(-1), [100, true]);
  await assert.rejects(adapter.uploadRVCModelFile(1, new File(['x'], 'voice.pth'), null, null), error => error.code === 'slot_occupied');
  delete state.clientCapabilities;
  assert.equal((await adapter.getServerConfiguration()).current_slot_index, -1);
  assert.equal(adapter.getCapabilities().uploadRVCModelFile.supported, false);
  await assert.rejects(adapter.uploadRVCModelFile(0, new File(['x'], 'voice.pth'), null, null), error => error.code === 'unsupported');
  assert.equal((await adapter.updateServerConfiguration({ pass_through: true })).pass_through, true);
});

test('null registration failure and concurrent occupancy remain explicit failures', async () => {
  const failed = await server({ registrationFailure: true });
  await assert.rejects(failed.adapter.uploadRVCModelFile(499, new File(['invalid synthetic checkpoint'], 'invalid.pth'), null, null),
    error => error.code === 'model_load_failed' && error.result_may_have_applied === true);
  assert.equal((await failed.adapter.getServerSlotInfo(499)).voice_changer_type, null);
  const conflict = await server({ registrationConflict: true });
  await assert.rejects(conflict.adapter.uploadRVCModelFile(0, new File(['synthetic'], 'voice.pth'), null, null),
    error => error.code === 'slot_occupied' && error.status === 409
      && typeof error.detail === 'string' && error.detail.includes('Synthetic concurrent writer'));
});

test('address invalidation ends a multipart chain before concat or registration', async () => {
  let invalidated = false;
  const { adapter, calls } = await server({ onRequest: (call, state, owner) => {
    if (call.path === '/upload_file' && !invalidated) {
      invalidated = true;
      owner.invalidate();
      owner.state.address = 'http://second.invalid/base/';
    }
  } });
  await assert.rejects(adapter.uploadRVCModelFile(0, new File(['synthetic'], 'voice.pth'), null, null), error => error.code === 'stale_session');
  assert.equal(calls.some(call => new URL(call.url).hostname === 'second.invalid'), false);
  assert.equal(calls.some(call => call.path === '/concat_uploaded_file' || call.path === '/load_model_if_empty'), false);
});

test('an older info body resolves to the latest same-generation snapshot and cannot cross addresses', async () => {
  const first = deferred();
  const started = deferred();
  let reads = 0;
  const { adapter, owner } = await server({ onRequest: call => {
    if (call.path === '/info' && reads++ === 0) {
      started.resolve();
      return { ok: true, json: () => first.promise };
    }
    return response({ ...structuredClone(fixture), passThrough: true });
  } });
  const older = adapter.getServerConfiguration();
  await started.promise;
  assert.equal((await adapter.getServerConfiguration()).pass_through, true);
  first.resolve(structuredClone(fixture));
  assert.equal((await older).pass_through, true);
  const oldSnapshot = adapter.snapshot;
  owner.invalidate();
  assert.equal(adapter.getCapabilities().uploadRVCModelFile.supported, false);
  owner.state.address = 'http://second.invalid/base/';
  await adapter.getServerConfiguration();
  assert.notEqual(adapter.snapshot, oldSnapshot);
  assert.equal(adapter.snapshotGeneration, owner.generation);
});

test('a control body invalidated mid-read cannot write to the new target', async () => {
  const body = deferred();
  const started = deferred();
  const { adapter, owner, calls } = await server({ onRequest: call => {
    if (call.path === '/info') { started.resolve(); return { ok: true, json: () => body.promise }; }
  } });
  const operation = adapter.updateServerConfiguration({ pass_through: true });
  await started.promise;
  owner.invalidate();
  owner.state.address = 'http://second.invalid/base/';
  body.resolve(structuredClone(fixture));
  await assert.rejects(operation, error => error.code === 'stale_session');
  assert.equal(calls.length, 1);
  assert.equal(adapter.snapshot, null);
});

test('hung legacy polls time out and malformed info never becomes a valid snapshot', async () => {
  const [{ LegacyVccAdapter }, { BackendClient }] = await modules;
  const owner = new BackendClient({ fetcher: (url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
  }) });
  owner.state.address = 'http://synthetic.invalid/';
  const adapter = new LegacyVccAdapter(owner, { timeoutMs: 15 });
  const keepAlive = setTimeout(() => {}, 100);
  try { await assert.rejects(adapter.getServerConfiguration(), error => error.code === 'timeout' && error.retryable); }
  finally { clearTimeout(keepAlive); }
  assert.equal(owner.aborters.size, 0);
  owner.fetcher = async () => response(null);
  await assert.rejects(adapter.getServerConfiguration(), error => error.code === 'invalid_response');
  assert.equal(adapter.snapshot, null);
});

test('the public facade selects legacy explicitly and keeps 2.x endpoint and JSON semantics', async () => {
  const { VCRestClient } = await import('../src/api/VoiceChangerApiClient.js');
  const { backendClient } = await import('../src/api/BackendClient.js');
  const originalState = backendClient.state;
  const originalFetcher = backendClient.fetcher;
  const calls = [];
  try {
    backendClient.state = { phase: 'ready', protocol: 'legacy-vcc', address: 'http://synthetic.invalid/base/' };
    backendClient.fetcher = async url => { calls.push(url); return response(fixture); };
    const facade = new VCRestClient();
    assert.equal((await facade.getServerConfiguration()).current_slot_index, -1);
    assert.equal(new URL(calls[0]).pathname, '/base/info');
    await assert.rejects(facade.deleteServerSlotInfo(0), error => error.code === 'unsupported');
    assert.equal(facade.getCapabilities().deleteServerSlotInfo.supported, false);
    backendClient.state.protocol = 'vcc-2x';
    facade.setBaseUrl('http://synthetic.invalid/base');
    backendClient.fetcher = async request => {
      calls.push(request);
      return response({ current_slot_index: 2 });
    };
    assert.deepEqual(facade.getCapabilities(), {});
    assert.deepEqual(await facade.getServerConfiguration(), { current_slot_index: 2 });
    assert.equal(calls.at(-1).url, 'http://synthetic.invalid/base/api/configuration-manager/configuration');
    await facade.updateServerConfiguration({ current_slot_index: 3 });
    assert.equal(calls.at(-1).method, 'PUT');
    assert.deepEqual(await calls.at(-1).json(), { current_slot_index: 3 });
  } finally {
    backendClient.state = originalState;
    backendClient.fetcher = originalFetcher;
  }
});
