// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { jsxRuntimeExports as jsxRuntime, reactExports as ReactRuntime, useTranslation, useTheme, IconButton } from "../../vendor/recovered-runtime.js";
import { useAppRoot } from "../../state/app-root-context.js";
import { MAX_SLOT_INDEX } from "../../domain/constants.js";
import { CloseIcon } from "../../components/icons.js";
import { ModelList } from "./ModelList.js";
const ModelEditDialog = ({
  onClose
}) => {
  const {
      t
    } = useTranslation(),
    {
      serverSlotInfos
    } = useAppRoot(),
    w = useTheme(),
    R = ReactRuntime.useMemo(() => serverSlotInfos.filter(x => x.voice_changer_type !== null).length, [serverSlotInfos]);
  return ReactRuntime.useMemo(() => jsxRuntime.jsx("div", {
    style: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1e3,
      width: "100%"
    },
    onClick: onClose,
    children: jsxRuntime.jsxs("div", {
      style: {
        backgroundColor: w.palette.background.paper,
        borderRadius: "8px",
        padding: "20px",
        width: "90%",
        maxWidth: "800px",
        maxHeight: "80vh",
        overflow: "auto",
        color: w.palette.text.primary
      },
      onClick: x => x.stopPropagation(),
      children: [jsxRuntime.jsxs("div", {
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          width: "100%"
        },
        children: [jsxRuntime.jsx("h2", {
          style: {
            margin: 0
          },
          children: t("common.model_editor.title")
        }), jsxRuntime.jsx(IconButton, {
          onClick: onClose,
          size: "large",
          sx: {
            color: w.palette.text.secondary
          },
          children: jsxRuntime.jsx(CloseIcon, {})
        })]
      }), jsxRuntime.jsx("div", {
        style: {
          marginBottom: "20px",
          width: "100%"
        },
        children: jsxRuntime.jsx("p", {
          style: {
            color: w.palette.text.primary
          },
          children: t("common.model_editor.slots_in_use", {
            used: R,
            total: MAX_SLOT_INDEX
          })
        })
      }), jsxRuntime.jsx(ModelList, {})]
    })
  }), [onClose, t, w, R]);
};
export { ModelEditDialog };
