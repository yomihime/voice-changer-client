const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('parameter display removes arithmetic noise without hiding off-grid values', async () => {
  const { parameterValue } = await import('../src/domain/numeric-display.js');
  assert.equal(parameterValue(0.1 + 0.2), '0.30');
  assert.equal(parameterValue(0.35), '0.35');
  assert.equal(parameterValue(1), '1.00');
  assert.equal(parameterValue(0.35125), '0.35125');
  assert.equal(parameterValue(0.300001), '0.300001');
  assert.equal(parameterValue(1e-16), '1e-16');
  assert.equal(parameterValue(null), '未取得');
  assert.equal(parameterValue(NaN), '未取得');
});

test('extra frames use the actual sample rate and unknown rates do not produce invented frame counts', async () => {
  const { durationWithFrames } = await import('../src/domain/numeric-display.js');
  assert.equal(durationWithFrames(16384 / 44100, 44100), '約371.519 ms（16384 frames）');
  assert.equal(durationWithFrames(0.1, null), '100 ms');
});

test('chunk labels distinguish requested presets from actual Legacy units and custom values', async () => {
  const { legacyChunkSeconds, legacyChunkUnits, chunkDurationLabel, chunkDurationOptions } = await import('../src/domain/legacy-chunk.js');
  const value = legacyChunkSeconds(38);
  assert.equal(chunkDurationLabel(value, [0.1, 0.2], true), '約101.333 ms（4864 frames・0.1 s プリセット）');
  assert.equal(chunkDurationLabel(0.128, [0.1, 0.2], true), '128 ms（6144 frames・カスタム）');
  assert.equal(chunkDurationLabel(0.2, [0.1, 0.2], true), '200 ms（9600 frames・0.2 s プリセット）');
  assert.equal(legacyChunkUnits(value), 38);
  assert.equal(chunkDurationOptions([0.1], value, true)[0], value);
  // Display strings never replace the exact select/backend value.
  assert.notEqual(value, 0.101333);
  assert.equal(chunkDurationLabel(0.1, [0.1], false), '100 ms（4800 frames・0.1 s プリセット）');
  assert.deepEqual(chunkDurationOptions([0.1, 0.2], 16384 / 44100, false), [0.1, 0.2, 16384 / 44100]);
});

async function renderSettings(relativePath, component, configuration) {
  const { parameterValue } = await import('../src/domain/numeric-display.js');
  const updates = [];
  const jsx = (type, props) => ({ type, props });
  const source = fs.readFileSync(path.join(__dirname, relativePath), 'utf8')
    .replace(/^import .*;\r?$/gm, '').replace(new RegExp(`export \\{ ${component} \\};`), '')
    + `\nglobalThis.render = ${component};`;
  const context = {
    console: { log() {}, warn() {}, error() {} }, parameterValue,
    jsxRuntime: { jsx, jsxs: jsx, Fragment: 'Fragment' },
    ReactRuntime: { useMemo: callback => callback(), useCallback: callback => callback,
      useState: value => [value, () => {}], useRef: value => ({ current: value }), useEffect() {} },
    useTranslation: () => ({ t: key => key }), capabilityProps: () => ({}),
    Dialog: 'Dialog', DialogContent: 'DialogContent', Button: 'Button', ButtonGroup: 'ButtonGroup', WaitingDialog: 'WaitingDialog',
    VoiceChangerInputMode: { client: 'client', server: 'server' },
    useAppState: () => ({ realtimeOutputStatusSendIntervalSec: configuration.realtime_output_status_send_interval_sec }),
    useAppRoot: () => ({ serverConfiguration: configuration,
      updateServerConfiguration: async value => updates.push(value), audioInputs: [], audioOutputs: [],
      serverAudioInputDevices: [], serverAudioOutputDevices: [], serverGpuInfo: [] })
  };
  vm.runInNewContext(source, context);
  const nodes = [];
  const visit = node => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (node && typeof node === 'object' && node.props) {
      nodes.push(node);
      visit(node.props.children);
    }
  };
  visit(context.render({ open: true, onClose() {} }));
  return { nodes, updates };
}

test('settings render readable values while retaining exact range and write values', async () => {
  const raw = 0.1 + 0.2;
  const { nodes, updates } = await renderSettings('../src/features/audio-controls/SettingsDialog.js', 'SettingsDialog', {
    voice_changer_input_mode: 'client', noise_gate: raw,
    enable_high_pass_filter: true, high_pass_filter_cutoff: 80,
    enable_low_pass_filter: true, low_pass_filter_cutoff: 8000
  });
  const gate = nodes.find(node => node.type === 'input' && node.props.step === '0.001');
  assert.equal(gate.props.value, raw);
  assert.ok(nodes.some(node => node.type === 'span' && node.props.children === '0.30' && node.props.title === String(raw)));
  assert.ok(nodes.some(node => node.type === 'span' && Array.isArray(node.props.children) && node.props.children.join('') === '80 Hz'));
  await gate.props.onChange({ target: { value: '0.35125' } });
  assert.equal(updates.at(-1).noise_gate, 0.35125);
});

test('advanced intervals retain server and client precision without exposing arithmetic tails', async () => {
  const raw = 0.1 + 0.02;
  for (const mode of ['client', 'server']) {
    const { nodes, updates } = await renderSettings('../src/features/settings/AdvancedSettingDialog.js', 'AdvancedSettingDialog', {
      voice_changer_input_mode: mode, realtime_output_status_send_interval_sec: raw,
      realtime_process_status_send_interval_sec: 0.35125
    });
    const output = nodes.find(node => node.type === 'input' && node.props.step === '0.04');
    const process = nodes.find(node => node.type === 'input' && node.props.step === '0.1');
    assert.equal(output.props.value, raw);
    assert.ok(nodes.some(node => node.type === 'span' && node.props.children === '0.12'));
    assert.ok(nodes.some(node => node.type === 'span' && node.props.children === '0.35125'));
    await process.props.onChange({ target: { value: '0.37125' } });
    assert.equal(updates.at(-1).realtime_process_status_send_interval_sec, 0.37125);
  }
});
