// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { jsxRuntimeExports as jsxRuntime, reactExports as ReactRuntime, useTranslation, Tooltip, IconButton } from "../../vendor/recovered-runtime.js";
import { useAppRoot } from "../../state/app-root-context.js";
import { ConfirmationDialog } from "../../components/common/ConfirmationDialog.js";
import { EmbedderType, PitchEstimatorType } from "../../domain/constants.js";
import { ExpandLess, ExpandMore, GraphicEq, Tune, WaveformIcon, WaveformPlusIcon, EmbedderIcon, IndexIcon } from "../../components/icons.js";
import { useAppGuiSetting } from "../../hooks/useAppGuiSetting.js";
const VoiceControls = () => {
  const {
      currentSlotInfo,
      updateServerSlotInfo,
      serverConfiguration,
      updateServerConfiguration
    } = useAppRoot(),
    {
      t
    } = useTranslation(),
    [isExpanded, setExpanded] = ReactRuntime.useState(true),
    {
      guiSetting
    } = useAppGuiSetting(),
    [isEmbedderConfirmationOpen, setEmbedderConfirmationOpen] = ReactRuntime.useState(false),
    [pendingEmbedderChange, setPendingEmbedderChange] = ReactRuntime.useState(null),
    pitchEstimatorControl = ReactRuntime.useMemo(() => {
      if (currentSlotInfo == null) return jsxRuntime.jsx(jsxRuntime.Fragment, {});
      if (currentSlotInfo.voice_changer_type != "RVC") return jsxRuntime.jsx(jsxRuntime.Fragment, {});
      const le = currentSlotInfo,
        de = le.pitch_estimator;
      return jsxRuntime.jsxs("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: "16px",
          marginTop: "8px"
        },
        children: [jsxRuntime.jsxs("div", {
          style: {
            minWidth: "100px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center"
          },
          children: [jsxRuntime.jsx(Tooltip, {
            title: t("common.voice_controls.pitch_estimator_tooltip"),
            children: jsxRuntime.jsx(GraphicEq, {})
          }), jsxRuntime.jsx("span", {
            style: {
              fontSize: "12px",
              marginTop: "4px",
              userSelect: "none"
            },
            children: t("common.voice_controls.pitch_estimator")
          })]
        }), jsxRuntime.jsx("select", {
          value: de,
          onChange: async he => {
            const me = he.target.value;
            le.pitch_estimator !== me && (await updateServerSlotInfo({
              ...le,
              pitch_estimator: me
            }));
          },
          style: {
            flex: 1,
            minWidth: "120px",
            padding: "4px"
          },
          children: Object.values(PitchEstimatorType).map(he => jsxRuntime.jsx("option", {
            value: he,
            children: he
          }, he))
        })]
      });
    }, [currentSlotInfo, updateServerSlotInfo, t]),
    embedderControl = ReactRuntime.useMemo(() => {
      if (currentSlotInfo == null) return jsxRuntime.jsx(jsxRuntime.Fragment, {});
      if (currentSlotInfo.voice_changer_type != "RVC") return jsxRuntime.jsx(jsxRuntime.Fragment, {});
      const le = currentSlotInfo,
        de = le.override_embedder;
      return jsxRuntime.jsxs("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: "16px",
          marginTop: "8px"
        },
        children: [jsxRuntime.jsxs("div", {
          style: {
            minWidth: "100px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center"
          },
          children: [jsxRuntime.jsx(Tooltip, {
            title: t("common.voice_controls.embedder_override_tooltip"),
            children: jsxRuntime.jsx(EmbedderIcon, {})
          }), jsxRuntime.jsx("span", {
            style: {
              fontSize: "12px",
              marginTop: "4px",
              userSelect: "none"
            },
            children: t("common.voice_controls.embedder")
          })]
        }), jsxRuntime.jsxs("select", {
          value: de || "",
          onChange: async he => {
            const me = he.target.value === "" ? null : he.target.value;
            le.override_embedder !== me && (setPendingEmbedderChange({
              slotInfo: le,
              newEmbedder: me,
              selectElement: he.target
            }), setEmbedderConfirmationOpen(true));
          },
          style: {
            flex: 1,
            minWidth: "120px",
            padding: "4px"
          },
          children: [jsxRuntime.jsx("option", {
            value: "",
            children: t("common.voice_controls.embedder_default", {
              embedder: le.embedder
            })
          }), Object.values(EmbedderType).map(he => jsxRuntime.jsx("option", {
            value: he,
            children: he
          }, he))]
        })]
      });
    }, [currentSlotInfo, t]),
    pitchControl = ReactRuntime.useMemo(() => {
      if (currentSlotInfo == null) return jsxRuntime.jsx(jsxRuntime.Fragment, {});
      let le = 0;
      if (currentSlotInfo.voice_changer_type == "RVC") le = currentSlotInfo.pitch_shift;else if (currentSlotInfo.voice_changer_type == "Beatrice_v2") {
        const de = currentSlotInfo;
        de.use_merged_speaker_embedding ? le = de.merged_speaker_pitch_shifts[de.merged_speaker_id] || 0 : le = de.pitch_shifts[de.dst_id] || 0;
      }
      return jsxRuntime.jsxs("div", {
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
            title: t("common.controls.pitch_adjust"),
            children: jsxRuntime.jsx(Tune, {})
          }), jsxRuntime.jsx("span", {
            style: {
              fontSize: "12px",
              marginTop: "4px",
              userSelect: "none"
            },
            children: t("common.controls.pitch")
          })]
        }), jsxRuntime.jsx("input", {
          type: "range",
          min: "-24",
          max: "24",
          step: "1",
          value: le,
          onChange: de => {
            const he = parseInt(de.target.value);
            if (currentSlotInfo != null) {
              if (currentSlotInfo.voice_changer_type == "RVC") {
                const me = currentSlotInfo;
                me.pitch_shift = he;
                updateServerSlotInfo(me);
              } else if (currentSlotInfo.voice_changer_type == "Beatrice_v2") {
                const me = currentSlotInfo;
                if (me.use_merged_speaker_embedding) {
                  const ye = me.merged_speaker_pitch_shifts;
                  ye[me.merged_speaker_id] = he;
                } else {
                  const ye = me.pitch_shifts;
                  ye[me.dst_id] = he;
                  for (let be = 0; be < me.dst_id; be++) ye[be] || (ye[be] = 0);
                }
                updateServerSlotInfo(me);
              }
            }
          },
          style: {
            flex: 1
          }
        }), jsxRuntime.jsx("span", {
          style: {
            minWidth: "50px",
            textAlign: "right"
          },
          children: le
        })]
      });
    }, [currentSlotInfo, updateServerSlotInfo, t]),
    indexRatioControl = ReactRuntime.useMemo(() => {
      if (currentSlotInfo == null) return jsxRuntime.jsx(jsxRuntime.Fragment, {});
      if (currentSlotInfo.voice_changer_type != "RVC") return jsxRuntime.jsx(jsxRuntime.Fragment, {});
      const le = currentSlotInfo,
        de = le.index_ratio,
        he = le.index_file != null;
      return jsxRuntime.jsxs("div", {
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
            title: t("common.controls.index_adjust"),
            children: jsxRuntime.jsx(IndexIcon, {})
          }), jsxRuntime.jsx("span", {
            style: {
              fontSize: "12px",
              marginTop: "4px",
              userSelect: "none"
            },
            children: t("common.controls.index")
          })]
        }), jsxRuntime.jsx("input", {
          type: "range",
          min: "0",
          max: "1",
          step: "0.1",
          value: de,
          disabled: !he,
          onChange: me => {
            if (de == null || !he) return;
            const ye = parseFloat(me.target.value),
              be = currentSlotInfo;
            be.index_ratio = ye;
            updateServerSlotInfo(be);
          },
          style: {
            flex: 1,
            opacity: he ? 1 : 0.5,
            cursor: he ? "pointer" : "not-allowed"
          }
        }), jsxRuntime.jsx("span", {
          style: {
            minWidth: "50px",
            textAlign: "right",
            opacity: he ? 1 : 0.5
          },
          children: he ? de.toFixed(2) : "N/A"
        })]
      });
    }, [currentSlotInfo, t, updateServerSlotInfo]),
    formantControl = ReactRuntime.useMemo(() => {
      if (currentSlotInfo == null) return jsxRuntime.jsx(jsxRuntime.Fragment, {});
      if (currentSlotInfo.voice_changer_type != "Beatrice_v2") return jsxRuntime.jsx(jsxRuntime.Fragment, {});
      const le = currentSlotInfo;
      let de = 0;
      return le.use_merged_speaker_embedding ? de = le.merged_speaker_formant_shifts[le.merged_speaker_id] || 0 : de = le.formant_shifts[le.dst_id] || 0, jsxRuntime.jsxs("div", {
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
            title: t("common.controls.formant_adjust"),
            children: jsxRuntime.jsx(GraphicEq, {})
          }), jsxRuntime.jsx("span", {
            style: {
              fontSize: "12px",
              marginTop: "4px",
              userSelect: "none"
            },
            children: t("common.controls.formant")
          })]
        }), jsxRuntime.jsx("input", {
          type: "range",
          min: "-2",
          max: "2",
          step: "0.5",
          value: de,
          onChange: he => {
            if (currentSlotInfo == null || currentSlotInfo.voice_changer_type != "Beatrice_v2") return;
            const me = parseFloat(he.target.value);
            if ([-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2].includes(me)) {
              const be = currentSlotInfo;
              if (be.use_merged_speaker_embedding) {
                const ve = be.merged_speaker_formant_shifts;
                ve[be.merged_speaker_id] = me;
              } else {
                const ve = be.formant_shifts;
                ve[be.dst_id] = me;
                for (let xe = 0; xe < be.dst_id; xe++) ve[xe] || (ve[xe] = 0);
              }
              updateServerSlotInfo(be);
            }
          },
          style: {
            flex: 1
          }
        }), jsxRuntime.jsx("span", {
          style: {
            minWidth: "50px",
            textAlign: "right"
          },
          children: de.toFixed(1)
        })]
      });
    }, [currentSlotInfo, t, updateServerSlotInfo]),
    chunkDurationControl = ReactRuntime.useMemo(() => !guiSetting.inputChunkSec || guiSetting.inputChunkSec.length === 0 || currentSlotInfo == null ? jsxRuntime.jsx(jsxRuntime.Fragment, {}) : jsxRuntime.jsxs("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "16px",
        marginTop: "8px"
      },
      children: [jsxRuntime.jsxs("div", {
        style: {
          minWidth: "100px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center"
        },
        children: [jsxRuntime.jsx(Tooltip, {
          title: t("common.controls.chunksec_adjust"),
          children: jsxRuntime.jsx(WaveformIcon, {})
        }), jsxRuntime.jsx("span", {
          style: {
            fontSize: "12px",
            marginTop: "4px",
            userSelect: "none"
          },
          children: t("common.controls.chunksec_label")
        })]
      }), jsxRuntime.jsx("select", {
        value: currentSlotInfo.chunk_sec,
        onChange: async le => {
          const de = Number(le.target.value);
          currentSlotInfo.chunk_sec !== de && (await updateServerSlotInfo({
            ...currentSlotInfo,
            chunk_sec: de
          }));
        },
        style: {
          flex: 1,
          minWidth: "120px",
          padding: "4px"
        },
        children: guiSetting.inputChunkSec.map(le => jsxRuntime.jsx("option", {
          value: le,
          children: `${Math.round(48e3 * le)} [${le} sec]`
        }, le))
      })]
    }), [guiSetting.inputChunkSec, currentSlotInfo, updateServerSlotInfo, t]),
    fe = ReactRuntime.useMemo(() => !guiSetting.extraFrameSec || guiSetting.extraFrameSec.length === 0 || !serverConfiguration ? jsxRuntime.jsx(jsxRuntime.Fragment, {}) : currentSlotInfo?.voice_changer_type != "RVC" ? jsxRuntime.jsx(jsxRuntime.Fragment, {}) : jsxRuntime.jsxs("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "16px",
        marginTop: "8px"
      },
      children: [jsxRuntime.jsxs("div", {
        style: {
          minWidth: "100px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center"
        },
        children: [jsxRuntime.jsx(Tooltip, {
          title: t("common.controls.extraframe_adjust"),
          children: jsxRuntime.jsx(WaveformPlusIcon, {})
        }), jsxRuntime.jsx("span", {
          style: {
            fontSize: "12px",
            marginTop: "4px",
            userSelect: "none"
          },
          children: t("common.controls.extraframesec_label")
        })]
      }), jsxRuntime.jsx("select", {
        value: serverConfiguration.extra_frame_sec,
        onChange: async le => {
          const de = Number(le.target.value);
          serverConfiguration.extra_frame_sec !== de && (await updateServerConfiguration({
            ...serverConfiguration,
            extra_frame_sec: de
          }));
        },
        style: {
          flex: 1,
          minWidth: "120px",
          padding: "4px"
        },
        children: guiSetting.extraFrameSec.map(le => jsxRuntime.jsx("option", {
          value: le,
          children: `${Math.round(48e3 * le)} [${le} sec]`
        }, le))
      })]
    }), [guiSetting.extraFrameSec, serverConfiguration, updateServerConfiguration, t, currentSlotInfo?.voice_changer_type]),
    pe = ReactRuntime.useMemo(() => currentSlotInfo == null ? jsxRuntime.jsx(jsxRuntime.Fragment, {}) : jsxRuntime.jsxs("div", {
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
          children: t("common.controls.voice_control")
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
        children: [pitchEstimatorControl, pitchControl, indexRatioControl, formantControl, chunkDurationControl, fe, embedderControl]
      })]
    }), [currentSlotInfo, pitchEstimatorControl, pitchControl, indexRatioControl, formantControl, chunkDurationControl, fe, embedderControl, t, isExpanded]);
  return jsxRuntime.jsxs(jsxRuntime.Fragment, {
    children: [pe, jsxRuntime.jsx(ConfirmationDialog, {
      isOpen: isEmbedderConfirmationOpen,
      title: t("common.voice_controls.embedder_change_title"),
      message: t("common.voice_controls.embedder_change_message"),
      confirmButtonText: t("common.voice_controls.embedder_change_confirm"),
      cancelButtonText: t("common.voice_controls.embedder_change_cancel"),
      onConfirm: async () => {
        pendingEmbedderChange && (await updateServerSlotInfo({
          ...pendingEmbedderChange.slotInfo,
          override_embedder: pendingEmbedderChange.newEmbedder
        }));
        setEmbedderConfirmationOpen(false);
        setPendingEmbedderChange(null);
      },
      onCancel: () => {
        pendingEmbedderChange && (pendingEmbedderChange.selectElement.value = pendingEmbedderChange.slotInfo.override_embedder || "");
        setEmbedderConfirmationOpen(false);
        setPendingEmbedderChange(null);
      }
    })]
  });
};
export { VoiceControls };
