// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { reactExports as ReactRuntime, useTranslation } from "../vendor/recovered-runtime.js";
import { useAppRoot } from "../state/app-root-context.js";
import { log$1 as logMessage } from "../shared/logger.js";
import { downloadAsWav } from "../audio/wav.js";
import { VoiceChangerType } from "../domain/constants.js";
import { VoiceChangerClient } from "../audio/VoiceChangerClient.js";
import { generateTimestamp } from "../shared/recordings.js";
const codeFilename = import.meta.url.split("/").pop();
const logPrefix = `[${codeFilename}]`;
const useVoiceChangerClient = options => {
  const {
      t
    } = useTranslation(),
    triggerToast = options.triggerToast,
    {
      currentSlotInfo,
      reloadLocalVoiceChangerInterfaceInfo
    } = useAppRoot(),
    voiceChangerClient = ReactRuntime.useMemo(() => new VoiceChangerClient(), []),
    [isClientInitialized, setClientInitialized] = ReactRuntime.useState(false),
    [outputBufferSizeHistory, setOutputBufferSizeHistory] = ReactRuntime.useState([]),
    [outputBufferSizeMonitoringEnabled, setOutputBufferMonitoringEnabledState] = ReactRuntime.useState(false),
    outputBufferSizeCallbackRef = ReactRuntime.useRef(null);
  ReactRuntime.useEffect(() => {
    options.ctx != null && (logMessage("info", logPrefix, "initializing client..... only one called.."), voiceChangerClient.initialize(options.ctx, false), voiceChangerClient.setVoiceChangerExceptionListener({
      onException: (he, me) => {
        logMessage("error", logPrefix, `onException: ${he} ${me}`);
        he == "LOCAL_VOICE_CHANGER_INTERFACE_RUN_ERROR" && (triggerToast("error", t("common.error_messages.server_device_init_failed")), reloadLocalVoiceChangerInterfaceInfo());
      }
    }));
  }, [options.ctx, voiceChangerClient, reloadLocalVoiceChangerInterfaceInfo, triggerToast, t]);
  ReactRuntime.useEffect(() => {
    if (!voiceChangerClient) return;
    (async () => {
      await voiceChangerClient.isInitialized();
      setClientInitialized(true);
    })();
  }, [voiceChangerClient]);
  ReactRuntime.useEffect(() => {
    if (!isClientInitialized) return;
    logMessage("info", logPrefix, "inputAudioType", options.globaSetting.inputAudioType);
    logMessage("info", logPrefix, "inputAudio", options.globaSetting.inputAudio);
    const me = voiceChangerClient.getClientSetting().voiceChangerClientSetting;
    (options.globaSetting.inputAudioType === "microphone" && typeof options.globaSetting.inputAudio == "string" || options.globaSetting.inputAudioType === "file" && options.globaSetting.inputAudio instanceof MediaStream || options.globaSetting.inputAudioType === "capture" && options.globaSetting.inputAudio instanceof MediaStream || options.globaSetting.inputAudioType === "sample" && options.globaSetting.inputAudio instanceof MediaStream) && (me.audioInput = options.globaSetting.inputAudio);
    me.inputGain = options.globaSetting.nodeInputGain;
    me.outputGain = options.globaSetting.nodeOutputGain;
    me.monitorGain = options.globaSetting.nodeMonitorGain;
    me.echoCancel = options.globaSetting.enableEchoCancellation;
    me.noiseSuppression = options.globaSetting.enableNoiseSuppression;
    me.noiseSuppression2 = options.globaSetting.enableNoiseSuppression2;
    console.log("clientSetting", me);
    voiceChangerClient.updateClientSetting({
      ...me
    });
  }, [voiceChangerClient, isClientInitialized, options.globaSetting.inputAudioType, options.globaSetting.inputAudio, options.globaSetting.nodeInputGain, options.globaSetting.nodeOutputGain, options.globaSetting.nodeMonitorGain, options.globaSetting.enableEchoCancellation, options.globaSetting.enableNoiseSuppression, options.globaSetting.enableNoiseSuppression2]);
  ReactRuntime.useEffect(() => {
    (async () => {
      if (!isClientInitialized) return;
      if (options.globaSetting.outputAudioElementId == null) {
        console.warn("[voiceChangerClient] audioOutputElementId not set for audio output.");
        return;
      }
      const me = document.getElementById(options.globaSetting.outputAudioElementId);
      if (!me) {
        console.warn("[voiceChangerClient] audioOutputElementId not set for audio output.");
        return;
      }
      if (options.globaSetting.outputAudio == "none") {
        console.warn("[voiceChangerClient] audioOutputDevice not set for audio output.");
        me.volume = 0;
        me.muted = true;
        return;
      }
      if (!(await navigator.mediaDevices.enumerateDevices()).filter(xe => xe.kind == "audiooutput").some(xe => xe.deviceId == options.globaSetting.outputAudio)) {
        console.warn(`[voiceChangerClient] audioOutputDevice ${options.globaSetting.outputAudio} not found.`);
        triggerToast("error", t("common.error_messages.audio_output_device_not_found", {
          device: options.globaSetting.outputAudio
        }));
        me.volume = 0;
        me.muted = true;
        return;
      }
      me.srcObject = null;
      me.srcObject = voiceChangerClient.stream;
      try {
        await me.setSinkId(options.globaSetting.outputAudio);
      } catch (xe) {
        console.log("setSinkId is not supported?", xe);
        triggerToast("error", t("common.error_messages.set_sink_id_not_supported", {
          error: xe
        }));
      }
      me.volume = 1;
      me.paused && me.play();
    })();
  }, [voiceChangerClient, isClientInitialized, options.globaSetting.outputAudioElementId, options.globaSetting.outputAudio, triggerToast, t]);
  ReactRuntime.useEffect(() => {
    (async () => {
      if (!isClientInitialized) return;
      if (options.globaSetting.monitorAudioElementId == null) {
        console.warn("[voiceChangerClient] audioMonitorElementId not set for audio monitor.");
        return;
      }
      const me = document.getElementById(options.globaSetting.monitorAudioElementId);
      if (!me) {
        console.warn("[voiceChangerClient] audioMonitorElementId not set for audio monitor.");
        return;
      }
      if (options.globaSetting.monitorAudio == "none") {
        console.warn("[voiceChangerClient] audioMonitorDevice not set for audio monitor.");
        me.volume = 0;
        me.muted = true;
        return;
      }
      if (!(await navigator.mediaDevices.enumerateDevices()).filter(xe => xe.kind == "audiooutput").some(xe => xe.deviceId == options.globaSetting.monitorAudio)) {
        console.warn(`[voiceChangerClient] audioMonitorDevice ${options.globaSetting.monitorAudio} not found.`);
        triggerToast("error", t("common.error_messages.audio_monitor_device_not_found", {
          device: options.globaSetting.monitorAudio
        }));
        me.volume = 0;
        me.muted = true;
        return;
      }
      me.srcObject = null;
      me.srcObject = voiceChangerClient.monitorStream;
      try {
        await me.setSinkId(options.globaSetting.monitorAudio);
      } catch (xe) {
        console.log("setSinkId is not supported?", xe);
        triggerToast("error", t("common.error_messages.set_sink_id_not_supported", {
          error: xe
        }));
      }
      me.volume = 1;
      me.paused && me.play();
    })();
  }, [voiceChangerClient, isClientInitialized, options.globaSetting.monitorAudioElementId, options.globaSetting.monitorAudio, triggerToast, t]);
  ReactRuntime.useEffect(() => {
    (async () => {
      if (isClientInitialized) if (options.globaSetting.isOutputRecording == true) voiceChangerClient.startOutputRecording();else {
        const me = await voiceChangerClient.stopOutputRecording();
        if (me.length > 0) {
          const ye = generateTimestamp();
          downloadAsWav(me, `output_client_${ye}.wav`);
        }
      }
    })();
  }, [voiceChangerClient, isClientInitialized, options.globaSetting.isOutputRecording]);
  ReactRuntime.useEffect(() => {
    (async () => {
      isClientInitialized && (options.globaSetting.isStarted == true ? voiceChangerClient.start() : voiceChangerClient.stop());
    })();
  }, [voiceChangerClient, isClientInitialized, options.globaSetting.isStarted]);
  ReactRuntime.useEffect(() => {
    (async () => {
      if (!isClientInitialized || !currentSlotInfo?.voice_changer_type) return;
      const ye = voiceChangerClient.getClientSetting().workletNodeSetting;
      let be = "bulk";
      currentSlotInfo.voice_changer_type == VoiceChangerType.RVC;
      be = "bulk";
      ye.protocol = options.globaSetting.protocol;
      ye.sendingMode = be;
      await voiceChangerClient.updateNodeSetting({
        ...ye
      });
      await voiceChangerClient.resetBuffer();
    })();
  }, [voiceChangerClient, isClientInitialized, options.globaSetting.protocol, currentSlotInfo?.voice_changer_type]);
  ReactRuntime.useEffect(() => {
    if (!voiceChangerClient || !isClientInitialized) return;
    const me = voiceChangerClient.getClientSetting().workletSetting;
    me.realtimeOutputStatusEnabled = options.globaSetting.realtimeOutputStatusEnabled;
    me.realtimeOutputStatusSendIntervalSec = options.globaSetting.realtimeOutputStatusSendIntervalSec;
    me.isPassthroughEnabled = options.globaSetting.isPassthrough;
    me.sendingChunkSec = currentSlotInfo?.chunk_sec ?? 0.2;
    voiceChangerClient.updateWorkletSetting(me);
  }, [voiceChangerClient, isClientInitialized, options.globaSetting.isPassthrough, options.globaSetting.realtimeOutputStatusEnabled, options.globaSetting.realtimeOutputStatusSendIntervalSec, currentSlotInfo?.chunk_sec]);
  ReactRuntime.useEffect(() => {
    isClientInitialized && voiceChangerClient.resetBuffer();
  }, [voiceChangerClient, isClientInitialized, currentSlotInfo?.chunk_sec]);
  ReactRuntime.useEffect(() => {
    if (!isClientInitialized || !outputBufferSizeMonitoringEnabled) return;
    const he = setInterval(async () => {
      try {
        const me = await voiceChangerClient.getOutputBufferSize(),
          ye = Date.now();
        setOutputBufferSizeHistory(be => [...be, {
          timestamp: ye,
          size: me
        }].slice(-100));
      } catch (me) {
        console.error("Failed to get output buffer size:", me);
      }
    }, 100);
    return () => clearInterval(he);
  }, [isClientInitialized, outputBufferSizeMonitoringEnabled, voiceChangerClient]);
  const getLatestOutputBufferSize = () => outputBufferSizeHistory.length > 0 ? outputBufferSizeHistory[outputBufferSizeHistory.length - 1].size : null,
    clearOutputBufferSizeHistory = () => {
      setOutputBufferSizeHistory([]);
    },
    setOutputBufferSizeMonitoringEnabled = he => {
      setOutputBufferMonitoringEnabledState(he);
      he || setOutputBufferSizeHistory([]);
    },
    getPendingRequestCount = () => voiceChangerClient.getPendingRequestCount(),
    abortAllRequests = () => {
      voiceChangerClient.abortAllRequests();
    },
    setOutputBufferSizeCallback = he => {
      outputBufferSizeCallbackRef.current = he;
    },
    resetOutputBuffer = () => {
      voiceChangerClient.resetBuffer();
    },
    setVoiceChangerStatusListener = ReactRuntime.useCallback(he => {
      voiceChangerClient.setVoiceChangerStatusListener(he);
    }, [voiceChangerClient]);
  return {
    isClientInitialized,
    outputBufferSizeHistory,
    outputBufferSizeMonitoringEnabled,
    getLatestOutputBufferSize,
    clearOutputBufferSizeHistory,
    setOutputBufferSizeMonitoringEnabled,
    getPendingRequestCount,
    abortAllRequests,
    setOutputBufferSizeCallback,
    resetOutputBuffer,
    setVoiceChangerStatusListener
  };
};
export { useVoiceChangerClient };
