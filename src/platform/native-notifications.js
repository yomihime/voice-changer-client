import { listenPlatformEvent } from './browser-adapter.js';

// Desktop shortcut results use the existing in-app toast, not an OS overlay.
export async function listenNativeNotifications(showNotification) {
  if (!window.__TAURI__?.core?.invoke) return () => {};
  if (new URLSearchParams(window.location?.search).get('app_mode') === 'LogViewer') return () => {};
  return listenPlatformEvent('native-notification', event => {
    const message = event.payload?.message;
    if (typeof message === 'string' && message.trim()) showNotification(message);
  });
}
