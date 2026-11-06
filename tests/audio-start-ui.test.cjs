'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Render the controls with synthetic state; no DOM, devices or backend are used.
function controls(state = {}) {
  const started = [];
  const source = fs.readFileSync(path.join(__dirname, '..', 'src/features/audio-controls/MainControls.js'), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace(/^export .*;\r?$/gm, '');
  const jsx = (type, props) => ({ type, props });
  const scope = {
    jsxRuntime: { jsx, jsxs: jsx }, ReactRuntime: { useState: value => [value, () => {}], useMemo: fn => fn(), useCallback: fn => fn },
    useTranslation: () => ({ t: key => key }), useAppState: () => ({ isStarted: false, isClientInitialized: false,
      clientAudioStatus: { phase: 'stopped', error: null }, setIsStarted: value => started.push(value), ...state }),
    useAppRoot: () => ({ serverConfiguration: { voice_changer_input_mode: 'client' }, serverGpuInfo: [], triggerToast() {} }),
    capabilityProps: () => ({ disabled: false }), VoiceChangerInputMode: { server: 'server' }
  };
  for (const name of ['Tooltip', 'IconButton', 'Chip', 'Box', 'Stack', 'FiberManualRecord', 'PlayArrow', 'Settings', 'Stop', 'SwapHoriz', 'SettingsDialog']) scope[name] = name;
  vm.runInNewContext(source + '\nglobalThis.rendered = MainControls();', scope);
  const nodes = [];
  const visit = node => {
    if (node == null || node === false) return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (typeof node === 'object') { nodes.push(node); visit(node.props?.children); }
  };
  visit(scope.rendered);
  return { nodes, started, start: nodes.find(node => node.props?.['aria-label'] === '変換を開始'),
    status: nodes.find(node => ['status', 'alert'].includes(node.props?.role)) };
}

test('Start requests a session, then shows preparation until actual initialization completes', async () => {
  const stopped = controls();
  assert.equal(stopped.start.props.disabled, false);
  await stopped.start.props.onClick();
  assert.deepEqual(stopped.started, [true]);
  const preparing = controls({ isStarted: true });
  assert.equal(preparing.start.props.disabled, true);
  assert.equal(preparing.start.props['aria-busy'], true);
  assert.match(preparing.status.props.children, /開始準備中/);
  assert.equal(preparing.start.props.color, 'default', 'Start intent alone is not successful conversion');
  const running = controls({ isStarted: true, isClientInitialized: true });
  assert.equal(running.start.props.color, 'primary');
  assert.match(running.status.props.children, /変換中/);
});

test('Start failures remain beside the controls after isStarted returns to false', () => {
  const failed = controls({ clientAudioStatus: { phase: 'failed', error: '入力デバイスを選択してください。' } });
  assert.equal(failed.status.props.role, 'alert');
  assert.match(failed.status.props.children, /入力デバイスを選択/);
  assert.equal(failed.start.props.disabled, false, 'user can correct settings and explicitly retry');
});

test('a selected silent monitor has a nonblocking hint without changing target-only starts', () => {
  const muted = controls({ monitorAudio: 'synthetic-monitor', nodeMonitorGain: 0 });
  assert.ok(muted.nodes.some(node => node.props?.['data-testid'] === 'monitor-volume-hint'
    && node.props.children.includes('モニター音量が0')));
  assert.equal(muted.start.props.disabled, false);
  for (const state of [{ monitorAudio: 'none', nodeMonitorGain: 0 }, { monitorAudio: 'synthetic-monitor', nodeMonitorGain: 0.3 }]) {
    const normal = controls(state);
    assert.equal(normal.nodes.some(node => node.props?.['data-testid'] === 'monitor-volume-hint'), false);
    assert.equal(normal.start.props.disabled, false);
  }
});
