// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { jsxRuntimeExports as jsxRuntime, reactExports as ReactRuntime, Lt as ToastContainer, createTheme, ThemeProvider } from "../vendor/recovered-runtime.js";
import { useAppRoot } from "../state/app-root-context.js";
import { LogViewer } from "../pages/LogViewer.js";
import { useAppState } from "../state/app-state-context.js";
import { Demo as VoiceChangerPage } from "../pages/VoiceChangerPage.js";
function App() {
  const {
      appMode
    } = useAppRoot(),
    {
      displayColorMode
    } = useAppState(),
    theme = ReactRuntime.useMemo(() => displayColorMode == "light" ? (document.body.classList.toggle("dark-mode", false), createTheme({
      palette: {
        mode: "light"
      }
    })) : (document.body.classList.toggle("dark-mode", true), createTheme({
      palette: {
        mode: "dark"
      }
    })), [displayColorMode]),
    page = ReactRuntime.useMemo(() => {
      if (appMode === "App") return jsxRuntime.jsx(VoiceChangerPage, {});
      if (appMode === "LogViewer") return jsxRuntime.jsx(LogViewer, {});
    }, [appMode]);
  return jsxRuntime.jsxs(ThemeProvider, {
    theme,
    children: [page, jsxRuntime.jsx(ToastContainer, {
      style: {
        zIndex: 2001
      }
    })]
  });
}
export { App };
