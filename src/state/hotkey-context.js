// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { reactExports as ReactRuntime, useTranslation } from "../vendor/recovered-runtime.js";
const HotkeyContext = ReactRuntime.createContext(null);
const useHotkey = () => {
  const {
      t
    } = useTranslation(),
    C = ReactRuntime.useContext(HotkeyContext);
  if (!C) throw new Error(t("common.error_messages.use_hotkey_context_error"));
  return C;
};
export { useHotkey, HotkeyContext };
