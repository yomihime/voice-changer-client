// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { jsxRuntimeExports as jsxRuntime, reactExports as ReactRuntime, useTranslation, y as toast, libExports } from "../vendor/recovered-runtime.js";
import { AppRootContext } from "./app-root-context.js";
import { log$1 as logMessage } from "../shared/logger.js";
import { useAppGuiSetting } from "../hooks/useAppGuiSetting.js";
import { useAudioConfig } from "../hooks/useAudioConfig.js";
import { useServerConfig } from "../hooks/useServerConfig.js";
const AppRootProvider = ({
  children
}) => {
  const {
      t
    } = useTranslation(),
    triggerToast = ReactRuntime.useCallback((se, ce) => {
      toast.info(ce, {
        type: se,
        position: "bottom-right",
        autoClose: 3e3,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: void 0,
        theme: "light"
      });
    }, []),
    [isUnhandledRejectionToastEnabled, setUnhandledRejectionToastEnabled] = ReactRuntime.useState(true),
    audioConfig = useAudioConfig({
      createAudioContextDelay: libExports.isMobile ? 2e3 : 0
    }),
    guiConfig = useAppGuiSetting(),
    serverConfigOptions = ReactRuntime.useMemo(() => ({
      flatPath: false,
      triggerToast
    }), [triggerToast]),
    serverConfig = useServerConfig(serverConfigOptions),
    [appMode, setAppMode] = ReactRuntime.useState("App"),
    [currentSlotInfo, setCurrentSlotInfo] = ReactRuntime.useState(null),
    origin = window.location.origin;
  ReactRuntime.useEffect(() => {
    const fe = new URL(window.location.href).searchParams.get("app_mode") || null;
    fe == "Test" ? setAppMode("Test") : fe == "LogViewer" ? setAppMode("LogViewer") : fe == "JsonViewer" ? setAppMode("JsonViewer") : setAppMode("App");
  }, []);
  ReactRuntime.useEffect(() => {
    if (serverConfig.serverConfiguration == null) return;
    const se = serverConfig.serverConfiguration.current_slot_index,
      ce = serverConfig.serverSlotInfos.find(fe => fe.slot_index === se);
    setCurrentSlotInfo(ce ?? null);
  }, [serverConfig.serverConfiguration, serverConfig.serverSlotInfos]);
  const handleUnhandledRejection = ReactRuntime.useCallback(se => {
    const ce = se.reason;
    logMessage("error", "Unhandled Rejection", ce);
    logMessage("error", "Unhandled Rejection", t("common.error_messages.unhandled_rejection_possible_cause"));
    logMessage("error", "Unhandled Rejection EVENT", se);
    se.preventDefault();
  }, [t]);
  ReactRuntime.useEffect(() => (window.addEventListener("unhandledrejection", handleUnhandledRejection), () => {
    window.removeEventListener("unhandledrejection", handleUnhandledRejection);
  }), [isUnhandledRejectionToastEnabled, handleUnhandledRejection]);
  const contextValue = {
    ...audioConfig,
    ...guiConfig,
    ...serverConfig,
    appMode,
    currentSlotInfo,
    setAppMode,
    origin,
    triggerToast,
    setUnhandledRejectionToastEnabled
  };
  return jsxRuntime.jsx(AppRootContext.Provider, {
    value: contextValue,
    children
  });
};
export { AppRootProvider };
