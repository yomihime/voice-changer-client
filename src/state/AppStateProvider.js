// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { jsxRuntimeExports as jsxRuntime, reactExports as ReactRuntime } from "../vendor/recovered-runtime.js";
import { useAppRoot } from "./app-root-context.js";
import { AppStateContext } from "./app-state-context.js";
import { useGlobalSetting } from "../hooks/useGlobalSetting.js";
import { useVoiceChangerClient } from "../hooks/useVoiceChangerClient.js";
const AppStateProvider = ({
  children
}) => {
  const {
      audioContext,
      triggerToast
    } = useAppRoot(),
    globalSettings = useGlobalSetting(),
    voiceChangerClientState = useVoiceChangerClient({
      globaSetting: globalSettings,
      ctx: audioContext,
      triggerToast
    });
  ReactRuntime.useEffect(() => (console.log("AppStateProvider mounted"), () => {
    console.log("AppStateProvider unmounted");
  }), []);
  const contextValue = {
    ...globalSettings,
    ...voiceChangerClientState
  };
  return jsxRuntime.jsx(AppStateContext.Provider, {
    value: contextValue,
    children
  });
};
export { AppStateProvider };
