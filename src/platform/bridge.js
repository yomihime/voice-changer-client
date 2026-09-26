// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { invokePlatform, listenPlatformEvent } from "./browser-adapter.js";
function transformCallback(S, C = false) {
  return window.__TAURI_INTERNALS__.transformCallback(S, C);
}
async function invoke(S, C = {}, E) {
  return invokePlatform(S, C, E);
}
var TauriEvent;
(function (S) {
  S.WINDOW_RESIZED = "tauri://resize";
  S.WINDOW_MOVED = "tauri://move";
  S.WINDOW_CLOSE_REQUESTED = "tauri://close-requested";
  S.WINDOW_DESTROYED = "tauri://destroyed";
  S.WINDOW_FOCUS = "tauri://focus";
  S.WINDOW_BLUR = "tauri://blur";
  S.WINDOW_SCALE_FACTOR_CHANGED = "tauri://scale-change";
  S.WINDOW_THEME_CHANGED = "tauri://theme-changed";
  S.WINDOW_CREATED = "tauri://window-created";
  S.WEBVIEW_CREATED = "tauri://webview-created";
  S.DRAG_ENTER = "tauri://drag-enter";
  S.DRAG_OVER = "tauri://drag-over";
  S.DRAG_DROP = "tauri://drag-drop";
  S.DRAG_LEAVE = "tauri://drag-leave";
})(TauriEvent || (TauriEvent = {}));
async function _unlisten(S, C) {
  await invoke("plugin:event|unlisten", {
    event: S,
    eventId: C
  });
}
async function listen(S, C, E) {
  if (!window.__TAURI_INTERNALS__) return listenPlatformEvent(S, C);
  var w;
  const R = (w = void 0) !== null && w !== void 0 ? w : {
    kind: "Any"
  };
  return invoke("plugin:event|listen", {
    event: S,
    target: R,
    handler: transformCallback(C)
  }).then(_ => async () => _unlisten(S, _));
}
export { invoke, listen };
