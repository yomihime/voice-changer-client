// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { jsxRuntimeExports as jsxRuntime, reactExports as ReactRuntime, useTranslation, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from "../../vendor/recovered-runtime.js";
import { useAppRoot } from "../../state/app-root-context.js";
import { log$1 as logMessage } from "../../shared/logger.js";
const codeFilename$5 = import.meta.url.split("/").pop();
const logPrefix$5 = `[${codeFilename$5}]`;
const VoiceCharacterEditDialog = ({
  open,
  onClose
}) => {
  const {
      currentSlotInfo,
      updateBeatriceV2VoiceName,
      updateBeatriceV2VoiceDescription,
      uploadBeatriceV2VoiceIconFile,
      triggerToast
    } = useAppRoot(),
    {
      t
    } = useTranslation(),
    A = ReactRuntime.useMemo(() => {
      if (currentSlotInfo == null || currentSlotInfo.voice_changer_type === "RVC") return null;
      if (currentSlotInfo.voice_changer_type === "Beatrice_v2") {
        const de = currentSlotInfo;
        return de.model_info.voice[de.dst_id];
      }
      return logMessage("error", logPrefix$5, "currentSlotInfo.voice_changer_type is not supported"), null;
    }, [currentSlotInfo]),
    [O, H] = ReactRuntime.useState(A?.name || ""),
    [ee, te] = ReactRuntime.useState(A?.description || ""),
    [ie, ne] = ReactRuntime.useState(null),
    [ae, se] = ReactRuntime.useState(""),
    [ce, fe] = ReactRuntime.useState(""),
    pe = ReactRuntime.useCallback(de => {
      if (currentSlotInfo == null || currentSlotInfo.voice_changer_type !== "Beatrice_v2") return null;
      const he = currentSlotInfo,
        me = he.model_info.voice[de],
        be = he.toml_file.replace(/\\\\/g, "/").replace(/\\/g, "/");
      return be.substring(0, be.lastIndexOf("/")) + "/" + me.portrait.path.split(/[/\\]/).pop();
    }, [currentSlotInfo]);
  return ReactRuntime.useEffect(() => {
    if (open && A) {
      H(A.name);
      te(A.description);
      ne(null);
      fe("");
      const he = pe(currentSlotInfo.dst_id);
      se(he || "./assets/icons/human.png");
    }
  }, [open, A, currentSlotInfo, pe]), ReactRuntime.useEffect(() => (open || (ae && ae.startsWith("blob:") && URL.revokeObjectURL(ae), ce && URL.revokeObjectURL(ce)), () => {
    ae && ae.startsWith("blob:") && URL.revokeObjectURL(ae);
    ce && URL.revokeObjectURL(ce);
  }), [open, ae, ce]), ReactRuntime.useMemo(() => {
    if (!currentSlotInfo || !A) return null;
    const de = () => {
        ne(null);
        onClose();
      },
      he = async () => {
        if (!currentSlotInfo || currentSlotInfo.voice_changer_type !== "Beatrice_v2") {
          onClose();
          return;
        }
        const ye = currentSlotInfo,
          be = ye.slot_index,
          ve = ye.dst_id;
        try {
          O !== A?.name && (await updateBeatriceV2VoiceName(be, ve, O));
          ee !== A?.description && (await updateBeatriceV2VoiceDescription(be, ve, ee));
          ie && (await uploadBeatriceV2VoiceIconFile(be, ve, ie, () => {}));
          triggerToast("success", t("common.voice_character_editor.save_success"));
        } catch {
          triggerToast("error", t("common.voice_character_editor.save_error"));
        }
        onClose();
      },
      me = ye => {
        if (ye.target.files && ye.target.files[0]) {
          const be = ye.target.files[0];
          ne(be);
          ce && URL.revokeObjectURL(ce);
          fe(URL.createObjectURL(be));
        }
      };
    return jsxRuntime.jsxs(Dialog, {
      open,
      onClose: de,
      maxWidth: "sm",
      fullWidth: true,
      children: [jsxRuntime.jsx(DialogTitle, {
        children: t("common.voice_character_editor.title")
      }), jsxRuntime.jsx(DialogContent, {
        children: jsxRuntime.jsxs(Box, {
          sx: {
            display: "flex",
            flexDirection: "column",
            gap: 2,
            mt: 2
          },
          children: [jsxRuntime.jsx(TextField, {
            label: t("common.voice_character_editor.name"),
            value: O,
            onChange: ye => H(ye.target.value),
            fullWidth: true
          }), jsxRuntime.jsx(TextField, {
            label: t("common.voice_character_editor.description"),
            value: ee,
            onChange: ye => te(ye.target.value),
            multiline: true,
            rows: 4,
            fullWidth: true
          }), jsxRuntime.jsxs(Box, {
            children: [jsxRuntime.jsx("input", {
              accept: "image/*",
              style: {
                display: "none"
              },
              id: "icon-file",
              type: "file",
              onChange: me
            }), jsxRuntime.jsx("label", {
              htmlFor: "icon-file",
              children: jsxRuntime.jsx(Button, {
                variant: "outlined",
                component: "span",
                children: t("common.voice_character_editor.select_icon")
              })
            }), jsxRuntime.jsxs(Box, {
              sx: {
                mt: 2,
                display: "flex",
                gap: 2,
                alignItems: "center"
              },
              children: [ae && jsxRuntime.jsxs(Box, {
                children: [jsxRuntime.jsx(Box, {
                  sx: {
                    mb: 1,
                    color: "text.secondary"
                  },
                  children: t("common.voice_character_edit_dialog.current_icon")
                }), jsxRuntime.jsx("img", {
                  src: ae,
                  alt: t("common.voice_character_edit_dialog.current_icon"),
                  style: {
                    width: "100px",
                    height: "100px",
                    objectFit: "cover",
                    borderRadius: "4px"
                  }
                })]
              }), ce && jsxRuntime.jsxs(Box, {
                children: [jsxRuntime.jsx(Box, {
                  sx: {
                    mb: 1,
                    color: "text.secondary"
                  },
                  children: t("common.voice_character_edit_dialog.new_icon")
                }), jsxRuntime.jsx("img", {
                  src: ce,
                  alt: t("common.voice_character_edit_dialog.new_icon"),
                  style: {
                    width: "100px",
                    height: "100px",
                    objectFit: "cover",
                    borderRadius: "4px"
                  }
                })]
              })]
            })]
          })]
        })
      }), jsxRuntime.jsxs(DialogActions, {
        children: [jsxRuntime.jsx(Button, {
          onClick: de,
          children: t("common.voice_character_editor.cancel")
        }), jsxRuntime.jsx(Button, {
          onClick: he,
          variant: "contained",
          color: "primary",
          children: t("common.voice_character_editor.save")
        })]
      })]
    });
  }, [open, A, O, ee, ae, ce, onClose, currentSlotInfo, updateBeatriceV2VoiceName, updateBeatriceV2VoiceDescription, uploadBeatriceV2VoiceIconFile, triggerToast, ie, t]);
};
export { VoiceCharacterEditDialog };
