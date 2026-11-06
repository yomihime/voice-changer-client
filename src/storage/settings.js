// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { invoke } from "../platform/bridge.js";
import { isNativeClient } from "../api/BackendClient.js";
import { openDB } from "../vendor/recovered-runtime.js";
const DB_NAME = "vcclient-settings";
const DB_VERSION = 1;
const STORE_NAME = "global-settings";
let db = null;
const initDB = async () => db || (db = await openDB(DB_NAME, DB_VERSION, {
  upgrade(S) {
    S.objectStoreNames.contains(STORE_NAME) || S.createObjectStore(STORE_NAME);
  }
}), db);
let nativeWrites = Promise.resolve();
const saveSettings = async S => {
  if (isNativeClient()) {
    const snapshot = structuredClone(S);
    nativeWrites = nativeWrites.catch(() => {}).then(() => invoke("save_global_settings", { settings: snapshot }));
    await nativeWrites;
  } else await (await initDB()).put(STORE_NAME, S, "settings");
};
const loadSettings = async () => {
  if (isNativeClient()) {
    await nativeWrites.catch(() => {});
    const native = await invoke("load_global_settings");
    if (native != null) return native;
    // Import the existing origin once; the original IndexedDB is retained.
    const legacy = await (await initDB()).get(STORE_NAME, "settings");
    if (legacy != null) await saveSettings(legacy);
    return legacy;
  }
  return (await initDB()).get(STORE_NAME, "settings");
};
export { saveSettings, loadSettings };
