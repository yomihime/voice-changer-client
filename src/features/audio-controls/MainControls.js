// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { jsxRuntimeExports as jsxRuntime, reactExports as ReactRuntime, useTranslation, Tooltip, IconButton, Chip, Box, Stack } from "../../vendor/recovered-runtime.js";
import { useAppRoot } from "../../state/app-root-context.js";
import { useAppState } from "../../state/app-state-context.js";
import { VoiceChangerInputMode } from "../../domain/constants.js";
import { FiberManualRecord, PlayArrow, Settings, Stop, SwapHoriz } from "../../components/icons.js";
import { SettingsDialog } from "./SettingsDialog.js";
import { downloadServerRecordingFiles } from "../../shared/recordings.js";
import { capabilityProps } from "../../components/common/backend-capabilities.js";
const MainControls = () => {
  const {
      isStarted,
      isClientInitialized,
      clientAudioStatus,
      monitorAudio,
      nodeMonitorGain,
      setIsStarted,
      isOutputRecording,
      setIsOutputRecording,
      isPassthrough,
      setIsPassthrough,
      recordForAnalysis
    } = useAppState(),
    {
      t
    } = useTranslation(),
    [isSettingsDialogOpen, setSettingsDialogOpen] = ReactRuntime.useState(false),
    {
      serverConfiguration,
      serverGpuInfo,
      startServerDevice,
      stopServerDevice,
      localVoiceChangerInterfaceInfo,
      updateServerConfiguration,
      triggerToast
    } = useAppRoot(),
    isServerInputMode = serverConfiguration.voice_changer_input_mode === VoiceChangerInputMode.server,
    isServerDeviceActive = !!localVoiceChangerInterfaceInfo?.local_voice_changer_interface_active,
    monitorIsMuted = !isServerInputMode && !!monitorAudio && monitorAudio !== "none" && nodeMonitorGain === 0,
    isClientStarting = !isServerInputMode && isStarted && !isClientInitialized,
    isConversionRunning = isServerInputMode ? isServerDeviceActive : isStarted && isClientInitialized,
    isConversionStopped = isServerInputMode ? !isServerDeviceActive : !isStarted,
    isPassthroughActive = isServerInputMode ? serverConfiguration.pass_through : isPassthrough,
    isRecordingActive = isServerInputMode ? serverConfiguration.recording_started : isOutputRecording,
    serverRecordingCapability = capabilityProps("config:recording_started"),
    recordingDownloadCapability = capabilityProps("downloadServerRecordingFiles"),
    serverRecordingUnavailable = serverRecordingCapability.disabled || recordingDownloadCapability.disabled,
    recordingUnavailable = isServerInputMode && serverRecordingUnavailable,
    recordingUnavailableReason = recordingUnavailable ? serverRecordingCapability.title || recordingDownloadCapability.title : undefined,
    startConversion = ReactRuntime.useCallback(async () => {
      if (isServerInputMode) {
        if (serverConfiguration.audio_input_device_index === -1 || serverConfiguration.audio_output_device_index === -1) {
          triggerToast("error", t("common.controls.device_not_selected_error"));
          return;
        }
        await startServerDevice();
      } else setIsStarted(true);
    }, [isServerInputMode, serverConfiguration.audio_input_device_index, serverConfiguration.audio_output_device_index, triggerToast, t, startServerDevice, setIsStarted]),
    stopConversion = ReactRuntime.useCallback(async () => {
      isServerInputMode ? await stopServerDevice() : setIsStarted(false);
    }, [isServerInputMode, stopServerDevice, setIsStarted]);
  return ReactRuntime.useMemo(() => jsxRuntime.jsxs("div", {
    children: [jsxRuntime.jsxs("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8
      },
      children: [jsxRuntime.jsx("label", {
        style: {
          display: "block",
          fontWeight: "bold",
          flex: 1
        },
        children: t("common.controls.title")
      }), jsxRuntime.jsxs("div", {
        style: {
          display: "flex",
          gap: 8,
          justifyContent: "flex-end"
        },
        children: [(() => {
          const ve = serverGpuInfo.find(xe => xe.device_id_int === serverConfiguration.gpu_device_id_int);
          return jsxRuntime.jsx(Chip, {
            label: `${ve?.name || "cpu"}`,
            color: "success",
            size: "small",
            sx: {
              fontWeight: "bold",
              cursor: "default",
              "&:hover": {
                backgroundColor: "success.main",
                color: "white",
                cursor: "default"
              }
            },
            clickable: true,
            onClick: () => setSettingsDialogOpen(true)
          });
        })(), jsxRuntime.jsx(Chip, {
          label: serverConfiguration.voice_changer_input_mode === VoiceChangerInputMode.server ? t("common.controls.server_mode") : t("common.controls.client_mode"),
          color: serverConfiguration.voice_changer_input_mode === VoiceChangerInputMode.server ? "secondary" : "primary",
          size: "small",
          sx: {
            fontWeight: "bold",
            cursor: "default",
            "&:hover": {
              backgroundColor: serverConfiguration.voice_changer_input_mode === VoiceChangerInputMode.server ? "secondary.main" : "primary.main",
              color: "white",
              cursor: "default"
            }
          },
          clickable: true,
          onClick: () => setSettingsDialogOpen(true)
        })]
      })]
    }), jsxRuntime.jsxs(Stack, {
      direction: "row",
      spacing: 2,
      justifyContent: "flex-start",
      sx: {
        my: 2
      },
      style: {
        width: "100%"
      },
      children: [jsxRuntime.jsx(Box, {
        sx: {
          minWidth: 0,
          display: "flex"
        },
        children: jsxRuntime.jsx(Tooltip, {
          title: t("common.controls.start"),
          children: jsxRuntime.jsx(IconButton, {
            onClick: startConversion,
            'aria-label': '変換を開始',
            ...capabilityProps(isServerInputMode ? "startServerDevice" : "clientAudio"),
            disabled: capabilityProps(isServerInputMode ? "startServerDevice" : "clientAudio").disabled || isClientStarting || isConversionRunning,
            'aria-busy': isClientStarting,
            color: isConversionRunning ? "primary" : "default",
            size: "large",
            sx: {
              height: "60px",
              minWidth: "70px",
              px: 1,
              border: "2px solid",
              borderColor: isConversionRunning ? "primary.main" : "grey.300",
              borderRadius: "8px",
              "&:hover": {
                borderColor: "primary.main"
              }
            },
            children: jsxRuntime.jsxs(Stack, {
              alignItems: "center",
              children: [jsxRuntime.jsx(PlayArrow, {
                sx: {
                  fontSize: "1.5rem"
                }
              }), jsxRuntime.jsx("span", {
                style: {
                  fontSize: "11px",
                  marginTop: "2px",
                  whiteSpace: "nowrap"
                },
                children: isClientStarting ? "準備中…" : t("common.controls.start")
              })]
            })
          })
        })
      }), jsxRuntime.jsx(Box, {
        sx: {
          minWidth: 0,
          display: "flex"
        },
        children: jsxRuntime.jsx(Tooltip, {
          title: t("common.controls.stop"),
          children: jsxRuntime.jsx(IconButton, {
            onClick: async () => {
              await stopConversion();
            },
            'aria-label': '変換を停止',
            color: isConversionStopped ? "primary" : "default",
            size: "large",
            sx: {
              height: "60px",
              minWidth: "70px",
              px: 1,
              border: "2px solid",
              borderColor: isConversionStopped ? "primary.main" : "grey.300",
              borderRadius: "8px",
              "&:hover": {
                borderColor: "primary.main"
              }
            },
            children: jsxRuntime.jsxs(Stack, {
              alignItems: "center",
              children: [jsxRuntime.jsx(Stop, {
                sx: {
                  fontSize: "1.5rem"
                }
              }), jsxRuntime.jsx("span", {
                style: {
                  fontSize: "11px",
                  marginTop: "2px",
                  whiteSpace: "nowrap"
                },
                children: t("common.controls.stop")
              })]
            })
          })
        })
      }), jsxRuntime.jsx(Box, {
        sx: {
          minWidth: 0,
          display: "flex"
        },
        children: jsxRuntime.jsx(Tooltip, {
          title: recordingUnavailableReason || t(isRecordingActive ? "common.controls.stop_recording" : "common.controls.start_recording"),
          children: jsxRuntime.jsx(IconButton, {
            disabled: recordingUnavailable,
            title: recordingUnavailableReason,
            onClick: async () => {
              if (isServerInputMode) {
                const ve = !serverConfiguration.recording_started;
                if (await updateServerConfiguration({
                  ...serverConfiguration,
                  recording_started: ve
                }), !ve) {
                  console.log(t("common.controls.start_download_recording"));
                  try {
                    recordForAnalysis ? await downloadServerRecordingFiles(true, true) : await downloadServerRecordingFiles(false, true);
                  } catch (xe) {
                    console.error(t("common.controls.download_recording_failed"), xe);
                  }
                }
              } else {
                const ve = !isOutputRecording;
                if (setIsOutputRecording(ve), recordForAnalysis && !serverRecordingUnavailable) try {
                  await updateServerConfiguration({
                    ...serverConfiguration,
                    recording_started: ve
                  });
                  ve || (console.log(t("common.controls.start_download_server_recording")), await downloadServerRecordingFiles(true, true));
                } catch (xe) {
                  console.error(t("common.controls.server_recording_failed"), xe);
                }
              }
            },
            color: isRecordingActive ? "primary" : "default",
            size: "large",
            sx: {
              height: "60px",
              minWidth: "70px",
              px: 1,
              border: "2px solid",
              borderColor: isRecordingActive ? "primary.main" : "grey.300",
              borderRadius: "8px",
              "&:hover": {
                borderColor: "primary.main"
              }
            },
            children: jsxRuntime.jsxs(Stack, {
              alignItems: "center",
              children: [jsxRuntime.jsx(FiberManualRecord, {
                sx: {
                  fontSize: "1.5rem"
                }
              }), jsxRuntime.jsx("span", {
                style: {
                  fontSize: "11px",
                  marginTop: "2px",
                  whiteSpace: "nowrap"
                },
                children: t(isRecordingActive ? "common.controls.recording" : "common.controls.record")
              })]
            })
          })
        })
      }), jsxRuntime.jsx(Box, {
        sx: {
          width: "20px"
        }
      }), jsxRuntime.jsx(Box, {
        sx: {
          minWidth: 0,
          display: "flex"
        },
        children: jsxRuntime.jsx(Tooltip, {
          title: t(isPassthroughActive ? "common.controls.passthrough_disable" : "common.controls.passthrough_enable"),
          children: jsxRuntime.jsx(IconButton, {
            ...capabilityProps(isServerInputMode ? "config:pass_through" : null),
            onClick: async () => {
              isServerInputMode ? await updateServerConfiguration({
                ...serverConfiguration,
                pass_through: !serverConfiguration.pass_through
              }) : setIsPassthrough(!isPassthrough);
            },
            color: isPassthroughActive ? "primary" : "default",
            size: "large",
            sx: {
              height: "60px",
              minWidth: "70px",
              px: 1,
              border: "2px solid",
              borderColor: isPassthroughActive ? "primary.main" : "grey.300",
              borderRadius: "8px",
              "&:hover": {
                borderColor: "primary.main"
              }
            },
            children: jsxRuntime.jsxs(Stack, {
              alignItems: "center",
              children: [jsxRuntime.jsx(SwapHoriz, {
                sx: {
                  fontSize: "1.5rem"
                }
              }), jsxRuntime.jsx("span", {
                style: {
                  fontSize: "11px",
                  marginTop: "2px",
                  whiteSpace: "nowrap"
                },
                children: t("common.controls.passthrough")
              })]
            })
          })
        })
      }), jsxRuntime.jsx(Box, {
        sx: {
          minWidth: 0,
          display: "flex"
        },
        children: jsxRuntime.jsx(Tooltip, {
          title: t("common.controls.settings"),
          children: jsxRuntime.jsx(IconButton, {
            onClick: () => setSettingsDialogOpen(true),
            'aria-label': '音声設定',
            color: "default",
            size: "large",
            sx: {
              height: "60px",
              minWidth: "70px",
              px: 1,
              border: "2px solid",
              borderColor: "grey.300",
              borderRadius: "8px",
              "&:hover": {
                borderColor: "primary.main"
              }
            },
            children: jsxRuntime.jsxs(Stack, {
              alignItems: "center",
              children: [jsxRuntime.jsx(Settings, {
                sx: {
                  fontSize: "1.5rem"
                }
              }), jsxRuntime.jsx("span", {
                style: {
                  fontSize: "11px",
                  marginTop: "2px",
                  whiteSpace: "nowrap"
                },
                children: t("common.controls.settings")
              })]
            })
          })
        })
      })]
    }), !isServerInputMode && jsxRuntime.jsx("p", {
      role: clientAudioStatus?.error ? "alert" : "status",
      style: { marginTop: 0, color: clientAudioStatus?.error ? "#b3261e" : "inherit", overflowWrap: "anywhere" },
      children: clientAudioStatus?.error ? "開始できませんでした · " + clientAudioStatus.error
        : isClientStarting ? "開始準備中です。初回はモデルの準備に時間がかかります。停止ボタンで中断できます。"
        : isConversionRunning ? "変換中 · 入力・出力デバイスを使用しています。"
        : "停止中 · 音声設定で入力と出力またはモニターを選択してから開始してください。"
    }), monitorIsMuted && jsxRuntime.jsx("p", {
      role: "status",
      "data-testid": "monitor-volume-hint",
      style: { marginTop: 0 },
      children: "モニター音量が0です。試聴する場合は音量を上げてください。"
    }), jsxRuntime.jsx(SettingsDialog, {
      open: isSettingsDialogOpen,
      onClose: () => setSettingsDialogOpen(false)
    })]
  }), [setIsOutputRecording, setIsPassthrough, t, isOutputRecording, isPassthrough, isSettingsDialogOpen, setSettingsDialogOpen, serverConfiguration, serverGpuInfo, isServerInputMode, isConversionRunning, isConversionStopped, isClientStarting, clientAudioStatus, monitorIsMuted, updateServerConfiguration, isPassthroughActive, isRecordingActive, recordForAnalysis, serverRecordingUnavailable, recordingUnavailable, recordingUnavailableReason, startConversion, stopConversion]);
};
export { MainControls };
