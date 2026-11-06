// Device enumeration never grants microphone permission or starts audio.
import { reactExports as ReactRuntime, useTranslation } from "../vendor/recovered-runtime.js";
import { log$1 as logMessage } from "../shared/logger.js";
import { backendClient } from "../api/BackendClient.js";

const useAudioConfig = options => {
  const { t } = useTranslation();
  const [audioContext, setAudioContext] = ReactRuntime.useState(null);
  const [audioInputs, setAudioInputs] = ReactRuntime.useState([]);
  const [audioOutputs, setAudioOutputs] = ReactRuntime.useState([]);
  const lifecycleRef = ReactRuntime.useRef(null);
  const reloadRef = ReactRuntime.useRef(null);

  const reloadDeviceInfo = ReactRuntime.useCallback(async () => {
    const lifecycle = lifecycleRef.current;
    if (!lifecycle?.active) return;
    const devices = await navigator.mediaDevices.enumerateDevices();
    if (!lifecycle.active) return;
    const option = (deviceId, label, kind) => ({ deviceId, groupId: deviceId, kind, label, toJSON() {} });
    setAudioInputs([
      option("default", "システム既定（変更に追従）", "audioinput"),
      ...devices.filter(device => device.kind === "audioinput" && device.deviceId !== "default"),
      option("none", t("common.controls.device_none"), "audioinput"),
      option("file", t("common.controls.device_file"), "audioinput"),
      option("screen", t("common.controls.device_system"), "audioinput")
    ]);
    setAudioOutputs([
      option("default", "システム既定（変更に追従）", "audiooutput"),
      ...devices.filter(device => device.kind === "audiooutput" && device.deviceId !== "default"),
      option("none", t("common.controls.device_none"), "audiooutput")
    ]);
  }, [t]);
  reloadRef.current = reloadDeviceInfo;

  const ensureAudioContext = ReactRuntime.useCallback(async () => {
    const lifecycle = lifecycleRef.current;
    if (!lifecycle?.active) return null;
    if (lifecycle.context && lifecycle.context.state !== "closed") return lifecycle.context;
    if (!lifecycle.pending) {
      lifecycle.pending = Promise.resolve().then(async () => {
        let context;
        try {
          const requested = new URL(window.location.href).searchParams.get("sample_rate");
          context = requested === "default" ? new AudioContext() : new AudioContext({
            sampleRate: requested == null ? 48000 : Number(requested)
          });
          lifecycle.context = context;
          await context.resume?.();
          if (!lifecycle.active) {
            if (context.state !== "closed") await context.close();
            return null;
          }
          await reloadDeviceInfo();
          if (!lifecycle.active) return null;
          setAudioContext(context);
          return context;
        } catch (error) {
          if (context && context.state !== "closed") await context.close();
          lifecycle.context = null;
          throw error;
        } finally {
          lifecycle.pending = null;
        }
      });
    }
    return lifecycle.pending;
  }, [reloadDeviceInfo]);

  ReactRuntime.useEffect(() => {
    const lifecycle = { active: true, context: null, pending: null };
    lifecycleRef.current = lifecycle;
    const refresh = () => reloadRef.current().catch(error => logMessage("error", "audio-devices", error));
    const dispose = () => {
      lifecycle.active = false;
      navigator.mediaDevices.removeEventListener?.("devicechange", refresh);
      if (lifecycle.context && lifecycle.context.state !== "closed") {
        lifecycle.context.close().catch(error => logMessage("error", "audio-devices", error));
      }
    };
    navigator.mediaDevices.addEventListener?.("devicechange", refresh);
    refresh();
    const unsubscribe = backendClient.onInvalidate(dispose);
    return () => { unsubscribe(); dispose(); };
  }, []);

  return { audioContext, audioInputs, audioOutputs, reloadDeviceInfo, ensureAudioContext };
};
export { useAudioConfig };
