// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { jsxRuntimeExports as jsxRuntime, reactExports as ReactRuntime, useTranslation, useTheme } from "../../vendor/recovered-runtime.js";
import { useAppRoot } from "../../state/app-root-context.js";
const ModelIcon = ({
  model
}) => {
  const C = useTheme(),
    {
      t
    } = useTranslation(),
    {
      uploadIconFile,
      triggerToast
    } = useAppRoot(),
    _ = ReactRuntime.useRef(null),
    x = ReactRuntime.useCallback(O => {
      O.stopPropagation();
      model?.name && _.current && (_.current.value = "", _.current.click());
    }, [model?.name]),
    T = ReactRuntime.useCallback(async O => {
      const H = O.target.files?.[0];
      if (H && model?.slot_index !== void 0) try {
        await uploadIconFile(model.slot_index, H, () => {});
        triggerToast("success", t("common.model_editor.icon_upload_success"));
      } catch {
        triggerToast("error", t("common.model_editor.icon_upload_failed"));
      }
    }, [model?.slot_index, uploadIconFile, triggerToast, t]);
  return ReactRuntime.useMemo(() => {
    const O = model.icon_file ? "model_dir/" + model.slot_index + "/" + model.icon_file.split(/[/\\]/).pop() : "./assets/icons/human.png";
    return jsxRuntime.jsxs(jsxRuntime.Fragment, {
      children: [jsxRuntime.jsx("input", {
        type: "file",
        accept: "image/*",
        style: {
          display: "none"
        },
        ref: _,
        onChange: T
      }), jsxRuntime.jsx("div", {
        style: {
          width: "64px",
          height: "64px",
          flexShrink: 0,
          borderRadius: "8px",
          overflow: "hidden",
          backgroundColor: C.palette.mode === "light" ? "#f0f2f5" : C.palette.background.default,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: model?.name ? "pointer" : "default",
          position: "relative"
        },
        onClick: x,
        children: model.voice_changer_type != null ? jsxRuntime.jsxs(jsxRuntime.Fragment, {
          children: [model.icon_file ? jsxRuntime.jsx("img", {
            src: O,
            alt: model.name,
            style: {
              width: "100%",
              height: "100%",
              objectFit: "cover"
            }
          }) : jsxRuntime.jsx("div", {
            style: {
              fontSize: "24px",
              fontWeight: "bold",
              color: C.palette.text.secondary
            },
            children: model.name.charAt(0).toUpperCase()
          }), jsxRuntime.jsx("div", {
            style: {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: 0,
              transition: "opacity 0.2s"
            },
            onMouseEnter: H => {
              H.target.style.opacity = "1";
            },
            onMouseLeave: H => {
              H.target.style.opacity = "0";
            },
            children: jsxRuntime.jsxs("svg", {
              width: "24",
              height: "24",
              viewBox: "0 0 24 24",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: "2",
              children: [jsxRuntime.jsx("path", {
                d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
              }), jsxRuntime.jsx("polyline", {
                points: "17 8 12 3 7 8"
              }), jsxRuntime.jsx("line", {
                x1: "12",
                y1: "3",
                x2: "12",
                y2: "15"
              })]
            })
          })]
        }) : jsxRuntime.jsx("div", {
          style: {
            fontSize: "24px",
            color: C.palette.text.secondary
          },
          children: "-"
        })
      })]
    });
  }, [model.name, model.icon_file, model.slot_index, model.voice_changer_type, C.palette.mode, C.palette.text.secondary, C.palette.background.default, T, x]);
};
export { ModelIcon as IconArea };
