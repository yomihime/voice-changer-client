import { backendClient, BackendError } from '../api/BackendClient.js';
import { convertLegacyAudio, MAX_LEGACY_SAMPLES } from '../api/LegacyPcmCodec.js';

export function getAudioChunkGeometry(settings, legacy = false) {
  const chunkSec = settings.sendingChunkSec ?? 0.2;
  if (!Number.isFinite(settings.sampleRate) || settings.sampleRate <= 0
    || !Number.isFinite(chunkSec) || chunkSec < 0.02 || chunkSec > 5) {
    throw new BackendError('invalid_audio_configuration', '音声ブロック長は 0.02〜5 秒で指定してください。');
  }
  const chunkFrames = Math.round(settings.sampleRate * chunkSec);
  if (legacy && chunkFrames > MAX_LEGACY_SAMPLES) {
    throw new BackendError('invalid_audio_configuration', '旧 VCC の音声ブロックは 240000 サンプル以下にしてください。');
  }
  return { chunkFrames, maxInputFrames: legacy
    ? Math.min(MAX_LEGACY_SAMPLES, Math.round(settings.sampleRate * 5))
    : Math.round(settings.sampleRate * 5) };
}

export class AudioTransport {
  constructor({ client = backendClient, convert = convertLegacyAudio, onOutput = () => {},
    onError = () => {}, clock = () => performance.now() } = {}) {
    this.client = client;
    this.convert = convert;
    this.onOutput = onOutput;
    this.onError = onError;
    this.clock = clock;
    this.epoch = 0;
    this.state = 'stopped';
    this.inFlight = null;
    this.pending = null;
    this.startPromise = null;
    this.startController = null;
    this.stats = { sentChunks: 0, sentFrames: 0, receivedFrames: 0, droppedInputChunks: 0,
      droppedInputFrames: 0, staleResponses: 0, errors: 0, abortedRequests: 0,
      lastRoundTripMs: null, maxRoundTripMs: 0, lastError: null, overloadEvents: 0, gatewayDrops: 0,
      warmupFrames: 0, warmupMs: null };
    this.unsubscribeConnection = client.onInvalidate(() => this.dispose());
    this.unsubscribeAudio = client.onAudioChange?.(state => { if (state.blocked) this.stop(); });
  }
  start(settings) {
    if (this.state === 'disposed') return Promise.resolve(false);
    if (this.state === 'running') return Promise.resolve(true);
    if (this.startPromise) return this.startPromise;
    this.stop();
    const epoch = this.epoch;
    const generation = this.client.generation;
    const controller = new AbortController();
    this.startController = controller;
    this.state = 'starting';
    this.settings = { ...settings };
    this.stats.lastError = null;
    this.stats.warmupFrames = 0;
    this.stats.warmupMs = null;
    this.lastChunkHadGatewayError = false;
    this.startPromise = (async () => {
      let streamEpoch = null;
      if (this.client.clearAudioError?.() === false || this.client.audioState?.blocked) {
        throw new BackendError('busy', '音声設定の適用が完了するまで開始できません。');
      }
      const revision = this.client.audioState?.revision;
      const current = () => {
        const valid = epoch === this.epoch && generation === this.client.generation
          && !controller.signal.aborted && !this.client.audioState?.blocked
          && revision === this.client.audioState?.revision;
        if (!valid && epoch === this.epoch) this.stop();
        return valid;
      };
      if (settings.protocol !== 'rest') throw new BackendError('unsupported', '音声転送は HTTP REST を選択してください。');
      if (!Number.isFinite(settings.sampleRate) || settings.sampleRate <= 0) {
        throw new BackendError('invalid_audio_configuration', 'AudioContext のサンプルレートを確認できません。');
      }
      this.localPassthrough = settings.localPassthrough === true;
      this.legacy = !this.localPassthrough && this.client.state.protocol === 'legacy-vcc';
      this.geometry = getAudioChunkGeometry(settings, this.legacy);
      if (this.legacy) {
        if (settings.legacyRate !== settings.sampleRate) {
          throw new BackendError('sample_rate_mismatch', 'クライアントと旧 VCC の入力サンプルレートを一致させてください。');
        }
        if (settings.expectedSamplesPolicy === 'variable' && settings.legacyBackend !== 'official') {
          throw new BackendError('invalid_audio_configuration', '可変長出力は Official backend の明示指定が必要です。');
        }
        const reset = async () => {
          const result = await this.client.json('/reset_audio', { generation, method: 'POST',
            headers: { 'Content-Type': 'application/json' }, body: '{}',
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60000)]) });
          if (!current()) return null;
          if (typeof result?.stream_epoch !== 'string' || !result.stream_epoch || result.stream_epoch.length > 64) {
            throw new BackendError('invalid_audio_response', '音声セッションの識別子を取得できません。');
          }
          return result.stream_epoch;
        };
        streamEpoch = await reset();
        if (!current()) return false;
        if (settings.warmup === true) {
          const samples = this.warmupSamples(settings);
          this.state = 'warming';
          this.stats.warmupFrames = samples.length;
          const started = this.clock();
          // Synthetic startup PCM never reaches onOutput, recording or live-frame statistics.
          await this.convert(samples, { generation, signal: controller.signal, streamEpoch,
            sequence: 0, timeoutMs: 60000,
            expectedSamples: settings.expectedSamplesPolicy === 'variable' ? null : samples.length });
          if (!current()) return false;
          this.stats.warmupMs = Math.max(0, this.clock() - started);
          streamEpoch = await reset();
          if (!current()) return false;
        }
      }
      if (!current()) return false;
      this.generation = generation;
      this.streamEpoch = streamEpoch;
      this.audioRevision = revision;
      this.sequence = 0;
      this.state = 'running';
      return true;
    })().catch(error => {
      if (epoch !== this.epoch || controller.signal.aborted) {
        if (epoch === this.epoch) this.stop();
        return false;
      }
      this.fail(error);
      throw error;
    }).finally(() => {
      if (epoch === this.epoch) { this.startPromise = null; this.startController = null; }
    });
    return this.startPromise;
  }
  warmupSamples(settings) {
    const chunk = settings.sendingChunkSec ?? 0.128;
    const gate = settings.noiseGate ?? 0;
    if (!Number.isFinite(chunk) || chunk <= 0 || !Number.isFinite(gate) || gate < 0 || gate >= 1) {
      throw new BackendError('invalid_audio_configuration', '予熱用のブロック長とノイズゲートを確認してください。');
    }
    const count = Math.min(MAX_LEGACY_SAMPLES, Math.max(6144, Math.ceil(settings.sampleRate * Math.max(0.128, chunk))));
    const samples = new Float32Array(count);
    const amplitude = Math.min(1, Math.max(0.03, gate * 2));
    let energy = 0;
    for (let index = 0; index < count; index++) {
      samples[index] = amplitude * Math.sin(2 * Math.PI * 210 * (index + 0.25) / settings.sampleRate);
      energy += samples[index] * samples[index];
    }
    // A high user gate can exceed sine RMS. A bounded square waveform still exercises inference.
    if (Math.sqrt(energy / count) <= gate) {
      for (let index = 0; index < count; index++) samples[index] = samples[index] >= 0 ? amplitude : -amplitude;
    }
    return samples;
  }
  stop() {
    if (this.state === 'disposed') return;
    this.epoch++;
    this.state = 'stopped';
    this.streamEpoch = null;
    this.startController?.abort();
    this.startController = null;
    this.startPromise = null;
    if (this.inFlight) {
      this.inFlight.controller.abort();
      this.inFlight.resolve(false);
      this.stats.abortedRequests++;
      this.inFlight = null;
    }
    if (this.pending) {
      this.drop(this.pending);
      this.pending = null;
    }
  }
  dispose() {
    if (this.state === 'disposed') return;
    this.stop();
    this.state = 'disposed';
    this.unsubscribeConnection?.();
    this.unsubscribeAudio?.();
  }
  current(item) {
    return this.state === 'running' && item.epoch === this.epoch
      && item.generation === this.client.generation && !item.controller.signal.aborted
      && !this.client.audioState?.blocked && this.audioRevision === this.client.audioState?.revision;
  }
  drop(item) {
    this.stats.droppedInputChunks++;
    this.stats.droppedInputFrames += item.samples.length;
    item.resolve(false);
  }
  send(samples) {
    if (this.state !== 'running' || this.localPassthrough) return Promise.resolve(false);
    if (this.client.audioState?.blocked || this.generation !== this.client.generation
      || this.audioRevision !== this.client.audioState?.revision) {
      this.stop();
      return Promise.resolve(false);
    }
    if (!(samples instanceof Float32Array) || !samples.length
      || samples.length > this.geometry.maxInputFrames
      || !samples.every(Number.isFinite)) {
      const error = new BackendError('invalid_audio', '有限の mono PCM ブロックが必要です。');
      this.fail(error);
      return Promise.resolve(false);
    }
    return new Promise(resolve => {
      const item = { samples: samples.slice(), epoch: this.epoch, generation: this.generation,
        controller: new AbortController(), resolve };
      if (this.inFlight) {
        if (this.pending) { this.stats.overloadEvents++; this.drop(this.pending); }
        this.pending = item;
      } else void this.run(item);
    });
  }
  async run(item) {
    this.inFlight = item;
    const sequence = this.sequence++;
    const started = this.clock();
    this.stats.sentChunks++;
    this.stats.sentFrames += item.samples.length;
    let responseReceived = false;
    try {
      const output = this.legacy
        ? await this.convert(item.samples, { generation: item.generation, signal: item.controller.signal,
          streamEpoch: this.streamEpoch, sequence,
          expectedSamples: this.settings.expectedSamplesPolicy === 'variable' ? null : item.samples.length })
        : await this.convertTwoX(item);
      responseReceived = true;
      if (!this.current(item)) { this.stats.staleResponses++; item.resolve(false); return; }
      const roundTrip = Math.max(0, this.clock() - started);
      this.lastChunkHadGatewayError = false;
      this.stats.lastRoundTripMs = roundTrip;
      this.stats.maxRoundTripMs = Math.max(this.stats.maxRoundTripMs, roundTrip);
      this.stats.receivedFrames += output.length;
      await this.onOutput(output, { epoch: item.epoch, sequence });
      item.resolve(this.current(item));
    } catch (error) {
      if (!this.current(item)) { item.resolve(false); return; }
      if (!responseReceived && this.legacy && error.status === 502 && error.code === 'backend_transport'
          && !this.lastChunkHadGatewayError) {
        // The backend may have processed this sequence. Never replay it.
        this.lastChunkHadGatewayError = true;
        this.stats.gatewayDrops++;
        this.drop(item);
      } else {
        item.resolve(false);
        this.fail(error);
      }
    } finally {
      if (this.inFlight === item) {
        this.inFlight = null;
        const next = this.pending;
        this.pending = null;
        if (next && this.current(next)) void this.run(next);
        else if (next) this.drop(next);
      }
    }
  }
  async convertTwoX(item) {
    const body = new FormData();
    body.append('waveform', new Blob([item.samples]), 'waveform.bin');
    const path = this.settings.sendingMode === 'bulk' ? '/api/voice-changer/convert_chunk_bulk' : '/api/voice-changer/convert_chunk';
    return this.client.request(path, { generation: item.generation, method: 'POST', body,
      headers: { 'x-timestamp': String(Date.now()) },
      signal: AbortSignal.any([item.controller.signal, AbortSignal.timeout(10000)]),
      consume: async response => {
        if (!response.ok) throw new BackendError('http_error', `HTTP ${response.status}`);
        if (Number(response.headers.get('content-length')) > this.geometry.maxInputFrames * 4) throw new BackendError('invalid_audio_response', '音声応答が上限を超えています。');
        const bytes = await response.arrayBuffer();
        if (!bytes.byteLength || bytes.byteLength % 4 || bytes.byteLength > this.geometry.maxInputFrames * 4) throw new BackendError('invalid_audio_response', 'Float32 PCM 応答の長さが不正です。');
        const output = new Float32Array(bytes);
        if (!output.every(Number.isFinite)) throw new BackendError('invalid_audio_response', '音声応答に有限でない値があります。');
        return output;
      } });
  }
  fail(error) {
    this.stats.errors++;
    this.stats.lastError = { code: error.code || 'audio_failed', message: error.message || String(error) };
    this.stop();
    try { this.onError(error); } catch (listenerError) { console.error('Audio error listener failed', listenerError); }
  }
  getMetrics() {
    return { ...this.stats, epoch: this.epoch, state: this.state, localPassthrough: !!this.localPassthrough,
      inFlight: this.inFlight ? 1 : 0,
      pendingChunks: this.pending ? 1 : 0, pendingFrames: this.pending?.samples.length || 0,
      overload: this.stats.overloadEvents > 0 };
  }
}
