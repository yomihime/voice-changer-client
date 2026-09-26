// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
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
const saveSettings = async S => {
  await (await initDB()).put(STORE_NAME, S, "settings");
};
const loadSettings = async () => (await initDB()).get(STORE_NAME, "settings");
export { saveSettings, loadSettings };
