// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { jsxRuntimeExports as jsxRuntime, reactExports as ReactRuntime, useTranslation, Button } from "../../vendor/recovered-runtime.js";
import { AdvancedSettingDialog } from "./AdvancedSettingDialog.js";
import { ShortcutSettingDialog } from "./ShortcutSettingDialog.js";
import { ConfirmDialog } from "../../components/common/ConfirmDialog.js";
import { invoke } from "../../platform/bridge.js";
const AdvancedArea = () => {
  const {
      t
    } = useTranslation(),
    [isAdvancedSettingsOpen, setAdvancedSettingsOpen] = ReactRuntime.useState(false),
    [isShortcutSettingsOpen, setShortcutSettingsOpen] = ReactRuntime.useState(false),
    [isClearDataConfirmationOpen, setClearDataConfirmationOpen] = ReactRuntime.useState(false),
    openLogViewer = () => {
      const ie = new URL(window.location.href);
      ie.searchParams.set("app_mode", "LogViewer");
      window.open(ie.toString(), "_blank");
    },
    openAdvancedSettings = () => {
      setAdvancedSettingsOpen(true);
    },
    openShortcutSettings = () => {
      setShortcutSettingsOpen(true);
    },
    openClearDataConfirmation = () => {
      setClearDataConfirmationOpen(true);
    },
    clearSiteDataAndStopApp = async () => {
      try {
        await invoke("set_clear_site_data_and_stop_app");
      } catch (ie) {
        console.error("Failed to clear site data and stop app:", ie);
      }
    },
    openExternalUrl = ReactRuntime.useCallback(async ie => {
      try {
        await invoke("open_browser_url", {
          url: ie
        });
      } catch (ne) {
        console.warn(t("common.links.url_open_failed"), ne);
        window.open(ie, "_blank", "noopener,noreferrer");
      }
    }, [t]);
  return jsxRuntime.jsxs("div", {
    style: {
      display: "flex",
      gap: "16px",
      marginTop: "16px",
      flexWrap: "wrap"
    },
    children: [jsxRuntime.jsx(Button, {
      size: "small",
      onClick: openLogViewer,
      children: t("common.advanced_area.log")
    }), jsxRuntime.jsx(Button, {
      size: "small",
      onClick: openAdvancedSettings,
      children: t("common.advanced_area.advanced_settings")
    }), jsxRuntime.jsx(Button, {
      size: "small",
      onClick: openShortcutSettings,
      children: t("common.advanced_area.key_settings")
    }), jsxRuntime.jsx(Button, {
      size: "small",
      onClick: () => openExternalUrl("https://github.com/w-okada/voice-changer"),
      children: t("common.advanced_area.github_repo")
    }), jsxRuntime.jsx(Button, {
      size: "small",
      onClick: openClearDataConfirmation,
      children: t("common.advanced_area.clear_site_data_and_restart")
    }), jsxRuntime.jsx(AdvancedSettingDialog, {
      open: isAdvancedSettingsOpen,
      onClose: () => setAdvancedSettingsOpen(false)
    }), jsxRuntime.jsx(ShortcutSettingDialog, {
      open: isShortcutSettingsOpen,
      onClose: () => setShortcutSettingsOpen(false)
    }), jsxRuntime.jsx(ConfirmDialog, {
      open: isClearDataConfirmationOpen,
      onClose: () => setClearDataConfirmationOpen(false),
      onConfirm: clearSiteDataAndStopApp,
      title: t("common.clear_site_data_confirm.title"),
      message: t("common.clear_site_data_confirm.message"),
      confirmText: t("common.dialog.confirm"),
      cancelText: t("common.dialog.cancel")
    })]
  });
};
export { AdvancedArea };
