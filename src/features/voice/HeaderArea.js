// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { jsxRuntimeExports as jsxRuntime, reactExports as ReactRuntime, useTranslation } from "../../vendor/recovered-runtime.js";
import { useAppRoot } from "../../state/app-root-context.js";
import { TagIcon } from "../../components/icons.js";
const HeaderArea = () => {
  const {
      currentSlotInfo
    } = useAppRoot(),
    {
      t
    } = useTranslation();
  return ReactRuntime.useMemo(() => jsxRuntime.jsxs("div", {
    style: {
      padding: "10px",
      marginBottom: "20px",
      width: "100%"
    },
    children: [jsxRuntime.jsxs("div", {
      style: {
        fontSize: "1.2em",
        fontWeight: "bold",
        marginBottom: "8px"
      },
      children: [currentSlotInfo ? `${currentSlotInfo.slot_index + 1}. ` : "", currentSlotInfo?.name || t("common.model.not_selected"), currentSlotInfo?.voice_changer_type != null ? jsxRuntime.jsxs(jsxRuntime.Fragment, {
        children: [jsxRuntime.jsx(TagIcon, {
          label: currentSlotInfo.voice_changer_type
        }), currentSlotInfo.voice_changer_type === "RVC" && jsxRuntime.jsx(TagIcon, {
          label: (currentSlotInfo.is_onnx ? "onnx" : "torch") + " " + currentSlotInfo.version
        }), currentSlotInfo.voice_changer_type === "RVC" && jsxRuntime.jsx(TagIcon, {
          label: currentSlotInfo.is_f0 ? "f0" : "non-f0"
        }), currentSlotInfo.voice_changer_type === "RVC" && jsxRuntime.jsx(TagIcon, {
          label: currentSlotInfo.embedder
        })]
      }) : null]
    }), currentSlotInfo?.description && jsxRuntime.jsx("div", {
      style: {
        width: "100%",
        padding: "10px",
        backgroundColor: "#f5f5f5",
        borderRadius: "4px",
        fontSize: "14px",
        color: "darkslategrey",
        maxHeight: "100px",
        overflowY: "auto"
      },
      children: currentSlotInfo.description
    }), currentSlotInfo?.voice_changer_type === "Beatrice_v2" && jsxRuntime.jsx("div", {
      children: jsxRuntime.jsxs("div", {
        children: [jsxRuntime.jsx("span", {
          children: t("common.copyright.beatrice_lib_license")
        }), jsxRuntime.jsx("span", {
          children: t("common.copyright.beatrice_lib_license2")
        })]
      })
    })]
  }), [currentSlotInfo, t]);
};
export { HeaderArea };
