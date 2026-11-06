import { BackendError, isLegacyVccInfo } from './BackendClient.js';
import { legacyChunkSeconds, legacyChunkUnits } from '../domain/legacy-chunk.js';

// This is the replaceable legacy boundary. It owns no inference or audio devices.
const CONFIG_KEYS = {
  current_slot_index: 'modelSlotIndex', pass_through: 'passThrough',
  audio_input_device_index: 'serverInputDeviceId', audio_output_device_index: 'serverOutputDeviceId',
  audio_monitor_device_index: 'serverMonitorDeviceId', audio_input_device_gain: 'serverInputAudioGain',
  audio_output_device_gain: 'serverOutputAudioGain', audio_monitor_device_gain: 'serverMonitorAudioGain',
  gpu_device_id_int: 'gpu', input_sample_rate: 'inputSampleRate', output_sample_rate: 'outputSampleRate',
  noise_gate: 'silentThreshold', server_audio_sample_rate: 'serverAudioSampleRate',
  server_read_chunk_size: 'serverReadChunkSize', rvc_backend: 'rvcBackend'
};
const UNSUPPORTED_CONFIG = [
  'sio_broadcast', 'enable_high_pass_filter', 'high_pass_filter_cutoff', 'enable_low_pass_filter',
  'low_pass_filter_cutoff', 'volume_tuning_type', 'server_device_trancate_buffer_ratio',
  'realtime_process_status_enabled', 'realtime_process_status_send_interval_sec',
  'realtime_output_status_enabled', 'realtime_output_status_send_interval_sec'
];
const RUNTIME_CONFIG = new Set(['gpu_device_id_int', 'input_sample_rate', 'output_sample_rate',
  'noise_gate', 'extra_frame_sec', 'crossfade_sec', 'rvc_backend']);
const INTEGER_CONFIG = new Set(['audio_input_device_index', 'audio_output_device_index',
  'audio_monitor_device_index', 'gpu_device_id_int', 'input_sample_rate', 'output_sample_rate',
  'server_audio_sample_rate', 'server_read_chunk_size']);
const METADATA_KEYS = { name: 'name', description: 'description', credit: 'credit',
  terms_of_use_url: 'termsOfUseUrl', speakers: 'speakers' };
const SLOT_SETTINGS = { pitch_shift: 'tran', index_ratio: 'indexRatio', protect: 'protect',
  pitch_estimator: 'f0Detector', dst_id: 'dstId' };
const AUDIO_CONFIG = new Set(['current_slot_index', 'voice_changer_input_mode', 'gpu_device_id_int',
  'input_sample_rate', 'output_sample_rate', 'server_audio_sample_rate', 'server_read_chunk_size',
  'audio_input_device_index', 'audio_output_device_index', 'audio_monitor_device_index',
  'rvc_backend', 'extra_frame_sec', 'crossfade_sec', 'noise_gate', 'pass_through']);
const RVC_MUTATIONS = new Set([...Object.values(SLOT_SETTINGS), 'gpu', 'rvcBackend',
  'extraConvertSize', 'silentThreshold', 'inputSampleRate', 'outputSampleRate', 'crossFadeOverlapSize']);
const SUPPORTED_METHODS = ['getServerConfiguration', 'updateServerConfiguration', 'getServerGPUInfo',
  'getServerSlotInfos', 'getServerSlotInfo', 'updateServerSlotInfo', 'uploadFile', 'uploadRVCModelFile',
  'uploadIconFile', 'getServerAudioInputDevices', 'getServerAudioOutputDevices',
  'getVoiceChangerManagerInfo', 'getLocalVoiceChangerInterfaceInfo', 'startServerDevice', 'stopServerDevice'];
