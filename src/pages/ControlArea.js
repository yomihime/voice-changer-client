// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { jsxRuntimeExports as jsxRuntime, reactExports as ReactRuntime } from "../vendor/recovered-runtime.js";
import { useAppRoot } from "../state/app-root-context.js";
import { HeaderArea } from "../features/voice/HeaderArea.js";
import { PortraitArea } from "../features/voice/PortraitArea.js";
import { Controls } from "../features/audio-controls/Controls.js";
import { PerformanceArea } from "../features/performance/PerformanceArea.js";
const ControlArea = () => {
  const {
    currentSlotInfo
  } = useAppRoot();
  return ReactRuntime.useMemo(() => currentSlotInfo == null ? jsxRuntime.jsx(jsxRuntime.Fragment, {}) : jsxRuntime.jsxs("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      marginBottom: "30px",
      border: "1px solid #eee",
      borderRadius: "8px",
      padding: "20px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
      width: "100%"
    },
    children: [jsxRuntime.jsx(HeaderArea, {}), jsxRuntime.jsxs("div", {
      style: {
        display: "flex",
        gap: "10px",
        width: "100%"
      },
      children: [jsxRuntime.jsxs("div", {
        children: [jsxRuntime.jsx(PortraitArea, {}), jsxRuntime.jsx(PerformanceArea, {})]
      }), jsxRuntime.jsx(Controls, {})]
    })]
  }), [currentSlotInfo]);
};
export { ControlArea };
