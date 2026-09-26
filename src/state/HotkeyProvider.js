// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { jsxRuntimeExports as jsxRuntime } from "../vendor/recovered-runtime.js";
import { HotkeyContext } from "./hotkey-context.js";
import { useHotKeySetting } from "../hooks/useHotKeySetting.js";
const HotkeyProvider = ({
  children
}) => {
  const contextValue = {
    ...useHotKeySetting()
  };
  return jsxRuntime.jsx(HotkeyContext.Provider, {
    value: contextValue,
    children
  });
};
export { HotkeyProvider };
