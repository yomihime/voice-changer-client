// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { jsxRuntimeExports as jsxRuntime, reactExports as ReactRuntime, useTranslation, Tooltip, IconButton, FormControl, MenuItem, Select, Stack, LightModeIcon, DarkModeIcon, LanguageIcon, DownloadIcon, instance } from "../../vendor/recovered-runtime.js";
import { useAppRoot } from "../../state/app-root-context.js";
import { useAppState } from "../../state/app-state-context.js";
import { ConfirmationDialog } from "../../components/common/ConfirmationDialog.js";
const languageNativeNames = {
  en: "English",
  ja: "日本語",
  ko: "한국어",
  de: "Deutsch",
  ar: "العربية",
  el: "Ελληνικά",
  es: "Español",
  fr: "Français",
  it: "Italiano",
  la: "Latina",
  ms: "Bahasa Melayu",
  ru: "Русский",
  zh: "中文"
};
const LinkArea = () => {
  const {
      displayColorMode,
      setDisplayColorMode,
      setSelectedLanguage,
      selectedLanguage
    } = useAppState(),
    {
      initializeServer,
      guiSetting
    } = useAppRoot(),
    [x, T] = ReactRuntime.useState(false),
    {
      t
    } = useTranslation(),
    O = ReactRuntime.useCallback(te => {
      setSelectedLanguage(te.target.value);
      instance.changeLanguage(te.target.value);
    }, [setSelectedLanguage]),
    H = ReactRuntime.useCallback(() => {
      setDisplayColorMode(displayColorMode === "light" ? "dark" : "light");
    }, [displayColorMode, setDisplayColorMode]);
  return ReactRuntime.useMemo(() => jsxRuntime.jsxs("div", {
    style: {
      display: "flex",
      justifyContent: "flex-start",
      alignItems: "center",
      marginBottom: "20px",
      marginTop: "20px"
    },
    children: [guiSetting.lang && jsxRuntime.jsx(FormControl, {
      size: "small",
      sx: {
        minWidth: 120,
        marginRight: 2
      },
      children: jsxRuntime.jsx(Select, {
        value: selectedLanguage,
        onChange: O,
        sx: {
          height: "32px",
          fontSize: "13px"
        },
        startAdornment: jsxRuntime.jsx(LanguageIcon, {
          sx: {
            fontSize: "1.2rem",
            marginRight: 1
          }
        }),
        children: guiSetting.lang.map(te => jsxRuntime.jsx(MenuItem, {
          value: te,
          children: languageNativeNames[te] || te.toUpperCase()
        }, te))
      })
    }), jsxRuntime.jsx(Tooltip, {
      title: t(`common.theme.${displayColorMode === "light" ? "dark" : "light"}`),
      children: jsxRuntime.jsx(IconButton, {
        onClick: H,
        color: "default",
        size: "small",
        sx: {
          px: 1.5,
          marginLeft: "10px",
          border: "2px solid",
          borderColor: "grey.300",
          borderRadius: "8px",
          "&:hover": {
            borderColor: "primary.main"
          },
          height: "32px"
        },
        children: jsxRuntime.jsx(Stack, {
          alignItems: "center",
          direction: "row",
          sx: {
            height: "18px"
          },
          children: displayColorMode === "light" ? jsxRuntime.jsx(DarkModeIcon, {
            sx: {
              fontSize: "18px"
            }
          }) : jsxRuntime.jsx(LightModeIcon, {
            sx: {
              fontSize: "18px"
            }
          })
        })
      })
    }), jsxRuntime.jsx(Tooltip, {
      title: t("common.initialize.button"),
      children: jsxRuntime.jsx(IconButton, {
        onClick: () => {
          T(true);
        },
        color: "default",
        size: "small",
        sx: {
          px: 1.5,
          marginLeft: "20px",
          border: "2px solid",
          borderColor: "grey.300",
          borderRadius: "8px",
          "&:hover": {
            borderColor: "primary.main"
          },
          height: "32px"
        },
        children: jsxRuntime.jsx(Stack, {
          alignItems: "center",
          justifyContent: "center",
          sx: {
            height: "18px"
          },
          children: jsxRuntime.jsx("span", {
            style: {
              fontSize: "13px",
              whiteSpace: "nowrap"
            },
            children: t("common.initialize.button")
          })
        })
      })
    }), jsxRuntime.jsx(Tooltip, {
      title: t("common.links.download_native_client"),
      children: jsxRuntime.jsx("a", {
        href: "/native_client/voice-changer-native-client-win.exe",
        download: "voice-changer-native-client-win.exe",
        style: {
          textDecoration: "none"
        },
        children: jsxRuntime.jsx(IconButton, {
          color: "default",
          size: "small",
          sx: {
            px: 1.5,
            marginLeft: "10px",
            border: "2px solid",
            borderColor: "grey.300",
            borderRadius: "8px",
            "&:hover": {
              borderColor: "primary.main"
            },
            height: "32px"
          },
          children: jsxRuntime.jsxs(Stack, {
            alignItems: "center",
            direction: "row",
            sx: {
              height: "18px"
            },
            children: [jsxRuntime.jsx(DownloadIcon, {
              sx: {
                fontSize: "18px",
                marginRight: "5px"
              }
            }), jsxRuntime.jsx("span", {
              style: {
                fontSize: "13px",
                whiteSpace: "nowrap"
              },
              children: t("common.links.download_native_client")
            })]
          })
        })
      })
    }), jsxRuntime.jsx(ConfirmationDialog, {
      isOpen: x,
      title: t("common.initialize.confirm_title"),
      message: t("common.initialize.confirm_message"),
      confirmButtonText: t("common.initialize.confirm"),
      cancelButtonText: t("common.initialize.cancel"),
      onConfirm: async () => {
        await initializeServer();
        T(false);
      },
      onCancel: () => {
        T(false);
      }
    })]
  }), [initializeServer, guiSetting.lang, x, t, O, H, selectedLanguage, displayColorMode]);
};
export { LinkArea };
