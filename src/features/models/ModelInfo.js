// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { jsxRuntimeExports as jsxRuntime, reactExports as ReactRuntime, useTranslation, useTheme, IconButton, Stack } from "../../vendor/recovered-runtime.js";
import { useAppRoot } from "../../state/app-root-context.js";
import { TagIcon } from "../../components/icons.js";
const ModelInfo = ({
  model
}) => {
  const {
      serverSlotInfos,
      updateServerSlotInfo
    } = useAppRoot(),
    w = useTheme(),
    {
      t
    } = useTranslation(),
    [_, x] = ReactRuntime.useState(""),
    [T, A] = ReactRuntime.useState(""),
    [O, H] = ReactRuntime.useState(false),
    [ee, te] = ReactRuntime.useState(false),
    ie = ReactRuntime.useCallback(async (fe, pe) => {
      const le = serverSlotInfos.find(de => de.slot_index === fe);
      if (le) try {
        await updateServerSlotInfo({
          ...le,
          name: pe
        });
        H(false);
      } catch (de) {
        console.error(t("common.model_editor.name_update_failed"), de);
      }
    }, [serverSlotInfos, updateServerSlotInfo, t]),
    ne = ReactRuntime.useCallback(async (fe, pe) => {
      const le = serverSlotInfos.find(de => de.slot_index === fe);
      if (le) try {
        await updateServerSlotInfo({
          ...le,
          description: pe
        });
        te(false);
      } catch (de) {
        console.error(t("common.model_editor.description_update_failed"), de);
      }
    }, [serverSlotInfos, updateServerSlotInfo, t]),
    ae = ReactRuntime.useMemo(() => O ? jsxRuntime.jsx("div", {
      children: jsxRuntime.jsxs("div", {
        style: {
          display: "flex",
          gap: "8px",
          alignItems: "center"
        },
        children: [jsxRuntime.jsx("input", {
          type: "text",
          value: _,
          onChange: fe => x(fe.target.value),
          onKeyDown: async fe => {
            fe.key === "Enter" ? await ie(model.slot_index, _) : fe.key === "Escape" && H(false);
          },
          style: {
            padding: "4px 8px",
            borderRadius: "4px",
            border: `1px solid ${w.palette.divider}`,
            backgroundColor: w.palette.background.default,
            color: w.palette.text.primary
          },
          autoFocus: true
        }), jsxRuntime.jsx(IconButton, {
          onClick: async () => {
            await ie(model.slot_index, _);
          },
          color: "default",
          sx: {
            height: "32px",
            minWidth: "64px",
            px: 2,
            border: "2px solid",
            borderColor: "grey.300",
            borderRadius: "8px",
            "&:hover": {
              borderColor: "primary.main"
            }
          },
          children: jsxRuntime.jsx(Stack, {
            direction: "row",
            spacing: 1,
            alignItems: "center",
            children: jsxRuntime.jsx("span", {
              style: {
                fontSize: "14px",
                whiteSpace: "nowrap"
              },
              children: t("common.model_editor.save")
            })
          })
        }), jsxRuntime.jsx(IconButton, {
          onClick: () => H(false),
          color: "default",
          sx: {
            height: "32px",
            minWidth: "64px",
            px: 2,
            border: "2px solid",
            borderColor: "grey.300",
            borderRadius: "8px",
            "&:hover": {
              borderColor: "primary.main"
            }
          },
          children: jsxRuntime.jsx(Stack, {
            direction: "row",
            spacing: 1,
            alignItems: "center",
            children: jsxRuntime.jsx("span", {
              style: {
                fontSize: "14px",
                whiteSpace: "nowrap"
              },
              children: t("common.model_editor.cancel")
            })
          })
        })]
      })
    }) : jsxRuntime.jsx("div", {
      onClick: () => {
        ee || (H(true), x(model.name || ""));
      },
      style: {
        cursor: ee ? "default" : "pointer",
        color: w.palette.text.primary,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      },
      children: model.name
    }), [O, ee, model.name, model.slot_index, _, x, t, w.palette.background.default, w.palette.divider, w.palette.text.primary, ie]),
    se = ReactRuntime.useMemo(() => jsxRuntime.jsx("div", {
      children: ee ? jsxRuntime.jsxs("div", {
        style: {
          display: "flex",
          gap: "8px",
          alignItems: "center",
          marginTop: "8px"
        },
        children: [jsxRuntime.jsx("input", {
          type: "text",
          value: T,
          onChange: fe => A(fe.target.value),
          onKeyDown: async fe => {
            fe.key === "Enter" ? await ne(model.slot_index, T) : fe.key === "Escape" && te(false);
          },
          style: {
            padding: "4px 8px",
            borderRadius: "4px",
            border: `1px solid ${w.palette.divider}`,
            backgroundColor: w.palette.background.default,
            color: w.palette.text.primary,
            width: "100%"
          },
          autoFocus: true
        }), jsxRuntime.jsx(IconButton, {
          onClick: async () => {
            await ne(model.slot_index, T);
          },
          color: "default",
          sx: {
            height: "32px",
            minWidth: "64px",
            px: 2,
            border: "2px solid",
            borderColor: "grey.300",
            borderRadius: "8px",
            "&:hover": {
              borderColor: "primary.main"
            }
          },
          children: jsxRuntime.jsx(Stack, {
            direction: "row",
            spacing: 1,
            alignItems: "center",
            children: jsxRuntime.jsx("span", {
              style: {
                fontSize: "14px",
                whiteSpace: "nowrap"
              },
              children: t("common.model_editor.save")
            })
          })
        }), jsxRuntime.jsx(IconButton, {
          onClick: () => te(false),
          color: "default",
          sx: {
            height: "32px",
            minWidth: "64px",
            px: 2,
            border: "2px solid",
            borderColor: "grey.300",
            borderRadius: "8px",
            "&:hover": {
              borderColor: "primary.main"
            }
          },
          children: jsxRuntime.jsx(Stack, {
            direction: "row",
            spacing: 1,
            alignItems: "center",
            children: jsxRuntime.jsx("span", {
              style: {
                fontSize: "14px",
                whiteSpace: "nowrap"
              },
              children: t("common.model_editor.cancel")
            })
          })
        })]
      }) : jsxRuntime.jsx("div", {
        onClick: () => {
          O || (te(true), A(model.description || ""));
        },
        style: {
          fontSize: "14px",
          color: w.palette.text.secondary,
          marginTop: "4px",
          cursor: O ? "default" : "pointer"
        },
        children: model.description && model.description.length > 0 ? model.description : t("common.model_editor.no_description")
      })
    }), [ee, O, model.description, model.slot_index, T, A, t, w.palette.background.default, w.palette.divider, w.palette.text.primary, w.palette.text.secondary, ne]);
  return ReactRuntime.useMemo(() => jsxRuntime.jsxs("div", {
    style: {
      width: "60%"
    },
    children: [jsxRuntime.jsxs("div", {
      style: {
        display: "flex",
        fontWeight: "bold",
        marginBottom: "4px",
        color: w.palette.text.primary,
        gap: "1rem"
      },
      children: [jsxRuntime.jsx("span", {
        children: t("common.model_editor.slot", {
          number: model.slot_index + 1
        })
      }), jsxRuntime.jsx("span", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: "0.3rem"
        },
        children: model.voice_changer_type != null ? jsxRuntime.jsxs(jsxRuntime.Fragment, {
          children: [jsxRuntime.jsx(TagIcon, {
            label: model.voice_changer_type
          }), model.voice_changer_type === "RVC" && jsxRuntime.jsx(TagIcon, {
            label: (model.is_onnx ? "onnx" : "torch") + " " + model.version
          }), model.voice_changer_type === "RVC" && jsxRuntime.jsx(TagIcon, {
            label: model.is_f0 ? "f0" : "non-f0"
          }), model.voice_changer_type === "RVC" && jsxRuntime.jsx(TagIcon, {
            label: model.embedder
          })]
        }) : null
      })]
    }), jsxRuntime.jsx("div", {
      children: model.voice_changer_type != null ? jsxRuntime.jsxs(jsxRuntime.Fragment, {
        children: [ae, se]
      }) : jsxRuntime.jsx("div", {
        style: {
          color: w.palette.text.secondary
        },
        children: t("common.model_editor.empty_slot")
      })
    })]
  }), [model, t, w, ae, se]);
};
export { ModelInfo as InfoArea };
