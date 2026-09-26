// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { jsxRuntimeExports as jsxRuntime, reactExports as ReactRuntime, useTranslation, Tooltip, IconButton } from "../../vendor/recovered-runtime.js";
import { useAppRoot } from "../../state/app-root-context.js";
import { useAppState } from "../../state/app-state-context.js";
import { VoiceChangerInputMode } from "../../domain/constants.js";
import { ExpandLess, ExpandMore, Mic, VolumeUp } from "../../components/icons.js";
const VolumeControls = () => {
  const {
      t
    } = useTranslation(),
    {
      nodeInputGain,
      nodeOutputGain,
      nodeMonitorGain,
      setNodeInputGain,
      setNodeOutputGain,
      setNodeMonitorGain
    } = useAppState(),
    {
      serverConfiguration,
      updateServerConfiguration
    } = useAppRoot(),
    isServerInputMode = serverConfiguration.voice_changer_input_mode === VoiceChangerInputMode.server,
    [isExpanded, setExpanded] = ReactRuntime.useState(true),
    inputGain = isServerInputMode ? serverConfiguration.audio_input_device_gain : nodeInputGain,
    outputGain = isServerInputMode ? serverConfiguration.audio_output_device_gain : nodeOutputGain,
    monitorGain = isServerInputMode ? serverConfiguration.audio_monitor_device_gain : nodeMonitorGain,
    updateInputGain = ReactRuntime.useCallback(async pe => {
      isServerInputMode ? await updateServerConfiguration({
        ...serverConfiguration,
        audio_input_device_gain: pe
      }) : setNodeInputGain(pe);
    }, [isServerInputMode, serverConfiguration, updateServerConfiguration, setNodeInputGain]),
    updateOutputGain = ReactRuntime.useCallback(async pe => {
      isServerInputMode ? await updateServerConfiguration({
        ...serverConfiguration,
        audio_output_device_gain: pe
      }) : setNodeOutputGain(pe);
    }, [isServerInputMode, serverConfiguration, updateServerConfiguration, setNodeOutputGain]),
    updateMonitorGain = ReactRuntime.useCallback(async pe => {
      isServerInputMode ? await updateServerConfiguration({
        ...serverConfiguration,
        audio_monitor_device_gain: pe
      }) : setNodeMonitorGain(pe);
    }, [isServerInputMode, serverConfiguration, updateServerConfiguration, setNodeMonitorGain]);
  return ReactRuntime.useMemo(() => jsxRuntime.jsxs("div", {
    style: {
      marginBottom: "20px"
    },
    children: [jsxRuntime.jsxs("div", {
      style: {
        display: "flex",
        alignItems: "center",
        marginBottom: "10px"
      },
      children: [jsxRuntime.jsx("label", {
        style: {
          display: "block",
          fontWeight: "bold",
          flex: 1
        },
        children: t("common.controls.volume_control")
      }), jsxRuntime.jsx(IconButton, {
        onClick: () => setExpanded(!isExpanded),
        size: "small",
        children: isExpanded ? jsxRuntime.jsx(ExpandLess, {}) : jsxRuntime.jsx(ExpandMore, {})
      })]
    }), isExpanded && jsxRuntime.jsxs("div", {
      style: {
        border: "1px solid #ddd",
        borderRadius: "8px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "16px"
      },
      children: [jsxRuntime.jsxs("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: "16px"
        },
        children: [jsxRuntime.jsxs("div", {
          style: {
            minWidth: "100px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center"
          },
          children: [jsxRuntime.jsx(Tooltip, {
            title: t("common.controls.input_volume"),
            children: jsxRuntime.jsx(Mic, {})
          }), jsxRuntime.jsx("span", {
            style: {
              fontSize: "12px",
              marginTop: "4px",
              userSelect: "none"
            },
            children: t("common.controls.input")
          })]
        }), jsxRuntime.jsx("input", {
          type: "range",
          min: "0",
          max: "10",
          step: "0.1",
          value: inputGain,
          onChange: async pe => {
            const le = parseFloat(pe.target.value);
            await updateInputGain(le);
          },
          style: {
            flex: 1
          }
        }), jsxRuntime.jsx("span", {
          style: {
            minWidth: "50px",
            textAlign: "right"
          },
          children: inputGain?.toFixed(1) || "unknown"
        })]
      }), jsxRuntime.jsxs("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: "16px"
        },
        children: [jsxRuntime.jsxs("div", {
          style: {
            minWidth: "100px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center"
          },
          children: [jsxRuntime.jsx(Tooltip, {
            title: t("common.controls.output_volume"),
            children: jsxRuntime.jsx(VolumeUp, {})
          }), jsxRuntime.jsx("span", {
            style: {
              fontSize: "12px",
              marginTop: "4px",
              userSelect: "none"
            },
            children: t("common.controls.output1")
          })]
        }), jsxRuntime.jsx("input", {
          type: "range",
          min: "0",
          max: "10",
          step: "0.1",
          value: outputGain,
          onChange: async pe => {
            const le = parseFloat(pe.target.value);
            await updateOutputGain(le);
          },
          style: {
            flex: 1
          }
        }), jsxRuntime.jsx("span", {
          style: {
            minWidth: "50px",
            textAlign: "right"
          },
          children: outputGain?.toFixed(1) || "unknown"
        })]
      }), jsxRuntime.jsxs("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: "16px"
        },
        children: [jsxRuntime.jsxs("div", {
          style: {
            minWidth: "100px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center"
          },
          children: [jsxRuntime.jsx(Tooltip, {
            title: t("common.controls.monitor_volume"),
            children: jsxRuntime.jsx(VolumeUp, {})
          }), jsxRuntime.jsx("span", {
            style: {
              fontSize: "12px",
              marginTop: "4px",
              userSelect: "none"
            },
            children: t("common.controls.output2")
          })]
        }), jsxRuntime.jsx("input", {
          type: "range",
          min: "0",
          max: "10",
          step: "0.1",
          value: monitorGain,
          onChange: async pe => {
            const le = parseFloat(pe.target.value);
            await updateMonitorGain(le);
          },
          style: {
            flex: 1
          }
        }), jsxRuntime.jsx("span", {
          style: {
            minWidth: "50px",
            textAlign: "right"
          },
          children: monitorGain?.toFixed(1) || "unknwon"
        })]
      })]
    })]
  }), [isExpanded, t, inputGain, monitorGain, outputGain, updateInputGain, updateMonitorGain, updateOutputGain]);
};
export { VolumeControls };
