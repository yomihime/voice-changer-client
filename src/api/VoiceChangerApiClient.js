// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { FileUploaderClient } from "./FileUploaderClient.js";
import { RestClient } from "./RestClient.js";
class VoiceChangerApiClient {
  static _instance = null;
  restClient;
  fileUploaderClient;
  enableFlatPath = false;
  constructor() {
    this.restClient = new RestClient();
    this.fileUploaderClient = new FileUploaderClient();
  }
  static getInstance = () => (VoiceChangerApiClient._instance === null && (VoiceChangerApiClient._instance = new VoiceChangerApiClient()), VoiceChangerApiClient._instance);
  setBaseUrl = baseUrl => {
    this.restClient.setBaseUrl(baseUrl);
    this.fileUploaderClient.setBaseUrl(baseUrl);
  };
  setEnableFlatPath = enabled => {
    this.enableFlatPath = enabled;
    this.fileUploaderClient.setEnableFlatPath(enabled);
  };
  generatePath = endpointPath => this.enableFlatPath ? endpointPath[0] + endpointPath.slice(1).replace(/\//g, "_") : endpointPath;
  initializeServer = async () => {
    const endpointPath = this.generatePath("/api/operation/initialize");
    await this.restClient.postRequest(endpointPath, null);
  };
  getServerAudioInputDevices = async (reload = false) => {
    let endpointPath = this.generatePath("/api/audio-device-manager/input_devices");
    return reload && (endpointPath += "?reload=true"), await this.restClient.getRequest(endpointPath);
  };
  getServerAudioOutputDevices = async (reload = false) => {
    let endpointPath = this.generatePath("/api/audio-device-manager/output_devices");
    return reload && (endpointPath += "?reload=true"), await this.restClient.getRequest(endpointPath);
  };
  getServerConfiguration = async () => {
    const endpointPath = this.generatePath("/api/configuration-manager/configuration");
    return await this.restClient.getRequest(endpointPath);
  };
  updateServerConfiguration = async configuration => {
    const endpointPath = this.generatePath("/api/configuration-manager/configuration");
    await this.restClient.putRequest(endpointPath, configuration);
  };
  getServerGPUInfo = async () => {
    const endpointPath = this.generatePath("/api/gpu-device-manager/devices");
    return await this.restClient.getRequest(endpointPath);
  };
  getServerModuleStatus = async (reload = false) => {
    let endpointPath = this.generatePath("/api/module-manager/modules");
    return reload && (endpointPath += "?reload=true"), await this.restClient.getRequest(endpointPath);
  };
  downloadApplioModules = async () => {
    const endpointPath = this.generatePath("/api/module-manager/modules/operation/download_applio_modules");
    return await this.restClient.postRequest(endpointPath, null);
  };
  getSamples = async () => {
    const endpointPath = this.generatePath("/api/sample-manager/samples");
    return await this.restClient.getRequest(endpointPath);
  };
  downloadSample = async (slotIndex, sampleId) => {
    const endpointPath = this.generatePath("/api/sample-manager/samples/operation/download"),
      requestBody = {
        slot_index: slotIndex,
        sample_id: sampleId
      };
    return await this.restClient.postRequest(endpointPath, requestBody);
  };
  getServerSlotInfos = async () => {
    const endpointPath = this.generatePath("/api/slot-manager/slots");
    return await this.restClient.getRequest(endpointPath);
  };
  getServerSlotInfo = async slotIndex => {
    const endpointPath = this.generatePath(`/api/slot-manager/slots/${slotIndex}`);
    return await this.restClient.getRequest(endpointPath);
  };
  uploadFile = async (filenamePrefix, file, onProgress) => {
    const chunkCount = await this.fileUploaderClient.uploadFile(filenamePrefix, file, onProgress);
    await this.fileUploaderClient.concatUploadedFile(file.name, chunkCount);
  };
  uploadRVCModelFile = async (slotIndex, modelFile, indexFile, embedder, onProgress) => {
    const fileCount = indexFile != null ? 2 : 1;
    await this.uploadFile("", modelFile, (O, H) => {
      onProgress(O / fileCount, false);
    });
    indexFile != null && (await this.uploadFile("", indexFile, (O, H) => {
      onProgress(O / fileCount + 100 / fileCount, false);
    }));
    const endpointPath = this.generatePath("/api/slot-manager/slots"),
      requestBody = {
        slot_index: slotIndex ?? null,
        voice_changer_type: "RVC",
        name: modelFile.name.split(".")[0],
        model_file: modelFile.name,
        index_file: indexFile?.name ?? null,
        embedder
      };
    await this.restClient.postRequest(endpointPath, requestBody);
    onProgress(100, true);
  };
  uploadBeatriceV2ModelFile = async (slotIndex, zipFile, onProgress) => {
    await this.uploadFile("", zipFile, (x, T) => {
      onProgress(x / 1, false);
    });
    const endpointPath = this.generatePath("/api/slot-manager/slots"),
      requestBody = {
        slot_index: slotIndex ?? null,
        voice_changer_type: "Beatrice_v2",
        name: zipFile.name.split(".")[0],
        zip_file: zipFile.name
      };
    await this.restClient.postRequest(endpointPath, requestBody);
  };
  uploadIconFile = async (slotIndex, iconFile, onProgress) => {
    await this.uploadFile("", iconFile, (x, T) => {
      onProgress(x, false);
    });
    const endpointPath = this.generatePath("/api/slot-manager/slots/operation/set_icon_file"),
      requestBody = {
        slot_index: slotIndex,
        icon_file: iconFile.name
      };
    await this.restClient.postRequest(endpointPath, requestBody);
  };
  updateServerSlotInfo = async slotInfo => {
    const endpointPath = this.generatePath(`/api/slot-manager/slots/${slotInfo.slot_index}`);
    await this.restClient.putRequest(endpointPath, slotInfo);
  };
  deleteServerSlotInfo = async slotIndex => {
    const endpointPath = this.generatePath(`/api/slot-manager/slots/${slotIndex}`);
    await this.restClient.deleteRequest(endpointPath, null);
  };
  mergeModels = async requestBody => {
    const endpointPath = this.generatePath("/api/slot-manager/slots/operation/merge_models");
    await this.restClient.postRequest(endpointPath, requestBody);
  };
  exportToOnnx = async requestBody => {
    const endpointPath = this.generatePath("/api/slot-manager/slots/operation/export_onnx");
    await this.restClient.postRequest(endpointPath, requestBody);
  };
  export = async requestBody => {
    const endpointPath = this.generatePath("/api/slot-manager/slots/operation/export");
    return await this.restClient.postRequest(endpointPath, requestBody, "blob");
  };
  moveMergedModel = async requestBody => {
    const endpointPath = this.generatePath("/api/slot-manager/slots/operation/move_merged_model");
    await this.restClient.postRequest(endpointPath, requestBody);
  };
  moveExportedOnnxModel = async requestBody => {
    const endpointPath = this.generatePath("/api/slot-manager/slots/operation/move_exported_onnx_model");
    await this.restClient.postRequest(endpointPath, requestBody);
  };
  moveModel = async requestBody => {
    const endpointPath = this.generatePath("/api/slot-manager/slots/operation/move_model");
    await this.restClient.postRequest(endpointPath, requestBody);
  };
  refreshQueue = async () => {
    const endpointPath = this.generatePath("/api/voice-changer/operation/refresh_queue");
    await this.restClient.postRequest(endpointPath, null);
  };
  startServerDevice = async () => {
    const endpointPath = this.generatePath("/api/local-voice-changer-interface/operation/start");
    await this.restClient.postRequest(endpointPath, null);
  };
  stopServerDevice = async () => {
    const endpointPath = this.generatePath("/api/local-voice-changer-interface/operation/stop");
    await this.restClient.postRequest(endpointPath, null);
  };
  truncateOutputBuffer = async () => {
    const endpointPath = this.generatePath("/api/local-voice-changer-interface/operation/truncate-output-buffer");
    await this.restClient.postRequest(endpointPath, null);
  };
  getVoiceChangerManagerInfo = async () => {
    const endpointPath = this.generatePath("/api/voice-changer-manager/information");
    return await this.restClient.getRequest(endpointPath);
  };
  getLocalVoiceChangerInterfaceInfo = async () => {
    const endpointPath = this.generatePath("/api/local-voice-changer-interface/information");
    return await this.restClient.getRequest(endpointPath);
  };
  getTask = async taskId => {
    const endpointPath = this.generatePath(`/api/task-manager/tasks/${taskId}`);
    return await this.restClient.getRequest(endpointPath);
  };
  deleteTask = async taskId => {
    const endpointPath = this.generatePath(`/api/task-manager/tasks/${taskId}`);
    await this.restClient.deleteRequest(endpointPath, null);
  };
  uploadBeatriceV2VoiceIconFile = async (slotIndex, voiceIndex, iconFile, onProgress) => {
    await this.uploadFile("", iconFile, (T, A) => {
      onProgress(T, false);
    });
    const endpointPath = this.generatePath("/api/slot-manager/slots/operation/beatricev2/set_voice_icon_file"),
      requestBody = {
        slot_index: slotIndex,
        voice_index: voiceIndex,
        icon_file: iconFile.name
      };
    await this.restClient.postRequest(endpointPath, requestBody);
  };
  updateBeatriceV2VoiceName = async (slotIndex, voiceIndex, voiceName) => {
    const endpointPath = this.generatePath("/api/slot-manager/slots/operation/beatricev2/set_voice_name"),
      requestBody = {
        slot_index: slotIndex,
        voice_index: voiceIndex,
        voice_name: voiceName
      };
    await this.restClient.postRequest(endpointPath, requestBody);
  };
  updateBeatriceV2VoiceDescription = async (slotIndex, voiceIndex, voiceDescription) => {
    const endpointPath = this.generatePath("/api/slot-manager/slots/operation/beatricev2/set_voice_description"),
      requestBody = {
        slot_index: slotIndex,
        voice_index: voiceIndex,
        voice_description: voiceDescription
      };
    await this.restClient.postRequest(endpointPath, requestBody);
  };
  setLocalVoiceChangerDummyInput = async audioUrl => {
    const endpointPath = this.generatePath("/api/local-voice-changer-interface/operation/set_dummy_input"),
      requestBody = {
        url: audioUrl
      };
    await this.restClient.postRequest(endpointPath, requestBody);
  };
}
export { VoiceChangerApiClient as VCRestClient };
