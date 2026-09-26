// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { jsxRuntimeExports as jsxRuntime, reactExports as ReactRuntime, useTranslation, Tooltip, IconButton, FormControl, MenuItem, Select } from "../../vendor/recovered-runtime.js";
import { useAppRoot } from "../../state/app-root-context.js";
import { log$1 as logMessage } from "../../shared/logger.js";
import { useAppState } from "../../state/app-state-context.js";
import { Edit } from "../../components/icons.js";
import { VoiceCharacterEditDialog } from "./VoiceCharacterEditDialog.js";
const codeFilename$4 = import.meta.url.split("/").pop();
const logPrefix$4 = `[${codeFilename$4}]`;
const PortraitArea = () => {
  const {
      currentSlotInfo,
      updateServerSlotInfo
    } = useAppRoot(),
    {
      setOutputBufferSizeCallback
    } = useAppState(),
    [w, R] = ReactRuntime.useState(false),
    {
      t
    } = useTranslation();
  ReactRuntime.useEffect(() => {
    const ie = document.getElementById("outputBufferSize");
    setOutputBufferSizeCallback(ne => {
      ie != null && (ie.textContent = ne.toString());
    });
  }, [setOutputBufferSizeCallback]);
  const x = ReactRuntime.useCallback(ie => {
      if (currentSlotInfo == null || currentSlotInfo.voice_changer_type !== "Beatrice_v2") return null;
      const ne = currentSlotInfo,
        ae = ne.model_info.voice[ie],
        ce = ne.toml_file.replace(/\\\\/g, "/").replace(/\\/g, "/");
      return ce.substring(0, ce.lastIndexOf("/")) + "/" + ae.portrait.path.split(/[/\\]/).pop();
    }, [currentSlotInfo]),
    T = ReactRuntime.useMemo(() => currentSlotInfo == null ? null : currentSlotInfo.voice_changer_type === "RVC" ? currentSlotInfo.icon_file != null ? "model_dir/" + currentSlotInfo.slot_index + "/" + currentSlotInfo.icon_file.split(/[/\\]/).pop() : "./assets/icons/human.png" : currentSlotInfo.voice_changer_type === "Beatrice_v2" ? x(currentSlotInfo.dst_id) : (logMessage("error", logPrefix$4, "currentSlotInfo.voice_changer_type is not supported"), null), [currentSlotInfo, x]),
    A = ReactRuntime.useMemo(() => {
      if (currentSlotInfo == null || currentSlotInfo.voice_changer_type === "RVC") return null;
      if (currentSlotInfo.voice_changer_type === "Beatrice_v2") {
        const ie = currentSlotInfo;
        return ie.model_info.voice[ie.dst_id];
      }
      return logMessage("error", logPrefix$4, "currentSlotInfo.voice_changer_type is not supported"), null;
    }, [currentSlotInfo]),
    O = ReactRuntime.useMemo(() => {
      if (currentSlotInfo == null || currentSlotInfo.voice_changer_type === "RVC") return null;
      if (currentSlotInfo.voice_changer_type === "Beatrice_v2") {
        const ie = currentSlotInfo,
          ae = Object.values(ie.model_info.voice).map((se, ce) => {
            const fe = x(ce);
            return jsxRuntime.jsxs(MenuItem, {
              value: ce,
              sx: {
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "8px 12px",
                "&:hover": {
                  backgroundColor: "action.hover"
                }
              },
              children: [jsxRuntime.jsx("div", {
                style: {
                  width: "40px",
                  height: "40px",
                  borderRadius: "4px",
                  overflow: "hidden",
                  flexShrink: 0
                },
                children: fe ? jsxRuntime.jsx("img", {
                  src: fe,
                  alt: se.name,
                  style: {
                    width: "100%",
                    height: "100%",
                    objectFit: "cover"
                  }
                }) : jsxRuntime.jsx("div", {
                  style: {
                    width: "100%",
                    height: "100%",
                    backgroundColor: "action.hover",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "20px",
                    color: "text.secondary"
                  },
                  children: se.name.charAt(0)
                })
              }), jsxRuntime.jsxs("div", {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flex: 1
                },
                children: [jsxRuntime.jsx("span", {
                  style: {
                    fontWeight: 500
                  },
                  children: se.name
                }), jsxRuntime.jsxs("span", {
                  style: {
                    color: "#666",
                    fontSize: "0.85em"
                  },
                  children: ["(", se.average_pitch, ")"]
                })]
              })]
            }, ce);
          });
        return jsxRuntime.jsxs(jsxRuntime.Fragment, {
          children: [jsxRuntime.jsx("div", {
            style: {
              display: "flex",
              alignItems: "center",
              marginBottom: "10px"
            },
            children: jsxRuntime.jsx("label", {
              style: {
                display: "block",
                fontWeight: "bold",
                flex: 1
              },
              children: t("common.voice.character")
            })
          }), jsxRuntime.jsx(FormControl, {
            fullWidth: true,
            children: jsxRuntime.jsx(Select, {
              value: ie.dst_id,
              onChange: async se => {
                const ce = se.target.value,
                  fe = {
                    ...ie,
                    dst_id: ce
                  };
                await updateServerSlotInfo(fe);
              },
              sx: {
                backgroundColor: "background.paper",
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "divider"
                },
                "&:hover .MuiOutlinedInput-notchedOutline": {
                  borderColor: "action.active"
                },
                "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                  borderColor: "primary.main"
                },
                borderRadius: "8px",
                "& .MuiSelect-select": {
                  padding: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px"
                }
              },
              MenuProps: {
                PaperProps: {
                  sx: {
                    borderRadius: "8px",
                    marginTop: "8px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.1)"
                  }
                },
                TransitionProps: {
                  timeout: {
                    enter: 10,
                    exit: 5
                  }
                }
              },
              children: ae
            })
          })]
        });
      }
      return null;
    }, [currentSlotInfo, x, updateServerSlotInfo, t]),
    H = ReactRuntime.useMemo(() => currentSlotInfo == null || currentSlotInfo.voice_changer_type === "RVC" ? null : jsxRuntime.jsx("div", {
      style: {
        width: "320px",
        padding: "10px",
        backgroundColor: "#f5f5f5",
        borderRadius: "4px",
        fontSize: "14px",
        color: "darkslategrey",
        maxHeight: "100px",
        overflowY: "auto"
      },
      children: A != null ? A.description : t("common.voice.no_description")
    }), [currentSlotInfo, A, t]),
    ee = ReactRuntime.useMemo(() => currentSlotInfo == null || currentSlotInfo.voice_changer_type === "RVC" ? null : jsxRuntime.jsx("div", {
      style: {
        marginTop: "8px",
        display: "flex",
        justifyContent: "flex-start"
      },
      children: jsxRuntime.jsx(Tooltip, {
        title: t("common.voice.edit_tooltip"),
        children: jsxRuntime.jsx(IconButton, {
          size: "small",
          onClick: () => R(true),
          children: jsxRuntime.jsx(Edit, {
            fontSize: "small"
          })
        })
      })
    }), [currentSlotInfo, t, R]);
  return ReactRuntime.useMemo(() => currentSlotInfo == null ? jsxRuntime.jsx(jsxRuntime.Fragment, {}) : jsxRuntime.jsxs("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "20px"
    },
    children: [O, jsxRuntime.jsx("div", {
      style: {
        width: "320px",
        height: "320px",
        borderRadius: "8px",
        overflow: "hidden",
        border: "1px solid #eee",
        marginRight: "20px",
        flexShrink: 0
      },
      children: T ? jsxRuntime.jsx("img", {
        src: T,
        style: {
          width: "100%",
          height: "100%",
          objectFit: "scale-down"
        }
      }) : jsxRuntime.jsx("div", {
        style: {
          width: "100%",
          height: "100%",
          backgroundColor: "action.hover",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "120px",
          fontWeight: "bold",
          color: "text.secondary"
        },
        children: A?.name?.charAt(0).toUpperCase()
      })
    }), H, ee, jsxRuntime.jsx(VoiceCharacterEditDialog, {
      open: w,
      onClose: () => R(false)
    })]
  }), [currentSlotInfo, w, T, O, H, ee, A?.name]);
};
export { PortraitArea };
