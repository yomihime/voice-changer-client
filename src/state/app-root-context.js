// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { reactExports as ReactRuntime, useTranslation } from "../vendor/recovered-runtime.js";
const AppRootContext = ReactRuntime.createContext(null);
const useAppRoot = () => {
  const {
      t
    } = useTranslation(),
    C = ReactRuntime.useContext(AppRootContext);
  if (!C) throw new Error(t("common.error_messages.use_app_root_context_error"));
  return C;
};
export { useAppRoot, AppRootContext };
