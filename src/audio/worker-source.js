// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
const workerjs = `const a = "[voicechanger-worklet-processor]", p = {
  config: "config",
  start: "start",
  stop: "stop",
  sendConvertedVoice: "sendConvertedVoice",
  resetBuffer: "resetBuffer",
  startInputRecording: "startInputRecording",
  stopInputRecording: "stopInputRecording",
  startOutputRecording: "startOutputRecording",
  stopOutputRecording: "stopOutputRecording",
  sendOriginalVoice: "sendOriginalVoice",
  sendRealtimeOutputStatus: "sendRealtimeOutputStatus",
  getOutputBufferSize: "getOutputBufferSize"
}, o = (u, ...s) => {
  u === "info" ? console.log(a, ...s) : u === "warn" ? console.warn(a, ...s) : u === "error" && console.error(a, ...s);
};
class c extends AudioWorkletProcessor {
  BLOCK_SIZE = 128;
  initialized = !1;
  // private volume = 0;
  isStarted = !1;
  passthrough = !1;
  isInputRecordingStarted = !1;
  isOutputRecordingStarted = !1;
  inputRecording = [];
  outputRecording = [];
  realtimeOutputStatusEnabled = !1;
  realtimeOutputStatusSendIntervalSec = 0.2;
  // デフォルト値
  realtimeOutputStatusSendInterval = this.realtimeOutputStatusSendIntervalSec / (this.BLOCK_SIZE / 48e3);
  // デフォルト値 (this.BLOCK_SIZE / 48000)はブロックサイズあたりの秒数
  volumeCalculationBuffer = [];
  processCallCounter = 0;
  // 入力音声バッファ関連のプロパティを追加
  sendingChunkSec = 0.2;
  // デフォルト値
  inputVoiceBuffer = [];
  bufferedSamplesCount = 0;
  SAMPLE_RATE = 48e3;
  // サンプルレート
  playBuffer = [];
  unpushedF32Data = new Float32Array(0);
  /**
   * @constructor
   */
  constructor() {
    super(), o("info", "VoiceChangerWorkletProcessor is created."), this.initialized = !0, this.port.onmessage = this.handleMessage.bind(this);
  }
  trancateBuffer = (s) => {
    for (this.passthrough == !1 && o("info", "Buffer truncated", s); this.playBuffer.length > s; )
      this.playBuffer.shift();
  };
  handleMessage(s) {
    const e = s.data;
    if (e.commandType === "config") {
      const t = e;
      this.realtimeOutputStatusEnabled = t.config.realtimeOutputStatusEnabled, this.passthrough = t.config.isPassthroughEnabled, this.realtimeOutputStatusSendIntervalSec = t.config.realtimeOutputStatusSendIntervalSec, this.realtimeOutputStatusSendInterval = this.realtimeOutputStatusSendIntervalSec / (this.BLOCK_SIZE / 48e3), this.sendingChunkSec = t.config.sendingChunkSec;
      const r = {
        commandType: "config",
        status: "ok"
      };
      this.port.postMessage(r);
      return;
    } else if (e.commandType === "start") {
      if (this.isStarted) {
        o("warn", \`audio processor is already started. \${this.isStarted}\`);
        return;
      }
      this.isStarted = !0;
      const t = {
        commandType: "start",
        status: "ok"
      };
      this.port.postMessage(t);
      return;
    } else if (e.commandType === "stop") {
      if (!this.isStarted) {
        o("warn", \`audio processor is not started. \${this.isStarted}\`);
        return;
      }
      this.isStarted = !1;
      const t = {
        commandType: "stop",
        status: "ok"
      };
      this.port.postMessage(t);
      return;
    } else if (e.commandType === "sendConvertedVoice") {
      const t = e;
      this.addConvertedVoice(t.voice);
      const r = {
        commandType: "sendConvertedVoice",
        status: "ok"
      };
      this.port.postMessage(r);
      return;
    } else if (e.commandType === "resetBuffer") {
      this.trancateBuffer(0), this.resetInputVoiceBuffer();
      const t = {
        commandType: "resetBuffer",
        status: "ok"
      };
      this.port.postMessage(t);
      return;
    } else if (e.commandType === "startInputRecording") {
      this.inputRecording = [], this.isInputRecordingStarted = !0;
      const t = {
        commandType: "startInputRecording",
        status: "ok"
      };
      this.port.postMessage(t);
      return;
    } else if (e.commandType === "stopInputRecording") {
      this.isInputRecordingStarted = !1;
      const t = {
        commandType: "stopInputRecording",
        status: "ok",
        inputRecording: this.inputRecording
      };
      this.port.postMessage(t);
      return;
    } else if (e.commandType === "startOutputRecording") {
      this.outputRecording = [], this.isOutputRecordingStarted = !0;
      const t = {
        commandType: "startOutputRecording",
        status: "ok"
      };
      this.port.postMessage(t);
      return;
    } else if (e.commandType === "stopOutputRecording") {
      this.isOutputRecordingStarted = !1;
      const t = {
        commandType: "stopOutputRecording",
        status: "ok",
        outputRecording: this.outputRecording
      };
      this.port.postMessage(t);
      return;
    } else if (e.commandType === "getOutputBufferSize") {
      const t = {
        commandType: "getOutputBufferSize",
        status: "ok",
        outputBufferSize: this.playBuffer.length * this.BLOCK_SIZE
      };
      this.port.postMessage(t);
      return;
    } else
      o("error", "unknown command", e);
  }
  addConvertedVoice = (s) => {
    const e = s, t = new Float32Array(this.unpushedF32Data.length + e.length);
    t.set(this.unpushedF32Data), t.set(e, this.unpushedF32Data.length), this.isOutputRecordingStarted && this.outputRecording.push(e);
    const r = Math.floor(t.length / this.BLOCK_SIZE);
    for (let n = 0; n < r; n++) {
      const i = t.slice(n * this.BLOCK_SIZE, (n + 1) * this.BLOCK_SIZE);
      this.playBuffer.push(i);
    }
    this.unpushedF32Data = t.slice(r * this.BLOCK_SIZE);
  };
  pushData = (s) => {
    this.inputVoiceBuffer.push(s.slice()), this.bufferedSamplesCount += s.length;
    const e = this.sendingChunkSec * this.SAMPLE_RATE;
    this.bufferedSamplesCount >= e && this.sendBufferedVoice(e), this.isInputRecordingStarted && this.inputRecording.push(s);
  };
  sendBufferedVoice = (s) => {
    const e = this.extractSamplesFromBuffer(s), t = {
      commandType: "sendOriginalVoice",
      voice: e
    };
    this.port.postMessage(t, [e.buffer]);
  };
  extractSamplesFromBuffer = (s) => {
    const e = new Float32Array(s);
    let t = 0, r = s;
    for (; r > 0 && this.inputVoiceBuffer.length > 0; ) {
      const n = this.inputVoiceBuffer[0], i = Math.min(r, n.length);
      e.set(n.subarray(0, i), t), i === n.length ? this.inputVoiceBuffer.shift() : this.inputVoiceBuffer[0] = n.subarray(i), t += i, r -= i, this.bufferedSamplesCount -= i;
    }
    return e.subarray(0, t);
  };
  resetInputVoiceBuffer = () => {
    this.inputVoiceBuffer = [], this.bufferedSamplesCount = 0;
  };
  calculateAndSendRealtimeOutputStatus = () => {
    if (this.volumeCalculationBuffer.length === 0)
      return;
    const s = this.volumeCalculationBuffer.reduce((n, i) => n + i.length, 0), e = new Float32Array(s);
    let t = 0;
    for (const n of this.volumeCalculationBuffer)
      e.set(n, t), t += n.length;
    const r = {
      commandType: "sendRealtimeOutputStatus",
      // volume: this.volume,
      realtimeOutputStatusSendIntervalSec: this.realtimeOutputStatusSendIntervalSec,
      realtimeOutputStatusSendInterval: this.realtimeOutputStatusSendInterval,
      outputBufferSize: this.playBuffer.length * this.BLOCK_SIZE
    };
    this.port.postMessage(r), this.volumeCalculationBuffer = [];
  };
  process(s, e, t) {
    if (!this.initialized)
      return o("warn", "worklet_process not ready"), !0;
    if (this.isStarted) {
      if (this.passthrough) {
        this.trancateBuffer(0);
        const n = s[0];
        return e[0][0].set(n[0]), !0;
      }
      s.length > 0 && s[0].length > 0 ? this.pushData(s[0][0]) : o("warn", "no input data");
    }
    if (this.playBuffer.length === 0)
      return !0;
    const r = this.playBuffer.shift();
    return r ? (this.realtimeOutputStatusEnabled && (this.volumeCalculationBuffer.push(r.slice()), this.processCallCounter++, this.processCallCounter >= this.realtimeOutputStatusSendInterval && (this.calculateAndSendRealtimeOutputStatus(), this.processCallCounter = 0)), e[0][0].set(r), e[0].length == 2 && e[0][1].set(r)) : o("warn", "no voice data"), !0;
  }
}
registerProcessor("voice-changer-worklet-processor", c);
export {
  p as CommandType
};
`;
export { workerjs };
