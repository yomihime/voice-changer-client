// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { reactExports as ReactRuntime, useTranslation } from "../vendor/recovered-runtime.js";
import { log$1 as logMessage } from "../shared/logger.js";
const codeFilename$2 = import.meta.url.split("/").pop();
const logPrefix$2 = `[${codeFilename$2}]`;
const useAudioConfig = options => {
  const {
      t
    } = useTranslation(),
    [audioContext, setAudioContext] = ReactRuntime.useState(null),
    [audioInputs, setAudioInputs] = ReactRuntime.useState([]),
    [audioOutputs, setAudioOutputs] = ReactRuntime.useState([]),
    audioContextCreationStartedRef = ReactRuntime.useRef(false);
  ReactRuntime.useEffect(() => {
    const ee = async () => {
        if (audioContextCreationStartedRef.current == true) return;
        audioContextCreationStartedRef.current = true;
        const ae = new URL(window.location.href).searchParams.get("sample_rate") || null;
        let se;
        ae ? ae == "default" ? (logMessage("info", logPrefix$2, "Sample rate: default"), se = new AudioContext()) : (logMessage("info", logPrefix$2, `Sample rate: ${ae}`), se = new AudioContext({
          sampleRate: Number(ae)
        })) : (logMessage("info", logPrefix$2, "Sample rate: default(48000)"), se = new AudioContext({
          sampleRate: 48e3
        }));
        await reloadDeviceInfo();
        logMessage("info", logPrefix$2, se);
        setAudioContext(se);
        document.removeEventListener("touchstart", te);
        document.removeEventListener("mousedown", te);
      },
      te = () => {
        setTimeout(() => {
          ee();
        }, options.createAudioContextDelay);
      };
    document.addEventListener("touchstart", te, false);
    document.addEventListener("mousedown", te, false);
  }, []);
  const reloadDeviceInfo = async () => {
    try {
      (await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true
      })).getTracks().forEach(ae => {
        ae.stop();
      });
    } catch (ne) {
      console.warn("Enumerate device error::", ne);
    }
    const ee = await navigator.mediaDevices.enumerateDevices(),
      te = ee.filter(ne => ne.kind == "audioinput");
    te.push({
      deviceId: "none",
      groupId: "none",
      kind: "audioinput",
      label: t("common.controls.device_none"),
      toJSON: () => {}
    });
    te.push({
      deviceId: "file",
      groupId: "file",
      kind: "audioinput",
      label: t("common.controls.device_file"),
      toJSON: () => {}
    });
    te.push({
      deviceId: "screen",
      groupId: "screen",
      kind: "audioinput",
      label: t("common.controls.device_system"),
      toJSON: () => {}
    });
    setAudioInputs(te);
    const ie = ee.filter(ne => ne.kind == "audiooutput");
    ie.push({
      deviceId: "none",
      groupId: "none",
      kind: "audiooutput",
      label: t("common.controls.device_none"),
      toJSON: () => {}
    });
    setAudioOutputs(ie);
  };
  return {
    audioContext,
    audioInputs,
    audioOutputs,
    reloadDeviceInfo
  };
};
export { useAudioConfig };
