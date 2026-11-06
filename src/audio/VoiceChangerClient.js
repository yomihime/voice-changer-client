// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { workerjs } from "./worker-source.js";
import { log, VoiceChangerWorkletNode } from "./VoiceChangerWorkletNode.js";
import { buildExports } from "../vendor/recovered-runtime.js";
import { BlockingQueue } from "./BlockingQueue.js";
import { backendClient } from "../api/BackendClient.js";
const createDummyMediaStream = S => {
  const C = S.createMediaStreamDestination(),
    E = S.createGain();
  E.gain.value = 0;
  E.connect(C);
  const w = S.createOscillator();
  w.frequency.value = 440;
  w.connect(E);
  w.start();
  return {
    stream: C.stream,
    dispose: () => {
      w.stop();
      w.disconnect();
      E.disconnect();
      C.disconnect();
      C.stream.getTracks().forEach(track => track.stop());
    }
  };
};
const validateUrl = S => S?.endsWith("/") ? S.substring(0, S.length - 1) : S;
const LOG_PREFIX = "[voicechanger-client]";
class VoiceChangerClient {
  voiceChangerStatusListener = null;
  voiceChangerExceptionListener = null;
  ctx;
  vfEnable = false;
  vf = null;
  currentDevice = null;
  currentMediaStream = null;
  currentMediaStreamAudioSourceNode = null;
  currentMediaStreamAudioDestinationNode;
  currentMediaStreamAudioDestinationMonitorNode;
  inputGainNode;
  outputGainNode;
  monitorGainNode;
  inputAnalyser;
  outputAnalyser;
  inputRms = 0;
  outputRms = 0;
  vcInNode;
  promiseForInitialize;
  _isVoiceChanging = false;
  setting = {
    inputGain: 1,
    outputGain: 1,
    monitorGain: 1,
    audioInput: "none",
    echoCancel: false,
    noiseSuppression: false,
    noiseSuppression2: false,
    sampleRate: 48e3
  };
  nodeSetting = {
    protocol: "rest",
    sendingMode: "bulk"
  };
  workletSetting = {
    realtimeOutputStatusEnabled: false,
    isPassthroughEnabled: false,
    realtimeOutputStatusSendIntervalSec: 10,
    sendingChunkSec: 0.2
  };
  sslCertified = [];
  sem = new BlockingQueue();
  disposed = true;
  generation = 0;
  captureGeneration = 0;
  desiredRunning = false;
  transportReady = false;
  inputEndedHandlers = [];
  transformNodes = null;
  recordingTouched = { input: false, output: false };
  recordingVersions = { input: 0, output: 0 };
  recordingStops = { input: null, output: null };
  recordingClips = { input: null, output: null };
  dummyInput = null;
  unsubscribeInvalidation = null;
  constructor() {}
  initialize(C, E) {
    this.dispose();
    this.disposed = false;
    const generation = this.generation;
    this.unsubscribeInvalidation = backendClient.onInvalidate(() => this.dispose());
    log("info", LOG_PREFIX, "initializing...");
    this.ctx = C;
    this.vfEnable = E;
    this.sem = new BlockingQueue();
    this.sem.enqueue(0);
    this.inputGainNode = this.ctx.createGain();
    this.outputGainNode = this.ctx.createGain();
    this.monitorGainNode = this.ctx.createGain();
    this.inputAnalyser = this.ctx.createAnalyser();
    this.outputAnalyser = this.ctx.createAnalyser();
    this.inputGainNode.gain.value = this.setting.inputGain;
    this.outputGainNode.gain.value = this.setting.outputGain;
    this.monitorGainNode.gain.value = this.setting.monitorGain;
    this.currentMediaStreamAudioDestinationNode = this.ctx.createMediaStreamDestination();
    this.currentMediaStreamAudioDestinationMonitorNode = this.ctx.createMediaStreamDestination();
    const w = {
      outputChannelCount: [1]
    };
    this.promiseForInitialize = (async () => {
      const _ = URL.createObjectURL(new Blob([workerjs], {
        type: "text/javascript"
      }));
      try {
        await C.audioWorklet.addModule(_);
      } finally {
        URL.revokeObjectURL(_);
      }
      if (this.disposed || generation !== this.generation) return false;
      try {
        this.vcInNode = new VoiceChangerWorkletNode(C, w);
        this.vcInNode.connect(this.outputGainNode);
        this.outputGainNode.connect(this.currentMediaStreamAudioDestinationNode);
        this.outputGainNode.connect(this.outputAnalyser);
        this.vcInNode.connect(this.monitorGainNode);
        this.monitorGainNode.connect(this.currentMediaStreamAudioDestinationMonitorNode);
      } catch (error) {
        this.dispose();
        throw error;
      }
      const node = this.vcInNode;
      await node.updateSetting(this.nodeSetting);
      await node.updateWorkletSetting(this.workletSetting);
      if (this.disposed || generation !== this.generation) return false;
      if (this.vfEnable) {
        const transformer = await buildExports.VoiceFocusDeviceTransformer.create({
          variant: "c20"
        });
        if (this.disposed || generation !== this.generation) return false;
        this.vf = transformer;
        const dummy = createDummyMediaStream(C);
        this.dummyInput = dummy;
        const device = await transformer.createTransformDevice(dummy.stream);
        if (this.disposed || generation !== this.generation) {
          device?.stop?.();
          return false;
        }
        this.currentDevice = device || null;
      }
      this.setVoiceChangerWorkletNodeListener();
      return true;
    })().catch(error => {
      if (generation === this.generation) this.dispose();
      throw error;
    });
    return this.promiseForInitialize;
  }
  dispose = () => {
    this.disposed = true;
    this.generation++;
    this.desiredRunning = false;
    this.transportReady = false;
    this.releaseInput();
    this.unsubscribeInvalidation?.();
    this.unsubscribeInvalidation = null;
    this.vcInNode?.dispose();
    this.dummyInput?.dispose();
    this.dummyInput = null;
    for (const stream of [this.currentMediaStreamAudioDestinationNode?.stream,
      this.currentMediaStreamAudioDestinationMonitorNode?.stream]) {
      stream?.getTracks().forEach(track => track.stop());
    }
    for (const node of [this.currentMediaStreamAudioSourceNode, this.inputGainNode, this.outputGainNode,
      this.monitorGainNode, this.inputAnalyser, this.outputAnalyser,
      this.currentMediaStreamAudioDestinationNode, this.currentMediaStreamAudioDestinationMonitorNode]) {
      node?.disconnect();
    }
    this.currentDevice?.stop?.();
    this.currentDevice = null;
    this.currentMediaStream = null;
    this.currentMediaStreamAudioSourceNode = null;
    this.vcInNode = null;
    this._isVoiceChanging = false;
    this.recordingTouched = { input: false, output: false };
    this.recordingStops = { input: null, output: null };
    this.recordingClips = { input: null, output: null };
    this.voiceChangerStatusListener = null;
    this.voiceChangerExceptionListener = null;
  };
  isInitialized = async () => {
    const generation = this.generation;
    const initialized = await this.promiseForInitialize;
    return initialized === true && !this.disposed && generation === this.generation;
  };
  getRms = (C, E = 0) => {
    const w = new Float32Array(C.fftSize);
    C.getFloatTimeDomainData(w);
    let R = 0;
    for (let x = 0; x < w.length; x++) R += w[x] * w[x];
    const _ = Math.sqrt(R / w.length);
    return Math.max(_, E * 0.95);
  };
  setVoiceChangerWorkletNodeListener = () => {
    const C = {
        onRealtimeOutputStatus: w => {
          w.inputRms == null || w.outputRms == null ? (this.inputRms = this.getRms(this.inputAnalyser, this.inputRms), this.outputRms = this.getRms(this.outputAnalyser, this.outputRms), this.voiceChangerStatusListener?.onRealtimeOutputStatus({
            ...w,
            inputRms: this.inputRms,
            outputRms: this.outputRms
          })) : w.inputRms != null && w.outputRms != null && this.voiceChangerStatusListener?.onRealtimeOutputStatus({
            ...w,
            inputRms: w.inputRms,
            outputRms: w.outputRms
          });
        },
        onRealtimeProcessStatus: w => {
          this.voiceChangerStatusListener?.onRealtimeProcessStatus(w);
        },
        onData: (w, R) => {
          this.voiceChangerStatusListener?.onData(w, R);
        }
      },
      E = {
        onException: (w, R) => {
          this.voiceChangerExceptionListener?.onException(w, R);
        }
      };
    this.vcInNode.setStatusListener(C);
    this.vcInNode.setExceptionListener(E);
  };
  setVoiceChangerStatusListener = C => {
    this.voiceChangerStatusListener = C;
  };
  setVoiceChangerExceptionListener = C => {
    this.voiceChangerExceptionListener = C;
  };
  releaseInput = () => {
    this.captureGeneration++;
    this.dummyInput?.dispose();
    this.dummyInput = null;
    for (const [track, listener] of this.inputEndedHandlers) track.removeEventListener?.("ended", listener);
    this.inputEndedHandlers = [];
    this.currentMediaStream?.getTracks().forEach(track => track.stop());
    this.currentMediaStreamAudioSourceNode?.disconnect();
    this.inputGainNode?.disconnect();
    this.transformNodes?.start?.disconnect();
    this.transformNodes?.end?.disconnect();
    this.transformNodes = null;
    this.currentMediaStream = null;
    this.currentMediaStreamAudioSourceNode = null;
  };
  setup = async () => {
    if (this.disposed || !this.desiredRunning || !this.transportReady) return false;
    const generation = this.generation;
    const context = this.ctx;
    this.releaseInput();
    const captureGeneration = this.captureGeneration;
    const current = () => !this.disposed && this.desiredRunning && this.transportReady && generation === this.generation && captureGeneration === this.captureGeneration;
    let stream;
    this.dummyInput?.dispose();
    this.dummyInput = null;
    try {
      if (typeof this.setting.audioInput === "string") {
        if (!this.setting.audioInput || this.setting.audioInput === "none") throw new Error("入力デバイスを選択してください。");
        stream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: {
            deviceId: { exact: this.setting.audioInput },
            channelCount: 1,
            sampleRate: this.setting.sampleRate,
            sampleSize: 16,
            autoGainControl: false,
            echoCancellation: this.setting.echoCancel,
            noiseSuppression: this.setting.noiseSuppression
          }
        });
        const actual = stream.getAudioTracks?.()[0]?.getSettings?.().deviceId;
        if (this.setting.audioInput !== "default" && actual && actual !== this.setting.audioInput) throw new Error("選択した入力デバイスと取得したデバイスが一致しません。");
      } else stream = this.setting.audioInput;
      if (!stream?.getTracks || stream.getTracks().every(track => track.readyState === "ended")) throw new Error("入力ストリームは終了しています。デバイスを選び直してください。");
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop());
      if (!current()) return false;
      this.stop().catch(error => log("error", LOG_PREFIX, error));
      throw error;
    }
    if (!current()) {
      stream?.getTracks().forEach(track => track.stop());
      return false;
    }
    this.currentMediaStream = stream;
    for (const track of stream.getTracks()) {
      const ended = () => {
        if (!current()) return;
        this.stop().catch(error => log("error", LOG_PREFIX, error));
        this.voiceChangerExceptionListener?.onException("AUDIO_DEVICE_ERROR", "入力デバイスが切断されました。接続を確認して開始し直してください。");
      };
      track.addEventListener?.("ended", ended);
      this.inputEndedHandlers.push([track, ended]);
    }
    if (this.currentMediaStreamAudioSourceNode = this.ctx.createMediaStreamSource(this.currentMediaStream), this.inputGainNode.gain.value = this.setting.inputGain, this.currentMediaStreamAudioSourceNode.connect(this.inputGainNode), this.currentDevice && this.setting.noiseSuppression2) {
      this.currentDevice.chooseNewInnerDevice(this.currentMediaStream);
      const C = await this.currentDevice.createAudioNode(this.ctx);
      if (!current()) {
        C.start.disconnect();
        C.end.disconnect();
        return false;
      }
      this.transformNodes = C;
      this.inputGainNode.connect(C.start);
      C.end.connect(this.vcInNode);
      C.end.connect(this.inputAnalyser);
    } else {
      this.inputGainNode.connect(this.vcInNode);
      this.inputGainNode.connect(this.inputAnalyser);
    }
    console.log("Input Setup=> success");
    return true;
  };
  get stream() {
    return this.currentMediaStreamAudioDestinationNode?.stream ?? null;
  }
  get monitorStream() {
    return this.currentMediaStreamAudioDestinationMonitorNode?.stream ?? null;
  }
  start = async () => {
    if (this.disposed) return false;
    this.desiredRunning = true;
    this.transportReady = false;
    const generation = this.generation;
    await this.promiseForInitialize;
    if (this.disposed || generation !== this.generation || !this.desiredRunning) return false;
    try {
      const started = await this.vcInNode.start();
      if (this.disposed || generation !== this.generation || !this.desiredRunning) return false;
      if (started !== true) {
        await this.stop();
        return false;
      }
      this.transportReady = true;
      if (!await this.setup()) return false;
      if (this.disposed || generation !== this.generation || !this.desiredRunning) return false;
      this._isVoiceChanging = true;
      return true;
    } catch (error) {
      this.stop().catch(failure => log("error", LOG_PREFIX, failure));
      throw error;
    }
  };
  stop = async () => {
    this.desiredRunning = false;
    this.transportReady = false;
    this.releaseInput();
    this._isVoiceChanging = false;
    const node = this.vcInNode;
    await node?.stop();
    await node?.resetBuffer();
  };
  get isVoiceChanging() {
    return this._isVoiceChanging;
  }
  setServerUrl = (C, E = false) => {
    const w = validateUrl(C),
      R = `${location.protocol}//${location.host}`;
    throw w != R && w.length != 0 && location.protocol == "https:" && this.sslCertified.includes(w) == false && E && (window.confirm("MMVC Server is different from this page's origin. Open tab to open ssl connection. OK? (You can close the opened tab after ssl connection succeed.)") ? (window.open(w, "_blank"), this.sslCertified.push(w)) : alert("Your voice conversion may fail...")), new Error("setServerUrl not implemented");
  };
  getClientSetting = () => ({
    voiceChangerClientSetting: {
      ...this.setting
    },
    workletNodeSetting: {
      ...this.nodeSetting
    },
    workletSetting: {
      ...this.workletSetting
    }
  });
  updateClientSetting = async C => {
    if (this.disposed) return;
    const generation = this.generation;
    await this.promiseForInitialize;
    if (this.disposed || generation !== this.generation) return;
    const semaphore = this.sem;
    const E = await semaphore.dequeue();
    try {
      if (this.disposed || generation !== this.generation) return;
      const setupRequired = !this.currentMediaStream || this.setting.audioInput != C.audioInput
        || this.setting.echoCancel != C.echoCancel || this.setting.noiseSuppression != C.noiseSuppression
        || this.setting.noiseSuppression2 != C.noiseSuppression2 || this.setting.sampleRate != C.sampleRate;
      this.setting.inputGain != C.inputGain && this._setInputGain(C.inputGain);
      this.setting.outputGain != C.outputGain && this._setOutputGain(C.outputGain);
      this.setting.monitorGain != C.monitorGain && this._setMonitorGain(C.monitorGain);
      this.setting = C;
      if (setupRequired && this.desiredRunning && this.transportReady) await this.setup();
    } finally { semaphore.enqueue(E + 1); }
  };
  updateNodeSetting = async C => {
    if (this.disposed) return;
    const generation = this.generation;
    await this.promiseForInitialize;
    if (this.disposed || generation !== this.generation) return;
    const semaphore = this.sem;
    const E = await semaphore.dequeue();
    try {
      if (this.disposed || generation !== this.generation) return;
      await this.vcInNode.updateSetting(C);
      if (!this.disposed && generation === this.generation) this.nodeSetting = C;
    } finally { semaphore.enqueue(E + 1); }
  };
  updateWorkletSetting = async C => {
    if (this.disposed) return;
    const generation = this.generation;
    await this.promiseForInitialize;
    if (this.disposed || generation !== this.generation) return;
    const semaphore = this.sem;
    const E = await semaphore.dequeue();
    try {
      if (this.disposed || generation !== this.generation) return;
      await this.vcInNode.updateWorkletSetting(C);
      if (!this.disposed && generation === this.generation) this.workletSetting = C;
    } finally { semaphore.enqueue(E + 1); }
  };
  _setInputGain = C => {
    this.inputGainNode && C != null && (this.inputGainNode.gain.value = C);
  };
  _setOutputGain = C => {
    this.outputGainNode && C != null && (this.outputGainNode.gain.value = C);
  };
  _setMonitorGain = C => {
    this.monitorGainNode && C != null && (this.monitorGainNode.gain.value = C);
  };
  resetBuffer = () => this.vcInNode?.resetBuffer();
  startRecording = async kind => {
    if (this.disposed || !this.vcInNode) return;
    this.recordingTouched[kind] = true;
    this.recordingVersions[kind]++;
    return kind === "input" ? this.vcInNode.startInputRecording() : this.vcInNode.startOutputRecording();
  };
  stopRecording = kind => {
    if (this.recordingStops[kind]) return this.recordingStops[kind];
    if (!this.recordingTouched[kind] || this.disposed || !this.vcInNode) return Promise.resolve(this.recordingClips[kind] ?? new Float32Array(0));
    const node = this.vcInNode;
    const version = this.recordingVersions[kind];
    const operation = (kind === "input" ? node.stopInputRecording() : node.stopOutputRecording()).then(samples => {
      if (this.vcInNode === node && !this.disposed) {
        if (version === this.recordingVersions[kind]) this.recordingTouched[kind] = false;
        this.recordingClips[kind] = samples;
      }
      return samples;
    });
    const tracked = operation.finally(() => {
      if (this.recordingStops[kind] === tracked) this.recordingStops[kind] = null;
    });
    this.recordingStops[kind] = tracked;
    return tracked;
  };
  claimRecording = (kind, samples) => {
    if (this.recordingClips[kind] !== samples) return false;
    this.recordingClips[kind] = null;
    return true;
  };
  finalizeRecording = async () => {
    this.desiredRunning = false;
    this.transportReady = false;
    this._isVoiceChanging = false;
    this.releaseInput();
    const node = this.vcInNode;
    if (this.disposed || !node) return { recordings: [], errors: [], metrics: {} };
    node.quiesceForRecording();
    const kinds = ["input", "output"];
    const results = await Promise.allSettled(kinds.map(kind => this.stopRecording(kind)));
    const recordings = [];
    const errors = [];
    results.forEach((result, index) => {
      if (result.status === "rejected") errors.push(result.reason);
      else if (result.value.length > 0 && this.claimRecording(kinds[index], result.value)) recordings.push({ kind: kinds[index], samples: result.value });
    });
    return { recordings, errors, metrics: node.getAudioMetrics() };
  };
  startInputRecording = () => this.startRecording("input");
  stopInputRecording = () => this.stopRecording("input");
  startOutputRecording = () => this.startRecording("output");
  stopOutputRecording = () => this.stopRecording("output");
  getOutputBufferSize = async () => await this.vcInNode?.getOutputBufferSize() ?? 0;
  abortAllRequests = () => this.stop();
  isRequestPending = () => this.vcInNode?.isRequestPending() ?? false;
  getPendingRequestCount = () => this.vcInNode?.getPendingRequestCount() ?? 0;
  getAudioMetrics = () => ({
    ...this.vcInNode?.getAudioMetrics?.(),
    inputDeviceId: typeof this.setting.audioInput === "string" ? this.setting.audioInput : null,
    actualInputDeviceId: this.currentMediaStream?.getAudioTracks?.()[0]?.getSettings?.().deviceId ?? null,
    inputSampleRate: this.currentMediaStream?.getAudioTracks?.()[0]?.getSettings?.().sampleRate ?? null,
    inputChannels: this.currentMediaStream?.getAudioTracks?.()[0]?.getSettings?.().channelCount ?? null,
    inputActive: this.currentMediaStream != null && this.desiredRunning,
    inputRms: !this.disposed && typeof this.inputAnalyser?.getFloatTimeDomainData === 'function'
      ? this.getRms(this.inputAnalyser) : null,
    outputRms: !this.disposed && typeof this.outputAnalyser?.getFloatTimeDomainData === 'function'
      ? this.getRms(this.outputAnalyser) : null,
    clientSession: this.generation,
    captureGeneration: this.captureGeneration,
    sampleRate: this.ctx?.sampleRate ?? null
  });
}
export { VoiceChangerClient };
