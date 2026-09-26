// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
const MAX_SLOT_INDEX = 199;
const VOICE_CHANGER_CLIENT_EXCEPTION = {
  ERR_HTTP_EXCEPTION: "ERR_HTTP_EXCEPTION"
};
const VoiceChangerInputMode = {
  server: "server",
  client: "client"
};
const VoiceChangerType = {
  RVC: "RVC",
  Beatrice_v2: "Beatrice_v2"
};
const EmbedderType = {
  hubert_base_l9fp: "hubert_base_l9fp",
  hubert_base_l12: "hubert_base_l12",
  contentvec: "contentvec",
  hubert_base_japanese_l9fp: "hubert_base_japanese_l9fp",
  hubert_base_japanese_l12: "hubert_base_japanese_l12",
  whisper: "whisper",
  applio_japanese_hubert_base_l12: "applio_japanese_hubert_base_l12",
  applio_chinese_hubert_base_l12: "applio_chinese_hubert_base_l12",
  applio_korean_hubert_base_l12: "applio_korean_hubert_base_l12"
};
const PitchEstimatorType = {
  harvest: "harvest",
  dio: "dio",
  crepe_full: "crepe_full",
  crepe_tiny: "crepe_tiny",
  rmvpe: "rmvpe",
  rmvpe_onnx: "rmvpe_onnx",
  fcpe: "fcpe"
};
const InputAudioType = {
  MICROPHONE: "microphone",
  FILE: "file",
  CAPTURE: "capture",
  SAMPLE: "sample"
};
export { VoiceChangerType, MAX_SLOT_INDEX, VoiceChangerInputMode, InputAudioType, EmbedderType, PitchEstimatorType, VOICE_CHANGER_CLIENT_EXCEPTION };
