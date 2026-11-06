// A single connection owner; all control and audio adapters share its generation.
import { invoke } from '../platform/bridge.js';

export const DEFAULT_BACKEND = 'http://localhost:18888/';
export function normalizeBackendAddress(value) {
  const raw = String(value).trim();
  if (!raw || /[\\\s\u0000-\u001f\u007f]/.test(raw)) throw new Error('有効な http/https URL を入力してください。');
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password || url.search || url.hash || url.port === '0') {
    throw new Error('認証情報、クエリ、フラグメントを含まない http/https URL を入力してください。');
  }
  url.pathname = url.pathname.replace(/\/+$/, '') + '/';
  return url.href;
}
export function isLegacyVccInfo(value) {
  return value?.status === 'OK' && Array.isArray(value.modelSlots) && Array.isArray(value.gpus)
    && typeof value.python === 'string' && typeof value.voiceChangerParams?.model_dir === 'string'
    && [0, 1].includes(value.serverAudioStated);
}
export function isTwoXConfiguration(value) {
  return Number.isInteger(value?.current_slot_index)
    && ['client', 'server'].includes(value.voice_changer_input_mode)
    && typeof value.pass_through === 'boolean';
}
export class BackendError extends Error {
  constructor(code, message, details = {}) { super(message); this.name = 'BackendError'; this.code = code; Object.assign(this, details); }
}
export class BackendClient {
  constructor({ fetcher = (...args) => fetch(...args), configure, native = false, origin, timeoutMs = 4500 } = {}) {
    this.fetcher = fetcher; this.native = native; this.origin = origin;
    this.configure = configure ?? ((address, remember) => invoke('configure_backend', { address, remember }));
    this.timeoutMs = timeoutMs; this.generation = 0; this.listeners = new Set(); this.aborters = new Set(); this.invalidators = new Set();
    this.state = { phase: 'idle', address: null, protocol: null, message: '' };
    this.audioState = { revision: 0, blocked: false, error: null, reason: '' };
    this.audioListeners = new Set();
    this.audioChanges = new Set();
  }
  subscribe(listener) { this.listeners.add(listener); listener(this.state); return () => this.listeners.delete(listener); }
  publish(patch) { this.state = { ...this.state, ...patch }; for (const listener of this.listeners) listener(this.state); }
  onInvalidate(listener) { this.invalidators.add(listener); return () => this.invalidators.delete(listener); }
  onAudioChange(listener) {
    this.audioListeners.add(listener);
    listener(this.audioState);
    return () => this.audioListeners.delete(listener);
  }
  publishAudio(patch) {
    this.audioState = { ...this.audioState, ...patch, revision: this.audioState.revision + 1 };
    for (const listener of this.audioListeners) {
      try { listener(this.audioState); } catch (error) { console.error('Audio cleanup failed', error); }
    }
  }
  beginAudioChange(reason) {
    const token = {};
    this.audioChanges.add(token);
    this.publishAudio({ blocked: true, error: null, reason });
    return error => {
      if (!this.audioChanges.delete(token)) return;
      this.publishAudio({ blocked: this.audioChanges.size > 0 || !!error,
        error: error ? error.message || String(error) : null, reason });
    };
  }
  clearAudioError() {
    if (this.audioChanges.size) return false;
    if (this.audioState.blocked || this.audioState.error) {
      this.audioState = { ...this.audioState, blocked: false, error: null, reason: '' };
      for (const listener of this.audioListeners) {
        try { listener(this.audioState); } catch (error) { console.error('Audio cleanup failed', error); }
      }
    }
    return true;
  }
  assertGeneration(generation) { if (generation !== this.generation) throw new BackendError("stale_session", "接続先が変更されました。"); }
  invalidate() {
    this.generation++;
    for (const listener of this.invalidators) { try { listener(this.generation); } catch (error) { console.error("Connection cleanup failed", error); } }
    for (const controller of this.aborters) controller.abort();
    this.aborters.clear();
    this.audioChanges.clear();
    this.publishAudio({ blocked: false, error: null, reason: '' });
    return this.generation;
  }
  endpoint(path) {
    const base = this.native ? this.origin : this.state.address;
    if (!base) return path;
    return new URL(path.replace(/^\/+/, ''), base.endsWith('/') ? base : base + '/').href;
  }
  async request(path, options = {}) {
    const { generation = this.generation, consume, ...requestOptions } = options;
    this.assertGeneration(generation);
    const controller = new AbortController(); this.aborters.add(controller);
    const signal = requestOptions.signal ? AbortSignal.any([controller.signal, requestOptions.signal]) : controller.signal;
    try {
      const init = { ...requestOptions, signal, cache: "no-store" };
      const response = path instanceof Request
        ? await this.fetcher(new Request(path, init))
        : await this.fetcher(this.endpoint(path), init);
      this.assertGeneration(generation);
      if (consume) {
        const result = await consume(response);
        this.assertGeneration(generation);
        return result;
      }
      return response;
    } finally { this.aborters.delete(controller); }
  }
  async json(path, options = {}) {
    return this.request(path, { ...options, consume: async response => {
      if (!response.ok) throw new BackendError("http_error", "HTTP " + response.status, { status: response.status });
      try { return await response.json(); } catch { throw new BackendError("invalid_response", "JSON 応答ではありません。", { status: response.status }); }
    }});
  }
  async connect(value = DEFAULT_BACKEND, { remember = false, probing = false } = {}) {
    const address = normalizeBackendAddress(value);
    const generation = this.invalidate();
    this.publish({ phase: probing ? 'probing' : 'connecting', address, protocol: null, message: '' });
    try {
      if (this.native) await this.configure(address, remember);
      if (generation !== this.generation) return false;
      const signal = AbortSignal.timeout(this.timeoutMs);
      let info, hadResponse = false, lastError;
      try { info = await this.json('/info', { signal }); hadResponse = true; } catch (error) { lastError = error; hadResponse ||= error.status > 0; if (signal.aborted) throw error; }
      let protocol = isLegacyVccInfo(info) ? 'legacy-vcc' : null;
      if (!protocol) {
        let config;
        try { config = await this.json('/api/configuration-manager/configuration', { signal }); hadResponse = true; }
        catch (error) { lastError = error; hadResponse ||= error.status > 0; if (signal.aborted) throw error; }
        if (isTwoXConfiguration(config)) protocol = 'vcc-2x';
      }
      if (generation !== this.generation) return false;
      if (!protocol && !hadResponse) throw new BackendError('unavailable', lastError?.message || 'サーバーに接続できません。');
      if (!protocol) throw new BackendError('incompatible_service', 'このアドレスのサービスを VCClient として識別できません。');
      this.publish({ phase: 'ready', address, protocol, message: '' });
      return true;
    } catch (error) {
      if (generation !== this.generation) return false;
      this.publish({ phase: error.code === 'incompatible_service' ? 'incompatible' : 'needs-address',
        protocol: null, message: error.message || String(error) });
      return false;
    }
  }
  disconnect() { this.invalidate(); this.publish({ phase: 'needs-address', protocol: null, message: '' }); }
}
export const isNativeClient = () => typeof window !== 'undefined' && !!window.__TAURI__?.core?.invoke;
export const backendClient = new BackendClient({ native: isNativeClient(),
  origin: typeof window === 'undefined' ? undefined : window.location.origin + '/' });
