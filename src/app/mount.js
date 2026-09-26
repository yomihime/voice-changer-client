// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import "../i18n/setup.js";
import { jsxRuntimeExports as jsxRuntime, reactExports as ReactRuntime, clientExports as ReactDOMClient } from "../vendor/recovered-runtime.js";
import { App } from "./App.js";
import { AppRootProvider } from "../state/AppRootProvider.js";
import { AppStateProvider } from "../state/AppStateProvider.js";
import { HotkeyProvider } from "../state/HotkeyProvider.js";
ReactDOMClient.createRoot(document.getElementById("root")).render(jsxRuntime.jsx(ReactRuntime.StrictMode, {
  children: jsxRuntime.jsx(AppRootProvider, {
    children: jsxRuntime.jsx(AppStateProvider, {
      children: jsxRuntime.jsx(HotkeyProvider, {
        children: jsxRuntime.jsx(App, {})
      })
    })
  })
}));
