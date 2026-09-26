// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { reactExports as ReactRuntime, useTranslation } from "../vendor/recovered-runtime.js";
import { useAppRoot } from "../state/app-root-context.js";
import { useAppState } from "../state/app-state-context.js";
import { VoiceChangerInputMode } from "../domain/constants.js";
import { invoke, listen } from "../platform/bridge.js";
const useHotKeySetting = () => {
  const {
      t
    } = useTranslation(),
    [config, setConfig] = ReactRuntime.useState(null),
    [hotKeySettingError, setHotKeySettingError] = ReactRuntime.useState(null),
    {
      serverConfiguration,
      localVoiceChangerInterfaceInfo,
      startServerDevice,
      stopServerDevice,
      updateServerConfiguration,
      serverSlotInfos,
      currentSlotInfo,
      origin
    } = useAppRoot(),
    {
      isStarted,
      isPassthrough,
      setIsStarted,
      setIsPassthrough,
      setNodeInputGain,
      nodeInputGain,
      setNodeOutputGain,
      nodeOutputGain,
      setNodeMonitorGain,
      nodeMonitorGain
    } = useAppState(),
    isServerInputMode = serverConfiguration.voice_changer_input_mode === VoiceChangerInputMode.server,
    isServerDeviceActive = !!localVoiceChangerInterfaceInfo?.local_voice_changer_interface_active,
    isConversionRunning = isServerInputMode ? isServerDeviceActive : isStarted,
    isPassthroughActive = isServerInputMode ? serverConfiguration.pass_through : isPassthrough,
    startConversion = ReactRuntime.useCallback(async () => {
      if (isServerInputMode) {
        if (serverConfiguration.audio_input_device_index === -1 || serverConfiguration.audio_output_device_index === -1) return;
        await startServerDevice();
      } else setIsStarted(true);
    }, [isServerInputMode, serverConfiguration.audio_input_device_index, serverConfiguration.audio_output_device_index, startServerDevice, setIsStarted]),
    stopConversion = ReactRuntime.useCallback(async () => {
      isServerInputMode ? await stopServerDevice() : setIsStarted(false);
    }, [isServerInputMode, stopServerDevice, setIsStarted]),
    enablePassthrough = ReactRuntime.useCallback(async () => {
      isServerInputMode ? await updateServerConfiguration({
        ...serverConfiguration,
        pass_through: true
      }) : setIsPassthrough(true);
    }, [isServerInputMode, updateServerConfiguration, setIsPassthrough, serverConfiguration]),
    disablePassthrough = ReactRuntime.useCallback(async () => {
      isServerInputMode ? await updateServerConfiguration({
        ...serverConfiguration,
        pass_through: false
      }) : setIsPassthrough(false);
    }, [isServerInputMode, updateServerConfiguration, setIsPassthrough, serverConfiguration]),
    adjustInputGain = ReactRuntime.useCallback(async Ie => {
      const $e = isServerInputMode ? serverConfiguration.audio_input_device_gain : nodeInputGain,
        Me = Math.min(Math.max($e + Ie, 0), 10);
      return isServerInputMode ? await updateServerConfiguration({
        ...serverConfiguration,
        audio_input_device_gain: Me
      }) : setNodeInputGain(Me), Me;
    }, [isServerInputMode, serverConfiguration, updateServerConfiguration, setNodeInputGain, nodeInputGain]),
    adjustOutputGain = ReactRuntime.useCallback(async Ie => {
      const $e = isServerInputMode ? serverConfiguration.audio_output_device_gain : nodeOutputGain,
        Me = Math.min(Math.max($e + Ie, 0), 10);
      return isServerInputMode ? await updateServerConfiguration({
        ...serverConfiguration,
        audio_output_device_gain: Me
      }) : setNodeOutputGain(Me), Me;
    }, [isServerInputMode, serverConfiguration, updateServerConfiguration, setNodeOutputGain, nodeOutputGain]),
    adjustMonitorGain = ReactRuntime.useCallback(async Ie => {
      const $e = isServerInputMode ? serverConfiguration.audio_monitor_device_gain : nodeMonitorGain,
        Me = Math.min(Math.max($e + Ie, 0), 10);
      return isServerInputMode ? await updateServerConfiguration({
        ...serverConfiguration,
        audio_monitor_device_gain: Me
      }) : setNodeMonitorGain(Me), Me;
    }, [isServerInputMode, serverConfiguration, updateServerConfiguration, setNodeMonitorGain, nodeMonitorGain]),
    loadShortcutSettings = async () => {
      try {
        const Ie = await invoke("get_shortcut_settings");
        console.log(t("common.shortcut_settings.config_load_success"), Ie);
        setConfig(Ie);
        setHotKeySettingError(null);
      } catch (Ie) {
        setHotKeySettingError(`${t("common.shortcut_settings.config_load_failed")} ${Ie}`);
        console.error(t("common.shortcut_settings.settings_load_error"), Ie);
      }
    },
    saveShortcutSettings = async Ie => {
      try {
        await invoke("update_shortcut_settings", {
          configDto: Ie
        });
        await invoke("register_shortcuts");
        setConfig(Ie);
        setHotKeySettingError(null);
        console.log(t("common.shortcut_settings.config_save_success"));
      } catch ($e) {
        setHotKeySettingError(`${t("common.shortcut_settings.config_save_failed")} ${$e}`);
        console.error(t("common.shortcut_settings.settings_save_error"), $e);
      }
    },
    checkDuplicationKey = (Ie, $e) => {
      if (!config || !$e.trim()) return null;
      const Me = config.shortcuts.find(Ge => Ge.shortcut === $e && Ge.action !== Ie);
      return Me ? t("common.shortcut_settings.duplicate_key_error", {
        shortcut: $e,
        displayName: Me.display_name
      }) : null;
    },
    updateShortcut = async (Ie, $e) => {
      if (!config) return;
      const Me = config.shortcuts.map(er => er.action === Ie ? {
          ...er,
          shortcut: $e
        } : er),
        Ge = {
          ...config,
          shortcuts: Me
        };
      await saveShortcutSettings(Ge);
    },
    setShorcutEnabled = async Ie => {
      if (!config) return;
      const $e = {
        ...config,
        enabled: Ie
      };
      await saveShortcutSettings($e);
    };
  return ReactRuntime.useEffect(() => {
    loadShortcutSettings();
  }, []), ReactRuntime.useEffect(() => {
    const Ie = (Ht, rr) => {
        const Jt = serverSlotInfos.find(vr => vr.slot_index === Ht) || null;
        if (Jt == null || Jt.voice_changer_type !== "Beatrice_v2") return null;
        const Kt = Jt,
          dr = Kt.model_info.voice[rr],
          ar = Kt.toml_file.replace(/\\\\/g, "/").replace(/\\/g, "/");
        return ar.substring(0, ar.lastIndexOf("/")) + "/" + dr.portrait.path.split(/[/\\]/).pop();
      },
      $e = Ht => {
        const rr = serverSlotInfos.find(Jt => Jt.slot_index === Ht) || null;
        return rr == null ? null : rr.voice_changer_type === "RVC" ? rr.icon_file != null ? "model_dir/" + rr.slot_index + "/" + rr.icon_file.split(/[/\\]/).pop() : "./assets/icons/human.png" : rr.voice_changer_type === "Beatrice_v2" ? Ie(Ht, currentSlotInfo.dst_id) : null;
      },
      Me = {
        title: t("common.shortcut_settings.vcclient_notification"),
        message: "operation",
        icon_url: origin + "/" + $e(serverConfiguration.current_slot_index) || "./assets/icons/human.png",
        slot_id: serverConfiguration.current_slot_index,
        started: isConversionRunning,
        passthrough: isPassthroughActive,
        input_gain: isServerInputMode ? serverConfiguration.audio_input_device_gain : nodeInputGain,
        output_gain: isServerInputMode ? serverConfiguration.audio_output_device_gain : nodeOutputGain,
        monitor_gain: isServerInputMode ? serverConfiguration.audio_monitor_device_gain : nodeMonitorGain,
        model_name: currentSlotInfo?.name || t("common.shortcut_settings.unknown_model")
      },
      er = (async () => {
        const Ht = await listen("shortcut-action", async rr => {
          console.log("🎯 shortcut-action イベント受信:", rr);
          const {
            action,
            volumeType,
            delta
          } = rr.payload;
          switch (Me.title = t("common.shortcut_settings.vcclient_notification"), action) {
            case "ShowStatus":
              {
                console.log(t("common.shortcut_settings.show_status_action"));
                Me.message = t("common.shortcut_settings.status");
                break;
              }
            case "NextSlot":
              {
                const or = serverSlotInfos.filter(Ut => Ut.voice_changer_type !== null).map(Ut => Ut.slot_index).sort((Ut, nr) => Ut - nr);
                if (or.length <= 1) {
                  Me.message = t("common.shortcut_settings.slot_change_skip");
                  break;
                }
                const ar = serverConfiguration.current_slot_index,
                  ur = or.findIndex(Ut => Ut === ar);
                let pr;
                ur === -1 || ur === or.length - 1 ? pr = or[0] : pr = or[ur + 1];
                await updateServerConfiguration({
                  ...serverConfiguration,
                  current_slot_index: pr
                });
                Me.message = t("common.shortcut_settings.slot_changed_to_next", {
                  from: ar,
                  to: pr
                });
                Me.slot_id = pr;
                Me.icon_url = origin + "/" + $e(pr) || "./assets/icons/human.png";
                const vr = serverSlotInfos.find(Ut => Ut.slot_index === pr);
                Me.model_name = vr?.name || t("common.shortcut_settings.unknown_model");
                console.log(t("common.shortcut_settings.slot_changed_log", {
                  from: ar,
                  to: pr
                }));
                break;
              }
            case "PreviousSlot":
              {
                console.log(t("common.shortcut_settings.previous_slot_action"));
                const or = serverSlotInfos.filter(Ut => Ut.voice_changer_type !== null).map(Ut => Ut.slot_index).sort((Ut, nr) => Ut - nr);
                if (or.length <= 1) {
                  Me.message = t("common.shortcut_settings.slot_change_skip");
                  break;
                }
                const ar = serverConfiguration.current_slot_index,
                  ur = or.findIndex(Ut => Ut === ar);
                let pr;
                ur === -1 || ur === 0 ? pr = or[or.length - 1] : pr = or[ur - 1];
                await updateServerConfiguration({
                  ...serverConfiguration,
                  current_slot_index: pr
                });
                Me.message = t("common.shortcut_settings.slot_changed_to_previous", {
                  from: ar,
                  to: pr
                });
                Me.slot_id = pr;
                Me.icon_url = origin + "/" + $e(pr) || "./assets/icons/human.png";
                const vr = serverSlotInfos.find(Ut => Ut.slot_index === pr);
                Me.model_name = vr?.name || t("common.shortcut_settings.unknown_model");
                console.log(t("common.shortcut_settings.slot_changed_log", {
                  from: ar,
                  to: pr
                }));
                break;
              }
            case "ToggleVoiceConversion":
              try {
                isConversionRunning ? (await stopConversion(), Me.message = t("common.shortcut_settings.voice_conversion_stopped"), Me.started = false) : (await startConversion(), Me.message = t("common.shortcut_settings.voice_conversion_started"), Me.started = true);
              } catch (or) {
                console.error(t("common.shortcut_settings.notification_window_error"), or);
              }
              break;
            case "TogglePassthrough":
              try {
                isPassthroughActive ? (await disablePassthrough(), Me.message = t("common.shortcut_settings.passthrough_disabled"), Me.passthrough = false) : (await enablePassthrough(), Me.message = t("common.shortcut_settings.passthrough_enabled"), Me.passthrough = true);
              } catch (or) {
                console.error(t("common.shortcut_settings.notification_window_error"), or);
              }
              break;
            case "VolumeChange":
              if (!delta) return;
              if (volumeType === "input") {
                const or = await adjustInputGain(delta),
                  ar = Math.round(or * 10) / 10;
                Me.input_gain = ar;
                Me.message = t("common.shortcut_settings.input_volume_changed", {
                  volume: ar
                });
              } else if (volumeType === "output") {
                const or = await adjustOutputGain(delta),
                  ar = Math.round(or * 10) / 10;
                Me.output_gain = ar;
                Me.message = t("common.shortcut_settings.output_volume_changed", {
                  volume: ar
                });
              } else if (volumeType === "monitor") {
                const or = await adjustMonitorGain(delta),
                  ar = Math.round(or * 10) / 10;
                Me.monitor_gain = ar;
                Me.message = t("common.shortcut_settings.monitor_volume_changed", {
                  volume: ar
                });
              }
              break;
            default:
              Me.message = t("common.shortcut_settings.unknown_shortcut_action", {
                action
              });
              break;
          }
          console.log(t("common.shortcut_settings.notification_payload_log"), Me);
          await invoke("show_notification_window_with_message", {
            params: Me
          });
        });
        return () => {
          Ht();
        };
      })();
    return () => {
      er.then(Ht => Ht());
    };
  }, [origin, isConversionRunning, isPassthroughActive, startConversion, stopConversion, enablePassthrough, disablePassthrough, adjustInputGain, adjustOutputGain, adjustMonitorGain, serverConfiguration, serverSlotInfos, updateServerConfiguration, currentSlotInfo, isServerInputMode, nodeInputGain, nodeMonitorGain, nodeOutputGain, t]), {
    config,
    updateShortcut,
    setShorcutEnabled,
    checkDuplicationKey,
    hotKeySettingError
  };
};
export { useHotKeySetting };
