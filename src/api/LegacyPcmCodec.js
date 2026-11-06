import { backendClient, BackendError } from './BackendClient.js';

// Legacy /test owns resampling, history and SOLA. The client supplies only new mono PCM.
export const MAX_LEGACY_SAMPLES = 240000;

export function float32ToInt16Base64(samples) {
  if (!(samples instanceof Float32Array) || !samples.length || samples.length > MAX_LEGACY_SAMPLES) {
    throw new BackendError('invalid_audio', '音声ブロックの長さが不正です。');
  }
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < samples.length; index++) {
    if (!Number.isFinite(samples[index])) throw new BackendError('invalid_audio', '音声に有限でない値があります。');
    const value = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(index * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
  }
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 32768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  }
  return btoa(binary);
}

export function int16Base64ToFloat32(encoded) {
  if (typeof encoded !== 'string' || encoded.length > Math.ceil(MAX_LEGACY_SAMPLES * 2 / 3) * 4
      || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    throw new BackendError('invalid_audio_response', '音声応答の base64 が不正です。');
  }
  const binary = atob(encoded);
  if (!binary.length || binary.length % 2 || binary.length / 2 > MAX_LEGACY_SAMPLES) {
    throw new BackendError('invalid_audio_response', '音声応答は mono Int16 PCM が必要です。');
  }
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  const samples = new Float32Array(bytes.length / 2);
  for (let index = 0; index < samples.length; index++) {
    const value = view.getInt16(index * 2, true);
    samples[index] = value / (value < 0 ? 32768 : 32767);
  }
  return samples;
}

export async function convertLegacyAudio(samples, { generation = backendClient.generation,
  signal, timestamp = Date.now(), expectedSamples = samples.length, streamEpoch, sequence, timeoutMs = 10000 } = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) {
    throw new BackendError('invalid_audio_configuration', '音声要求のタイムアウトが不正です。');
  }
  if (!Number.isSafeInteger(timestamp) || timestamp < 0) {
    throw new BackendError('invalid_audio', '音声要求の識別子が不正です。');
  }
  if (streamEpoch !== undefined && (typeof streamEpoch !== 'string' || !streamEpoch.length
      || streamEpoch.length > 64 || !Number.isSafeInteger(sequence) || sequence < 0)) {
    throw new BackendError('invalid_audio', '音声セッションの識別子が不正です。');
  }
  const result = await backendClient.request('/test', {
    generation, method: 'POST',
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timestamp, buffer: float32ToInt16Base64(samples),
      ...(streamEpoch === undefined ? {} : { stream_epoch: streamEpoch, sequence }) }),
    consume: async response => {
      let data;
      try { data = await response.json(); }
      catch {
        throw new BackendError(response.ok ? 'invalid_audio_response' : 'http_error',
          '音声応答の JSON が不正です。', { status: response.status });
      }
      if (!response.ok) throw new BackendError(data?.error?.code || 'http_error',
        data?.error?.reason || 'HTTP ' + response.status, { status: response.status });
      return data;
    }
  });
  if (result?.timestamp !== timestamp) {
    throw new BackendError('invalid_audio_response', '音声応答の識別子が一致しません。');
  }
  if (streamEpoch !== undefined && (result.stream_epoch !== streamEpoch || result.sequence !== sequence)) {
    throw new BackendError('stale_session', '古い音声セッションの応答を破棄しました。');
  }
  const output = int16Base64ToFloat32(result.changedVoiceBase64);
  // VCC uses a one-sample zero response for missing/warming/failed engines.
  if (output.length === 1) throw new BackendError('model_unavailable', '推論エンジンが有効な音声を返しませんでした。');
  if (expectedSamples !== null && output.length !== expectedSamples) {
    throw new BackendError('invalid_audio_response', '音声応答のサンプル数が契約と一致しません。');
  }
  return output;
}
