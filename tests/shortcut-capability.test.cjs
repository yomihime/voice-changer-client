const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('native shortcut reports unsupported client audio without starting or claiming success', async () => {
  for (const [mode, expectedMessage] of [['client', '音声接続は未対応です。'],
    ['server', 'common.controls.device_not_selected_error']]) {
  const effects = [], starts = [], notifications = [];
  let handleShortcut;
  const source = fs.readFileSync(path.join(__dirname, '../src/hooks/useHotKeySetting.js'), 'utf8')
    .replace(/^import .*;\r?$/gm, '').replace(/export \{ useHotKeySetting \};/, '')
    + '\nglobalThis.runHook = useHotKeySetting;';
  const context = {
    console: { log() {}, warn() {}, error() {} },
    ReactRuntime: { useState: value => [value, () => {}], useCallback: value => value,
      useEffect: callback => effects.push(callback) },
    useTranslation: () => ({ t: key => key }),
    VoiceChangerInputMode: { client: 'client', server: 'server' },
    VCRestClient: { getInstance: () => ({ getCapabilities: () => ({
      clientAudio: { supported: false, reason: '音声接続は未対応です。' }
    }) }) },
    useAppRoot: () => ({ serverConfiguration: { voice_changer_input_mode: mode, current_slot_index: -1,
      audio_input_device_index: -1, audio_output_device_index: -1 },
      localVoiceChangerInterfaceInfo: {}, serverSlotInfos: [], origin: 'http://test.invalid' }),
    useAppState: () => ({ isStarted: false, isPassthrough: false, nodeInputGain: 1,
      nodeOutputGain: 1, nodeMonitorGain: 0, setIsStarted: value => starts.push(value) }),
    invoke: async (command, args) => {
      if (command === 'show_notification_window_with_message') notifications.push(args.params);
      return { shortcuts: [], enabled: false };
    },
    listen: async (event, callback) => { handleShortcut = callback; return () => {}; }
  };
  vm.runInNewContext(source, context);
  context.runHook();
  effects.forEach(callback => callback());
  await handleShortcut({ payload: { action: 'ToggleVoiceConversion' } });
  assert.deepEqual(starts, []);
  assert.equal(notifications.at(-1).started, false);
  assert.equal(notifications.at(-1).message, expectedMessage);
  }
});
