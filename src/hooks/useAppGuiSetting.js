// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { reactExports as ReactRuntime, useTranslation } from "../vendor/recovered-runtime.js";
const defaultAppGuiSettings = {
  type: "demo",
  lang: ["en", "ja"],
  inputChunkSec: [0.1],
  extraFrameSec: [0.1]
};
const useAppGuiSetting = () => {
  const {
      t
    } = useTranslation(),
    [guiSettingLoaded, setGuiSettingLoaded] = ReactRuntime.useState(false),
    [guiSetting, setGuiSetting] = ReactRuntime.useState(defaultAppGuiSettings),
    [version, setVersion] = ReactRuntime.useState(t("common.app_info.unknown_version")),
    [edition, setEdition] = ReactRuntime.useState(t("common.app_info.unknown_edition"));
  return ReactRuntime.useEffect(() => {
    (async () => {
      const ee = await (await fetch("/assets/gui_settings/GUI.json", {
        method: "GET"
      })).json();
      setGuiSetting(ee);
    })();
  }, []), ReactRuntime.useEffect(() => {
    (async () => {
      const ee = await (await fetch("/assets/gui_settings/version.txt", {
        method: "GET"
      })).text();
      setVersion(ee);
    })();
  }, []), ReactRuntime.useEffect(() => {
    (async () => {
      const ee = await (await fetch("/assets/gui_settings/edition.txt", {
        method: "GET"
      })).text();
      setEdition(ee);
    })();
  }, []), ReactRuntime.useEffect(() => {
    version !== null && edition !== null && setGuiSettingLoaded(true);
  }, [version, edition]), {
    guiSettingLoaded,
    guiSetting,
    version,
    edition
  };
};
export { useAppGuiSetting };
