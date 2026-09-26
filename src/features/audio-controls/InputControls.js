// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { jsxRuntimeExports as jsxRuntime, reactExports as ReactRuntime, useTranslation, useTheme, Tooltip, IconButton, Button, FormControl, MenuItem, Select, Stack } from "../../vendor/recovered-runtime.js";
import { useAppRoot } from "../../state/app-root-context.js";
import { useAppState } from "../../state/app-state-context.js";
import { AUDIO_ELEMENT_FOR_INPUT_MEDIA, AUDIO_ELEMENT_FOR_INPUT_MEDIA_ECHOBACK } from "../../audio/elements.js";
import { VoiceChangerInputMode, InputAudioType } from "../../domain/constants.js";
import { AudioFile, LibraryMusic, Loop, Mic, NetworkPing, PlayArrow, ScreenShare, Send } from "../../components/icons.js";
const isDesktopApp = () => navigator.userAgent.indexOf("Electron") >= 0;
const InputControls = () => {
  const {
      setInputAudio,
      inputAudioType,
      setInputAudioType,
      selectedInputAudioDeviceId,
      showSampleAudioButton
    } = useAppState(),
    {
      audioContext,
      serverConfiguration,
      serverAudioInputDevices,
      audioInputs,
      setLocalVoiceChangerDummyInput
    } = useAppRoot(),
    theme = useTheme(),
    {
      t
    } = useTranslation(),
    te = ReactRuntime.useRef(null),
    [ie, ne] = ReactRuntime.useState(false),
    [isEchobackEnabled, setEchobackEnabled] = ReactRuntime.useState(false),
    [isLoopEnabled, setLoopEnabled] = ReactRuntime.useState(false),
    [sampleVoices, setSampleVoices] = ReactRuntime.useState({}),
    [selectedSampleVoice, setSelectedSampleVoice] = ReactRuntime.useState(""),
    [audioFile, setAudioFile] = ReactRuntime.useState(null),
    mediaElementSourceRef = ReactRuntime.useRef(null),
    isServerInputMode = serverConfiguration.voice_changer_input_mode === VoiceChangerInputMode.server;
  ReactRuntime.useEffect(() => {
    (async () => {
      try {
        const Me = await (await fetch("./assets/voices/sample_voices.json")).json();
        setSampleVoices(Me);
      } catch ($e) {
        console.error(t("common.controls.sample_voices_load_failed"), $e);
      }
    })();
  }, [t]);
  ReactRuntime.useEffect(() => {
    isServerInputMode && (inputAudioType === InputAudioType.FILE || inputAudioType === InputAudioType.CAPTURE) && setInputAudioType(InputAudioType.MICROPHONE);
  }, [isServerInputMode, inputAudioType, setInputAudioType]);
  const selectedServerInputDevice = serverAudioInputDevices.find(Ie => Ie.index === serverConfiguration.audio_input_device_index),
    selectedBrowserInputDevice = audioInputs.find(Ie => Ie.deviceId === selectedInputAudioDeviceId);
  ReactRuntime.useEffect(() => {
    if (console.log(t("common.controls.useeffect_log"), audioFile, inputAudioType), audioContext == null || audioFile == null || inputAudioType !== InputAudioType.FILE) return;
    const Ie = document.getElementById(AUDIO_ELEMENT_FOR_INPUT_MEDIA);
    if (Ie == null) return;
    Ie.pause();
    Ie.srcObject = null;
    Ie.src = URL.createObjectURL(audioFile);
    Ie.play();
    mediaElementSourceRef.current || (mediaElementSourceRef.current = audioContext.createMediaElementSource(Ie));
    mediaElementSourceRef.current.mediaElement != Ie && (mediaElementSourceRef.current = audioContext.createMediaElementSource(Ie));
    const $e = audioContext.createMediaStreamDestination();
    mediaElementSourceRef.current.connect($e);
    setInputAudio($e.stream);
    const Me = document.getElementById(AUDIO_ELEMENT_FOR_INPUT_MEDIA_ECHOBACK);
    Me.srcObject = $e.stream;
    Me.play();
  }, [audioFile, audioContext, setInputAudio, inputAudioType, t]);
  ReactRuntime.useEffect(() => {
    if (audioContext == null || inputAudioType !== InputAudioType.SAMPLE || selectedSampleVoice.length == 0 || sampleVoices[selectedSampleVoice] == null) return;
    const Ie = document.getElementById(AUDIO_ELEMENT_FOR_INPUT_MEDIA);
    if (Ie == null) {
      console.error(t("common.controls.audio_element_null"));
      return;
    }
    Ie.pause();
    Ie.srcObject = null;
    inputAudioType === InputAudioType.SAMPLE ? Ie.src = sampleVoices[selectedSampleVoice] : Ie.src = "";
    Ie.play();
    mediaElementSourceRef.current || (mediaElementSourceRef.current = audioContext.createMediaElementSource(Ie));
    mediaElementSourceRef.current.mediaElement != Ie && (mediaElementSourceRef.current = audioContext.createMediaElementSource(Ie));
    const $e = audioContext.createMediaStreamDestination();
    mediaElementSourceRef.current.connect($e);
    setInputAudio($e.stream);
    const Me = document.getElementById(AUDIO_ELEMENT_FOR_INPUT_MEDIA_ECHOBACK);
    Me.srcObject = $e.stream;
    Me.play();
  }, [audioContext, selectedSampleVoice, sampleVoices, setInputAudio, inputAudioType, t]);
  const sendSampleToServer = ReactRuntime.useCallback(async Ie => {
    try {
      let $e = Ie;
      /^https?:\/\//.test($e) || ($e = new URL($e, window.location.href).href);
      setLocalVoiceChangerDummyInput($e);
    } catch ($e) {
      console.error(t("common.controls.sample_send_failed"), $e);
    }
  }, [setLocalVoiceChangerDummyInput, t]);
  ReactRuntime.useEffect(() => {
    const Ie = document.getElementById(AUDIO_ELEMENT_FOR_INPUT_MEDIA_ECHOBACK);
    console.log("Echoback muted:::", isEchobackEnabled, audioContext);
    Ie != null && (isEchobackEnabled ? Ie.muted = false : Ie.muted = true);
  }, [isEchobackEnabled, audioContext, audioFile, selectedSampleVoice, inputAudioType]);
  ReactRuntime.useEffect(() => {
    const Ie = document.getElementById(AUDIO_ELEMENT_FOR_INPUT_MEDIA);
    Ie != null && (Ie.loop = isLoopEnabled);
  }, [isLoopEnabled]);
  const microphoneDeviceLabel = ReactRuntime.useMemo(() => inputAudioType !== InputAudioType.MICROPHONE ? null : isServerInputMode == true ? jsxRuntime.jsx("div", {
      style: {
        marginBottom: "20px",
        marginTop: "10px"
      },
      children: jsxRuntime.jsxs("label", {
        style: {
          display: "block",
          marginBottom: "5px",
          fontSize: "12px"
        },
        children: [t("common.controls.mic_device"), ":", " ", selectedServerInputDevice ? `${selectedServerInputDevice.name} (ID: ${selectedServerInputDevice.index})` : t("common.controls.no_device")]
      })
    }) : jsxRuntime.jsx("div", {
      style: {
        marginBottom: "20px",
        marginTop: "10px"
      },
      children: jsxRuntime.jsxs("label", {
        style: {
          display: "block",
          marginBottom: "5px",
          fontSize: "12px"
        },
        children: [t("common.controls.mic_device"), ":", " ", selectedBrowserInputDevice ? `${selectedBrowserInputDevice.label} (ID: ${selectedBrowserInputDevice.deviceId})` : selectedInputAudioDeviceId]
      })
    }), [t, isServerInputMode, selectedServerInputDevice, selectedBrowserInputDevice, selectedInputAudioDeviceId, inputAudioType]),
    loopToggleButton = ReactRuntime.useMemo(() => jsxRuntime.jsx(Tooltip, {
      title: t(isLoopEnabled ? "common.controls.loop_disable" : "common.controls.loop_enable"),
      children: jsxRuntime.jsx(IconButton, {
        onClick: () => setLoopEnabled(!isLoopEnabled),
        color: isLoopEnabled ? "primary" : "default",
        size: "large",
        sx: {
          height: "40px",
          width: "40px",
          minWidth: "40px",
          border: "2px solid",
          borderColor: isLoopEnabled ? "primary.main" : "grey.300",
          borderRadius: "8px",
          "&:hover": {
            borderColor: "primary.main"
          }
        },
        children: jsxRuntime.jsx(Loop, {
          sx: {
            fontSize: "20px"
          }
        })
      })
    }), [isLoopEnabled, t]),
    echobackToggleButton = ReactRuntime.useMemo(() => jsxRuntime.jsx(Tooltip, {
      title: t(isEchobackEnabled ? "common.controls.echoback_disable" : "common.controls.echoback_enable"),
      children: jsxRuntime.jsx(IconButton, {
        onClick: () => setEchobackEnabled(!isEchobackEnabled),
        color: isEchobackEnabled ? "primary" : "default",
        size: "large",
        sx: {
          height: "40px",
          width: "40px",
          minWidth: "40px",
          border: "2px solid",
          borderColor: isEchobackEnabled ? "primary.main" : "grey.300",
          borderRadius: "8px",
          "&:hover": {
            borderColor: "primary.main"
          }
        },
        children: jsxRuntime.jsx(NetworkPing, {
          sx: {
            fontSize: "20px"
          }
        })
      })
    }), [isEchobackEnabled, t]),
    fileInputControls = ReactRuntime.useMemo(() => inputAudioType !== InputAudioType.FILE ? null : jsxRuntime.jsxs("div", {
      style: {
        marginBottom: "20px"
      },
      children: [jsxRuntime.jsx("div", {
        onClick: () => {
          const Ie = document.createElement("input");
          Ie.type = "file";
          Ie.onchange = $e => {
            const Me = $e.target.files;
            Me && setAudioFile(Me[0]);
          };
          Ie.click();
        },
        onDragOver: Ie => {
          Ie.preventDefault();
          Ie.stopPropagation();
        },
        onDrop: Ie => {
          Ie.preventDefault();
          Ie.stopPropagation();
          const $e = Ie.dataTransfer.files;
          $e.length > 0 && setAudioFile($e[0]);
        },
        style: {
          width: "100%",
          height: "100px",
          border: "2px dashed #ccc",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          backgroundColor: theme.palette.mode === "light" ? "#f8f8f8" : "#2f2f2f",
          marginBottom: "10px",
          marginTop: "10px"
        },
        children: jsxRuntime.jsxs("div", {
          style: {
            textAlign: "center"
          },
          children: [jsxRuntime.jsx("div", {
            children: t("common.controls.drop_files")
          }), jsxRuntime.jsx("div", {
            style: {
              fontSize: "12px",
              color: "#666"
            },
            children: t("common.controls.supported_formats")
          })]
        })
      }), jsxRuntime.jsxs("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: "16px",
          marginBottom: "20px"
        },
        children: [jsxRuntime.jsx("audio", {
          id: AUDIO_ELEMENT_FOR_INPUT_MEDIA,
          controls: true,
          style: {
            flex: 1,
            height: "40px"
          }
        }), loopToggleButton, echobackToggleButton]
      }), jsxRuntime.jsx("audio", {
        id: AUDIO_ELEMENT_FOR_INPUT_MEDIA_ECHOBACK,
        controls: true,
        style: {
          width: "100%",
          marginBottom: "20px"
        },
        hidden: true
      })]
    }), [t, inputAudioType, echobackToggleButton, loopToggleButton, theme.palette.mode]),
    qe = ReactRuntime.useMemo(() => inputAudioType !== InputAudioType.CAPTURE ? null : jsxRuntime.jsx("div", {
      style: {
        marginBottom: "20px"
      },
      children: jsxRuntime.jsx(IconButton, {
        onClick: () => {
          (async () => {
            if (te.current && (te.current.getTracks().forEach($e => {
              $e.stop();
            }), te.current = null), ie == true) {
              ne(false);
              return;
            }
            try {
              if (isDesktopApp()) {
                const $e = {
                  audio: {
                    mandatory: {
                      chromeMediaSource: "desktop"
                    }
                  },
                  video: {
                    mandatory: {
                      chromeMediaSource: "desktop"
                    }
                  }
                };
                te.current = await navigator.mediaDevices.getUserMedia($e);
              } else te.current = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
              });
            } catch ($e) {
              console.error(t("common.controls.capture_error"), $e);
              return;
            }
            if (!te.current) {
              console.error(t("common.controls.capture_no_media_stream"));
              return;
            }
            if (te.current.getAudioTracks().length == 0) {
              te.current.getTracks().forEach($e => {
                $e.stop();
              });
              te.current = null;
              console.error(t("common.controls.capture_no_audio_track"));
              return;
            }
            try {
              setInputAudio(te.current);
            } catch ($e) {
              console.error(t("common.controls.capture_error"), $e);
            }
            ne(true);
          })();
        },
        color: ie ? "primary" : "default",
        size: "large",
        sx: {
          width: "100%",
          height: "80px",
          minWidth: "100px",
          px: 2,
          border: "2px solid",
          borderColor: ie ? "primary.main" : "grey.300",
          borderRadius: "8px",
          "&:hover": {
            borderColor: "primary.main"
          },
          marginTop: "10px"
        },
        children: jsxRuntime.jsxs(Stack, {
          alignItems: "center",
          children: [jsxRuntime.jsx(ScreenShare, {}), jsxRuntime.jsx("span", {
            style: {
              fontSize: "12px",
              marginTop: "4px",
              whiteSpace: "nowrap"
            },
            children: t(ie ? "common.controls.stop_capture" : "common.controls.screen_capture")
          })]
        })
      })
    }), [t, inputAudioType, ie, setInputAudio]),
    ze = ReactRuntime.useMemo(() => inputAudioType !== InputAudioType.SAMPLE || isServerInputMode != true || selectedSampleVoice == "" ? null : jsxRuntime.jsxs("div", {
      style: {
        display: "flex",
        gap: "8px",
        justifyContent: "flex-end",
        marginBottom: "10px"
      },
      children: [jsxRuntime.jsx(Button, {
        variant: "outlined",
        startIcon: jsxRuntime.jsx(PlayArrow, {}),
        onClick: () => {
          sampleVoices[selectedSampleVoice] && new Audio(sampleVoices[selectedSampleVoice]).play().catch($e => {
            console.error(t("common.controls.test_audio_play_failed"), $e);
          });
        },
        sx: {
          height: "40px",
          minWidth: "120px"
        },
        children: t("common.controls.test_play")
      }), jsxRuntime.jsx(Button, {
        variant: "contained",
        startIcon: jsxRuntime.jsx(Send, {}),
        onClick: () => {
          sampleVoices[selectedSampleVoice] && sendSampleToServer(sampleVoices[selectedSampleVoice]);
        },
        sx: {
          height: "40px",
          minWidth: "120px"
        },
        children: t("common.controls.send_sample")
      })]
    }), [sendSampleToServer, inputAudioType, isServerInputMode, sampleVoices, selectedSampleVoice, t]),
    Ae = ReactRuntime.useMemo(() => inputAudioType !== InputAudioType.SAMPLE || isServerInputMode == true || selectedSampleVoice == "" ? null : jsxRuntime.jsxs("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "16px",
        marginBottom: "20px"
      },
      children: [jsxRuntime.jsx("audio", {
        id: AUDIO_ELEMENT_FOR_INPUT_MEDIA,
        controls: true,
        style: {
          flex: 1,
          height: "40px"
        }
      }), loopToggleButton, echobackToggleButton]
    }), [echobackToggleButton, loopToggleButton, inputAudioType, isServerInputMode, selectedSampleVoice]),
    Ne = ReactRuntime.useMemo(() => inputAudioType !== InputAudioType.SAMPLE ? null : jsxRuntime.jsxs("div", {
      style: {
        marginBottom: "20px"
      },
      children: [jsxRuntime.jsx(FormControl, {
        fullWidth: true,
        style: {
          marginBottom: "10px",
          marginTop: "10px"
        },
        children: jsxRuntime.jsxs(Select, {
          value: selectedSampleVoice,
          onChange: Ie => {
            const $e = Ie.target.value;
            setSelectedSampleVoice($e);
          },
          displayEmpty: true,
          sx: {
            height: "40px"
          },
          children: [jsxRuntime.jsx(MenuItem, {
            value: "",
            children: jsxRuntime.jsx("em", {
              children: t("common.controls.select_sample")
            })
          }), Object.keys(sampleVoices).map(Ie => jsxRuntime.jsx(MenuItem, {
            value: Ie,
            children: Ie
          }, Ie))]
        })
      }), ze, Ae, jsxRuntime.jsx("audio", {
        id: AUDIO_ELEMENT_FOR_INPUT_MEDIA_ECHOBACK,
        controls: true,
        style: {
          width: "100%",
          marginBottom: "20px"
        },
        hidden: true
      })]
    }), [inputAudioType, sampleVoices, selectedSampleVoice, t, ze, Ae]);
  return ReactRuntime.useMemo(() => jsxRuntime.jsxs("div", {
    children: [jsxRuntime.jsx("label", {
      style: {
        display: "block",
        fontWeight: "bold",
        flex: 1
      },
      children: t("common.controls.input_type")
    }), jsxRuntime.jsxs(Stack, {
      direction: "row",
      spacing: 2,
      justifyContent: "flex-start",
      children: [jsxRuntime.jsx(Tooltip, {
        title: t("common.controls.microphone_input"),
        children: jsxRuntime.jsx(IconButton, {
          onClick: () => setInputAudioType("microphone"),
          color: inputAudioType === "microphone" ? "primary" : "default",
          size: "large",
          sx: {
            width: "70px",
            minWidth: "70px",
            height: "60px",
            border: "2px solid",
            borderColor: inputAudioType === "microphone" ? "primary.main" : "grey.300",
            borderRadius: "8px",
            "&:hover": {
              borderColor: "primary.main"
            }
          },
          children: jsxRuntime.jsxs(Stack, {
            alignItems: "center",
            children: [jsxRuntime.jsx(Mic, {
              sx: {
                fontSize: "1.5rem"
              }
            }), jsxRuntime.jsx("span", {
              style: {
                fontSize: "11px",
                marginTop: "2px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                width: "100%",
                textAlign: "center",
                paddingLeft: "2px",
                paddingRight: "2px"
              },
              children: t("common.controls.microphone")
            })]
          })
        })
      }), jsxRuntime.jsx(Tooltip, {
        title: t("common.controls.file_input"),
        children: jsxRuntime.jsx(IconButton, {
          onClick: () => setInputAudioType("file"),
          color: inputAudioType === "file" ? "primary" : "default",
          size: "large",
          disabled: isServerInputMode,
          sx: {
            width: "70px",
            minWidth: "70px",
            height: "60px",
            border: "2px solid",
            borderColor: inputAudioType === "file" ? "primary.main" : "grey.300",
            borderRadius: "8px",
            "&:hover": {
              borderColor: "primary.main"
            }
          },
          children: jsxRuntime.jsxs(Stack, {
            alignItems: "center",
            children: [jsxRuntime.jsx(AudioFile, {
              sx: {
                fontSize: "1.5rem"
              }
            }), jsxRuntime.jsx("span", {
              style: {
                fontSize: "11px",
                marginTop: "2px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                width: "100%",
                textAlign: "center",
                paddingLeft: "2px",
                paddingRight: "2px"
              },
              children: t("common.controls.file")
            })]
          })
        })
      }), jsxRuntime.jsx(Tooltip, {
        title: t("common.controls.screen_capture"),
        children: jsxRuntime.jsx(IconButton, {
          onClick: () => setInputAudioType("capture"),
          color: inputAudioType === "capture" ? "primary" : "default",
          size: "large",
          disabled: isServerInputMode,
          sx: {
            width: "70px",
            minWidth: "70px",
            height: "60px",
            border: "2px solid",
            borderColor: inputAudioType === "capture" ? "primary.main" : "grey.300",
            borderRadius: "8px",
            "&:hover": {
              borderColor: "primary.main"
            }
          },
          children: jsxRuntime.jsxs(Stack, {
            alignItems: "center",
            children: [jsxRuntime.jsx(ScreenShare, {
              sx: {
                fontSize: "1.5rem"
              }
            }), jsxRuntime.jsx("span", {
              style: {
                fontSize: "11px",
                marginTop: "2px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                width: "100%",
                textAlign: "center",
                paddingLeft: "2px",
                paddingRight: "2px"
              },
              children: t("common.controls.capture")
            })]
          })
        })
      }), showSampleAudioButton && jsxRuntime.jsx(Tooltip, {
        title: t("common.controls.sample_input"),
        children: jsxRuntime.jsx(IconButton, {
          onClick: () => setInputAudioType("sample"),
          color: inputAudioType === "sample" ? "primary" : "default",
          size: "large",
          sx: {
            width: "70px",
            minWidth: "70px",
            height: "60px",
            border: "2px solid",
            borderColor: inputAudioType === "sample" ? "primary.main" : "grey.300",
            borderRadius: "8px",
            "&:hover": {
              borderColor: "primary.main"
            }
          },
          children: jsxRuntime.jsxs(Stack, {
            alignItems: "center",
            children: [jsxRuntime.jsx(LibraryMusic, {
              sx: {
                fontSize: "1.5rem"
              }
            }), jsxRuntime.jsx("span", {
              style: {
                fontSize: "11px",
                marginTop: "2px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                width: "100%",
                textAlign: "center",
                paddingLeft: "2px",
                paddingRight: "2px"
              },
              children: t("common.controls.sample")
            })]
          })
        })
      })]
    }), microphoneDeviceLabel, fileInputControls, qe, Ne]
  }), [setInputAudioType, t, inputAudioType, isServerInputMode, microphoneDeviceLabel, fileInputControls, qe, Ne, showSampleAudioButton]);
};
export { InputControls };
