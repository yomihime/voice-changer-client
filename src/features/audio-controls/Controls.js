// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { jsxRuntimeExports as jsxRuntime, reactExports as ReactRuntime } from "../../vendor/recovered-runtime.js";
import { useAppRoot } from "../../state/app-root-context.js";
import { MainControls } from "./MainControls.js";
import { InputControls } from "./InputControls.js";
import { VolumeControls } from "./VolumeControls.js";
import { VoiceControls } from "../voice/VoiceControls.js";
const Controls = () => {
  const {
    currentSlotInfo
  } = useAppRoot();
  return ReactRuntime.useMemo(() => currentSlotInfo == null ? null : jsxRuntime.jsx("div", {
    style: {
      flex: 1,
      width: "calc(100% - 340px)"
    },
    children: jsxRuntime.jsxs("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "0px",
        justifyContent: "center",
        width: "100%"
      },
      children: [jsxRuntime.jsx(MainControls, {}), jsxRuntime.jsx(InputControls, {}), jsxRuntime.jsx(VolumeControls, {}), jsxRuntime.jsx(VoiceControls, {})]
    })
  }), [currentSlotInfo]);
};
export { Controls };
