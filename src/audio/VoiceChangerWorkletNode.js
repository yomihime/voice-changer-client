import { backendClient, BackendError } from '../api/BackendClient.js';
import { AudioTransport, getAudioChunkGeometry } from './AudioTransport.js';

const log = (level, prefix, ...values) => {
  if (level === 'info') console.log(prefix, ...values);
  else if (level === 'warn') console.warn(prefix, ...values);
  else if (level === 'error') console.error(prefix, ...values);
};

class VoiceChangerWorkletNode extends AudioWorkletNode {
  constructor(context, options) {
    super(context, 'voice-changer-worklet-processor', options);
    this.disposed = false;
    this.listener = null;
    this.exceptionListener = null;
    this.requestId = 0;
    this.commands = new Map();
    this.processorMetrics = {};
    this.startPromise = null;
    this.processorStarted = false;
    this.configRevision = 0;
    this.sampleRate = context.sampleRate;
    this.setting = { protocol: 'rest', sendingMode: 'single', sampleRate: context.sampleRate,
      expectedSamplesPolicy: 'same', legacyRate: context.sampleRate, legacyBackend: 'legacy' };
    this.currentWorkletSetting = { realtimeOutputStatusEnabled: false, realtimeOutputStatusSendIntervalSec: 0.2,
      isPassthroughEnabled: false, sendingChunkSec: 0.2, maxOutputBufferSec: 1, maxRecordingSec: 60 };
    this.transport = new AudioTransport({
      onOutput: (voice, frame) => this.sendConvertedVoice(voice, frame.epoch),
      onError: error => this.reportError(error)
    });
    this.port.onmessage = event => this.handleMessage(event.data);
    this.unsubscribeConnection = backendClient.onInvalidate(() => this.dispose());
    this.unsubscribeAudio = backendClient.onAudioChange?.(state => {
      if (state.blocked) this.stop().catch(error => this.reportError(error));
    });
  }
  getSocketId = () => undefined;
  setStatusListener = listener => { this.listener = listener; };
  setExceptionListener = listener => { this.exceptionListener = listener; };
  command(commandType, payload = {}) {
    if (this.disposed) return Promise.resolve({ status: 'cancelled' });
    if (this.commands.size >= 32) return Promise.reject(new BackendError('busy', '音声コマンドの待ち行列が上限に達しました。'));
    const requestId = ++this.requestId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.commands.delete(requestId);
        reject(new BackendError('audio_ack_timeout', '音声処理器が応答しませんでした。'));
      }, 2000);
      this.commands.set(requestId, { commandType, resolve, reject, timer });
      try {
        const message = { commandType, requestId, epoch: this.transport.epoch, ...payload };
        this.port.postMessage(message, payload.voice ? [payload.voice.buffer] : []);
      } catch (error) {
        clearTimeout(timer);
        this.commands.delete(requestId);
        reject(error);
      }
    });
  }
  handleMessage(message) {
    if (this.disposed || !message) return;
    if (message.epoch === this.transport.epoch && message.metrics) this.processorMetrics = message.metrics;
    if (message.requestId && this.commands.has(message.requestId)) {
      const pending = this.commands.get(message.requestId);
      this.commands.delete(message.requestId);
      clearTimeout(pending.timer);
      if (message.status === 'error') pending.reject(new BackendError(message.code || 'audio_processor_error', message.message));
      else pending.resolve(message);
      return;
    }
    if (message.epoch !== this.transport.epoch) return;
    if (message.commandType === 'sendOriginalVoice') {
      void this.sendBuffer(message.voice);
      this.port.postMessage({ commandType: 'inputConsumed', epoch: this.transport.epoch });
    } else if (message.commandType === 'sendRealtimeOutputStatus') {
      this.listener?.onRealtimeOutputStatus({
        realtimeOutputStatusSendIntervalSec: message.realtimeOutputStatusSendIntervalSec,
        outputBufferSize: message.outputBufferSize, inputRms: null, outputRms: null,
        metrics: this.getAudioMetrics()
      });
      this.port.postMessage({ commandType: 'statusConsumed', epoch: this.transport.epoch });
    }
  }
  reportError(error) {
    if (this.disposed) return;
    this.processorStarted = false;
    this.processorMetrics = { ...this.processorMetrics, started: false, queuedFrames: 0, inputBufferedFrames: 0 };
    this.cancelCommands();
    this.command('stop').catch(failure => log('error', '[voicechanger-worklet-node]', failure));
    try { this.exceptionListener?.onException('AUDIO_TRANSPORT_ERROR', error.message || String(error)); }
    catch (listenerError) { log('error', '[voicechanger-worklet-node]', listenerError); }
  }
  updateSetting = async setting => {
    if (this.disposed) return;
    const next = { ...this.setting, ...setting };
    if (next.sampleRate !== this.sampleRate) throw new BackendError('sample_rate_mismatch', 'AudioContext の実サンプルレートは上書きできません。');
    if (next.protocol !== 'rest' || !['single', 'bulk'].includes(next.sendingMode)
      || !['same', 'variable'].includes(next.expectedSamplesPolicy)) {
      await this.stop();
      const error = new BackendError('unsupported', '対応する HTTP REST 音声設定を選択してください。Socket.IO 音声転送は未対応です。');
      this.reportError(error);
      throw error;
    }
    const changed = Object.keys(next).some(key => next[key] !== this.setting[key]);
    if (changed && ['starting', 'warming', 'running'].includes(this.transport.state)) await this.stop();
    this.setting = next;
  };
  configure = async config => {
    if (this.disposed) return;
    const revision = ++this.configRevision;
    const next = { ...this.currentWorkletSetting, ...config };
    const geometry = getAudioChunkGeometry({ ...this.setting, sendingChunkSec: next.sendingChunkSec },
      backendClient.state.protocol === 'legacy-vcc' && !next.isPassthroughEnabled);
    const changed = ['sendingChunkSec', 'maxOutputBufferSec', 'isPassthroughEnabled']
      .some(key => next[key] !== this.currentWorkletSetting[key]);
    if (changed && ['starting', 'warming', 'running'].includes(this.transport.state)) await this.stop();
    if (this.disposed || revision !== this.configRevision) return;
    const result = await this.command('config', { config: next, chunkFrames: geometry.chunkFrames });
    if (!this.disposed && result.status === 'ok' && revision === this.configRevision) this.currentWorkletSetting = next;
  };
  updateWorkletSetting = config => this.configure(config);
  start = () => {
    if (this.disposed) return Promise.resolve(false);
    if (this.processorStarted && this.transport.state === 'running') return Promise.resolve(true);
    if (this.startPromise) return this.startPromise;
    const operation = (async () => {
      if (!await this.transport.start({ ...this.setting,
        localPassthrough: this.currentWorkletSetting.isPassthroughEnabled === true,
        warmup: backendClient.state.protocol === 'legacy-vcc',
        sendingChunkSec: this.currentWorkletSetting.sendingChunkSec,
        noiseGate: this.setting.noiseGate ?? 0.00001 }) || this.disposed) return false;
      const epoch = this.transport.epoch;
      const result = await this.command('start');
      const started = !this.disposed && result.status === 'ok' && epoch === this.transport.epoch;
      this.processorStarted = started;
      return started;
    })().catch(error => {
      if (['starting', 'warming', 'running'].includes(this.transport.state)) this.transport.fail(error);
      throw error;
    });
    const tracked = operation.finally(() => { if (this.startPromise === tracked) this.startPromise = null; });
    this.startPromise = tracked;
    return tracked;
  };
  stop = () => {
    if (this.disposed) return Promise.resolve(false);
    this.transport.stop();
    this.processorStarted = false;
    this.cancelCommands();
    this.startPromise = null;
    this.processorMetrics = { ...this.processorMetrics, started: false, queuedFrames: 0, inputBufferedFrames: 0 };
    return this.command('stop').then(result => result.status === 'ok');
  };
  resetBuffer = () => {
    if (this.disposed) return Promise.resolve(false);
    this.transport.stop();
    this.processorStarted = false;
    this.cancelCommands();
    this.startPromise = null;
    this.processorMetrics = { ...this.processorMetrics, started: false, queuedFrames: 0, inputBufferedFrames: 0 };
    return this.command('resetBuffer').then(result => result.status === 'ok');
  };
  quiesceForRecording = () => {
    if (this.disposed) return false;
    this.transport.stop();
    this.processorStarted = false;
    this.startPromise = null;
    this.cancelCommands({ preserveRecordings: true });
    this.processorMetrics = { ...this.processorMetrics, started: false, queuedFrames: 0, inputBufferedFrames: 0 };
    // Preserve recording replies already queued on the other side of this port.
    this.port.postMessage({ commandType: 'stop', epoch: this.transport.epoch });
    return true;
  };
  sendBuffer = samples => this.disposed || !this.processorStarted ? Promise.resolve(false) : this.transport.send(samples);
  sendConvertedVoice = async (voice, epoch = this.transport.epoch) => {
    if (this.disposed || epoch !== this.transport.epoch) return false;
    const result = await this.command('sendConvertedVoice', { voice, epoch });
    return result.status === 'ok';
  };
  startInputRecording = () => this.command('startInputRecording');
  startOutputRecording = () => this.command('startOutputRecording');
  async stopRecording(kind) {
    const result = await this.command(kind === 'input' ? 'stopInputRecording' : 'stopOutputRecording');
    const chunks = result[kind + 'Recording'] || [];
    const count = chunks.reduce((total, chunk) => total + chunk.length, 0);
    const output = new Float32Array(count);
    let offset = 0;
    for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
    return output;
  }
  stopInputRecording = () => this.stopRecording('input');
  stopOutputRecording = () => this.stopRecording('output');
  getOutputBufferSize = async () => (await this.command('getOutputBufferSize')).outputBufferSize || 0;
  getAudioMetrics = () => ({ ...this.transport.getMetrics(), processor: { ...this.processorMetrics },
    queuedFrames: this.processorMetrics.queuedFrames || 0,
    droppedOutputFrames: this.processorMetrics.droppedOutputFrames || 0 });
  abortAllRequests = () => { this.stop().catch(error => this.reportError(error)); };
  isRequestPending = () => this.transport.getMetrics().inFlight > 0;
  getPendingRequestCount = () => this.transport.getMetrics().inFlight;
  cancelCommands({ preserveRecordings = false } = {}) {
    for (const [requestId, pending] of this.commands) {
      if (preserveRecordings && ['stopInputRecording', 'stopOutputRecording'].includes(pending.commandType)) continue;
      clearTimeout(pending.timer);
      pending.resolve({ status: 'cancelled' });
      this.commands.delete(requestId);
    }
  }
  dispose = () => {
    if (this.disposed) return;
    this.disposed = true;
    this.transport.dispose();
    this.processorStarted = false;
    this.processorMetrics = { ...this.processorMetrics, started: false, queuedFrames: 0, inputBufferedFrames: 0 };
    this.port.postMessage({ commandType: 'dispose', epoch: this.transport.epoch });
    this.unsubscribeConnection?.();
    this.unsubscribeAudio?.();
    this.listener = null;
    this.exceptionListener = null;
    this.cancelCommands();
    this.port.onmessage = null;
    this.port.close();
    this.disconnect();
  };
}
export { log, VoiceChangerWorkletNode };
