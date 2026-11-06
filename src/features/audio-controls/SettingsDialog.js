// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { jsxRuntimeExports as jsxRuntime, reactExports as ReactRuntime, useTranslation, Button, ButtonGroup, Dialog, DialogContent } from "../../vendor/recovered-runtime.js";
import { useAppRoot } from "../../state/app-root-context.js";
import { useAppState } from "../../state/app-state-context.js";
import { VoiceChangerInputMode } from "../../domain/constants.js";
import { WaitingDialog } from "../../components/common/WaitingDialog.js";
import { capabilityProps } from "../../components/common/backend-capabilities.js";
import { parameterValue } from "../../domain/numeric-display.js";
const SettingsDialog = ({
  open,
  onClose
}) => {
  const {
      setSelectedInputAudioDeviceId,
      setOutputAudio,
      setMonitorAudio,
      selectedInputAudioDeviceId,
      outputAudio,
      monitorAudio,
      enableEchoCancellation,
      setEnableEchoCancellation,
      enableNoiseSuppression,
      setEnableNoiseSuppression,
      enableNoiseSuppression2,
      setEnableNoiseSuppression2,
      isOutputRecording,
      isPassthrough,
      abortAllRequests,
      isStarted
    } = useAppState(),
    {
      audioInputs,
      audioOutputs,
      serverConfiguration,
      updateServerConfiguration,
      serverAudioInputDevices,
      serverAudioOutputDevices,
      serverGpuInfo,
      localVoiceChangerInterfaceInfo,
      stopServerDevice,
      startServerDevice
    } = useAppRoot(),
    {
      t
    } = useTranslation(),
    _e = serverConfiguration.voice_changer_input_mode === VoiceChangerInputMode.client,
    Be = serverConfiguration.voice_changer_input_mode === VoiceChangerInputMode.server,
    Ve = !!localVoiceChangerInterfaceInfo?.local_voice_changer_interface_active || !!serverConfiguration.recording_started || !!serverConfiguration.pass_through,
    ke = !!localVoiceChangerInterfaceInfo?.local_voice_changer_interface_active,
    qe = Be ? Ve : isStarted || isOutputRecording || isPassthrough,
    [ze, Ae] = ReactRuntime.useState(false),
    [Ne, We] = ReactRuntime.useState(""),
    [Ie, $e] = ReactRuntime.useState(""),
    [Me, Ge] = ReactRuntime.useState(""),
    er = ReactRuntime.useMemo(() => Array.from(new Set(serverAudioInputDevices.map(Fe => Fe.host_api))), [serverAudioInputDevices]),
    Ht = ReactRuntime.useMemo(() => Array.from(new Set(serverAudioOutputDevices.map(Fe => Fe.host_api))), [serverAudioOutputDevices]),
    rr = ReactRuntime.useMemo(() => Ne === "" ? serverAudioInputDevices : serverAudioInputDevices.filter(Fe => Fe.host_api === Ne), [serverAudioInputDevices, Ne]),
    Jt = ReactRuntime.useMemo(() => Ie === "" ? serverAudioOutputDevices : serverAudioOutputDevices.filter(Fe => Fe.host_api === Ie), [serverAudioOutputDevices, Ie]),
    Kt = ReactRuntime.useMemo(() => Me === "" ? serverAudioOutputDevices : serverAudioOutputDevices.filter(Fe => Fe.host_api === Me), [serverAudioOutputDevices, Me]),
    dr = ReactRuntime.useMemo(() => serverAudioInputDevices.find(Fe => Fe.index === serverConfiguration.audio_input_device_index), [serverAudioInputDevices, serverConfiguration.audio_input_device_index]),
    or = ReactRuntime.useMemo(() => serverAudioOutputDevices.find(Fe => Fe.index === serverConfiguration.audio_output_device_index), [serverAudioOutputDevices, serverConfiguration.audio_output_device_index]),
    ar = ReactRuntime.useMemo(() => serverAudioOutputDevices.find(Fe => Fe.index === serverConfiguration.audio_monitor_device_index), [serverAudioOutputDevices, serverConfiguration.audio_monitor_device_index]),
    commonServerSampleRates = ReactRuntime.useMemo(() => {
      const deviceRates = [dr, or, ar].filter(Boolean).map(device =>
        [...new Set([...(device.available_samplerates ?? []), device.default_samplerate]
          .map(Number).filter(rate => Number.isFinite(rate) && rate > 0))]
      ).filter(rates => rates.length > 0);
      const rates = deviceRates.length > 0
        ? deviceRates[0].filter(rate => deviceRates.every(available => available.includes(rate)))
        : [44100, 48000];
      const current = serverConfiguration.server_audio_sample_rate;
      return [...new Set([...rates, current].filter(rate => Number.isFinite(rate) && rate > 0))].sort((left, right) => left - right);
    }, [dr, or, ar, serverConfiguration.server_audio_sample_rate]),
    ur = ReactRuntime.useRef(""),
    pr = ReactRuntime.useRef(""),
    vr = ReactRuntime.useRef("");
  ReactRuntime.useEffect(() => {
    _e || Ne !== ur.current && (ur.current = Ne, Ne !== "" && serverConfiguration.audio_input_device_index !== -1 && (rr.some(Dt => Dt.index === serverConfiguration.audio_input_device_index) || updateServerConfiguration({
      ...serverConfiguration,
      audio_input_device_index: -1,
      ...(capabilityProps("config:audio_input_device_sample_rate").disabled ? {} : { audio_input_device_sample_rate: -1 })
    })));
  }, [Ne, rr, _e, serverConfiguration, updateServerConfiguration]);
  ReactRuntime.useEffect(() => {
    _e || Ie !== pr.current && (pr.current = Ie, Ie !== "" && serverConfiguration.audio_output_device_index !== -1 && (Jt.some(Dt => Dt.index === serverConfiguration.audio_output_device_index) || updateServerConfiguration({
      ...serverConfiguration,
      audio_output_device_index: -1,
      ...(capabilityProps("config:audio_output_device_sample_rate").disabled ? {} : { audio_output_device_sample_rate: -1 })
    })));
  }, [Ie, Jt, _e, serverConfiguration, updateServerConfiguration]);
  ReactRuntime.useEffect(() => {
    _e || Me !== vr.current && (vr.current = Me, Me !== "" && serverConfiguration.audio_monitor_device_index !== -1 && (Kt.some(Dt => Dt.index === serverConfiguration.audio_monitor_device_index) || updateServerConfiguration({
      ...serverConfiguration,
      audio_monitor_device_index: -1,
      ...(capabilityProps("config:audio_monitor_device_sample_rate").disabled ? {} : { audio_monitor_device_sample_rate: -1 })
    })));
  }, [Me, Kt, _e, serverConfiguration, updateServerConfiguration]);
  const Ut = ReactRuntime.useMemo(() => _e == false ? null : jsxRuntime.jsx("select", {
      'aria-label': 'Client 入力',
      value: selectedInputAudioDeviceId,
      onChange: Fe => setSelectedInputAudioDeviceId(Fe.target.value),
      style: {
        width: "100%",
        padding: "8px"
      },
      children: audioInputs.map(Fe => jsxRuntime.jsx("option", {
        value: Fe.deviceId,
        children: Fe.label
      }, Fe.deviceId))
    }), [audioInputs, selectedInputAudioDeviceId, setSelectedInputAudioDeviceId, _e]),
    nr = ReactRuntime.useMemo(() => _e ? null : jsxRuntime.jsxs("div", {
      style: {
        display: "flex",
        gap: "8px"
      },
      children: [jsxRuntime.jsxs("select", {
        value: Ne,
        onChange: Fe => We(Fe.target.value),
        style: {
          width: "25%",
          padding: "8px"
        },
        children: [jsxRuntime.jsx("option", {
          value: "",
          children: t("common.settings_dialog.all_hosts")
        }), er.map(Fe => jsxRuntime.jsx("option", {
          value: Fe,
          children: Fe
        }, Fe))]
      }), jsxRuntime.jsxs("select", {
        ...capabilityProps("config:audio_input_device_index", serverConfiguration.audio_input_device_index == null),
        'aria-label': 'Server 入力',
      value: serverConfiguration.audio_input_device_index ?? "",
        onChange: async Fe => {
          const Dt = parseInt(Fe.target.value);
          Ae(true);
          try {
            await updateServerConfiguration({
              ...serverConfiguration,
              audio_input_device_index: Dt,
              ...(capabilityProps("config:audio_input_device_sample_rate").disabled ? {} : { audio_input_device_sample_rate: -1 })
            });
            ke && (await stopServerDevice(), await new Promise(dt => setTimeout(dt, 100)), await startServerDevice(), await new Promise(dt => setTimeout(dt, 100)));
          } finally {
            Ae(false);
          }
        },
        style: {
          width: "50%",
          padding: "8px"
        },
        children: [serverConfiguration.audio_input_device_index == null && jsxRuntime.jsx("option", { value: "", children: "未取得" }), ke == false && jsxRuntime.jsx("option", {
          value: -1,
          children: t("common.settings_dialog.unselected")
        }, -1), rr.map(Fe => jsxRuntime.jsx("option", {
          value: Fe.index,
          children: Ne === "" ? `(${Fe.host_api})${Fe.name}` : Fe.name
        }, Fe.index))]
      }), dr && dr.available_samplerates.length > 0 && jsxRuntime.jsxs("select", {
        ...capabilityProps("config:audio_input_device_sample_rate", serverConfiguration.audio_input_device_sample_rate == null),
        value: serverConfiguration.audio_input_device_sample_rate ?? "",
        onChange: async Fe => {
          const Dt = parseInt(Fe.target.value);
          Ae(true);
          try {
            await updateServerConfiguration({
              ...serverConfiguration,
              audio_input_device_sample_rate: Dt
            });
            ke && (await stopServerDevice(), await new Promise(dt => setTimeout(dt, 100)), await startServerDevice(), await new Promise(dt => setTimeout(dt, 100)));
          } finally {
            Ae(false);
          }
        },
        style: {
          width: "25%",
          padding: "8px"
        },
        children: [serverConfiguration.audio_input_device_sample_rate == null && jsxRuntime.jsx("option", { value: "", children: "未取得" }), jsxRuntime.jsx("option", {
          value: -1,
          children: t("common.settings_dialog.auto")
        }), dr.available_samplerates.map(Fe => jsxRuntime.jsxs("option", {
          value: Fe,
          children: [Fe, " Hz"]
        }, Fe))]
      })]
    }), [_e, Ne, er, rr, serverConfiguration, updateServerConfiguration, dr, Ae, ke, stopServerDevice, startServerDevice, t]),
    mr = ReactRuntime.useMemo(() => _e ? jsxRuntime.jsx("select", {
      'aria-label': 'Client 出力',
      value: outputAudio,
      onChange: Fe => setOutputAudio(Fe.target.value),
      style: {
        width: "100%",
        padding: "8px"
      },
      children: audioOutputs.map(Fe => jsxRuntime.jsx("option", {
        value: Fe.deviceId,
        children: Fe.label
      }, Fe.deviceId))
    }) : null, [audioOutputs, outputAudio, setOutputAudio, _e]),
    gr = ReactRuntime.useMemo(() => _e ? null : jsxRuntime.jsxs("div", {
      style: {
        display: "flex",
        gap: "8px"
      },
      children: [jsxRuntime.jsxs("select", {
        value: Ie,
        onChange: Fe => $e(Fe.target.value),
        style: {
          width: "25%",
          padding: "8px"
        },
        children: [jsxRuntime.jsx("option", {
          value: "",
          children: t("common.settings_dialog.all_hosts")
        }), Ht.map(Fe => jsxRuntime.jsx("option", {
          value: Fe,
          children: Fe
        }, Fe))]
      }), jsxRuntime.jsxs("select", {
        ...capabilityProps("config:audio_output_device_index", serverConfiguration.audio_output_device_index == null),
        'aria-label': 'Server 出力',
      value: serverConfiguration.audio_output_device_index ?? "",
        onChange: async Fe => {
          const Dt = parseInt(Fe.target.value);
          Ae(true);
          try {
            await updateServerConfiguration({
              ...serverConfiguration,
              audio_output_device_index: Dt,
              ...(capabilityProps("config:audio_output_device_sample_rate").disabled ? {} : { audio_output_device_sample_rate: -1 })
            });
            ke && (await stopServerDevice(), await new Promise(dt => setTimeout(dt, 100)), await startServerDevice(), await new Promise(dt => setTimeout(dt, 100)));
          } finally {
            Ae(false);
          }
        },
        style: {
          width: "50%",
          padding: "8px"
        },
        children: [serverConfiguration.audio_output_device_index == null && jsxRuntime.jsx("option", { value: "", children: "未取得" }), ke == false && jsxRuntime.jsx("option", {
          value: -1,
          children: t("common.settings_dialog.unselected")
        }, -1), Jt.map(Fe => jsxRuntime.jsx("option", {
          value: Fe.index,
          children: Ie === "" ? `(${Fe.host_api})${Fe.name}` : Fe.name
        }, Fe.index))]
      }), or && or.available_samplerates.length > 0 && jsxRuntime.jsxs("select", {
        ...capabilityProps("config:audio_output_device_sample_rate", serverConfiguration.audio_output_device_sample_rate == null),
        value: serverConfiguration.audio_output_device_sample_rate ?? "",
        onChange: async Fe => {
          const Dt = parseInt(Fe.target.value);
          try {
            await updateServerConfiguration({
              ...serverConfiguration,
              audio_output_device_sample_rate: Dt
            });
            ke && (await stopServerDevice(), await new Promise(dt => setTimeout(dt, 100)), await startServerDevice(), await new Promise(dt => setTimeout(dt, 100)));
          } finally {
            Ae(false);
          }
        },
        style: {
          width: "25%",
          padding: "8px"
        },
        children: [serverConfiguration.audio_output_device_sample_rate == null && jsxRuntime.jsx("option", { value: "", children: "未取得" }), jsxRuntime.jsx("option", {
          value: -1,
          children: t("common.settings_dialog.auto")
        }), or.available_samplerates.map(Fe => jsxRuntime.jsxs("option", {
          value: Fe,
          children: [Fe, " Hz"]
        }, Fe))]
      })]
    }), [_e, Ie, Ht, Jt, serverConfiguration, updateServerConfiguration, or, Ae, stopServerDevice, startServerDevice, ke, t]),
    Zt = ReactRuntime.useMemo(() => _e ? jsxRuntime.jsx("select", {
      'aria-label': 'Client 監視',
      value: monitorAudio,
      onChange: Fe => setMonitorAudio(Fe.target.value),
      style: {
        width: "100%",
        padding: "8px"
      },
      children: audioOutputs.map(Fe => jsxRuntime.jsx("option", {
        value: Fe.deviceId,
        children: Fe.label
      }, Fe.deviceId))
    }) : null, [audioOutputs, monitorAudio, setMonitorAudio, _e]),
    yr = ReactRuntime.useMemo(() => _e ? null : jsxRuntime.jsxs("div", {
      style: {
        display: "flex",
        gap: "8px"
      },
      children: [jsxRuntime.jsxs("select", {
        value: Me,
        onChange: Fe => Ge(Fe.target.value),
        style: {
          width: "25%",
          padding: "8px"
        },
        children: [jsxRuntime.jsx("option", {
          value: "",
          children: t("common.settings_dialog.all_hosts")
        }), Ht.map(Fe => jsxRuntime.jsx("option", {
          value: Fe,
          children: Fe
        }, Fe))]
      }), jsxRuntime.jsxs("select", {
        ...capabilityProps("config:audio_monitor_device_index", serverConfiguration.audio_monitor_device_index == null),
        'aria-label': 'Server 監視',
      value: serverConfiguration.audio_monitor_device_index ?? "",
        onChange: async Fe => {
          const Dt = parseInt(Fe.target.value);
          Ae(true);
          try {
            await updateServerConfiguration({
              ...serverConfiguration,
              audio_monitor_device_index: Dt,
              ...(capabilityProps("config:audio_monitor_device_sample_rate").disabled ? {} : { audio_monitor_device_sample_rate: -1 })
            });
            ke && (await stopServerDevice(), await new Promise(dt => setTimeout(dt, 100)), await startServerDevice(), await new Promise(dt => setTimeout(dt, 100)));
          } finally {
            Ae(false);
          }
        },
        style: {
          width: "50%",
          padding: "8px"
        },
        children: [serverConfiguration.audio_monitor_device_index == null && jsxRuntime.jsx("option", { value: "", children: "未取得" }), jsxRuntime.jsx("option", {
          value: -1,
          children: t("common.settings_dialog.unselected")
        }, -1), Kt.map(Fe => jsxRuntime.jsx("option", {
          value: Fe.index,
          children: Me === "" ? `(${Fe.host_api})${Fe.name}` : Fe.name
        }, Fe.index))]
      }), ar && ar.available_samplerates.length > 0 && jsxRuntime.jsxs("select", {
        ...capabilityProps("config:audio_monitor_device_sample_rate", serverConfiguration.audio_monitor_device_sample_rate == null),
        value: serverConfiguration.audio_monitor_device_sample_rate ?? "",
        onChange: async Fe => {
          const Dt = parseInt(Fe.target.value);
          Ae(true);
          try {
            await updateServerConfiguration({
              ...serverConfiguration,
              audio_monitor_device_sample_rate: Dt
            });
            ke && (await stopServerDevice(), await new Promise(dt => setTimeout(dt, 100)), await startServerDevice(), await new Promise(dt => setTimeout(dt, 100)));
          } finally {
            Ae(false);
          }
        },
        style: {
          width: "25%",
          padding: "8px"
        },
        children: [serverConfiguration.audio_monitor_device_sample_rate == null && jsxRuntime.jsx("option", { value: "", children: "未取得" }), jsxRuntime.jsx("option", {
          value: -1,
          children: t("common.settings_dialog.auto")
        }), ar.available_samplerates.map(Fe => jsxRuntime.jsxs("option", {
          value: Fe,
          children: [Fe, " Hz"]
        }, Fe))]
      })]
    }), [_e, Me, Ht, Kt, serverConfiguration, updateServerConfiguration, ar, Ae, ke, stopServerDevice, startServerDevice, t]),
    xr = ReactRuntime.useMemo(() => {
      if (!_e) {
        const Fe = serverAudioInputDevices.find(Te => Te.index === serverConfiguration.audio_input_device_index),
          Dt = serverAudioOutputDevices.find(Te => Te.index === serverConfiguration.audio_output_device_index),
          dt = serverAudioOutputDevices.find(Te => Te.index === serverConfiguration.audio_monitor_device_index);
        return Fe && Fe.host_api === "Windows WASAPI" || Dt && Dt.host_api === "Windows WASAPI" || dt && dt.host_api === "Windows WASAPI";
      }
      return false;
    }, [_e, serverAudioInputDevices, serverAudioOutputDevices, serverConfiguration.audio_input_device_index, serverConfiguration.audio_output_device_index, serverConfiguration.audio_monitor_device_index]);
  return ReactRuntime.useMemo(() => jsxRuntime.jsxs(jsxRuntime.Fragment, {
    children: [jsxRuntime.jsxs(Dialog, {
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
          children: t("common.settings_dialog.title")
        }), jsxRuntime.jsx("button", {
          onClick: onClose,
          style: {
            border: "none",
            background: "none",
            fontSize: "24px",
            cursor: "pointer",
            padding: "0 8px"
          },
          children: t("common.settings_dialog.close")
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
              children: t("common.settings_dialog.gpu_settings")
            }), jsxRuntime.jsx("div", {
              style: {
                marginLeft: "16px"
              },
              children: jsxRuntime.jsxs("select", {
                ...capabilityProps("config:gpu_device_id_int", serverConfiguration.gpu_device_id_int == null),
                value: serverConfiguration.gpu_device_id_int ?? "",
                onChange: async Fe => {
                  const Dt = parseInt(Fe.target.value);
                  abortAllRequests();
                  await updateServerConfiguration({
                    ...serverConfiguration,
                    gpu_device_id_int: Dt
                  });
                },
                style: {
                  width: "100%",
                  padding: "8px"
                },
                children: [serverConfiguration.gpu_device_id_int == null && jsxRuntime.jsx("option", { value: "", children: "未取得" }), serverGpuInfo.map(Fe => jsxRuntime.jsx("option", {
                  value: Fe.device_id_int,
                  children: Fe.name
                }, Fe.device_id_int))]
              })
            })]
          }), jsxRuntime.jsxs("div", {
            style: {
              marginTop: "8px"
            },
            children: [jsxRuntime.jsx("div", {
              style: {
                fontWeight: "bold",
                marginBottom: "4px"
              },
              children: t("common.settings_dialog.voice_changer_input_mode")
            }), jsxRuntime.jsxs("div", {
              style: {
                marginLeft: "16px"
              },
              children: [jsxRuntime.jsxs(ButtonGroup, {
                variant: "outlined",
                fullWidth: true,
                children: [jsxRuntime.jsx("span", {
                  style: {
                    width: "100%"
                  },
                  children: jsxRuntime.jsx(Button, {
                    'aria-label': 'Client Device',
                    variant: serverConfiguration.voice_changer_input_mode === VoiceChangerInputMode.client ? "contained" : "outlined",
                    color: serverConfiguration.voice_changer_input_mode === VoiceChangerInputMode.client ? "primary" : "inherit",
                    onClick: async () => {
                      serverConfiguration.voice_changer_input_mode !== VoiceChangerInputMode.client && (await updateServerConfiguration({
                        ...serverConfiguration,
                        voice_changer_input_mode: VoiceChangerInputMode.client,
                        ...(capabilityProps("config:input_sample_rate").disabled ? {} : { input_sample_rate: 48e3 }),
                        ...(capabilityProps("config:output_sample_rate").disabled ? {} : { output_sample_rate: 48e3 }),
                        ...(capabilityProps("config:monitor_sample_rate").disabled ? {} : { monitor_sample_rate: 48e3 })
                      }));
                    },
                    ...capabilityProps("config:voice_changer_input_mode", qe),
                    children: t("common.settings_dialog.client_mode")
                  })
                }), jsxRuntime.jsx("span", {
                  style: {
                    width: "100%"
                  },
                  children: jsxRuntime.jsx(Button, {
                    'aria-label': 'Server Device',
                    variant: serverConfiguration.voice_changer_input_mode === VoiceChangerInputMode.server ? "contained" : "outlined",
                    color: serverConfiguration.voice_changer_input_mode === VoiceChangerInputMode.server ? "primary" : "inherit",
                    onClick: async () => {
                      serverConfiguration.voice_changer_input_mode !== VoiceChangerInputMode.server && (await updateServerConfiguration({
                        ...serverConfiguration,
                        voice_changer_input_mode: VoiceChangerInputMode.server
                      }));
                    },
                    ...capabilityProps("config:voice_changer_input_mode", qe),
                    children: t("common.settings_dialog.server_mode")
                  })
                })]
              }), qe && jsxRuntime.jsx("div", {
                style: {
                  color: "#f44336",
                  fontSize: "12px",
                  marginTop: "4px"
                },
                children: t("common.settings_dialog.mode_switch_disabled")
              })]
            })]
          }), jsxRuntime.jsxs("div", {
            style: {
              marginTop: "8px"
            },
            children: [jsxRuntime.jsx("div", {
              style: {
                fontWeight: "bold",
                marginBottom: "4px"
              },
              children: t("common.settings_dialog.audio_device_settings")
            }), jsxRuntime.jsxs("div", {
              style: {
                marginLeft: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "12px"
              },
              children: [jsxRuntime.jsxs("div", {
                children: [jsxRuntime.jsx("label", {
                  style: {
                    display: "block",
                    marginBottom: "5px"
                  },
                  children: t("common.settings_dialog.input_device")
                }), Ut, nr]
              }), jsxRuntime.jsxs("div", {
                children: [jsxRuntime.jsx("label", {
                  style: {
                    display: "block",
                    marginBottom: "5px"
                  },
                  children: t("common.settings_dialog.output_device")
                }), mr, gr]
              }), jsxRuntime.jsxs("div", {
                children: [jsxRuntime.jsx("label", {
                  style: {
                    display: "block",
                    marginBottom: "5px"
                  },
                  children: t("common.settings_dialog.monitor_device")
                }), Zt, yr]
              }), Be && Object.hasOwn(serverConfiguration, "server_audio_sample_rate") && jsxRuntime.jsxs("label", {
                style: { display: "flex", alignItems: "center", gap: "10px" },
                children: ["共通サンプルレート", jsxRuntime.jsxs("select", {
                  name: "server_audio_sample_rate",
                  ...capabilityProps("config:server_audio_sample_rate", serverConfiguration.server_audio_sample_rate == null || qe),
                  value: serverConfiguration.server_audio_sample_rate ?? "",
                  onChange: async event => {
                    Ae(true);
                    try {
                      await updateServerConfiguration({
                        ...serverConfiguration,
                        server_audio_sample_rate: Number(event.target.value)
                      });
                    } finally {
                      Ae(false);
                    }
                  },
                  style: { flex: 1, padding: "8px" },
                  children: [serverConfiguration.server_audio_sample_rate == null && jsxRuntime.jsx("option", {
                    value: "", children: "未取得"
                  }), commonServerSampleRates.map(rate => jsxRuntime.jsx("option", {
                    value: rate, children: `${rate} Hz`
                  }, rate))]
                })]
              }), xr && jsxRuntime.jsx("div", {
                style: {
                  marginTop: "8px"
                },
                children: jsxRuntime.jsxs("label", {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  },
                  children: [jsxRuntime.jsx("input", {
                    type: "checkbox",
                    ...capabilityProps("config:wasapi_exclude_emabled", serverConfiguration.wasapi_exclude_emabled == null),
                    checked: serverConfiguration.wasapi_exclude_emabled ?? false,
                    onChange: Fe => updateServerConfiguration({
                      ...serverConfiguration,
                      wasapi_exclude_emabled: Fe.target.checked
                    })
                  }), t("common.settings_dialog.wasapi_exclusive_mode")]
                })
              })]
            })]
          }), jsxRuntime.jsxs("div", {
            style: {
              marginTop: "16px"
            },
            children: [jsxRuntime.jsx("div", {
              style: {
                fontWeight: "bold",
                marginBottom: "4px"
              },
              children: t("common.settings_dialog.noise_suppression")
            }), jsxRuntime.jsxs("div", {
              style: {
                marginLeft: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "4px"
              },
              children: [_e && jsxRuntime.jsxs(jsxRuntime.Fragment, {
                children: [jsxRuntime.jsxs("label", {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  },
                  children: [jsxRuntime.jsx("input", {
                    type: "checkbox",
                    checked: enableEchoCancellation,
                    onChange: Fe => setEnableEchoCancellation(Fe.target.checked)
                  }), t("common.settings_dialog.enable_echo_cancellation")]
                }), jsxRuntime.jsxs("label", {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  },
                  children: [jsxRuntime.jsx("input", {
                    type: "checkbox",
                    checked: enableNoiseSuppression,
                    onChange: Fe => setEnableNoiseSuppression(Fe.target.checked)
                  }), t("common.settings_dialog.enable_noise_suppression")]
                }), jsxRuntime.jsxs("label", {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  },
                  children: [jsxRuntime.jsx("input", {
                    type: "checkbox",
                    checked: enableNoiseSuppression2,
                    onChange: Fe => setEnableNoiseSuppression2(Fe.target.checked)
                  }), t("common.settings_dialog.enable_noise_suppression2")]
                })]
              }), jsxRuntime.jsxs("div", {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginTop: "8px"
                },
                children: [jsxRuntime.jsx("span", {
                  style: {
                    minWidth: "80px"
                  },
                  children: t("common.settings_dialog.noise_gate")
                }), jsxRuntime.jsx("input", {
                  type: "range",
                  min: "0",
                  max: "0.5",
                  step: "0.001",
                  ...capabilityProps("config:noise_gate", serverConfiguration.noise_gate == null),
                  value: serverConfiguration.noise_gate ?? 0,
                  onChange: async Fe => {
                    await updateServerConfiguration({
                      ...serverConfiguration,
                      noise_gate: Number(Fe.target.value)
                    });
                  },
                  style: {
                    width: "100%"
                  }
                }), jsxRuntime.jsx("span", {
                  style: {
                    minWidth: "30px",
                    textAlign: "right"
                  },
                  title: serverConfiguration.noise_gate == null ? undefined : String(serverConfiguration.noise_gate),
                  children: parameterValue(serverConfiguration.noise_gate)
                })]
              }), jsxRuntime.jsxs("div", {
                style: {
                  marginTop: "12px"
                },
                children: [jsxRuntime.jsxs("label", {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "8px"
                  },
                  children: [jsxRuntime.jsx("input", {
                    type: "checkbox",
                    ...capabilityProps("config:enable_high_pass_filter", serverConfiguration.enable_high_pass_filter == null),
                    checked: serverConfiguration.enable_high_pass_filter ?? false,
                    onChange: async Fe => {
                      await updateServerConfiguration({
                        ...serverConfiguration,
                        enable_high_pass_filter: Fe.target.checked
                      });
                    }
                  }), t("common.settings_dialog.enable_high_pass_filter")]
                }), serverConfiguration.enable_high_pass_filter && jsxRuntime.jsxs("div", {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    marginLeft: "24px"
                  },
                  children: [jsxRuntime.jsx("span", {
                    style: {
                      minWidth: "80px"
                    },
                    children: t("common.settings_dialog.cutoff")
                  }), jsxRuntime.jsx("input", {
                    type: "range",
                    min: "20",
                    max: "200",
                    step: "10",
                    ...capabilityProps("config:high_pass_filter_cutoff", serverConfiguration.high_pass_filter_cutoff == null),
                    value: serverConfiguration.high_pass_filter_cutoff ?? 0,
                    onChange: async Fe => {
                      await updateServerConfiguration({
                        ...serverConfiguration,
                        high_pass_filter_cutoff: Number(Fe.target.value)
                      });
                    },
                    style: {
                      width: "100%"
                    }
                  }), jsxRuntime.jsxs("span", {
                    style: {
                      minWidth: "50px",
                      textAlign: "right"
                    },
                    title: serverConfiguration.high_pass_filter_cutoff == null ? undefined : String(serverConfiguration.high_pass_filter_cutoff),
                    children: [parameterValue(serverConfiguration.high_pass_filter_cutoff, 0), " Hz"]
                  })]
                })]
              }), jsxRuntime.jsxs("div", {
                style: {
                  marginTop: "12px"
                },
                children: [jsxRuntime.jsxs("label", {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "8px"
                  },
                  children: [jsxRuntime.jsx("input", {
                    type: "checkbox",
                    ...capabilityProps("config:enable_low_pass_filter", serverConfiguration.enable_low_pass_filter == null),
                    checked: serverConfiguration.enable_low_pass_filter ?? false,
                    onChange: async Fe => {
                      await updateServerConfiguration({
                        ...serverConfiguration,
                        enable_low_pass_filter: Fe.target.checked
                      });
                    }
                  }), t("common.settings_dialog.enable_low_pass_filter")]
                }), serverConfiguration.enable_low_pass_filter && jsxRuntime.jsxs("div", {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    marginLeft: "24px"
                  },
                  children: [jsxRuntime.jsx("span", {
                    style: {
                      minWidth: "80px"
                    },
                    children: t("common.settings_dialog.cutoff")
                  }), jsxRuntime.jsx("input", {
                    type: "range",
                    min: "3500",
                    max: "15000",
                    step: "500",
                    ...capabilityProps("config:low_pass_filter_cutoff", serverConfiguration.low_pass_filter_cutoff == null),
                    value: serverConfiguration.low_pass_filter_cutoff ?? 0,
                    onChange: async Fe => {
                      await updateServerConfiguration({
                        ...serverConfiguration,
                        low_pass_filter_cutoff: Number(Fe.target.value)
                      });
                    },
                    style: {
                      width: "100%"
                    }
                  }), jsxRuntime.jsxs("span", {
                    style: {
                      minWidth: "50px",
                      textAlign: "right"
                    },
                    title: serverConfiguration.low_pass_filter_cutoff == null ? undefined : String(serverConfiguration.low_pass_filter_cutoff),
                    children: [parameterValue(serverConfiguration.low_pass_filter_cutoff, 0), " Hz"]
                  })]
                })]
              })]
            })]
          })]
        })
      })]
    }), jsxRuntime.jsx(WaitingDialog, {
      open: ze,
      message: t("common.settings_dialog.changing_device_settings")
    })]
  }), [open, onClose, t, serverConfiguration, updateServerConfiguration, Ut, mr, Zt, nr, gr, yr, xr, enableEchoCancellation, setEnableEchoCancellation, enableNoiseSuppression, setEnableNoiseSuppression, enableNoiseSuppression2, setEnableNoiseSuppression2, _e, Be, commonServerSampleRates, serverGpuInfo, qe, abortAllRequests, ze]);
};
export { SettingsDialog };
