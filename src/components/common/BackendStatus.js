import { jsxRuntimeExports as jsx, reactExports as React } from '../../vendor/recovered-runtime.js';
import { backendClient } from '../../api/BackendClient.js';
import { VCRestClient } from '../../api/VoiceChangerApiClient.js';
import { useAppRoot } from '../../state/app-root-context.js';
import { useAppState } from '../../state/app-state-context.js';

export function BackendStatus() {
  const { serverConfiguration, currentSlotInfo, localVoiceChangerInterfaceInfo, serverConnectionError } = useAppRoot();
  const { getAudioMetrics, clientAudioStatus, isStarted, isClientInitialized } = useAppState();
  const getter = React.useRef(getAudioMetrics);
  getter.current = getAudioMetrics;
  const [metrics, setMetrics] = React.useState(null);
  const [audioState, setAudioState] = React.useState(backendClient.audioState);
  React.useEffect(() => {
    const timer = setInterval(() => setMetrics(getter.current?.() || null), 1000);
    const unsubscribe = backendClient.onAudioChange(state => setAudioState({ ...state }));
    return () => { clearInterval(timer); unsubscribe(); };
  }, []);
  if (backendClient.state.protocol !== 'legacy-vcc') return null;
  const capabilities = VCRestClient.getInstance().getCapabilities();
  const reasons = [...new Set(Object.values(capabilities)
    .filter(capability => capability.supported === false).map(capability => capability.reason))];
  const running = localVoiceChangerInterfaceInfo?.local_voice_changer_interface_active === true;
  const deviceStatus = localVoiceChangerInterfaceInfo?.error
    ? '失敗 · ' + localVoiceChangerInterfaceInfo.error
    : localVoiceChangerInterfaceInfo?.state || (running ? 'active' : 'unknown');
  const serverRuntime = localVoiceChangerInterfaceInfo?.runtime_info;
  const modelStatus = currentSlotInfo?.runtime_error ? '失敗 · ' + currentSlotInfo.runtime_error
    : currentSlotInfo?.runtime_available ? '準備完了' : '未準備';
  const clientStateLabel = !isStarted ? '停止中' : !isClientInitialized
    ? metrics?.state === 'warming' ? 'モデルを準備中（マイクはまだ取得していません）' : '開始準備中'
    : '変換中';
  return jsx.jsxs('section', { className: 'backend-status', 'aria-label': 'VCC 接続情報', children: [
    jsx.jsx('p', { role: 'status', children: serverConnectionError
      ? 'サーバー応答エラー · ' + serverConnectionError
      : 'VCC legacy · モデル ' + serverConfiguration.current_slot_index
        + ' ' + modelStatus + ' · Server Device ' + deviceStatus }),
    jsx.jsx('p', { children: 'Client Device はこの PC、Server Device は接続先 PC のデバイスを使用します。' }),
    jsx.jsx('p', { role: 'status', children: audioState.error || clientAudioStatus?.error
      ? '音声を停止しました · ' + (audioState.error || clientAudioStatus.error)
      : metrics?.state ? 'Client audio ' + clientStateLabel + ' · HTTP 待機 ' + metrics.pendingChunks
        + ' · 出力 ' + metrics.queuedFrames + ' samples · 入力破棄 ' + metrics.droppedInputChunks
        + ' blocks · 出力破棄 ' + metrics.droppedOutputFrames + ' samples · RTT '
        + (Number.isFinite(metrics.lastRoundTripMs) ? metrics.lastRoundTripMs.toFixed(1) + ' ms' : '未測定')
        + (metrics.overload ? ' · 過負荷' : '')
      : 'Client audio ' + clientStateLabel }),
    metrics?.lastError && !audioState.error && jsx.jsx('p', { role: 'alert', children:
      typeof metrics.lastError === 'string' ? metrics.lastError : metrics.lastError.code + ' · ' + metrics.lastError.message }),
    Number.isInteger(serverRuntime?.queueCapacityBlocks) && jsx.jsx('p', { children:
      'Server audio · 出力 ' + serverRuntime.outputQueueBlocks + '/' + serverRuntime.queueCapacityBlocks
      + ' blocks · 監視 ' + serverRuntime.monitorQueueBlocks + '/' + serverRuntime.queueCapacityBlocks
      + ' blocks · 破棄 ' + serverRuntime.queueDropCount + ' · underrun ' + serverRuntime.queueUnderflowCount }),
    jsx.jsxs('details', { children: [
      jsx.jsx('summary', { children: 'この接続で利用できない機能' }),
      jsx.jsx('ul', { children: reasons.map(reason => jsx.jsx('li', { children: reason }, reason)) })
    ] })
  ] });
}
