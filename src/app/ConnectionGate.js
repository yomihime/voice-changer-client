import { jsxRuntimeExports as jsx, reactExports as React } from '../vendor/recovered-runtime.js';
import { invoke } from '../platform/bridge.js';
import { backendClient, DEFAULT_BACKEND } from '../api/BackendClient.js';

export function ConnectionGate({ children }) {
  const [state, setState] = React.useState(backendClient.state);
  const [address, setAddress] = React.useState(DEFAULT_BACKEND);
  const [offline, setOffline] = React.useState(false);
  const connect = async (value, options = {}) => {
    backendClient.publish({ phase: "preparing-settings", message: "保存済み設定を確認しています。" });
    try { await invoke("load_global_settings"); } catch (error) {
      backendClient.publish({ phase: "settings-error", message: "保存済み設定を移行できませんでした。元のデータは保持しています。 " + String(error) });
      return false;
    }
    return backendClient.connect(value, options);
  };
  React.useEffect(() => {
    let active = true;
    const unsubscribe = backendClient.subscribe(value => { if (active) setState({ ...value }); });
    (async () => {
      try {
        const profile = await invoke('get_connection_profile');
        if (!active) return;
        setAddress(profile.manual_address || DEFAULT_BACKEND);
        if (profile.offline) { setOffline(true); return; }
      } catch (error) { if (active) backendClient.publish({ phase: 'settings-error', message: '保存済み設定を読み込めませんでした。 ' + String(error) }); return; }
      if (active) await connect(DEFAULT_BACKEND, { probing: true });
    })();
    return () => { active = false; unsubscribe(); backendClient.invalidate(); };
  }, []);
  if (offline) return children;
  const busy = ['idle', 'preparing-settings', 'probing', 'connecting'].includes(state.phase);
  if (state.phase === 'ready') {
    return jsx.jsxs(React.Fragment, { children: [
      jsx.jsxs('div', { className: 'connection-strip', children: [
        jsx.jsx('span', { children: state.address + ' · ' + state.protocol }),
        jsx.jsx('button', { type: 'button', onClick: () => backendClient.disconnect(), children: '接続先を変更' })
      ] }), children
    ] });
  }
  const recognized = state.phase === 'ready';
  return jsx.jsx('main', { className: 'connection-page', children: jsx.jsxs('section', {
    className: 'connection-card', 'aria-labelledby': 'connection-title', children: [
      jsx.jsx('p', { className: 'connection-brand', children: 'VOICE CHANGER CLIENT' }),
      jsx.jsx('h1', { id: 'connection-title', children: busy ? 'サーバーに接続しています' : recognized ? 'VCC サーバーを識別しました' : 'サーバーに接続' }),
      jsx.jsx('p', { role: 'status', 'aria-live': 'polite', 'data-connection-state': state.phase,
        children: busy ? '起動時は localhost:18888 を先に確認します。しばらくお待ちください。'
          : recognized ? '接続は確認できました。旧 VCC の操作・音声アダプターは別途検証が必要です。'
          : state.message || '接続先のアドレスを入力するか、サーバー起動後に再試行してください。' }),
      jsx.jsxs('form', { onSubmit: event => { event.preventDefault(); void connect(address, { remember: true }).catch(error => backendClient.publish({ phase: 'needs-address', message: error.message })); }, children: [
        jsx.jsx('label', { htmlFor: 'backend-address', children: 'バックエンド URL' }),
        jsx.jsx('input', { id: 'backend-address', type: 'url', required: true, value: address,
          disabled: busy, onChange: event => setAddress(event.target.value), placeholder: 'http://localhost:18888/', autoComplete: 'url', spellCheck: false }),
        jsx.jsx('p', { className: 'connection-hint', children: 'http / https、ホスト、ポート、必要なベースパスを指定できます。画面用の内部ポートとは別の設定です。' }),
        jsx.jsxs('div', { className: 'connection-actions', children: [
          jsx.jsx('button', { type: 'submit', disabled: busy, children: '接続' }),
          jsx.jsx('button', { type: 'button', disabled: busy, onClick: () => { void connect(DEFAULT_BACKEND, { probing: true }); }, children: 'localhost:18888 を再試行' })
        ] })
      ] }),
      jsx.jsx('p', { className: 'connection-note', children: 'サーバーの識別、操作機能、実際の音声変換はそれぞれ別の検証です。' })
    ]
  }) });
}
