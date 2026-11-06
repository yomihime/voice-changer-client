// Browser worklet source. PCM queues and recordings are bounded in sample frames.
const workerjs = `
class VoiceChangerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.rate = sampleRate;
    this.epoch = 0;
    this.isStarted = false;
    this.isDisposed = false;
    this.config = { sendingChunkSec: 0.2, maxOutputBufferSec: 1, maxRecordingSec: 60,
      realtimeOutputStatusEnabled: false, realtimeOutputStatusSendIntervalSec: 0.2,
      isPassthroughEnabled: false };
    this.stats = { droppedOutputFrames: 0, discardedOutputFrames: 0, droppedInputFrames: 0,
      droppedInputChunks: 0, inputFrames: 0,
      playedFrames: 0, recordingDroppedFrames: 0, inputRecordingTruncated: false,
      outputRecordingTruncated: false };
    this.inputRecording = [];
    this.outputRecording = [];
    this.inputRecordingFrames = 0;
    this.outputRecordingFrames = 0;
    this.isInputRecordingStarted = false;
    this.isOutputRecordingStarted = false;
    this.statusFrames = 0;
    this.inputInFlight = false;
    this.pendingInput = null;
    this.statusInFlight = false;
    this.allocateBuffers();
    this.port.onmessage = event => this.handleMessage(event.data);
  }
  allocateBuffers() {
    this.inputBuffer = new Float32Array(Math.max(1, Math.round(this.rate * this.config.sendingChunkSec)));
    // Keep one whole response plus a partial 128-frame render quantum.
    const capacity = Math.max(Math.ceil(this.rate * this.config.maxOutputBufferSec), this.inputBuffer.length + 127);
    this.outputBuffer = new Float32Array(Math.min(Math.ceil(this.rate * 6), capacity));
    this.inputFill = 0;
    this.outputRead = 0;
    this.outputWrite = 0;
    this.outputFrames = 0;
  }
  clearBuffers() {
    this.stats.discardedOutputFrames += this.outputFrames;
    this.inputBuffer.fill(0);
    this.outputBuffer.fill(0);
    this.inputFill = 0;
    this.outputRead = 0;
    this.outputWrite = 0;
    this.outputFrames = 0;
    this.statusFrames = 0;
    this.inputInFlight = false;
    this.pendingInput = null;
    this.statusInFlight = false;
  }
  metrics() {
    return { ...this.stats, epoch: this.epoch, sampleRate: this.rate,
      inputBufferedFrames: this.inputFill, queuedFrames: this.outputFrames,
      pendingInputFrames: this.pendingInput?.length || 0,
      maxQueuedFrames: this.outputBuffer.length, inputRecordingFrames: this.inputRecordingFrames,
      outputRecordingFrames: this.outputRecordingFrames, started: this.isStarted };
  }
  reply(message, extra = {}) {
    this.port.postMessage({ commandType: message.commandType, requestId: message.requestId,
      epoch: this.epoch, status: 'ok', metrics: this.metrics(), ...extra });
  }
  handleMessage(message) {
    if (!message || typeof message.commandType !== 'string') return;
    if (Number.isInteger(message.epoch) && message.epoch < this.epoch) {
      this.reply(message, { status: 'stale' });
      return;
    }
    if (Number.isInteger(message.epoch) && message.epoch > this.epoch) {
      this.epoch = message.epoch;
      this.isStarted = false;
      this.isInputRecordingStarted = false;
      this.isOutputRecordingStarted = false;
      this.clearBuffers();
    }
    try {
      switch (message.commandType) {
        case 'inputConsumed': {
          this.inputInFlight = false;
          const pending = this.pendingInput;
          this.pendingInput = null;
          if (pending && this.isStarted && !this.config.isPassthroughEnabled) this.postInput(pending);
          return;
        }
        case 'statusConsumed':
          this.statusInFlight = false;
          return;
        case 'config': {
          const config = { ...this.config, ...message.config };
          if (!Number.isFinite(config.sendingChunkSec) || config.sendingChunkSec < 0.02 || config.sendingChunkSec > 5) {
            throw new Error('sendingChunkSec must be between 0.02 and 5 seconds');
          }
          if (!Number.isFinite(config.maxOutputBufferSec) || config.maxOutputBufferSec < 0.02 || config.maxOutputBufferSec > 6) {
            throw new Error('maxOutputBufferSec must be between 0.02 and 6 seconds');
          }
          if (message.chunkFrames !== undefined && message.chunkFrames !== Math.round(this.rate * config.sendingChunkSec)) {
            throw new Error('Audio block frame count does not match the processor sample rate');
          }
          if (!Number.isFinite(config.maxRecordingSec) || config.maxRecordingSec < 0 || config.maxRecordingSec > 300) {
            throw new Error('maxRecordingSec must be between 0 and 300 seconds');
          }
          if (!Number.isFinite(config.realtimeOutputStatusSendIntervalSec)
            || config.realtimeOutputStatusSendIntervalSec < 0.02 || config.realtimeOutputStatusSendIntervalSec > 60) {
            throw new Error('status interval must be between 0.02 and 60 seconds');
          }
          const geometryChanged = config.sendingChunkSec !== this.config.sendingChunkSec
            || config.maxOutputBufferSec !== this.config.maxOutputBufferSec;
          const passthroughChanged = config.isPassthroughEnabled !== this.config.isPassthroughEnabled;
          this.config = config;
          if (geometryChanged) { this.clearBuffers(); this.allocateBuffers(); }
          else if (passthroughChanged) this.clearBuffers();
          break;
        }
        case 'start':
          this.isStarted = true;
          break;
        case 'stop':
        case 'resetBuffer':
          this.isStarted = false;
          this.isInputRecordingStarted = false;
          this.isOutputRecordingStarted = false;
          this.clearBuffers();
          break;
        case 'dispose':
          this.isDisposed = true;
          this.isStarted = false;
          this.isInputRecordingStarted = false;
          this.isOutputRecordingStarted = false;
          this.inputRecording = [];
          this.outputRecording = [];
          this.inputRecordingFrames = 0;
          this.outputRecordingFrames = 0;
          this.clearBuffers();
          break;
        case 'sendConvertedVoice':
          this.addVoice(message.voice);
          break;
        case 'getOutputBufferSize':
          this.reply(message, { outputBufferSize: this.outputFrames });
          return;
        case 'startInputRecording':
          this.inputRecording = [];
          this.inputRecordingFrames = 0;
          this.stats.inputRecordingTruncated = false;
          this.isInputRecordingStarted = true;
          break;
        case 'startOutputRecording':
          this.outputRecording = [];
          this.outputRecordingFrames = 0;
          this.stats.outputRecordingTruncated = false;
          this.isOutputRecordingStarted = true;
          break;
        case 'stopInputRecording': {
          this.isInputRecordingStarted = false;
          const recorded = this.inputRecording;
          this.inputRecording = [];
          this.inputRecordingFrames = 0;
          this.reply(message, { inputRecording: recorded });
          return;
        }
        case 'stopOutputRecording': {
          this.isOutputRecordingStarted = false;
          const recorded = this.outputRecording;
          this.outputRecording = [];
          this.outputRecordingFrames = 0;
          this.reply(message, { outputRecording: recorded });
          return;
        }
        default:
          throw new Error('Unsupported processor command');
      }
      this.reply(message);
    } catch (error) {
      this.reply(message, { status: 'error', code: 'invalid_audio_configuration', message: error.message });
    }
  }
  record(kind, samples) {
    const input = kind === 'input';
    const enabled = input ? this.isInputRecordingStarted : this.isOutputRecordingStarted;
    if (!enabled) return;
    const used = input ? this.inputRecordingFrames : this.outputRecordingFrames;
    const remaining = Math.max(0, Math.floor(this.rate * this.config.maxRecordingSec) - used);
    const length = Math.min(remaining, samples.length);
    if (length) {
      this[kind + 'Recording'].push(samples.slice(0, length));
      this[kind + 'RecordingFrames'] += length;
    }
    if (length < samples.length) {
      this.stats.recordingDroppedFrames += samples.length - length;
      this.stats[kind + 'RecordingTruncated'] = true;
      this[input ? 'isInputRecordingStarted' : 'isOutputRecordingStarted'] = false;
    }
  }
  addVoice(samples) {
    if (!(samples instanceof Float32Array) || !samples.every(Number.isFinite)) throw new Error('Invalid converted PCM');
    if (!this.isStarted || this.config.isPassthroughEnabled) {
      this.stats.discardedOutputFrames += samples.length;
      return;
    }
    const capacity = this.outputBuffer.length;
    const kept = samples.subarray(Math.max(0, samples.length - capacity));
    this.stats.droppedOutputFrames += samples.length - kept.length;
    const overflow = Math.max(0, this.outputFrames + kept.length - capacity);
    this.outputRead = (this.outputRead + overflow) % capacity;
    this.outputFrames -= overflow;
    this.stats.droppedOutputFrames += overflow;
    const first = Math.min(kept.length, capacity - this.outputWrite);
    this.outputBuffer.set(kept.subarray(0, first), this.outputWrite);
    this.outputBuffer.set(kept.subarray(first), 0);
    this.outputWrite = (this.outputWrite + kept.length) % capacity;
    this.outputFrames += kept.length;
  }
  capture(samples) {
    this.stats.inputFrames += samples.length;
    this.record('input', samples);
    let offset = 0;
    while (offset < samples.length) {
      const count = Math.min(samples.length - offset, this.inputBuffer.length - this.inputFill);
      this.inputBuffer.set(samples.subarray(offset, offset + count), this.inputFill);
      this.inputFill += count;
      offset += count;
      if (this.inputFill === this.inputBuffer.length) {
        const voice = this.inputBuffer.slice();
        this.inputFill = 0;
        if (this.inputInFlight) {
          if (this.pendingInput) {
            this.stats.droppedInputChunks++;
            this.stats.droppedInputFrames += this.pendingInput.length;
          }
          this.pendingInput = voice;
        } else this.postInput(voice);
      }
    }
  }
  postInput(voice) {
    this.inputInFlight = true;
    this.port.postMessage({ commandType: 'sendOriginalVoice', epoch: this.epoch, voice,
      metrics: this.metrics() }, [voice.buffer]);
  }
  process(inputs, outputs) {
    for (const bus of outputs) for (const channel of bus) channel.fill(0);
    if (this.isDisposed) return false;
    if (!this.isStarted) return true;
    const output = outputs[0]?.[0];
    if (!output) return true;
    const input = inputs[0]?.[0];
    if (this.config.isPassthroughEnabled) {
      if (input) {
        const mono = input.subarray(0, output.length);
        output.set(mono);
        this.record('input', mono);
      }
    } else {
      if (input) this.capture(input);
      const count = Math.min(output.length, this.outputFrames);
      for (let index = 0; index < count; index++) {
        output[index] = this.outputBuffer[this.outputRead];
        this.outputRead = (this.outputRead + 1) % this.outputBuffer.length;
      }
      this.outputFrames -= count;
    }
    for (const channel of outputs[0].slice(1)) channel.set(output);
    this.record('output', output);
    this.stats.playedFrames += output.length;
    this.statusFrames += output.length;
    if (this.config.realtimeOutputStatusEnabled && !this.statusInFlight
      && this.statusFrames >= this.rate * this.config.realtimeOutputStatusSendIntervalSec) {
      this.statusFrames = 0;
      this.statusInFlight = true;
      this.port.postMessage({ commandType: 'sendRealtimeOutputStatus', epoch: this.epoch,
        outputBufferSize: this.outputFrames, realtimeOutputStatusSendIntervalSec: this.config.realtimeOutputStatusSendIntervalSec,
        metrics: this.metrics() });
    }
    return true;
  }
}
registerProcessor('voice-changer-worklet-processor', VoiceChangerProcessor);
`;
export { workerjs };
