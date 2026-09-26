// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { lookup } from "../vendor/recovered-runtime.js";
const log = (S, C, ...E) => {
  S === "info" ? console.log(C, ...E) : S === "warn" ? console.warn(C, ...E) : S === "error" && console.error(C, ...E);
};
const LOG_PREFIX$1 = "[voicechanger-worklet-node]";
class VoiceChangerWorkletNode extends AudioWorkletNode {
  configurePromiseResolve = null;
  startPromiseResolve = null;
  stopPromiseResolve = null;
  sendConvertedVoicePromiseResolve = null;
  resetBufferPromiseResolve = null;
  startInputRecordingPromiseResolve = null;
  stopInputRecordingPromiseResolve = null;
  startOutputRecordingPromiseResolve = null;
  stopOutputRecordingPromiseResolve = null;
  getOutputBufferSizePromiseResolve = null;
  listener = null;
  exceptionListener = null;
  socket = null;
  abortControllers = [];
  setting = {
    protocol: "rest",
    sendingMode: "single"
  };
  currentWorkletSetting = {
    realtimeOutputStatusEnabled: false,
    realtimeOutputStatusSendIntervalSec: 0.2,
    isPassthroughEnabled: false,
    sendingChunkSec: 3
  };
  constructor(C, E) {
    super(C, "voice-changer-worklet-processor", E);
    this.port.onmessage = this.handleMessage.bind(this);
    this.createSocketIO();
    log("info", "worklet_node", "VoiceChangerWorkletNode is created. v2");
  }
  getSocketId = () => this.socket?.id;
  createSocketIO = () => {
    this.socket && (console.log("close socket"), this.socket.close(), this.socket = null);
    this.socket = lookup("/test");
    this.socket.on("connect_error", C => {
      log("error", "SIO", "connect failed", C);
      this.socket.close();
      this.socket = null;
    });
    this.socket.on("connect", () => {
      log("info", "SIO", `connected on ${this.socket?.id}`);
    });
    this.socket.on("close", () => {
      log("info", "SIO", `close ${this.socket?.id}`);
    });
    this.socket.on("message", C => {
      log("info", "SIO", "Message received:", C);
    });
    this.socket.on("response", C => {
      const E = C[1],
        w = C[2],
        R = JSON.parse(w);
      if (console.log("perf", R), C[0] == 0) return;
      const _ = E,
        x = new Float32Array(_);
      x.length > 1 ? this.sendConvertedVoice(x) : log("info", "SIO", `skip short data length:${x.length}`);
    });
    this.socket.on("perf", C => {
      log("info", "SIO", "perf:", C);
    });
    this.socket.on("command", C => {
      const E = C[0],
        w = C[1];
      log("info", "SIO", "command received ", E, w);
    });
    this.socket.on("exception", C => {
      const E = C[0],
        w = C[1];
      log("info", "SIO", "Exception received: ", E, w);
      this.exceptionListener && this.exceptionListener.onException(E, w);
    });
    this.socket.on("data", C => {
      const E = C[0],
        w = C[1];
      if (this.listener) if (E === "realtime_output_status") try {
        const R = JSON.parse(w);
        this.listener.onRealtimeOutputStatus({
          realtimeOutputStatusSendIntervalSec: R.realtimeOutputStatusSendIntervalSec,
          realtimeOutputStatusSendInterval: R.realtimeOutputStatusSendInterval,
          outputBufferSize: R.outputBufferSize,
          inputRms: R.inputRms,
          outputRms: R.outputRms
        });
      } catch (R) {
        log("error", "SIO", "Failed to parse realtime_output_status data:", R);
      } else if (E === "realtime_process_status") try {
        const R = JSON.parse(w);
        this.listener.onRealtimeProcessStatus({
          inputBufferSize: R.inputBufferSize,
          inputSize: R.inputSize,
          inputSec: R.inputSec,
          outputSize: R.outputSize,
          outputSec: R.outputSec,
          elapsedTime: R.elapsedTime,
          dataNum: R.dataNum
        });
      } catch (R) {
        log("error", "SIO", "Failed to parse realtime_process_status data:", R);
      } else this.listener.onData(E, w);
    });
  };
  setStatusListener = C => {
    this.listener = C;
  };
  setExceptionListener = C => {
    this.exceptionListener = C;
  };
  updateSetting = async C => {
    const E = this.setting.protocol != C.protocol;
    this.setting = C;
    E && this.createSocketIO();
  };
  updateWorkletSetting = async C => {
    this.currentWorkletSetting = {
      ...this.currentWorkletSetting,
      ...C
    };
    await this.configure(this.currentWorkletSetting);
  };
  handleMessage = async C => {
    const E = C.data;
    if (E.commandType === "config") this.configurePromiseResolve && (this.configurePromiseResolve(), this.configurePromiseResolve = null);else if (E.commandType === "start") this.startPromiseResolve && (this.startPromiseResolve(), this.startPromiseResolve = null);else if (E.commandType === "stop") this.stopPromiseResolve && (this.stopPromiseResolve(), this.stopPromiseResolve = null);else if (E.commandType === "sendConvertedVoice") this.sendConvertedVoicePromiseResolve && (this.sendConvertedVoicePromiseResolve(), this.sendConvertedVoicePromiseResolve = null);else if (E.commandType === "resetBuffer") this.resetBufferPromiseResolve && (this.resetBufferPromiseResolve(), this.resetBufferPromiseResolve = null);else if (E.commandType === "startInputRecording") this.startInputRecordingPromiseResolve && (this.startInputRecordingPromiseResolve(), this.startInputRecordingPromiseResolve = null);else if (E.commandType === "stopInputRecording") {
      const w = E;
      this.stopInputRecordingPromiseResolve && (this.stopInputRecordingPromiseResolve(w.inputRecording), this.stopInputRecordingPromiseResolve = null);
    } else if (E.commandType === "startOutputRecording") this.startOutputRecordingPromiseResolve && (this.startOutputRecordingPromiseResolve(), this.startOutputRecordingPromiseResolve = null);else if (E.commandType === "stopOutputRecording") {
      const w = E;
      this.stopOutputRecordingPromiseResolve && (this.stopOutputRecordingPromiseResolve(w.outputRecording), this.stopOutputRecordingPromiseResolve = null);
    } else if (E.commandType === "sendOriginalVoice") {
      const w = E;
      this.handleOriginalVoice(w.voice);
    } else if (E.commandType === "sendRealtimeOutputStatus") {
      const w = E;
      this.listener && this.listener.onRealtimeOutputStatus({
        realtimeOutputStatusSendIntervalSec: w.realtimeOutputStatusSendIntervalSec,
        realtimeOutputStatusSendInterval: w.realtimeOutputStatusSendInterval,
        outputBufferSize: w.outputBufferSize,
        inputRms: null,
        outputRms: null
      });
    } else if (E.commandType === "getOutputBufferSize") {
      const w = E;
      this.getOutputBufferSizePromiseResolve && (this.getOutputBufferSizePromiseResolve(w.outputBufferSize), this.getOutputBufferSizePromiseResolve = null);
    } else log("warn", "worklet_node", `Unknown command type: ${E.commandType}`);
  };
  handleOriginalVoice = C => {
    const E = new Uint8Array(C.buffer);
    this.sendBuffer(E);
  };
  sendBuffer = async C => {
    const E = Date.now();
    if (this.setting.protocol !== "sio") if (this.setting.protocol === "rest") {
      const w = new AbortController();
      this.abortControllers.push(w);
      const R = new FormData();
      R.append("waveform", new Blob([C]), "waveform.bin");
      let _ = "";
      this.setting.sendingMode == "bulk" ? _ = "/api/voice-changer/convert_chunk_bulk" : _ = "/api/voice-changer/convert_chunk";
      const x = {
        method: "POST",
        body: R,
        headers: {},
        signal: w.signal
      };
      x.headers = {
        "x-timestamp": E.toString()
      };
      try {
        const T = await fetch(_, x);
        if (T.ok) {
          const A = await T.arrayBuffer(),
            O = new Float32Array(A);
          O.length > 1 ? this.sendConvertedVoice(O) : log("warn", LOG_PREFIX$1, `skip short data length:${O.length}`);
        } else console.error("[worklet_node]Error:", T.status);
      } catch (T) {
        T instanceof Error && T.name === "AbortError" ? log("info", LOG_PREFIX$1, "Fetch request was aborted") : console.error("[worklet_node]Fetch error:", T);
      } finally {
        this.abortControllers = this.abortControllers.filter(T => T !== w);
      }
    } else throw "unknown protocol";
  };
  configure = async C => {
    const E = new Promise(R => {
        this.configurePromiseResolve = R;
      }),
      w = {
        commandType: "config",
        config: C
      };
    this.port.postMessage(w);
    await E;
  };
  start = async () => {
    const C = new Promise(w => {
        this.startPromiseResolve = w;
      }),
      E = {
        commandType: "start"
      };
    this.port.postMessage(E);
    await C;
  };
  stop = async () => {
    const C = new Promise(w => {
        this.stopPromiseResolve = w;
      }),
      E = {
        commandType: "stop"
      };
    this.port.postMessage(E);
    await C;
  };
  sendConvertedVoice = async C => {
    const E = new Promise(R => {
        this.sendConvertedVoicePromiseResolve = R;
      }),
      w = {
        commandType: "sendConvertedVoice",
        voice: C
      };
    this.port.postMessage(w, [C.buffer]);
    await E;
  };
  resetBuffer = async () => {
    const C = new Promise(w => {
        this.resetBufferPromiseResolve = w;
      }),
      E = {
        commandType: "resetBuffer"
      };
    this.port.postMessage(E);
    await C;
  };
  startInputRecording = async () => {
    const C = new Promise(w => {
        this.startInputRecordingPromiseResolve = w;
      }),
      E = {
        commandType: "startInputRecording"
      };
    this.port.postMessage(E);
    await C;
  };
  stopInputRecording = async () => {
    const C = new Promise(T => {
        this.stopInputRecordingPromiseResolve = T;
      }),
      E = {
        commandType: "stopInputRecording"
      };
    this.port.postMessage(E);
    const w = await C,
      R = w.reduce((T, A) => T + A.length, 0),
      _ = new Float32Array(R);
    let x = 0;
    for (const T of w) {
      _.set(T, x);
      x += T.length;
    }
    return _;
  };
  startOutputRecording = async () => {
    const C = new Promise(w => {
        this.startOutputRecordingPromiseResolve = w;
      }),
      E = {
        commandType: "startOutputRecording"
      };
    this.port.postMessage(E);
    await C;
  };
  stopOutputRecording = async () => {
    const C = new Promise(T => {
        this.stopOutputRecordingPromiseResolve = T;
      }),
      E = {
        commandType: "stopOutputRecording"
      };
    this.port.postMessage(E);
    const w = await C,
      R = w.reduce((T, A) => T + A.length, 0),
      _ = new Float32Array(R);
    let x = 0;
    for (const T of w) {
      _.set(T, x);
      x += T.length;
    }
    return _;
  };
  getOutputBufferSize = async () => {
    const C = new Promise(w => {
        this.getOutputBufferSizePromiseResolve = w;
      }),
      E = {
        commandType: "getOutputBufferSize"
      };
    return this.port.postMessage(E), await C;
  };
  abortAllRequests = () => {
    this.abortControllers.length > 0 && (this.abortControllers.forEach(C => C.abort()), this.abortControllers = [], log("info", LOG_PREFIX$1, `All fetch requests aborted (${this.abortControllers.length} requests)`));
  };
  isRequestPending = () => this.abortControllers.length > 0;
  getPendingRequestCount = () => this.abortControllers.length;
}
export { log, VoiceChangerWorkletNode };
