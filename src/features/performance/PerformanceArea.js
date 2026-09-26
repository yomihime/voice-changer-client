// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { jsxRuntimeExports as jsxRuntime, reactExports as ReactRuntime, useTranslation } from "../../vendor/recovered-runtime.js";
import { useAppRoot } from "../../state/app-root-context.js";
import { useAppState } from "../../state/app-state-context.js";
const codeFilename$3 = import.meta.url.split("/").pop();
const logPrefix$3 = `[${codeFilename$3}]`;
const Y_AXIS_MULTIPLIER = 10;
const PerformanceArea = () => {
  const {
      t
    } = useTranslation(),
    {
      isClientInitialized,
      setVoiceChangerStatusListener,
      outputBufferSizeHistory,
      resetOutputBuffer
    } = useAppState(),
    {
      currentSlotInfo,
      serverConfiguration,
      truncateOutputBuffer,
      refreshVoiceChangerIOQueue
    } = useAppRoot(),
    inputLevelCanvasRef = ReactRuntime.useRef(null),
    inputLevelLabelRef = ReactRuntime.useRef(null),
    outputLevelCanvasRef = ReactRuntime.useRef(null),
    outputLevelLabelRef = ReactRuntime.useRef(null),
    bufferChartCanvasRef = ReactRuntime.useRef(null),
    inputBufferLabelRef = ReactRuntime.useRef(null),
    outputBufferLabelRef = ReactRuntime.useRef(null),
    realtimeFactorCanvasRef = ReactRuntime.useRef(null),
    realtimeFactorLabelRef = ReactRuntime.useRef(null),
    inputBufferHistoryRef = ReactRuntime.useRef([]),
    outputBufferHistoryRef = ReactRuntime.useRef([]),
    formatLevel = be => be === 0 ? "0.000" : be.toFixed(3),
    drawLevelMeter = (be, ve) => {
      if (!be) return;
      const xe = be.getContext("2d");
      if (!xe) return;
      be.width === 0 && (be.width = 300, be.height = 25);
      xe.fillStyle = "#f0f0f0";
      xe.fillRect(0, 0, be.width, be.height);
      const Ce = Math.max(0, Math.min(ve * be.width, be.width)),
        _e = xe.createLinearGradient(0, 0, be.width, 0);
      _e.addColorStop(0, "#4CAF50");
      _e.addColorStop(0.7, "#FFC107");
      _e.addColorStop(1, "#F44336");
      xe.fillStyle = _e;
      xe.fillRect(0, 0, Ce, be.height);
      xe.strokeStyle = "#ccc";
      xe.lineWidth = 1;
      xe.strokeRect(0, 0, be.width, be.height);
    },
    drawBufferChart = ReactRuntime.useCallback((be, ve, xe) => {
      if (!be) return;
      const Ce = be.getContext("2d");
      if (!Ce) return;
      if (be.width = 300, be.height = 120, Ce.fillStyle = "#f8f9fa", Ce.fillRect(0, 0, be.width, be.height), ve.length === 0 && xe.length === 0) {
        Ce.strokeStyle = "#ddd";
        Ce.lineWidth = 1;
        Ce.strokeRect(0, 0, be.width, be.height);
        return;
      }
      const _e = ve.slice(-100),
        Be = xe.slice(-100),
        Ve = _e.map(Me => Me.size).filter(Me => Me !== null),
        ke = Be.map(Me => Me.size).filter(Me => Me !== null),
        Le = [...Ve, ...ke],
        qe = Le.length > 0 ? Math.max(...Le) : 0,
        ze = currentSlotInfo?.chunk_sec || 0.1,
        Ae = ze * Y_AXIS_MULTIPLIER,
        Ne = Math.min(Math.max(qe, 0.1), Ae),
        We = {
          top: 10,
          right: 10,
          bottom: 20,
          left: 40
        },
        Ie = be.width - We.left - We.right,
        $e = be.height - We.top - We.bottom;
      if (Ce.strokeStyle = "#ddd", Ce.lineWidth = 1, Ce.beginPath(), Ce.moveTo(We.left, We.top), Ce.lineTo(We.left, We.top + $e), Ce.stroke(), Ce.beginPath(), Ce.moveTo(We.left, We.top + $e), Ce.lineTo(We.left + Ie, We.top + $e), Ce.stroke(), Ce.fillStyle = "#666", Ce.font = "12px Arial", Ce.textAlign = "right", Ce.fillText("0s", We.left - 5, We.top + $e), Ce.fillText(`${Ne.toFixed(2)}s`, We.left - 5, We.top + 5), _e.length >= 2) {
        Ce.strokeStyle = "#FF9800";
        Ce.lineWidth = 2;
        Ce.beginPath();
        let Me = true;
        _e.forEach((Ge, er) => {
          if (Ge.size !== null) {
            const Ht = Math.min(Ge.size, Ne),
              rr = We.left + er / (_e.length - 1) * Ie,
              Jt = We.top + $e - Ht / Ne * $e;
            Me ? (Ce.moveTo(rr, Jt), Me = false) : Ce.lineTo(rr, Jt);
          }
        });
        Ce.stroke();
      }
      if (Be.length >= 2) {
        Ce.strokeStyle = "#2196F3";
        Ce.lineWidth = 2;
        Ce.beginPath();
        let Me = true;
        Be.forEach((Ge, er) => {
          if (Ge.size !== null) {
            const Ht = Math.min(Ge.size, Ne),
              rr = We.left + er / (Be.length - 1) * Ie,
              Jt = We.top + $e - Ht / Ne * $e;
            Me ? (Ce.moveTo(rr, Jt), Me = false) : Ce.lineTo(rr, Jt);
          }
        });
        Ce.stroke();
      }
      if (currentSlotInfo?.chunk_sec) {
        const Me = We.top + $e - ze / Ne * $e;
        Ce.strokeStyle = "#ff6b6b";
        Ce.lineWidth = 4;
        Ce.setLineDash([5, 5]);
        Ce.beginPath();
        Ce.moveTo(We.left, Me);
        Ce.lineTo(We.left + Ie, Me);
        Ce.stroke();
        Ce.setLineDash([]);
        Ce.fillStyle = "#ff6b6b";
        Ce.font = "12px Arial";
        Ce.textAlign = "left";
        Ce.fillText(`${ze.toFixed(3)}s`, We.left + 5, Me - 5);
      }
      Ce.strokeStyle = "#ccc";
      Ce.lineWidth = 1;
      Ce.strokeRect(We.left, We.top, Ie, $e);
    }, [currentSlotInfo?.chunk_sec]),
    drawRealtimeFactor = (be, ve) => {
      if (!be) return;
      const xe = be.getContext("2d");
      if (!xe) return;
      be.width = 300;
      be.height = 25;
      xe.fillStyle = "#f8f9fa";
      xe.fillRect(0, 0, be.width, be.height);
      const Ce = {
          left: 20,
          right: 20,
          top: 5,
          bottom: 5
        },
        _e = be.width - Ce.left - Ce.right,
        Be = be.height - Ce.top - Ce.bottom,
        Ve = 0,
        ke = 2,
        Le = Ce.left + (1 - Ve) / (ke - Ve) * _e;
      xe.strokeStyle = "#ddd";
      xe.lineWidth = 1;
      xe.strokeRect(Ce.left, Ce.top, _e, Be);
      xe.strokeStyle = "#ff4444";
      xe.lineWidth = 3;
      xe.beginPath();
      xe.moveTo(Le, Ce.top);
      xe.lineTo(Le, Ce.top + Be);
      xe.stroke();
      const qe = Math.max(Ve, Math.min(ke, ve)),
        ze = Ce.left + (qe - Ve) / (ke - Ve) * _e;
      xe.strokeStyle = "#2196F3";
      xe.lineWidth = 2;
      xe.beginPath();
      xe.moveTo(ze, Ce.top);
      xe.lineTo(ze, Ce.top + Be);
      xe.stroke();
      xe.fillStyle = "#666";
      xe.font = "10px Arial";
      xe.textAlign = "center";
      xe.fillText("0", Ce.left, be.height - 2);
      xe.fillText("1", Le, be.height - 2);
      xe.fillText("2", Ce.left + _e, be.height - 2);
    };
  return ReactRuntime.useEffect(() => {
    if (isClientInitialized) return console.log(logPrefix$3, "Setting up voice changer status listener"), setVoiceChangerStatusListener({
      onRealtimeOutputStatus: be => {
        if (drawLevelMeter(inputLevelCanvasRef.current, be.inputRms ?? 0), inputLevelLabelRef.current && (inputLevelLabelRef.current.textContent = `入力音量 Level ${formatLevel(be.inputRms ?? 0)}`), drawLevelMeter(outputLevelCanvasRef.current, be.outputRms ?? 0), outputLevelLabelRef.current && (outputLevelLabelRef.current.textContent = `出力音量 Level ${formatLevel(be.outputRms ?? 0)}`), be.outputBufferSize !== void 0 && serverConfiguration?.output_sample_rate) {
          const ve = be.outputBufferSize / serverConfiguration.output_sample_rate,
            xe = {
              timestamp: Date.now(),
              size: ve
            },
            Ce = {
              timestamp: Date.now(),
              size: null
            };
          outputBufferHistoryRef.current = [...outputBufferHistoryRef.current, xe].slice(-100);
          inputBufferHistoryRef.current = [...inputBufferHistoryRef.current, Ce].slice(-100);
          drawBufferChart(bufferChartCanvasRef.current, inputBufferHistoryRef.current, outputBufferHistoryRef.current);
          outputBufferLabelRef.current && (outputBufferLabelRef.current.textContent = t("common.performance.output_buffer_label", {
            time: ve.toFixed(3)
          }));
        }
      },
      onRealtimeProcessStatus: be => {
        if (be.elapsedTime !== void 0 && be.outputSec !== void 0 && be.outputSec > 0) {
          const ve = be.elapsedTime / be.outputSec;
          drawRealtimeFactor(realtimeFactorCanvasRef.current, ve);
          realtimeFactorLabelRef.current && (realtimeFactorLabelRef.current.textContent = `RTF: ${ve.toFixed(3)}`);
        }
        if (be.inputBufferSize !== void 0 && serverConfiguration?.input_sample_rate) {
          const ve = be.inputBufferSize / serverConfiguration.input_sample_rate,
            xe = {
              timestamp: Date.now(),
              size: ve
            },
            Ce = {
              timestamp: Date.now(),
              size: null
            };
          inputBufferHistoryRef.current = [...inputBufferHistoryRef.current, xe].slice(-100);
          outputBufferHistoryRef.current = [...outputBufferHistoryRef.current, Ce].slice(-100);
          drawBufferChart(bufferChartCanvasRef.current, inputBufferHistoryRef.current, outputBufferHistoryRef.current);
          inputBufferLabelRef.current && (inputBufferLabelRef.current.textContent = t("common.performance.input_buffer_label", {
            time: ve.toFixed(3)
          }));
        }
      },
      onData: () => {}
    }), () => {
      setVoiceChangerStatusListener({
        onRealtimeOutputStatus: () => {},
        onRealtimeProcessStatus: () => {},
        onData: () => {}
      });
    };
  }, [setVoiceChangerStatusListener, isClientInitialized, drawBufferChart, serverConfiguration.input_sample_rate, serverConfiguration.output_sample_rate, t]), ReactRuntime.useEffect(() => {
    outputBufferSizeHistory.length > 0 && (outputBufferHistoryRef.current = outputBufferSizeHistory, drawBufferChart(bufferChartCanvasRef.current, inputBufferHistoryRef.current, outputBufferSizeHistory));
  }, [outputBufferSizeHistory, drawBufferChart]), ReactRuntime.useEffect(() => {
    drawLevelMeter(inputLevelCanvasRef.current, 0);
    drawLevelMeter(outputLevelCanvasRef.current, 0);
    drawBufferChart(bufferChartCanvasRef.current, [], []);
    drawRealtimeFactor(realtimeFactorCanvasRef.current, 0);
  }, []), ReactRuntime.useMemo(() => jsxRuntime.jsxs("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "20px"
    },
    children: [jsxRuntime.jsxs("div", {
      id: "input-volume",
      style: {
        width: "320px",
        borderRadius: "8px",
        overflow: "hidden",
        border: "1px solid #eee",
        marginRight: "20px",
        flexShrink: 0,
        padding: "10px",
        display: "flex",
        flexDirection: "column",
        gap: "5px"
      },
      children: [jsxRuntime.jsx("span", {
        ref: inputLevelLabelRef,
        style: {
          fontSize: "12px",
          color: "#666"
        },
        children: t("common.performance.input_volume_level")
      }), jsxRuntime.jsx("canvas", {
        ref: inputLevelCanvasRef,
        style: {
          height: "10px"
        }
      })]
    }), jsxRuntime.jsxs("div", {
      id: "output-volume",
      style: {
        width: "320px",
        borderRadius: "8px",
        overflow: "hidden",
        border: "1px solid #eee",
        marginRight: "20px",
        flexShrink: 0,
        padding: "10px",
        display: "flex",
        flexDirection: "column",
        gap: "5px"
      },
      children: [jsxRuntime.jsx("span", {
        ref: outputLevelLabelRef,
        style: {
          fontSize: "12px",
          color: "#666"
        },
        children: t("common.performance.output_volume_level")
      }), jsxRuntime.jsx("canvas", {
        ref: outputLevelCanvasRef,
        style: {
          height: "10px"
        }
      })]
    }), jsxRuntime.jsxs("div", {
      style: {
        width: "320px",
        borderRadius: "8px",
        overflow: "hidden",
        border: "1px solid #eee",
        marginRight: "20px",
        flexShrink: 0,
        padding: "10px",
        display: "flex",
        flexDirection: "column",
        gap: "5px"
      },
      children: [jsxRuntime.jsx("span", {
        ref: inputBufferLabelRef,
        style: {
          fontSize: "12px",
          color: "#666"
        },
        children: t("common.performance.input_buffer_initial")
      }), jsxRuntime.jsx("span", {
        ref: outputBufferLabelRef,
        style: {
          fontSize: "12px",
          color: "#666"
        },
        children: t("common.performance.output_buffer_initial")
      }), jsxRuntime.jsxs("div", {
        style: {
          fontSize: "12px",
          color: "#666",
          marginTop: "5px"
        },
        children: [jsxRuntime.jsxs("span", {
          style: {
            color: "#FF9800"
          },
          children: ["■ ", t("common.performance.input_buffer")]
        }), jsxRuntime.jsxs("span", {
          style: {
            marginLeft: "10px",
            color: "#2196F3"
          },
          children: ["■ ", t("common.performance.output_buffer")]
        }), jsxRuntime.jsx("button", {
          style: {
            marginLeft: "15px",
            padding: "2px 8px",
            fontSize: "11px",
            borderRadius: "4px",
            border: "1px solid #ddd",
            backgroundColor: "#f8f9fa",
            color: "#666",
            cursor: "pointer",
            transition: "all 0.2s ease"
          },
          onMouseEnter: be => {
            be.currentTarget.style.backgroundColor = "#e9ecef";
            be.currentTarget.style.borderColor = "#adb5bd";
          },
          onMouseLeave: be => {
            be.currentTarget.style.backgroundColor = "#f8f9fa";
            be.currentTarget.style.borderColor = "#ddd";
          },
          onClick: () => {
            resetOutputBuffer();
            truncateOutputBuffer();
            refreshVoiceChangerIOQueue();
          },
          children: t("common.performance.clear")
        })]
      }), jsxRuntime.jsx("canvas", {
        ref: bufferChartCanvasRef,
        style: {
          height: "120px"
        }
      })]
    }), jsxRuntime.jsxs("div", {
      style: {
        width: "320px",
        borderRadius: "8px",
        overflow: "hidden",
        border: "1px solid #eee",
        marginRight: "20px",
        flexShrink: 0,
        padding: "10px",
        display: "flex",
        flexDirection: "column",
        gap: "5px"
      },
      children: [jsxRuntime.jsx("span", {
        ref: realtimeFactorLabelRef,
        style: {
          fontSize: "12px",
          color: "#666"
        },
        children: "RTF: 0.000"
      }), jsxRuntime.jsx("canvas", {
        ref: realtimeFactorCanvasRef,
        style: {
          height: "25px"
        }
      })]
    })]
  }), [refreshVoiceChangerIOQueue, resetOutputBuffer, truncateOutputBuffer, t]);
};
export { PerformanceArea };
