// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { jsxRuntimeExports as jsxRuntime, reactExports as ReactRuntime, useTranslation, Tooltip, IconButton, Chip, Box, Stack } from "../../vendor/recovered-runtime.js";
import { useAppRoot } from "../../state/app-root-context.js";
import { useAppState } from "../../state/app-state-context.js";
import { VoiceChangerInputMode } from "../../domain/constants.js";
import { FiberManualRecord, PlayArrow, Settings, Stop, SwapHoriz } from "../../components/icons.js";
import { SettingsDialog } from "./SettingsDialog.js";
import { downloadServerRecordingFiles } from "../../shared/recordings.js";
const MainControls = () => {
  const {
      isStarted,
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
    isConversionRunning = isServerInputMode ? isServerDeviceActive : isStarted,
    isConversionStopped = isServerInputMode ? !isServerDeviceActive : !isStarted,
    isPassthroughActive = isServerInputMode ? serverConfiguration.pass_through : isPassthrough,
    isRecordingActive = isServerInputMode ? serverConfiguration.recording_started : isOutputRecording,
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
                children: t("common.controls.start")
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
          title: t(isRecordingActive ? "common.controls.stop_recording" : "common.controls.start_recording"),
          children: jsxRuntime.jsx(IconButton, {
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
                if (setIsOutputRecording(ve), recordForAnalysis) try {
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
    }), jsxRuntime.jsx(SettingsDialog, {
      open: isSettingsDialogOpen,
      onClose: () => setSettingsDialogOpen(false)
    })]
  }), [setIsOutputRecording, setIsPassthrough, t, isOutputRecording, isPassthrough, isSettingsDialogOpen, setSettingsDialogOpen, serverConfiguration, serverGpuInfo, isServerInputMode, isConversionRunning, isConversionStopped, updateServerConfiguration, isPassthroughActive, isRecordingActive, recordForAnalysis, startConversion, stopConversion]);
};
export { MainControls };