const UNSUPPORTED_METHODS = {
  initializeServer: '旧 VCC に対応する初期化操作がありません。',
  deleteServerSlotInfo: '旧 VCC にモデル削除 API がありません。',
  moveModel: '旧 VCC にモデル移動 API がありません。',
  moveMergedModel: '旧 VCC のマージ結果移動は未対応です。',
  moveExportedOnnxModel: '旧 VCC の ONNX 結果移動は未対応です。',
  mergeModels: '旧 /merge_model は存在しますが、この操作形式の適合は未検証です。',
  export: '旧 VCC にこのモデル ZIP エクスポート API がありません。',
  exportToOnnx: '旧 /onnx は存在しますが、この操作形式の適合は未検証です。',
  downloadSample: '旧サンプル登録は存在しますが、2.x サンプル形式の適合は未対応です。',
  getSamples: '旧 sampleModels と 2.x サンプル形式の適合は未対応です。',
  getServerModuleStatus: '旧 VCC に 2.x モジュール管理 API がありません。',
  downloadApplioModules: '旧 VCC に Applio モジュール管理 API がありません。',
  uploadBeatriceV2ModelFile: '旧 Beatrice と Beatrice_v2 は異なるモデル形式です。',
  uploadBeatriceV2VoiceIconFile: '旧 VCC に Beatrice_v2 音声アイコン API がありません。',
  updateBeatriceV2VoiceName: '旧 VCC に Beatrice_v2 音声名 API がありません。',
  updateBeatriceV2VoiceDescription: '旧 VCC に Beatrice_v2 音声説明 API がありません。',
  refreshQueue: '旧 VCC にキューリセット API がありません。',
  truncateOutputBuffer: '旧 VCC に出力バッファ切り詰め API がありません。',
  setLocalVoiceChangerDummyInput: '旧 VCC にこのダミー入力 API がありません。',
  getTask: '旧 VCC にタスク管理 API がありません。', deleteTask: '旧 VCC にタスク管理 API がありません。',
  recording: '旧 recordIO は存在しますが、2.x 録音ダウンロード形式の適合は未対応です。',
  downloadServerRecordingFiles: '旧 VCC に 2.x 録音ファイルダウンロード API がありません。',
  downloadNativeClient: '旧 VCC にこのネイティブクライアントダウンロード API がありません。'
};
const finite = value => typeof value === 'number' && Number.isFinite(value);
const nullable = value => value ?? null;
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const basename = value => String(value).split(/[/\\]/).pop();

function failure(code, message, details = {}) {
  return new BackendError(code, message, { type: 'ERR_HTTP_EXCEPTION', status: 0, statusText: code,
    reason: message, action: 'サーバーの状態と接続先を確認してください。', retryable: false,
    phase: 'legacy-control', detail: null, ...details });
}

