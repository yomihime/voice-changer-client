// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { jsxRuntimeExports as jsxRuntime, reactExports as ReactRuntime, useTranslation, Dialog, DialogContent } from "../../vendor/recovered-runtime.js";
import { useAppRoot } from "../../state/app-root-context.js";
import { useAppState } from "../../state/app-state-context.js";
import { VoiceChangerInputMode } from "../../domain/constants.js";
const AdvancedSettingDialog = ({
  open,
  onClose
}) => {
  const {
      realtimeOutputStatusEnabled,
      setRealtimeOutputStatusEnabled,
      realtimeOutputStatusSendIntervalSec,
      setRealtimeOutputStatusSendIntervalSec,
      recordForAnalysis,
      setRecordForAnalysis,
      showSampleAudioButton,
      setShowSampleAudioButton
    } = useAppState(),
    {
      serverConfiguration,
      updateServerConfiguration
    } = useAppRoot(),
    {
      t
    } = useTranslation(),
    ie = serverConfiguration.voice_changer_input_mode === VoiceChangerInputMode.server,
    ne = ie ? serverConfiguration.realtime_output_status_enabled ?? false : realtimeOutputStatusEnabled,
    ae = ie ? serverConfiguration.realtime_output_status_send_interval_sec ?? 0.2 : realtimeOutputStatusSendIntervalSec,
    se = serverConfiguration.realtime_process_status_enabled ?? false,
    ce = serverConfiguration.realtime_process_status_send_interval_sec ?? 2,
    fe = ReactRuntime.useCallback(async me => {
      try {
        if (ie) {
          const ye = {
            ...serverConfiguration,
            realtime_output_status_enabled: me
          };
          await updateServerConfiguration(ye);
        } else {
          setRealtimeOutputStatusEnabled(me);
          console.log("Client config updated successfully");
        }
      } catch (ye) {
        console.error("Error updating realtime output status setting:", ye);
      }
    }, [ie, serverConfiguration, updateServerConfiguration, setRealtimeOutputStatusEnabled]),
    pe = ReactRuntime.useCallback(async me => {
      try {
        if (ie) {
          const ye = {
            ...serverConfiguration,
            realtime_output_status_send_interval_sec: me
          };
          await updateServerConfiguration(ye);
        } else setRealtimeOutputStatusSendIntervalSec(me);
      } catch (ye) {
        console.error("Error updating realtime status send interval setting:", ye);
      }
    }, [ie, serverConfiguration, updateServerConfiguration, setRealtimeOutputStatusSendIntervalSec]),
    le = ReactRuntime.useCallback(async me => {
      console.log("RealtimeProcessStatus config updated successfully", me);
      try {
        const ye = {
          ...serverConfiguration,
          realtime_process_status_enabled: me
        };
        await updateServerConfiguration(ye);
        console.log("RealtimeProcessStatus config updated successfully");
      } catch (ye) {
        console.error("Error updating realtime process status setting:", ye);
      }
    }, [serverConfiguration, updateServerConfiguration]),
    de = ReactRuntime.useCallback(async me => {
      try {
        const ye = {
          ...serverConfiguration,
          realtime_process_status_send_interval_sec: me
        };
        await updateServerConfiguration(ye);
        console.log("RealtimeProcessStatus send interval updated successfully");
      } catch (ye) {
        console.error("Error updating realtime process status send interval setting:", ye);
      }
    }, [serverConfiguration, updateServerConfiguration]);
  return ReactRuntime.useMemo(() => jsxRuntime.jsxs(Dialog, {
    open,
    onClose,
    maxWidth: "sm",
    fullWidth: true,
    children: [jsxRuntime.jsxs("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "20px",
        padding: "20px 20px 0"
      },
      children: [jsxRuntime.jsx("h2", {
        style: {
          margin: 0
        },
        children: t("common.advanced_settings_dialog.title")
      }), jsxRuntime.jsx("button", {
        onClick: onClose,
        style: {
          border: "none",
          background: "none",
          fontSize: "24px",
          cursor: "pointer",
          padding: "0 8px"
        },
        children: "×"
      })]
    }), jsxRuntime.jsx(DialogContent, {
      children: jsxRuntime.jsxs("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          padding: "20px 0"
        },
        children: [jsxRuntime.jsxs("div", {
          style: {
            marginTop: "16px"
          },
          children: [jsxRuntime.jsx("div", {
            style: {
              fontWeight: "bold",
              marginBottom: "4px"
            },
            children: t("common.advanced_settings_dialog.realtime_analysis_settings")
          }), jsxRuntime.jsxs("div", {
            style: {
              marginLeft: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "8px"
            },
            children: [jsxRuntime.jsxs("label", {
              style: {
                display: "flex",
                alignItems: "center",
                gap: "8px"
              },
              children: [jsxRuntime.jsx("input", {
                type: "checkbox",
                checked: ne,
                onChange: me => fe(me.target.checked)
              }), t("common.advanced_settings_dialog.enable_realtime_io_analysis")]
            }), jsxRuntime.jsxs("div", {
              style: {
                marginTop: "8px",
                paddingLeft: "24px"
              },
              children: [jsxRuntime.jsxs("div", {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "10px"
                },
                children: [jsxRuntime.jsx("span", {
                  style: {
                    minWidth: "120px"
                  },
                  children: t("common.advanced_settings_dialog.send_interval_seconds")
                }), jsxRuntime.jsx("input", {
                  type: "range",
                  min: "0.04",
                  max: "0.2",
                  step: "0.04",
                  value: ae,
                  onChange: me => pe(Number(me.target.value)),
                  style: {
                    width: "100%"
                  }
                }), jsxRuntime.jsx("span", {
                  style: {
                    minWidth: "40px",
                    textAlign: "right"
                  },
                  children: ae
                })]
              }), jsxRuntime.jsx("div", {
                style: {
                  fontSize: "12px",
                  color: "#666",
                  marginTop: "4px"
                },
                children: t("common.advanced_settings.realtime_description")
              })]
            }), jsxRuntime.jsxs("div", {
              style: {
                marginTop: "16px",
                borderTop: "1px solid #eee",
                paddingTop: "16px"
              },
              children: [jsxRuntime.jsxs("label", {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                },
                children: [jsxRuntime.jsx("input", {
                  type: "checkbox",
                  checked: se,
                  onChange: me => le(me.target.checked)
                }), t("common.advanced_settings_dialog.enable_realtime_voice_processing_analysis")]
              }), jsxRuntime.jsxs("div", {
                style: {
                  marginTop: "8px",
                  paddingLeft: "24px"
                },
                children: [jsxRuntime.jsxs("div", {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "10px"
                  },
                  children: [jsxRuntime.jsx("span", {
                    style: {
                      minWidth: "120px"
                    },
                    children: t("common.advanced_settings_dialog.send_interval_seconds")
                  }), jsxRuntime.jsx("input", {
                    type: "range",
                    min: "0.1",
                    max: "5.0",
                    step: "0.1",
                    value: ce,
                    onChange: me => de(Number(me.target.value)),
                    style: {
                      width: "100%"
                    }
                  }), jsxRuntime.jsx("span", {
                    style: {
                      minWidth: "40px",
                      textAlign: "right"
                    },
                    children: ce
                  })]
                }), jsxRuntime.jsx("div", {
                  style: {
                    fontSize: "12px",
                    color: "#666",
                    marginTop: "4px"
                  },
                  children: t("common.advanced_settings.realtime_description")
                })]
              })]
            })]
          })]
        }), jsxRuntime.jsxs("div", {
          children: [jsxRuntime.jsx("div", {
            style: {
              fontWeight: "bold",
              marginBottom: "4px"
            },
            children: t("common.advanced_settings.recording_settings")
          }), jsxRuntime.jsxs("div", {
            style: {
              marginLeft: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "8px"
            },
            children: [jsxRuntime.jsxs("label", {
              style: {
                display: "flex",
                alignItems: "center",
                gap: "8px"
              },
              children: [jsxRuntime.jsx("input", {
                type: "checkbox",
                checked: recordForAnalysis,
                onChange: me => setRecordForAnalysis(me.target.checked)
              }), t("common.advanced_settings.record_for_analysis")]
            }), jsxRuntime.jsx("div", {
              style: {
                fontSize: "12px",
                color: "#666",
                marginLeft: "24px"
              },
              children: t("common.advanced_settings.record_for_analysis_description")
            })]
          })]
        }), jsxRuntime.jsxs("div", {
          children: [jsxRuntime.jsx("div", {
            style: {
              fontWeight: "bold",
              marginBottom: "4px"
            },
            children: t("common.advanced_settings.sample_audio_button")
          }), jsxRuntime.jsxs("div", {
            style: {
              marginLeft: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "8px"
            },
            children: [jsxRuntime.jsxs("label", {
              style: {
                display: "flex",
                alignItems: "center",
                gap: "8px"
              },
              children: [jsxRuntime.jsx("input", {
                type: "checkbox",
                checked: showSampleAudioButton,
                onChange: me => setShowSampleAudioButton(me.target.checked)
              }), t("common.advanced_settings.show_sample_audio_button")]
            }), jsxRuntime.jsx("div", {
              style: {
                fontSize: "12px",
                color: "#666",
                marginLeft: "24px"
              },
              children: t("common.advanced_settings.sample_audio_button_description")
            })]
          })]
        })]
      })
    })]
  }), [open, onClose, ne, fe, ae, pe, se, le, ce, de, recordForAnalysis, setRecordForAnalysis, ie, t, showSampleAudioButton, setShowSampleAudioButton]);
};
export { AdvancedSettingDialog };
