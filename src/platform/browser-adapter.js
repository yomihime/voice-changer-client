// Keep platform integration outside the recovered React application.
export async function invokePlatform(command, args = {}, options) {
  if (window.__TAURI__?.core?.invoke) return window.__TAURI__.core.invoke(command, args, options);
  switch (command) {
    case 'get_shortcut_settings':
      return { enabled: false, shortcuts: [] };
    case 'update_shortcut_settings':
    case 'register_shortcuts':
      throw new Error('当前浏览器版本尚未实现全局快捷键。');
    case 'open_browser_url': {
      const url = new URL(args.url);
      if (url.protocol !== 'https:') throw new Error('Only HTTPS links are supported');
      window.open(url.href, '_blank', 'noopener,noreferrer');
      return;
    }
    case 'open_log_window': {
      const url = new URL(window.location.href);
      url.searchParams.set('app_mode', 'LogViewer');
      window.open(url.href, '_blank');
      return;
    }
    case 'set_clear_site_data_and_stop_app':
      localStorage.clear();
      sessionStorage.clear();
      for (const key of await caches.keys()) await caches.delete(key);
      // Browser storage only. The separately managed inference service keeps running.
      window.location.reload();
      return;
    default:
      throw new Error(`Unsupported platform command: ${command}`);
  }
}

export async function listenPlatformEvent(event, callback, options) {
  if (window.__TAURI__?.event?.listen) return window.__TAURI__.event.listen(event, callback, options);
  if (window.__TAURI__?.core?.invoke) throw new Error('Tauri event API is unavailable. Enable app.withGlobalTauri.');
  if (event !== 'shortcut-action') throw new Error(`Unsupported platform event: ${event}`);
  // Browser sessions do not register native global shortcuts.
  return () => {};
}
