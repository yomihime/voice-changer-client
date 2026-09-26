// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { reactExports as ReactRuntime, useTranslation } from "../vendor/recovered-runtime.js";
import { log$1 as logMessage } from "../shared/logger.js";
import { VOICE_CHANGER_CLIENT_EXCEPTION } from "../domain/constants.js";
import { VCRestClient as VoiceChangerApiClient } from "../api/VoiceChangerApiClient.js";
const codeFilename$1 = import.meta.url.split("/").pop();
const logPrefix$1 = `[${codeFilename$1}]`;
const DefaultServerConfiguration = {
  current_slot_index: -1,
  voice_changer_input_mode: "client",
  sio_broadcast: false,
  pass_through: false,
  recording_started: false,
  enable_high_pass_filter: false,
  high_pass_filter_cutoff: 0,
  enable_low_pass_filter: false,
  low_pass_filter_cutoff: 0,
  volume_tuning_type: "sqrt",
  audio_input_device_index: -1,
  audio_output_device_index: -1,
  audio_monitor_device_index: -1,
  wasapi_exclude_emabled: false,
  audio_input_device_sample_rate: 0,
  audio_output_device_sample_rate: 0,
  audio_monitor_device_sample_rate: 0,
  audio_input_device_gain: 0,
  audio_output_device_gain: 0,
  audio_monitor_device_gain: 0,
  server_device_trancate_buffer_ratio: 0,
  realtime_process_status_enabled: false,
  realtime_process_status_send_interval_sec: 2,
  realtime_output_status_enabled: false,
  realtime_output_status_send_interval_sec: 0.2,
  noise_gate: 0,
  extra_frame_sec: 0,
  crossfade_sec: 0,
  sola_search_frame_sec: 0,
  gpu_device_id_int: 0,
  input_sample_rate: 0,
  output_sample_rate: 0,
  monitor_sample_rate: 0
};
const useServerConfig = options => {
  const {
      t
    } = useTranslation(),
    restClient = ReactRuntime.useMemo(() => VoiceChangerApiClient.getInstance(), []),
    [serverConfiguration, setServerConfiguration] = ReactRuntime.useState(DefaultServerConfiguration),
    [serverAudioInputDevices, setServerAudioInputDevices] = ReactRuntime.useState([]),
    [serverAudioOutputDevices, setServerAudioOutputDevices] = ReactRuntime.useState([]),
    [serverGpuInfo, setServerGpuInfo] = ReactRuntime.useState([]),
    [serverModuleStatus, setServerModuleStatus] = ReactRuntime.useState([]),
    [serverSlotInfos, setServerSlotInfos] = ReactRuntime.useState([]),
    [samples, setSamples] = ReactRuntime.useState([]),
    [localVoiceChangerInterfaceInfo, setLocalVoiceChangerInterfaceInfo] = ReactRuntime.useState(),
    reloadServerConfiguration = ReactRuntime.useCallback(async () => {
      const Ut = await restClient.getServerConfiguration();
      setServerConfiguration(Ut);
    }, [restClient]),
    reloadServerAudioInputDevices = ReactRuntime.useCallback(async (Ut = false) => {
      const nr = await restClient.getServerAudioInputDevices(Ut);
      setServerAudioInputDevices(nr);
    }, [restClient]),
    reloadServerAudioOutputDevices = ReactRuntime.useCallback(async (Ut = false) => {
      const nr = await restClient.getServerAudioOutputDevices(Ut);
      setServerAudioOutputDevices(nr);
    }, [restClient]),
    reloadServerGpuInfo = ReactRuntime.useCallback(async () => {
      const Ut = await restClient.getServerGPUInfo();
      setServerGpuInfo(Ut);
    }, [restClient]),
    reloadServerModuleStatus = ReactRuntime.useCallback(async (Ut = false) => {
      const nr = await restClient.getServerModuleStatus(Ut);
      setServerModuleStatus(nr);
    }, [restClient]),
    reloadSamples = ReactRuntime.useCallback(async () => {
      const Ut = await restClient.getSamples();
      setSamples(Ut);
    }, [restClient]),
    reloadServerSlotInfos = ReactRuntime.useCallback(async () => {
      const Ut = await restClient.getServerSlotInfos();
      setServerSlotInfos(Ut);
    }, [restClient]),
    reloadLocalVoiceChangerInterfaceInfo = ReactRuntime.useCallback(async () => {
      const Ut = await restClient.getLocalVoiceChangerInterfaceInfo();
      setLocalVoiceChangerInterfaceInfo(Ut);
    }, [restClient]);
  ReactRuntime.useEffect(() => {
    logMessage("info", logPrefix$1, "load server information");
    reloadServerConfiguration();
    reloadServerAudioInputDevices();
    reloadServerAudioOutputDevices();
    reloadServerGpuInfo();
    reloadServerModuleStatus();
    reloadSamples();
    reloadServerSlotInfos();
    reloadLocalVoiceChangerInterfaceInfo();
  }, [restClient, reloadServerConfiguration, reloadServerAudioInputDevices, reloadServerAudioOutputDevices, reloadServerGpuInfo, reloadServerModuleStatus, reloadSamples, reloadServerSlotInfos, reloadLocalVoiceChangerInterfaceInfo]);
  ReactRuntime.useEffect(() => {
    restClient.setEnableFlatPath(options.flatPath);
  }, [restClient, options.flatPath]);
  const withHttpErrorToast = ReactRuntime.useCallback(async Ut => {
      try {
        await Ut();
      } catch (nr) {
        logMessage("error", logPrefix$1, t("common.error_messages.error_occurred"), nr);
        const mr = nr;
        if (mr.type == VOICE_CHANGER_CLIENT_EXCEPTION.ERR_HTTP_EXCEPTION) {
          const gr = `${mr.status}[${mr.statusText}]: ${mr.reason} ${mr.action}`;
          options.triggerToast("error", gr);
        } else throw nr;
      }
    }, [options, t]),
    Ce = ReactRuntime.useCallback(async Ut => {
      await restClient.updateServerConfiguration(Ut);
      reloadServerConfiguration();
      reloadServerSlotInfos();
    }, [restClient, reloadServerConfiguration, reloadServerSlotInfos]),
    updateServerConfiguration = ReactRuntime.useCallback(async Ut => {
      await withHttpErrorToast(async () => {
        await Ce(Ut);
      });
    }, [withHttpErrorToast, Ce]),
    downloadApplioModules = ReactRuntime.useCallback(async () => {
      const Ut = await restClient.downloadApplioModules();
      return reloadServerModuleStatus(), Ut;
    }, [restClient, reloadServerModuleStatus]),
    downloadSample = ReactRuntime.useCallback(async (Ut, nr) => {
      const mr = await restClient.downloadSample(Ut, nr);
      return reloadServerSlotInfos(), mr;
    }, [restClient, reloadServerSlotInfos]),
    uploadModelFile = ReactRuntime.useCallback(async (Ut, nr, mr, gr = null, Zt) => {
      if (nr === "RVC") {
        const yr = mr.find(_r => _r.kind === "rvcModel")?.file,
          xr = mr.find(_r => _r.kind === "rvcIndex")?.file || null;
        if (!yr) throw new Error(t("common.error_messages.rvc_model_file_required"));
        await restClient.uploadRVCModelFile(Ut, yr, xr, gr, Zt);
      } else if (nr === "Beatrice_v2") {
        const yr = mr.find(xr => xr.kind === "beatriceV2Zip")?.file;
        if (!yr) throw new Error(t("common.error_messages.beatrice_v2_zip_file_required"));
        await restClient.uploadBeatriceV2ModelFile(Ut, yr, Zt);
      } else throw new Error(t("common.error_messages.not_supported_voice_changer_type"));
      reloadServerSlotInfos();
    }, [restClient, reloadServerSlotInfos, t]),
    updateServerSlotInfo = ReactRuntime.useCallback(async Ut => {
      await restClient.updateServerSlotInfo(Ut);
      reloadServerSlotInfos();
    }, [restClient, reloadServerSlotInfos]),
    deleteServerSlotInfo = ReactRuntime.useCallback(async Ut => {
      await restClient.deleteServerSlotInfo(Ut);
      reloadServerSlotInfos();
    }, [restClient, reloadServerSlotInfos]),
    uploadIconFile = ReactRuntime.useCallback(async (Ut, nr, mr) => {
      await restClient.uploadIconFile(Ut, nr, mr);
      reloadServerSlotInfos();
    }, [restClient, reloadServerSlotInfos]),
    uploadBeatriceV2VoiceIconFile = ReactRuntime.useCallback(async (Ut, nr, mr, gr) => {
      await restClient.uploadBeatriceV2VoiceIconFile(Ut, nr, mr, gr);
      reloadServerSlotInfos();
    }, [restClient, reloadServerSlotInfos]),
    updateBeatriceV2VoiceName = ReactRuntime.useCallback(async (Ut, nr, mr) => {
      await restClient.updateBeatriceV2VoiceName(Ut, nr, mr);
      reloadServerSlotInfos();
    }, [restClient, reloadServerSlotInfos]),
    updateBeatriceV2VoiceDescription = ReactRuntime.useCallback(async (Ut, nr, mr) => {
      await restClient.updateBeatriceV2VoiceDescription(Ut, nr, mr);
      reloadServerSlotInfos();
    }, [restClient, reloadServerSlotInfos]),
    getTask = ReactRuntime.useCallback(async Ut => await restClient.getTask(Ut), [restClient]),
    deleteTask = ReactRuntime.useCallback(async Ut => {
      await restClient.deleteTask(Ut);
    }, [restClient]),
    initializeServer = ReactRuntime.useCallback(async () => {
      await restClient.initializeServer();
      reloadServerSlotInfos();
    }, [restClient, reloadServerSlotInfos]),
    mergeModels = ReactRuntime.useCallback(async Ut => {
      await restClient.mergeModels(Ut);
      reloadServerSlotInfos();
    }, [restClient, reloadServerSlotInfos]),
    exportToOnnx = ReactRuntime.useCallback(async Ut => {
      await restClient.exportToOnnx(Ut);
      reloadServerSlotInfos();
    }, [restClient, reloadServerSlotInfos]),
    exportModel = ReactRuntime.useCallback(async Ut => {
      const nr = await restClient.export(Ut);
      return reloadServerSlotInfos(), nr;
    }, [restClient, reloadServerSlotInfos]),
    moveMergedModel = ReactRuntime.useCallback(async Ut => {
      const nr = {
        dst: Ut
      };
      await restClient.moveMergedModel(nr);
      reloadServerSlotInfos();
    }, [restClient, reloadServerSlotInfos]),
    moveExportedOnnxModel = ReactRuntime.useCallback(async Ut => {
      const nr = {
        dst: Ut
      };
      await restClient.moveExportedOnnxModel(nr);
      reloadServerSlotInfos();
    }, [restClient, reloadServerSlotInfos]),
    moveModel = ReactRuntime.useCallback(async (Ut, nr) => {
      const mr = {
        src: Ut,
        dst: nr
      };
      await restClient.moveModel(mr);
      reloadServerSlotInfos();
    }, [restClient, reloadServerSlotInfos]),
    startServerDevice = ReactRuntime.useCallback(async () => {
      await withHttpErrorToast(async () => {
        await restClient.startServerDevice();
      });
      reloadLocalVoiceChangerInterfaceInfo();
    }, [restClient, withHttpErrorToast, reloadLocalVoiceChangerInterfaceInfo]),
    stopServerDevice = ReactRuntime.useCallback(async () => {
      await restClient.stopServerDevice();
      reloadLocalVoiceChangerInterfaceInfo();
    }, [restClient, reloadLocalVoiceChangerInterfaceInfo]),
    setLocalVoiceChangerDummyInput = ReactRuntime.useCallback(async Ut => {
      await restClient.setLocalVoiceChangerDummyInput(Ut);
    }, [restClient]),
    truncateOutputBuffer = ReactRuntime.useCallback(async () => {
      await restClient.truncateOutputBuffer();
    }, [restClient]),
    refreshVoiceChangerIOQueue = ReactRuntime.useCallback(async () => {
      await restClient.refreshQueue();
    }, [restClient]);
  return {
    serverConfiguration,
    serverAudioInputDevices,
    serverAudioOutputDevices,
    serverGpuInfo,
    serverModuleStatus,
    samples,
    serverSlotInfos,
    localVoiceChangerInterfaceInfo,
    reloadServerConfiguration,
    reloadServerAudioInputDevices,
    reloadServerAudioOutputDevices,
    reloadServerSlotInfos,
    reloadLocalVoiceChangerInterfaceInfo,
    reloadServerModuleStatus,
    updateServerConfiguration,
    downloadApplioModules,
    downloadSample,
    uploadModelFile,
    updateServerSlotInfo,
    deleteServerSlotInfo,
    uploadIconFile,
    uploadBeatriceV2VoiceIconFile,
    updateBeatriceV2VoiceName,
    updateBeatriceV2VoiceDescription,
    getTask,
    deleteTask,
    initializeServer,
    mergeModels,
    exportToOnnx,
    exportModel,
    moveMergedModel,
    moveExportedOnnxModel,
    moveModel,
    startServerDevice,
    stopServerDevice,
    setLocalVoiceChangerDummyInput,
    truncateOutputBuffer,
    refreshVoiceChangerIOQueue
  };
};
export { useServerConfig };
