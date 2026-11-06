// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import "../i18n/setup.js";
import { jsxRuntimeExports as jsxRuntime, reactExports as ReactRuntime, clientExports as ReactDOMClient, createTheme, ThemeProvider } from "../vendor/recovered-runtime.js";
import { App } from "./App.js";
import { AppRootProvider } from "../state/AppRootProvider.js";
import { AppStateProvider } from "../state/AppStateProvider.js";
import { HotkeyProvider } from "../state/HotkeyProvider.js";
import { LogViewer } from "../pages/LogViewer.js";
import { ConnectionGate } from "./ConnectionGate.js";
import { isNativeClient } from "../api/BackendClient.js";
const MainConnection = isNativeClient() ? ConnectionGate : ReactRuntime.Fragment;
const isLogViewer = new URLSearchParams(window.location.search).get("app_mode") === "LogViewer";
// The log window must not create audio devices, server state, or global shortcuts.
ReactDOMClient.createRoot(document.getElementById("root")).render(jsxRuntime.jsx(ReactRuntime.StrictMode, {
  children: isLogViewer ? jsxRuntime.jsx(ThemeProvider, {
    theme: createTheme(),
    children: jsxRuntime.jsx(LogViewer, {})
  }) : jsxRuntime.jsx(MainConnection, { children: jsxRuntime.jsx(AppRootProvider, {
    children: jsxRuntime.jsx(AppStateProvider, {
      children: jsxRuntime.jsx(HotkeyProvider, {
        children: jsxRuntime.jsx(App, {})
      })
    })
  }) })
}));
