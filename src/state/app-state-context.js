// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { reactExports as ReactRuntime, useTranslation } from "../vendor/recovered-runtime.js";
const AppStateContext = ReactRuntime.createContext(null);
const useAppState = () => {
  const {
      t
    } = useTranslation(),
    C = ReactRuntime.useContext(AppStateContext);
  if (!C) throw new Error(t("common.error_messages.use_app_state_context_error"));
  return C;
};
export { useAppState, AppStateContext };
