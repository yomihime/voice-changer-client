'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

test('browser sessions keep log windows and reject unsupported native shortcuts', async () => {
  const { invoke, listen } = await import('../src/platform/bridge.js');
  const opened = [];
  global.window = { location: { href: 'http://127.0.0.1:21415/?language=zh' }, open: (...args) => opened.push(args) };
  try {
    assert.deepEqual(await invoke('get_shortcut_settings'), { enabled: false, shortcuts: [] });
    assert.equal(typeof await listen('shortcut-action', () => {}), 'function');
    await assert.rejects(invoke('register_shortcuts'), /全局快捷键/);
    await assert.rejects(invoke('open_browser_url', { url: 'file:///C:/Windows' }), /HTTPS/);
    await invoke('open_log_window');
    const logUrl = new URL(opened[0][0]);
    assert.equal(logUrl.origin, window.location.origin || 'http://127.0.0.1:21415');
    assert.equal(logUrl.searchParams.get('app_mode'), 'LogViewer');
    assert.equal(logUrl.searchParams.get('language'), 'zh');
    await assert.rejects(listen('unknown-event', () => {}), /Unsupported platform event/);
  } finally { delete global.window; }
});

test('Tauri uses its public invoke and event APIs, including event cleanup and log windows', async () => {
  const { invoke, listen } = await import('../src/platform/bridge.js');
  const calls = [];
  const payloads = [];
  let unsubscribed = false;
  const options = { target: { kind: 'Window', label: 'main' } };
  global.window = {
    __TAURI__: {
      core: { invoke: async (...args) => { calls.push(args); return 'native-result'; } },
      event: { listen: async (name, callback, suppliedOptions) => {
        assert.equal(name, 'shortcut-action');
        assert.equal(suppliedOptions, options);
        callback({ event: name, id: 7, payload: { action: 'VolumeChange', volumeType: 'input', delta: 0.1 } });
        return () => { unsubscribed = true; };
      } }
    },
    open: () => { throw new Error('Native log window must not use window.open'); },
    __TAURI_INTERNALS__: { invoke: () => { throw new Error('Private Tauri API must not be used'); } }
  };
  try {
    const config = { enabled: true, shortcuts: [] };
    assert.equal(await invoke('update_shortcut_settings', { configDto: config }), 'native-result');
    assert.deepEqual(calls[0], ['update_shortcut_settings', { configDto: config }, undefined]);
    await invoke('open_log_window');
    assert.equal(calls[1][0], 'open_log_window');
    const unlisten = await listen('shortcut-action', event => payloads.push(event.payload), options);
    assert.deepEqual(payloads, [{ action: 'VolumeChange', volumeType: 'input', delta: 0.1 }]);
    unlisten();
    assert.equal(unsubscribed, true);
    window.__TAURI__.core.invoke = async () => { throw new Error('Registration failed'); };
    await assert.rejects(invoke('register_shortcuts'), /Registration failed/);
    delete window.__TAURI__.event;
    await assert.rejects(listen('shortcut-action', () => {}), /event API is unavailable/);
  } finally { delete global.window; }
});

test('desktop notification messages use the in-app notification callback', async () => {
  const { listenNativeNotifications } = await import('../src/platform/native-notifications.js');
  const messages = [];
  const unlisten = () => {};
  global.window = {};
  try {
    assert.equal(typeof await listenNativeNotifications(() => { throw new Error('Browser must not receive native events'); }), 'function');
    window.__TAURI__ = {
      core: { invoke: async () => {} },
      event: { listen: async (name, callback) => {
        assert.equal(name, 'native-notification');
        callback({ payload: { title: 'Voice Changer', message: 'Output volume: 1.1' } });
        callback({ payload: null });
        callback({ payload: { message: '' } });
        return unlisten;
      } }
    };
    assert.equal(await listenNativeNotifications(message => messages.push(message)), unlisten);
    assert.deepEqual(messages, ['Output volume: 1.1']);
    window.location = { search: '?app_mode=LogViewer' };
    window.__TAURI__.event.listen = async () => { throw new Error('Log windows must not subscribe to native commands'); };
    assert.equal(typeof await listenNativeNotifications(() => {}), 'function');
  } finally { delete global.window; }
});
