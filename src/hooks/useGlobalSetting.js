// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { reactExports as ReactRuntime } from "../vendor/recovered-runtime.js";
import { saveSettings, loadSettings } from "../storage/settings.js";
import { InputAudioType } from "../domain/constants.js";
const useGlobalSetting = () => {
  const [settingsLoaded, setSettingsLoaded] = ReactRuntime.useState(false),
    [displayColorMode, setDisplayColorMode] = ReactRuntime.useState("light"),
    [selectedInputAudioDeviceId, setSelectedInputAudioDeviceId] = ReactRuntime.useState("default"),
    [inputAudio, setInputAudio] = ReactRuntime.useState("default"),
    [outputAudio, setOutputAudio] = ReactRuntime.useState("default"),
    [monitorAudio, setMonitorAudio] = ReactRuntime.useState("default"),
    [outputAudioElementId, setOutputAudioElementId] = ReactRuntime.useState(null),
    [monitorAudioElementId, setMonitorAudioElementId] = ReactRuntime.useState(null),
    [inputAudioType, setInputAudioType] = ReactRuntime.useState(InputAudioType.MICROPHONE),
    [nodeInputGain, setNodeInputGain] = ReactRuntime.useState(1),
    [nodeOutputGain, setNodeOutputGain] = ReactRuntime.useState(1),
    [nodeMonitorGain, setNodeMonitorGain] = ReactRuntime.useState(0),
    [selectedLanguage, setSelectedLanguage] = ReactRuntime.useState("ja"),
    [isOutputRecording, setIsOutputRecording] = ReactRuntime.useState(false),
    [outputRecord, setOutputRecord] = ReactRuntime.useState(null),
    [isStarted, setIsStarted] = ReactRuntime.useState(false),
    [isPassthrough, setIsPassthrough] = ReactRuntime.useState(false),
    [enableEchoCancellation, setEnableEchoCancellation] = ReactRuntime.useState(false),
    [enableNoiseSuppression, setEnableNoiseSuppression] = ReactRuntime.useState(false),
    [enableNoiseSuppression2, setEnableNoiseSuppression2] = ReactRuntime.useState(false),
    [realtimeOutputStatusEnabled, setRealtimeOutputStatusEnabled] = ReactRuntime.useState(true),
    [realtimeOutputStatusSendIntervalSec, setRealtimeOutputStatusSendIntervalSec] = ReactRuntime.useState(2),
    [protocol, setProtocol] = ReactRuntime.useState("rest"),
    [recordForAnalysis, setRecordForAnalysis] = ReactRuntime.useState(false),
    [showSampleAudioButton, setShowSampleAudioButton] = ReactRuntime.useState(true);
  return ReactRuntime.useEffect(() => {
    (async () => {
      try {
        const pr = await loadSettings();
        pr && (setDisplayColorMode(pr.displayColorMode), setNodeInputGain(pr.nodeInputGain), setNodeOutputGain(pr.nodeOutputGain), setNodeMonitorGain(pr.nodeMonitorGain), setSelectedInputAudioDeviceId(pr.selectedInputAudioDeviceId), setOutputAudio(pr.outputAudio), setMonitorAudio(pr.monitorAudio), setInputAudioType(pr.inputAudioType), setSelectedLanguage(pr.selectedLanguage), setEnableEchoCancellation(pr.enableEchoCancellation ?? false), setEnableNoiseSuppression(pr.enableNoiseSuppression ?? false), setEnableNoiseSuppression2(pr.enableNoiseSuppression2 ?? false), setRealtimeOutputStatusEnabled(pr.realtimeOutputStatusEnabled ?? false), setRealtimeOutputStatusSendIntervalSec(pr.realtimeOutputStatusSendIntervalSec ?? 10), setProtocol(pr.protocol ?? "rest"), setRecordForAnalysis(pr.recordForAnalysis ?? false), setShowSampleAudioButton(pr.showSampleAudioButton ?? true));
      } catch (pr) {
        console.error("Failed to load settings:", pr);
      } finally {
        setSettingsLoaded(true);
      }
    })();
  }, []), ReactRuntime.useEffect(() => {
    if (!settingsLoaded) return;
    (async () => {
      try {
        await saveSettings({
          displayColorMode,
          nodeInputGain,
          nodeOutputGain,
          nodeMonitorGain,
          selectedInputAudioDeviceId,
          outputAudio,
          monitorAudio,
          inputAudioType,
          selectedLanguage,
          enableEchoCancellation,
          enableNoiseSuppression,
          enableNoiseSuppression2,
          realtimeOutputStatusEnabled,
          realtimeOutputStatusSendIntervalSec,
          protocol,
          recordForAnalysis,
          showSampleAudioButton
        });
      } catch (pr) {
        console.error("Failed to save settings:", pr);
      }
    })();
  }, [settingsLoaded, displayColorMode, nodeInputGain, nodeOutputGain, nodeMonitorGain, selectedInputAudioDeviceId, outputAudio, monitorAudio, inputAudioType, selectedLanguage, enableEchoCancellation, enableNoiseSuppression, enableNoiseSuppression2, realtimeOutputStatusEnabled, realtimeOutputStatusSendIntervalSec, protocol, recordForAnalysis, showSampleAudioButton]), ReactRuntime.useEffect(() => {
    setInputAudio(inputAudioType === "microphone" ? selectedInputAudioDeviceId : "none");
  }, [inputAudioType, selectedInputAudioDeviceId]), {
    displayColorMode,
    setDisplayColorMode,
    selectedLanguage,
    setSelectedLanguage,
    selectedInputAudioDeviceId,
    setSelectedInputAudioDeviceId,
    inputAudio,
    setInputAudio,
    inputAudioType,
    setInputAudioType,
    outputAudio,
    setOutputAudio,
    monitorAudio,
    setMonitorAudio,
    outputAudioElementId,
    setOutputAudioElementId,
    monitorAudioElementId,
    setMonitorAudioElementId,
    nodeInputGain,
    setNodeInputGain,
    nodeOutputGain,
    setNodeOutputGain,
    nodeMonitorGain,
    setNodeMonitorGain,
    enableEchoCancellation,
    setEnableEchoCancellation,
    enableNoiseSuppression,
    setEnableNoiseSuppression,
    enableNoiseSuppression2,
    setEnableNoiseSuppression2,
    isOutputRecording,
    setIsOutputRecording,
    outputRecord,
    setOutputRecord,
    isStarted,
    setIsStarted,
    protocol,
    setProtocol,
    isPassthrough,
    setIsPassthrough,
    realtimeOutputStatusEnabled,
    setRealtimeOutputStatusEnabled,
    recordForAnalysis,
    setRecordForAnalysis,
    showSampleAudioButton,
    setShowSampleAudioButton,
    realtimeOutputStatusSendIntervalSec,
    setRealtimeOutputStatusSendIntervalSec
  };
};
export { useGlobalSetting };
