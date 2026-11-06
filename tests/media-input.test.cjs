const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('file inputs prepare only in a started Client session and Server Device never previews locally', async () => {
  const original = fs.readFileSync(path.join(__dirname, '../src/features/audio-controls/InputControls.js'), 'utf8');
  for (const [mode, ready, inputType = 'file'] of [['client', false], ['client', true], ['server', true], ['client', true, 'capture']]) {
    const effects = [], inputs = [], starts = [];
    let stateIndex = 0, refIndex = 0, plays = 0, contexts = 0, stops = 0;
    class Stream { getTracks() { return [{ stop() { stops++; } }]; } }
    const element = { pause() {}, play: async () => { plays++; }, srcObject: null };
    const context = { console: { log() {}, warn() {}, error() {} } };
    for (const match of original.matchAll(/import \{([^}]+)\}/g)) {
      for (const name of match[1].split(',')) context[name.trim().split(/\s+as\s+/).at(-1)] = () => {};
    }
    Object.assign(context, {
      jsxRuntime: { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
      ReactRuntime: { useRef: value => ({ current: refIndex++ === 0 && inputType === 'capture' ? new Stream() : value }), useMemo: callback => callback(),
        useEffect: callback => effects.push(callback), useCallback: callback => callback,
        useState: initial => { const index = stateIndex++; return [index === 5 ? {} : index === 0 && inputType === 'capture' ? true : initial, () => {}]; } },
      useTranslation: () => ({ t: key => key }),
      useTheme: () => ({ palette: { mode: 'light', divider: 'gray', background: {}, text: {} } }),
      useAppState: () => ({ setInputAudio: value => inputs.push(value), inputAudio: 'none',
        inputAudioType: inputType, isStarted: true, isClientInitialized: ready,
        setIsStarted: value => starts.push(value), setInputAudioType() {}, monitorAudio: 'none', outputAudio: 'approved',
        getAudioMetrics: () => ({ output: { active: true, deviceId: 'approved' } }) }),
      useAppRoot: () => ({ serverConfiguration: { voice_changer_input_mode: mode },
        serverAudioInputDevices: [], audioInputs: [], triggerToast() {},
        audioContext: { createMediaElementSource: () => { contexts++; return { connect() {}, disconnect() {} }; },
          createMediaStreamDestination: () => ({ stream: new Stream(), disconnect() {} }) } }),
      InputAudioType: { FILE: 'file', SAMPLE: 'sample', MICROPHONE: 'microphone', CAPTURE: 'capture' },
      VoiceChangerInputMode: { server: 'server', client: 'client' },
      document: { getElementById: () => element }, navigator: { userAgent: 'synthetic' },
      URL: { createObjectURL: () => 'blob:owned-fixture', revokeObjectURL() {} }, MediaStream: Stream,
      fetch: async () => ({ json: async () => ({}) }),
      setTimeout, clearTimeout,
      capabilityProps: () => ({}), silenceOutput: target => { target.pause(); target.srcObject = null; },
      OutputDeviceRouter: class { clear() {} },
      AUDIO_ELEMENT_FOR_INPUT_MEDIA: 'source', AUDIO_ELEMENT_FOR_INPUT_MEDIA_ECHOBACK: 'echo'
    });
    const source = original.replace(/^import .*;\r?$/gm, '').replace(/export \{ InputControls \};/, '')
      + '\nglobalThis.render = InputControls;';
    vm.runInNewContext(source, context);
    const rendered = context.render();
    if (inputType === 'capture') {
      const find = node => {
        if (Array.isArray(node)) return node.map(find).find(Boolean);
        if (!node || typeof node !== 'object') return null;
        if (node.type === context.IconButton && JSON.stringify(node.props.children).includes('stop_capture')) return node;
        return find(node.props?.children);
      };
      const stop = find(rendered);
      assert.ok(stop);
      stop.props.onClick();
      assert.equal(inputs.at(-1), 'none');
      assert.equal(starts.at(-1), false);
      assert.equal(stops, 1);
      continue;
    }
    const cleanups = effects.map(callback => callback());
    await Promise.resolve();
    assert.equal(plays, mode === 'client' && ready ? 1 : 0);
    assert.equal(contexts, mode === 'client' ? 1 : 0);
    assert.equal(inputs.some(input => input instanceof Stream), mode === 'client');
    cleanups.forEach(cleanup => { if (typeof cleanup === 'function') cleanup(); });
    assert.equal(stops, mode === 'client' ? 1 : 0);
  }
});
