// Stable platform boundary shared by the browser and Tauri desktop application.
export { invokePlatform as invoke, listenPlatformEvent as listen } from './browser-adapter.js';
