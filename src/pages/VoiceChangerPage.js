// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { jsxRuntimeExports as jsxRuntime, reactExports as ReactRuntime } from "../vendor/recovered-runtime.js";
import { useAppRoot } from "../state/app-root-context.js";
import { useAppState } from "../state/app-state-context.js";
import { AUDIO_ELEMENT_FOR_PLAY_RESULT, AUDIO_ELEMENT_FOR_PLAY_MONITOR } from "../audio/elements.js";
import { LinkArea } from "../features/settings/LinkArea.js";
import { ModelSelector } from "../features/models/ModelSelector.js";
import { ControlArea } from "./ControlArea.js";
import { AdvancedArea } from "../features/settings/AdvancedArea.js";
function VoiceChangerPage() {
  const {
      edition,
      version
    } = useAppRoot(),
    {
      setOutputAudioElementId,
      setMonitorAudioElementId
    } = useAppState();
  return ReactRuntime.useEffect(() => {
    setOutputAudioElementId(AUDIO_ELEMENT_FOR_PLAY_RESULT);
    setMonitorAudioElementId(AUDIO_ELEMENT_FOR_PLAY_MONITOR);
  }, []), jsxRuntime.jsxs("div", {
    style: {
      maxWidth: "1200px",
      margin: "0 auto",
      padding: "20px",
      width: "100%"
    },
    children: [jsxRuntime.jsxs("h2", {
      children: ["Realtime Voice Changer Client", " ", jsxRuntime.jsxs("span", {
        style: {
          fontSize: "1rem",
          color: "gray"
        },
        children: ["ver ", version, " ", edition]
      })]
    }), jsxRuntime.jsx(LinkArea, {}), jsxRuntime.jsx(ModelSelector, {}), jsxRuntime.jsx(ControlArea, {}), jsxRuntime.jsx(AdvancedArea, {}), jsxRuntime.jsxs("div", {
      children: [jsxRuntime.jsx("audio", {
        hidden: true,
        id: AUDIO_ELEMENT_FOR_PLAY_RESULT
      }), jsxRuntime.jsx("audio", {
        hidden: true,
        id: AUDIO_ELEMENT_FOR_PLAY_MONITOR
      })]
    })]
  });
}
export { VoiceChangerPage as Demo };
