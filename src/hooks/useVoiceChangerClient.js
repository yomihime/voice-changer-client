// Client audio is owned by an explicit Start session, independent of Server Device.
import { reactExports as ReactRuntime } from "../vendor/recovered-runtime.js";
import { useAppRoot } from "../state/app-root-context.js";
import { downloadAsWav } from "../audio/wav.js";
import { VoiceChangerClient } from "../audio/VoiceChangerClient.js";
import { OutputDeviceRouter } from "../audio/device-routing.js";
import { generateTimestamp } from "../shared/recordings.js";
import { backendClient } from "../api/BackendClient.js";
import { VCRestClient } from "../api/VoiceChangerApiClient.js";

const useVoiceChangerClient = options => {
  const { currentSlotInfo, serverConfiguration, localVoiceChangerInterfaceInfo, ensureAudioContext, reloadDeviceInfo, reloadLocalVoiceChangerInterfaceInfo } = useAppRoot();
  const settings = options.globaSetting;
  const voiceChangerClient = ReactRuntime.useMemo(() => new VoiceChangerClient(), []);
  const [isClientInitialized, setClientInitialized] = ReactRuntime.useState(false);
  const [outputBufferSizeHistory, setOutputBufferSizeHistory] = ReactRuntime.useState([]);
  const [outputBufferSizeMonitoringEnabled, setOutputBufferMonitoringEnabledState] = ReactRuntime.useState(false);
  const [audioState, setAudioState] = ReactRuntime.useState(backendClient.audioState ?? { revision: 0, blocked: false });
  const [deviceRevision, setDeviceRevision] = ReactRuntime.useState(0);
  const outputRouterRef = ReactRuntime.useRef(null);
  const monitorRouterRef = ReactRuntime.useRef(null);
  const outputBufferSizeCallbackRef = ReactRuntime.useRef(null);
  const lastErrorRef = ReactRuntime.useRef(null);
  const inputConfigurationRef = ReactRuntime.useRef(null);
  const recordingFinalizationRef = ReactRuntime.useRef(null);
  const intentRef = ReactRuntime.useRef(null);
  const clientMode = serverConfiguration?.voice_changer_input_mode === "client";
  const desiredRunning = clientMode && settings.isStarted === true;
  const inputReady = settings.inputAudioType === "microphone"
    ? typeof settings.inputAudio === "string" && settings.inputAudio !== "none" && settings.inputAudio.length > 0
    : typeof settings.inputAudio?.getTracks === "function";
  intentRef.current = { desiredRunning, clientMode, context: options.ctx, revision: audioState.revision };
  const inputConfiguration = [settings.inputAudioType, settings.inputAudio, settings.enableEchoCancellation,
    settings.enableNoiseSuppression, settings.enableNoiseSuppression2, settings.protocol, settings.isPassthrough,
    serverConfiguration?.voice_changer_input_mode, serverConfiguration?.gpu_device_id_int,
    serverConfiguration?.input_sample_rate, serverConfiguration?.output_sample_rate, serverConfiguration?.rvc_backend, currentSlotInfo?.slot_index,
    currentSlotInfo?.chunk_sec, currentSlotInfo?.runtime_available, localVoiceChangerInterfaceInfo?.local_voice_changer_interface_active];

  const preflightStart = ReactRuntime.useCallback(() => {
    if (localVoiceChangerInterfaceInfo?.local_voice_changer_interface_active) throw new Error("Server Device が動作中です。停止してから Client Device を開始してください。");
    if (settings.inputAudioType === "microphone" && !inputReady) throw new Error("入力デバイスを選択してください。");
    if (settings.isPassthrough === true) {
      if ((!settings.outputAudio || settings.outputAudio === "none") && (!settings.monitorAudio || settings.monitorAudio === "none")) {
        throw new Error("出力またはモニターデバイスを選択してください。");
      }
      return;
    }
    const capability = VCRestClient.getInstance().getCapabilities?.().clientAudio;
    if (capability?.supported === false) throw new Error(capability.reason);
    const ready = backendClient.state?.protocol === "legacy-vcc"
      ? currentSlotInfo?.runtime_available === true
      : currentSlotInfo?.voice_changer_type != null && currentSlotInfo.runtime_available !== false;
    if (!ready) throw new Error("対応モデルを読み込んでから開始してください。");
    if (backendClient.state?.protocol === "legacy-vcc" && options.ctx &&
        (serverConfiguration.input_sample_rate !== options.ctx.sampleRate || serverConfiguration.output_sample_rate !== options.ctx.sampleRate)) {
      throw new Error(`Server の入力・出力サンプルレートを Client の ${options.ctx.sampleRate} Hz に合わせてください。`);
    }
  }, [localVoiceChangerInterfaceInfo, settings.inputAudioType, inputReady, settings.isPassthrough, settings.outputAudio,
    settings.monitorAudio, currentSlotInfo, serverConfiguration, options.ctx]);

  const silenceRoutes = ReactRuntime.useCallback(() => {
    outputRouterRef.current?.clear();
    monitorRouterRef.current?.clear();
  }, []);
  const stopSession = ReactRuntime.useCallback(() => {
    silenceRoutes();
    voiceChangerClient.stop().catch(error => console.error("Audio stop failed", error));
    voiceChangerClient.dispose();
    setClientInitialized(false);
    settings.setIsStarted?.(false);
    settings.setIsOutputRecording?.(false);
  }, [voiceChangerClient, silenceRoutes, settings.setIsStarted, settings.setIsOutputRecording]);
  const failSession = ReactRuntime.useCallback(error => {
    lastErrorRef.current = error.message ?? String(error);
    stopSession();
    options.triggerToast("error", "音声処理を停止しました。" + lastErrorRef.current);
  }, [stopSession, options.triggerToast]);
  const reportRouteError = ReactRuntime.useCallback(error => {
    lastErrorRef.current = error.message ?? String(error);
    options.triggerToast("error", lastErrorRef.current);
  }, [options.triggerToast]);
  const finalizeOrdinaryStop = ReactRuntime.useCallback(() => {
    if (recordingFinalizationRef.current) return recordingFinalizationRef.current;
    if (voiceChangerClient.disposed) return Promise.resolve();
    silenceRoutes();
    setClientInitialized(false);
    settings.setIsOutputRecording?.(false);
    const generation = voiceChangerClient.generation;
    const sampleRate = voiceChangerClient.ctx?.sampleRate;
    const operation = voiceChangerClient.finalizeRecording().then(result => {
      if (generation !== voiceChangerClient.generation) return;
      for (const { kind, samples } of result.recordings) downloadAsWav(samples, `${kind}_client_${generateTimestamp()}.wav`, sampleRate);
      if (result.errors.length > 0) {
        const message = result.errors.map(error => error.message ?? String(error)).join(" / ");
        reportRouteError(new Error("録音の保存に失敗しました。" + message));
      }
      const metrics = result.metrics.processor ?? {};
      if (result.recordings.length > 0 && (metrics.inputRecordingTruncated || metrics.outputRecordingTruncated)) options.triggerToast("warning", "録音は上限に達したため一部を保存しています。");
    }).catch(reportRouteError);
    const tracked = operation.finally(() => {
      if (generation === voiceChangerClient.generation) voiceChangerClient.dispose();
      if (recordingFinalizationRef.current === tracked) recordingFinalizationRef.current = null;
    });
    recordingFinalizationRef.current = tracked;
    return tracked;
  }, [voiceChangerClient, silenceRoutes, settings.setIsOutputRecording, reportRouteError, options.triggerToast]);

  ReactRuntime.useEffect(() => {
    let revision = backendClient.audioState?.revision ?? 0;
    const unsubscribeAudio = backendClient.onAudioChange?.(state => {
      const changed = state.revision !== revision;
      revision = state.revision;
      setAudioState({ ...state });
      if (state.blocked || changed) {
        lastErrorRef.current = state.error ?? null;
        stopSession();
      }
    });
    const unsubscribeConnection = backendClient.onInvalidate(stopSession);
    return () => { unsubscribeAudio?.(); unsubscribeConnection(); stopSession(); };
  }, [stopSession]);

  ReactRuntime.useEffect(() => {
    if (!desiredRunning || options.ctx != null) return;
    let active = true;
    (async () => {
      preflightStart();
      if (audioState.blocked && backendClient.clearAudioError?.() !== true) throw new Error(audioState.error || "バックエンドの変更処理が完了していません。");
      if (typeof ensureAudioContext !== "function") throw new Error("音声コンテキストを作成できません。");
      await ensureAudioContext();
    })().catch(error => { if (active) failSession(error); });
    return () => { active = false; };
  }, [desiredRunning, options.ctx, audioState.blocked, audioState.error, ensureAudioContext, failSession, preflightStart]);

  // Changes that recreate the input require a fresh explicit Start. Gain changes
  // are handled separately and do not re-request microphone permission.
  ReactRuntime.useEffect(() => {
    const previous = inputConfigurationRef.current;
    inputConfigurationRef.current = inputConfiguration;
    if (!previous || !settings.isStarted) return;
    const changed = previous.map((value, index) => value !== inputConfiguration[index] ? index : -1).filter(index => index >= 0);
    const preparedInput = settings.inputAudioType !== "microphone" && inputReady
      && (previous[1] == null || previous[1] === "none") && changed.every(index => index === 1);
    if (changed.length > 0 && !preparedInput) stopSession();
  }, [...inputConfiguration, voiceChangerClient, stopSession]);

  ReactRuntime.useEffect(() => {
    if (!desiredRunning || options.ctx == null) {
      silenceRoutes();
      if (!desiredRunning && clientMode) finalizeOrdinaryStop();
      else voiceChangerClient.dispose();
      setClientInitialized(false);
      if (!clientMode && settings.isStarted) settings.setIsStarted?.(false);
      return;
    }
    if (!inputReady) {
      const timer = setTimeout(() => failSession(new Error("入力音声を準備できませんでした。ファイルやキャプチャを選び直して開始してください。")), 10000);
      return () => clearTimeout(timer);
    }
    if (audioState.blocked) {
      if (backendClient.clearAudioError?.() !== true) failSession(new Error(audioState.error || "バックエンドの変更処理が完了していません。"));
      return;
    }
    let active = true;
    setClientInitialized(false);
    lastErrorRef.current = null;
    (async () => {
      if (recordingFinalizationRef.current) await recordingFinalizationRef.current;
      if (!active) return;
      preflightStart();
      const ready = await voiceChangerClient.initialize(options.ctx, false);
      if (!active || !ready) return;
      voiceChangerClient.setVoiceChangerExceptionListener({ onException: (code, message) => {
        if (!active) return;
        if (code === "LOCAL_VOICE_CHANGER_INTERFACE_RUN_ERROR") reloadLocalVoiceChangerInterfaceInfo?.();
        failSession(new Error(message));
      } });
      await voiceChangerClient.updateNodeSetting({
        protocol: settings.protocol,
        sendingMode: "bulk",
        sampleRate: options.ctx.sampleRate,
        legacyRate: serverConfiguration.input_sample_rate,
        legacyBackend: serverConfiguration.rvc_backend,
        noiseGate: serverConfiguration.noise_gate ?? 0.00001,
        localPassthrough: settings.isPassthrough === true,
        expectedSamplesPolicy: serverConfiguration.rvc_backend === "official" ? "variable" : "same"
      });
      await voiceChangerClient.updateWorkletSetting({
        realtimeOutputStatusEnabled: settings.realtimeOutputStatusEnabled,
        realtimeOutputStatusSendIntervalSec: settings.realtimeOutputStatusSendIntervalSec,
        isPassthroughEnabled: settings.isPassthrough,
        sendingChunkSec: currentSlotInfo?.chunk_sec ?? 0.2
      });
      await voiceChangerClient.updateClientSetting({
        audioInput: settings.inputAudio,
        inputGain: settings.nodeInputGain,
        outputGain: settings.nodeOutputGain,
        monitorGain: settings.nodeMonitorGain,
        echoCancel: settings.enableEchoCancellation,
        noiseSuppression: settings.enableNoiseSuppression,
        noiseSuppression2: settings.enableNoiseSuppression2,
        sampleRate: options.ctx.sampleRate
      });
      if (!active || voiceChangerClient.disposed) return;
      const started = await voiceChangerClient.start();
      if (active && started && !voiceChangerClient.disposed) {
        await reloadDeviceInfo?.();
        if (active && !voiceChangerClient.disposed) setClientInitialized(true);
      } else if (active && !voiceChangerClient.disposed) throw new Error("音声セッションを開始できませんでした。開始し直してください。");
    })().catch(error => { if (active) failSession(error); });
    return () => {
      active = false;
      silenceRoutes();
      const next = intentRef.current;
      if (!next.desiredRunning && next.clientMode && next.context === options.ctx && next.revision === audioState.revision) finalizeOrdinaryStop();
      else voiceChangerClient.dispose();
    };
  }, [options.ctx, desiredRunning, clientMode, inputReady, audioState.revision, audioState.blocked, voiceChangerClient,
    silenceRoutes, failSession, finalizeOrdinaryStop, reloadLocalVoiceChangerInterfaceInfo]);

  ReactRuntime.useEffect(() => {
    if (!isClientInitialized || !voiceChangerClient.isVoiceChanging) return;
    voiceChangerClient.updateWorkletSetting({
      ...voiceChangerClient.getClientSetting().workletSetting,
      realtimeOutputStatusEnabled: settings.realtimeOutputStatusEnabled,
      realtimeOutputStatusSendIntervalSec: settings.realtimeOutputStatusSendIntervalSec
    }).catch(failSession);
  }, [voiceChangerClient, isClientInitialized, settings.realtimeOutputStatusEnabled,
    settings.realtimeOutputStatusSendIntervalSec, failSession]);

  ReactRuntime.useEffect(() => {
    if (!isClientInitialized || !voiceChangerClient.isVoiceChanging) return;
    voiceChangerClient.updateClientSetting({
      ...voiceChangerClient.getClientSetting().voiceChangerClientSetting,
      inputGain: settings.nodeInputGain,
      outputGain: settings.nodeOutputGain,
      monitorGain: settings.nodeMonitorGain
    }).catch(failSession);
  }, [isClientInitialized, voiceChangerClient, settings.nodeInputGain, settings.nodeOutputGain, settings.nodeMonitorGain, failSession]);

  ReactRuntime.useEffect(() => {
    const changed = async () => {
      silenceRoutes();
      setDeviceRevision(value => value + 1);
      const generation = voiceChangerClient.generation;
      const selected = voiceChangerClient.setting?.audioInput;
      if (!voiceChangerClient.desiredRunning || typeof selected !== "string") return;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (voiceChangerClient.disposed || generation !== voiceChangerClient.generation) return;
        if (!devices.some(device => device.kind === "audioinput" && device.deviceId === selected)) {
          failSession(new Error("選択した入力デバイスが見つかりません。接続を確認して開始し直してください。"));
        }
      } catch (error) {
        if (!voiceChangerClient.disposed && generation === voiceChangerClient.generation) failSession(error);
      }
    };
    navigator.mediaDevices.addEventListener?.("devicechange", changed);
    return () => navigator.mediaDevices.removeEventListener?.("devicechange", changed);
  }, [voiceChangerClient, silenceRoutes, failSession]);

  const routeElement = (routerRef, elementId, deviceId, stream) => {
    const element = elementId == null ? null : document.getElementById(elementId);
    if (!element) return;
    if (routerRef.current?.element !== element) {
      routerRef.current?.clear();
      routerRef.current = new OutputDeviceRouter(element);
    }
    const router = routerRef.current;
    let active = true;
    const generation = voiceChangerClient.generation;
    if (isClientInitialized && desiredRunning) {
      router.route(deviceId, stream, () => active && !voiceChangerClient.disposed && generation === voiceChangerClient.generation)
        .catch(error => { if (active) reportRouteError(error); });
    } else router.clear();
    return () => { active = false; router.clear(); };
  };
  ReactRuntime.useEffect(() => routeElement(outputRouterRef, settings.outputAudioElementId, settings.outputAudio, voiceChangerClient.stream),
    [voiceChangerClient, isClientInitialized, desiredRunning, settings.outputAudioElementId, settings.outputAudio, deviceRevision, reportRouteError]);
  ReactRuntime.useEffect(() => routeElement(monitorRouterRef, settings.monitorAudioElementId, settings.monitorAudio, voiceChangerClient.monitorStream),
    [voiceChangerClient, isClientInitialized, desiredRunning, settings.monitorAudioElementId, settings.monitorAudio, deviceRevision, reportRouteError]);

  ReactRuntime.useEffect(() => {
    if (!isClientInitialized || !desiredRunning) return;
    let active = true;
    (async () => {
      if (settings.isOutputRecording) await voiceChangerClient.startOutputRecording();
      else {
        const recording = await voiceChangerClient.stopOutputRecording();
        if (!voiceChangerClient.disposed && recording.length > 0 && voiceChangerClient.claimRecording("output", recording)) {
          downloadAsWav(recording, `output_client_${generateTimestamp()}.wav`, voiceChangerClient.ctx.sampleRate);
          if (voiceChangerClient.getAudioMetrics().processor?.outputRecordingTruncated) options.triggerToast("warning", "録音は上限に達したため一部を保存しています。");
        }
      }
    })().catch(error => { if (active) reportRouteError(error); });
    return () => { active = false; };
  }, [voiceChangerClient, isClientInitialized, desiredRunning, settings.isOutputRecording, reportRouteError]);

  ReactRuntime.useEffect(() => {
    if (!isClientInitialized || !outputBufferSizeMonitoringEnabled) return;
    let active = true;
    const timer = setInterval(async () => {
      try {
        const size = await voiceChangerClient.getOutputBufferSize();
        if (!active || voiceChangerClient.disposed) return;
        outputBufferSizeCallbackRef.current?.(size);
        setOutputBufferSizeHistory(history => [...history, { timestamp: Date.now(), size }].slice(-100));
      } catch (error) { if (active) console.error("Audio buffer monitoring failed", error); }
    }, 100);
    return () => { active = false; clearInterval(timer); };
  }, [voiceChangerClient, isClientInitialized, outputBufferSizeMonitoringEnabled]);

  const setVoiceChangerStatusListener = ReactRuntime.useCallback(listener => {
    voiceChangerClient.setVoiceChangerStatusListener(listener);
  }, [voiceChangerClient]);
  const getAudioMetrics = ReactRuntime.useCallback(() => {
    const metrics = voiceChangerClient.getAudioMetrics();
    return { ...metrics, output: outputRouterRef.current?.state ?? null, monitor: monitorRouterRef.current?.state ?? null,
      lastError: lastErrorRef.current ?? metrics.lastError ?? null, audioState: backendClient.audioState };
  }, [voiceChangerClient]);

  return {
    isClientInitialized,
    outputBufferSizeHistory,
    outputBufferSizeMonitoringEnabled,
    getLatestOutputBufferSize: () => outputBufferSizeHistory.at(-1)?.size ?? null,
    clearOutputBufferSizeHistory: () => setOutputBufferSizeHistory([]),
    setOutputBufferSizeMonitoringEnabled: enabled => { setOutputBufferMonitoringEnabledState(enabled); if (!enabled) setOutputBufferSizeHistory([]); },
    getPendingRequestCount: () => voiceChangerClient.getPendingRequestCount(),
    abortAllRequests: stopSession,
    setOutputBufferSizeCallback: listener => { outputBufferSizeCallbackRef.current = listener; },
    resetOutputBuffer: stopSession,
    setVoiceChangerStatusListener,
    getAudioMetrics
  };
};
export { useVoiceChangerClient };