export class LegacyVccAdapter {
  constructor(client, { timeoutMs = 5000, modelTimeoutMs = 60000 } = {}) {
    this.client = client;
    this.timeoutMs = timeoutMs;
    this.modelTimeoutMs = modelTimeoutMs;
    this.snapshot = null;
    this.snapshotGeneration = -1;
    this.readSequence = 0;
    this.appliedReadSequence = 0;
    this.mutationGeneration = -1;
    this.mutations = Promise.resolve();
  }
  unsupported(method) {
    throw failure('unsupported', UNSUPPORTED_METHODS[method] || `${method} は旧 VCC で未対応です。`);
  }
  getCapabilities() {
    const capabilities = {};
    for (const key of SUPPORTED_METHODS) capabilities[key] = { supported: true, reason: '' };
    for (const [key, reason] of Object.entries(UNSUPPORTED_METHODS)) capabilities[key] = { supported: false, reason };
    const info = this.snapshotGeneration === this.client.generation ? this.snapshot : null;
    capabilities.uploadRVCModelFile = { supported: info?.clientCapabilities?.safeModelRegistration === true,
      reason: info?.clientCapabilities?.safeModelRegistration === true ? '' : '安全な空スロット登録 API が必要です。' };
    const config = info ? this.configuration(info) : {};
    for (const key of [...Object.keys(CONFIG_KEYS), 'voice_changer_input_mode', 'extra_frame_sec', 'crossfade_sec']) {
      const available = !RUNTIME_CONFIG.has(key) || config[key] != null;
      capabilities['config:' + key] = { supported: available,
        reason: available ? '' : '対応モデルを読み込んだ後に利用できます。' };
    }
    for (const key of [...UNSUPPORTED_CONFIG, 'recording_started', 'wasapi_exclude_emabled',
      'audio_input_device_sample_rate', 'audio_output_device_sample_rate', 'audio_monitor_device_sample_rate',
      'sola_search_frame_sec', 'monitor_sample_rate']) {
      capabilities['config:' + key] = { supported: false,
        reason: key.includes('device_sample_rate') ? '旧 VCC のデバイスサンプルレートは server_audio_sample_rate で共通設定します。'
          : '旧 VCC のこの設定は読み取り専用、または適合が未対応です。' };
    }
    capabilities['slot:override_embedder'] = { supported: false, reason: '旧 VCC の埋め込みモデル上書きは未対応です。' };
    capabilities.clientAudio = { supported: info?.clientCapabilities?.audioEpoch === true,
      reason: info?.clientCapabilities?.audioEpoch === true ? '' : '音声の世代管理に対応した Server が必要です。' };
    return capabilities;
  }
  async json(path, generation, { timeoutMs = this.timeoutMs, ...options } = {}) {
    try {
      return await this.client.request(path, { ...options, generation, signal: AbortSignal.timeout(timeoutMs),
        consume: async response => {
          let data;
          try { data = await response.json(); }
          catch { throw failure('invalid_response', 'JSON 応答ではありません。', { status: response.status }); }
          if (!response.ok) {
            const detail = data?.error || data?.detail || data;
            const code = typeof detail?.code === 'string' ? detail.code : 'http_error';
            throw failure(code, detail?.message || detail?.reason || `HTTP ${response.status}`, {
              status: response.status, statusText: response.statusText || code,
              detail: typeof detail === 'string' ? detail : JSON.stringify(detail),
              result_may_have_applied: options.method === 'POST' && code !== 'slot_occupied'
            });
          }
          return data;
        } });
    } catch (error) {
      if (generation !== this.client.generation) throw failure('stale_session', '接続先が変更されました。');
      if (error.type === 'ERR_HTTP_EXCEPTION') throw error;
      const code = generation !== this.client.generation ? 'stale_session'
        : error.name === 'TimeoutError' ? 'timeout'
          : typeof error.code === 'string' ? error.code : 'unavailable';
      throw failure(code, error.message || String(error), { status: error.status || 0,
        retryable: options.method !== 'POST' && code !== 'stale_session',
        result_may_have_applied: options.method === 'POST' });
    }
  }
  async readInfo(generation = this.client.generation) {
    const sequence = ++this.readSequence;
    const info = await this.json('/info', generation);
    if (!isLegacyVccInfo(info) || typeof info.passThrough !== 'boolean'
      || ![0, 1].includes(info.enableServerAudio)
      || (!Number.isInteger(info.modelSlotIndex) && info.modelSlotIndex !== 'Beatrice-JVS')
      || !info.modelSlots.every(slot => slot && (Number.isInteger(slot.slotIndex) || typeof slot.slotIndex === 'string'))) {
      throw failure('invalid_response', '旧 VCC の情報応答を確認できません。');
    }
    if (sequence >= this.appliedReadSequence) {
      this.snapshot = info;
      this.snapshotGeneration = generation;
      this.appliedReadSequence = sequence;
    }
    return this.snapshotGeneration === generation ? this.snapshot : info;
  }
  configuration(info) {
    const config = {};
    for (const [key, legacy] of Object.entries(CONFIG_KEYS)) config[key] = nullable(info[legacy]);
    Object.assign(config, {
      gpu_device_id_int: finite(info.gpu) && info.gpu < 0 ? -1 : nullable(info.gpu),
      voice_changer_input_mode: info.enableServerAudio === 1 ? 'server' : 'client',
      recording_started: info.recordIO == null ? null : info.recordIO === 1,
      wasapi_exclude_emabled: nullable(info.exclusiveMode),
      audio_input_device_sample_rate: nullable(info.serverInputAudioSampleRate),
      audio_output_device_sample_rate: nullable(info.serverOutputAudioSampleRate),
      audio_monitor_device_sample_rate: nullable(info.serverMonitorAudioSampleRate),
      monitor_sample_rate: nullable(info.serverMonitorAudioSampleRate),
      extra_frame_sec: finite(info.extraConvertSize) && info.inputSampleRate > 0 ? info.extraConvertSize / info.inputSampleRate : null,
      crossfade_sec: finite(info.crossFadeOverlapSize) && info.inputSampleRate > 0 ? info.crossFadeOverlapSize / info.inputSampleRate : null,
      sola_search_frame_sec: info.modelSlots.some(slot => slot.slotIndex === info.modelSlotIndex && slot.voiceChangerType === 'RVC') ? 0.012 : null
    });
    for (const key of UNSUPPORTED_CONFIG) config[key] = null;
    return config;
  }
  slots(info) {
    return info.modelSlots.filter(slot => slot.slotIndex >= 0 || slot.voiceChangerType != null).map(slot => {
      const current = slot.slotIndex === info.modelSlotIndex;
      return {
        slot_index: slot.slotIndex, voice_changer_type: nullable(slot.voiceChangerType), name: slot.name || '',
        description: slot.description || '', credit: slot.credit || '', terms_of_use_url: slot.termsOfUseUrl || '',
        icon_file: slot.iconFile || null, speakers: slot.speakers || {}, model_file: slot.modelFile || null,
        index_file: slot.indexFile || null, is_onnx: nullable(slot.isONNX), is_f0: nullable(slot.f0),
        model_type: nullable(slot.modelType), sampling_rate: nullable(slot.samplingRate),
        version: nullable(slot.version), embedder: nullable(slot.embedder), override_embedder: null,
        pitch_shift: nullable(current ? info.tran : slot.defaultTune),
        index_ratio: nullable(current ? info.indexRatio : slot.defaultIndexRatio),
        protect: nullable(current ? info.protect : slot.defaultProtect),
        pitch_estimator: current ? nullable(info.f0Detector) : null,
        dst_id: current ? nullable(info.dstId) : null,
        chunk_sec: Number.isInteger(info.serverReadChunkSize) ? legacyChunkSeconds(info.serverReadChunkSize) : null,
        runtime_available: current && slot.voiceChangerType === 'RVC' && info.pipelineInfo?.ready === true && !info.backendError,
        runtime_error: current ? info.backendError || null : null,
        registration_available: slot.voiceChangerType == null
          && info.clientCapabilities?.safeModelRegistration === true
          && !info.occupiedModelSlots?.includes(slot.slotIndex),
        registration_error: slot.voiceChangerType == null && info.occupiedModelSlots?.includes(slot.slotIndex)
          ? 'このスロットには保存済みファイルがあります。別の空スロットを選択してください。' : null
      };
    });
  }
  slot(info, index, { empty = false } = {}) {
    if (!Number.isInteger(index) || index < 0 || index >= 500) {
      throw failure('invalid_model', '数字モデルスロットは 0 から 499 を指定してください。');
    }
    const slot = info.modelSlots.find(value => value.slotIndex === index);
    if (!slot || (!empty && slot.voiceChangerType == null)) throw failure('invalid_model', 'モデルが登録されていないスロットです。');
    return slot;
  }
  runtimeReady(info) {
    const selectedRvc = info.modelSlots.some(slot => slot.slotIndex === info.modelSlotIndex && slot.voiceChangerType === 'RVC');
    if (!selectedRvc || info.pipelineInfo?.ready !== true || info.backendError) {
      throw failure('model_unavailable', info.backendError || 'モデルの推論パイプラインが準備できていません。');
    }
  }
  stopped(info) {
    if (info.serverAudioStated === 1 || info.serverDeviceRuntimeInfo?.active === true
        || info.serverDeviceRuntimeInfo?.ownsAudio === true) {
      throw failure('busy', '先に Server Device を停止してください。');
    }
  }
  mutate(operation) {
    const generation = this.client.generation;
    if (this.mutationGeneration !== generation) {
      this.mutationGeneration = generation;
      this.mutations = Promise.resolve();
    }
    const result = this.mutations.then(() => {
      this.client.assertGeneration(generation);
      return operation(generation);
    });
    this.mutations = result.catch(() => {});
    return result;
  }
  async form(path, values, generation, options = {}) {
    const body = new FormData();
    for (const [key, value] of Object.entries(values)) body.append(key, typeof value === 'boolean' ? String(value) : value);
    return this.json(path, generation, { method: 'POST', body, ...options });
  }
  async setting(key, value, generation, options = {}) {
    const response = await this.form('/update_settings', { key, val: value }, generation, options);
    if (!isLegacyVccInfo(response)) throw failure('failed', '設定操作が正常な状態を返しませんでした。', { result_may_have_applied: true });
    const info = await this.readInfo(generation);
    if (!same(info[key], value)) throw failure('setting_rejected', `${key} が適用されませんでした。`, { applied_value: info[key] });
    if (RVC_MUTATIONS.has(key) && info.backendError) {
      throw failure('failed', info.backendError);
    }
    return info;
  }
  async audioChange(generation, operation, { reset = true } = {}) {
    const end = this.client.beginAudioChange('音声設定が変更されました。確認後に再開してください。');
    try {
      const result = await operation();
      const info = this.snapshotGeneration === generation ? this.snapshot : null;
      if (reset && info?.clientCapabilities?.audioEpoch === true && info.serverAudioStated === 0) {
        await this.form('/reset_audio', {}, generation);
      }
      end();
      return result;
    } catch (error) { end(error); throw error; }
  }
  getServerConfiguration = async () => this.configuration(await this.readInfo());
  getServerSlotInfos = async () => this.slots(await this.readInfo());
  getServerSlotInfo = async index => {
    const info = await this.readInfo();
    const slot = this.slots(info).find(slot => slot.slot_index === index);
    if (!slot) throw failure('invalid_model', 'モデルスロットが見つかりません。');
    return slot;
  };
  getServerGPUInfo = async () => {
    const info = await this.readInfo();
    return [{ device_id_int: -1, name: 'CPU', memory: null, scope: 'server' },
      ...info.gpus.map(gpu => ({ ...gpu, device_id_int: gpu.id, scope: 'server' }))];
  };
  devices(info, key) {
    if (!Array.isArray(info[key])) throw failure('unavailable', 'サーバーの音声デバイスを列挙できません。');
    return info[key].map(device => ({ ...device, host_api: device.hostAPI, scope: 'server',
      available_samplerates: device.available_samplerates || [] }));
  }
  getServerAudioInputDevices = async () => this.devices(await this.readInfo(), 'serverAudioInputDevices');
  getServerAudioOutputDevices = async () => this.devices(await this.readInfo(), 'serverAudioOutputDevices');
  getServerModuleStatus = async () => [];
  getSamples = async () => [];
  localInfo(info) {
    const runtime = info.serverDeviceRuntimeInfo;
    return { local_voice_changer_interface_active: runtime?.active ?? null,
      requested_started: info.serverAudioStated === 1, state: runtime?.state || 'unknown',
      runtime_info: runtime || null, error: runtime?.state === 'error'
        ? runtime.lastLoopError || runtime.lastCallbackError || 'Server Device error' : null };
  }
  getLocalVoiceChangerInterfaceInfo = async () => this.localInfo(await this.readInfo());
  getVoiceChangerManagerInfo = async () => {
    const info = await this.readInfo();
    const current = info.modelSlots.find(slot => slot.slotIndex === info.modelSlotIndex);
    const ready = current?.voiceChangerType === 'RVC' && info.pipelineInfo?.ready === true && !info.backendError;
    return { protocol: 'legacy-vcc', model_loaded: ready,
      model_status: info.backendError ? 'failed' : ready ? 'ready'
        : current?.voiceChangerType === 'RVC' ? 'unavailable' : current?.voiceChangerType ? 'unsupported' : 'unloaded',
      error: info.backendError || null, pipeline_info: info.pipelineInfo || null,
      host_runtime_info: info.hostRuntimeInfo || null, server_device: this.localInfo(info),
      capabilities: this.getCapabilities() };
  };
  updateServerConfiguration(configuration) {
    return this.mutate(async generation => {
      if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)) throw failure('invalid_value', '設定オブジェクトを指定してください。');
      let info = await this.readInfo(generation);
      const current = this.configuration(info);
      const changes = Object.entries(configuration).filter(([key, value]) => !same(value, current[key]));
      const capabilities = this.getCapabilities();
      const updates = changes.map(([key, value]) => {
        if (!capabilities['config:' + key]?.supported) throw failure('unsupported', `${key} は変更できません。`);
        if (key === 'current_slot_index') {
          if (this.slot(info, value).voiceChangerType !== 'RVC') throw failure('unsupported', '現在のアダプターは RVC モデル選択に対応しています。');
          this.stopped(info);
        } else if (key === 'voice_changer_input_mode') {
          if (!['client', 'server'].includes(value)) throw failure('invalid_value', '入力モードが不正です。');
          this.stopped(info);
          return ['enableServerAudio', value === 'server' ? 1 : 0];
        } else if (key === 'pass_through') {
          if (typeof value !== 'boolean') throw failure('invalid_value', 'パススルーは真偽値を指定してください。');
        } else if (key === 'rvc_backend') {
          if (!['legacy', 'official'].includes(value)) throw failure('invalid_value', '対応する RVC backend を指定してください。');
          this.stopped(info);
        } else {
          if (!finite(value) || (INTEGER_CONFIG.has(key) && !Number.isInteger(value))) throw failure('invalid_value', `${key} は有効な数値を指定してください。`);
          if (key.endsWith('_gain') && value < 0) throw failure('invalid_value', 'ゲインは 0 以上を指定してください。');
          if ((key.endsWith('sample_rate') || key === 'server_read_chunk_size') && value <= 0) throw failure('invalid_value', `${key} は正の値を指定してください。`);
          if (key === 'gpu_device_id_int') {
            if (value !== -1 && !info.gpus.some(gpu => gpu.id === value)) throw failure('invalid_value', 'GPU が見つかりません。');
            this.stopped(info);
          }
          if (key.endsWith('_device_index') && value !== -1) {
            const devices = key === 'audio_input_device_index' ? info.serverAudioInputDevices : info.serverAudioOutputDevices;
            if (!devices?.some(device => device.index === value)) throw failure('device_unavailable', '指定されたサーバーデバイスが見つかりません。');
          }
          if (key === 'noise_gate' && value < 0) throw failure('invalid_value', 'ノイズゲートは 0 以上を指定してください。');
        }
        if (key === 'extra_frame_sec' || key === 'crossfade_sec') {
          if (value < 0 || !(info.inputSampleRate > 0)) throw failure('invalid_value', 'フレーム長は 0 以上を指定してください。');
          return [key === 'extra_frame_sec' ? 'extraConvertSize' : 'crossFadeOverlapSize', Math.round(value * info.inputSampleRate)];
        }
        return [CONFIG_KEYS[key], value];
      });
      const changesAudio = changes.some(([key]) => AUDIO_CONFIG.has(key));
      if (changes.some(([key]) => AUDIO_CONFIG.has(key) && key !== 'pass_through')) this.stopped(info);
      // Validate the full patch before the first write. The legacy API has no transaction/revision.
      const apply = async () => {
        for (const [key, value] of updates) {
          info = await this.setting(key, value, generation,
            ['modelSlotIndex', 'gpu', 'rvcBackend'].includes(key) ? { timeoutMs: this.modelTimeoutMs } : {});
          if (['modelSlotIndex', 'gpu', 'rvcBackend'].includes(key)) this.runtimeReady(info);
        }
        return this.configuration(info);
      };
      return changesAudio ? this.audioChange(generation, apply) : apply();
    });
  }
  updateServerSlotInfo(slotInfo) {
    return this.mutate(async generation => {
      if (!slotInfo || typeof slotInfo !== 'object' || Array.isArray(slotInfo)) throw failure('invalid_value', 'モデル情報オブジェクトを指定してください。');
      let info = await this.readInfo(generation);
      const index = slotInfo.slot_index;
      const raw = this.slot(info, index);
      const current = this.slots(info).find(slot => slot.slot_index === index);
      const changes = Object.entries(slotInfo).filter(([key, value]) => !same(value, current[key]));
      const changesAudio = changes.some(([key]) => SLOT_SETTINGS[key] || key === 'chunk_sec');
      if (changesAudio) this.stopped(info);
      for (const [key, value] of changes) {
        if (METADATA_KEYS[key]) {
          if (key === 'speakers' ? !value || typeof value !== 'object' || Array.isArray(value) : typeof value !== 'string') {
            throw failure('invalid_value', `${key} が不正です。`);
          }
        } else if (SLOT_SETTINGS[key] || key === 'chunk_sec') {
          if (raw.voiceChangerType !== 'RVC' || info.modelSlotIndex !== index) throw failure('unavailable', '先にこの RVC モデルを選択してください。');
          this.runtimeReady(info);
          if (key === 'pitch_estimator' ? typeof value !== 'string' : !finite(value)) throw failure('invalid_value', `${key} が不正です。`);
          if (['pitch_shift', 'dst_id'].includes(key) && !Number.isInteger(value)) throw failure('invalid_value', `${key} は整数を指定してください。`);
          if (['index_ratio', 'protect'].includes(key) && (value < 0 || value > 1)) throw failure('invalid_value', `${key} は 0 から 1 を指定してください。`);
          if (key === 'chunk_sec') {
            const units = legacyChunkUnits(value);
            if (units === null || value !== legacyChunkSeconds(units)) {
              throw failure('invalid_value', '旧 VCC のブロック長は 0.02〜5 秒の範囲で、128/48000 秒の整数倍を指定してください。');
            }
          }
        } else throw failure('unsupported', `${key} のモデル編集は未対応です。`);
      }
      const apply = async () => {
        for (const [key, value] of changes) {
          if (METADATA_KEYS[key]) {
            const result = await this.form('/update_model_info', { newData: JSON.stringify({ slot: index,
              key: METADATA_KEYS[key], val: key === 'speakers' ? JSON.stringify(value) : value }) }, generation);
            if (!isLegacyVccInfo(result)) throw failure('failed', 'モデル情報の更新に失敗しました。', { result_may_have_applied: true });
            info = await this.readInfo(generation);
            if (!same(this.slot(info, index)[METADATA_KEYS[key]], value)) throw failure('setting_rejected', 'モデル情報が適用されませんでした。');
          } else {
            info = await this.setting(key === 'chunk_sec' ? 'serverReadChunkSize' : SLOT_SETTINGS[key],
              key === 'chunk_sec' ? legacyChunkUnits(value) : value, generation);
          }
        }
        return this.slots(info).find(slot => slot.slot_index === index);
      };
      return changesAudio ? this.audioChange(generation, apply) : apply();
    });
  }
  uploadFile(prefix, file, onProgress = () => {}, generation = this.client.generation) {
    if (prefix) throw failure('unsupported', '旧アップロードはディレクトリ指定に対応していません。');
    return this.uploadResource(file, onProgress, generation);
  }
  async uploadResource(file, onProgress, generation) {
    if (!file || typeof file.slice !== 'function' || !Number.isInteger(file.size) || file.size <= 0) throw failure('invalid_resource', '空でないファイルを選択してください。');
    const original = basename(file.name);
    if (!original || original !== file.name || /[\x00-\x1f\x7f]/.test(original)) throw failure('invalid_resource', 'ファイル名が不正です。');
    const name = 'vcc-' + crypto.randomUUID() + '-' + original.replace(/\.onnx$/i, '.onnx');
    if (name.length > 240) throw failure('invalid_resource', 'ファイル名が長すぎます。');
    const size = 1024 * 1024;
    const chunks = Math.ceil(file.size / size);
    this.client.assertGeneration(generation);
    onProgress(0, false);
    for (let index = 0; index < chunks; index++) {
      const result = await this.form('/upload_file', { file: file.slice(index * size, (index + 1) * size), filename: `${name}_${index}` }, generation);
      if (result?.status !== 'OK') throw failure('upload_failed', 'ファイルチャンクを保存できませんでした。');
      this.client.assertGeneration(generation);
      onProgress(Math.floor((index + 1) / chunks * 90), false);
    }
    const result = await this.form('/concat_uploaded_file', { filename: name, filenameChunkNum: chunks }, generation);
    if (result?.status !== 'OK') throw failure('upload_failed', 'アップロードチャンクを結合できませんでした。');
    return { name, resource_name: name, original_name: original, size: file.size };
  }
  uploadRVCModelFile(slotIndex, modelFile, indexFile, embedder, onProgress = () => {}) {
    return this.mutate(async generation => {
      let info = await this.readInfo(generation);
      if (info.clientCapabilities?.safeModelRegistration !== true) {
        throw failure('unsupported', '安全な空スロット登録 API が必要です。');
      }
      const index = slotIndex ?? info.modelSlots.find(slot => Number.isInteger(slot.slotIndex) && slot.slotIndex >= 0 && slot.voiceChangerType == null)?.slotIndex;
      if (this.slot(info, index, { empty: true }).voiceChangerType != null) throw failure('slot_occupied', '既存モデルを保護するため、空のスロットを指定してください。');
      if (embedder != null && embedder !== '') throw failure('unsupported', 'アップロード時の埋め込みモデル上書きは未対応です。');
      if (!/\.(pth|onnx)$/i.test(modelFile?.name || '') || (indexFile && !/\.index$/i.test(indexFile.name))) throw failure('invalid_resource', 'RVC の .pth/.onnx と任意の .index を選択してください。');
      const count = indexFile ? 2 : 1;
      const model = await this.uploadResource(modelFile, progress => onProgress(progress / count, false), generation);
      const indexResource = indexFile ? await this.uploadResource(indexFile, progress => onProgress((90 + progress) / count, false), generation) : null;
      info = await this.readInfo(generation);
      if (this.slot(info, index, { empty: true }).voiceChangerType != null) throw failure('slot_occupied', 'アップロード中に対象スロットが使用されました。');
      const files = [{ name: model.name, kind: 'rvcModel', dir: '' }];
      if (indexResource) files.push({ name: indexResource.name, kind: 'rvcIndex', dir: '' });
      const params = { voiceChangerType: 'RVC', slot: index, isSampleMode: false, sampleId: '', files, params: {} };
      const result = await this.form('/load_model_if_empty', { slot: index, isHalf: false, params: JSON.stringify(params) }, generation, { timeoutMs: this.modelTimeoutMs });
      // An accepted registration still requires resource/slot readback before success.
      if (result != null && result.status === 'ERROR') throw failure('model_load_failed', 'モデルの登録に失敗しました。');
      info = await this.readInfo(generation);
      const registered = this.slot(info, index, { empty: true });
      if (registered.voiceChangerType !== 'RVC' || basename(registered.modelFile) !== model.name
        || (indexResource && basename(registered.indexFile) !== indexResource.name)) {
        throw failure('model_load_failed', 'モデルの登録結果を確認できません。空スロットとアップロード資源を確認してください。', { result_may_have_applied: true });
      }
      const title = model.original_name.replace(/\.[^.]+$/, '');
      await this.form('/update_model_info', { newData: JSON.stringify({ slot: index, key: 'name', val: title }) }, generation);
      info = await this.readInfo(generation);
      if (this.slot(info, index).name !== title) throw failure('setting_rejected', '登録したモデル名を確認できません。');
      onProgress(100, true);
      this.client.assertGeneration(generation);
      return this.slots(info).find(slot => slot.slot_index === index);
    });
  }
  uploadIconFile(slotIndex, file, onProgress = () => {}) {
    return this.mutate(async generation => {
      const info = await this.readInfo(generation);
      this.slot(info, slotIndex);
      if (!/\.(png|jpe?g|webp)$/i.test(file?.name || '')) throw failure('invalid_resource', '対応する画像ファイルを選択してください。');
      const resource = await this.uploadResource(file, onProgress, generation);
      await this.form('/upload_model_assets', { params: JSON.stringify({ slot: slotIndex, file: resource.name, name: 'iconFile' }) }, generation);
      const updated = await this.readInfo(generation);
      if (basename(this.slot(updated, slotIndex).iconFile) !== resource.name) throw failure('upload_failed', 'モデルアイコンを確認できません。');
      onProgress(100, true);
      this.client.assertGeneration(generation);
    });
  }
  startServerDevice() {
    return this.mutate(async generation => {
      let info = await this.readInfo(generation);
      this.stopped(info);
      if (info.enableServerAudio !== 1) throw failure('invalid_mode', '先に Server Device 入力モードを選択してください。');
      this.runtimeReady(info);
      if (!info.serverAudioInputDevices?.some(device => device.index === info.serverInputDeviceId)
        || !info.serverAudioOutputDevices?.some(device => device.index === info.serverOutputDeviceId)) {
        throw failure('device_unavailable', 'サーバーの入力・出力デバイスを選択してください。');
      }
      if (info.serverMonitorDeviceId !== -1
        && !info.serverAudioOutputDevices?.some(device => device.index === info.serverMonitorDeviceId)) {
        throw failure('device_unavailable', 'サーバーのモニターデバイスが見つかりません。');
      }
      return this.audioChange(generation, async () => {
        info = await this.setting('serverAudioStated', 1, generation);
        return this.localInfo(info);
      }, { reset: false });
    });
  }
  stopServerDevice() {
    return this.mutate(async generation => this.localInfo(await this.setting('serverAudioStated', 0, generation)));
  }
}
