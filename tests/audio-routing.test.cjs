'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

function deferred() {
  let resolve;
  const promise = new Promise(complete => { resolve = complete; });
  return { promise, resolve };
}

function element({ sink = async () => {}, play = async () => {} } = {}) {
  return {
    muted: false, volume: 1, paused: false, srcObject: null, sinkId: 'default', sinks: [], plays: [],
    pause() { this.paused = true; },
    async setSinkId(id) { this.sinks.push(id); await sink(id); this.sinkId = id; },
    async play() { this.plays.push({ sinkId: this.sinkId, muted: this.muted }); await play(); this.paused = false; }
  };
}

const devices = (...ids) => ({ enumerateDevices: async () => ids.map(deviceId => ({ kind: 'audiooutput', deviceId })) });
const load = () => import('../src/audio/device-routing.js');

test('none to an explicit sink unmutes only after sink selection and play succeed', async () => {
  const { OutputDeviceRouter } = await load();
  const output = element();
  const router = new OutputDeviceRouter(output, devices('selected'));
  assert.equal(await router.route('none', {}), false);
  assert.equal(output.muted, true);
  assert.equal(output.volume, 0);
  assert.equal(output.srcObject, null);
  const stream = {};
  assert.equal(await router.route('selected', stream), true);
  assert.deepEqual(output.plays, [{ sinkId: 'selected', muted: true }]);
  assert.equal(output.muted, false);
  assert.equal(output.volume, 1);
  assert.equal(output.srcObject, stream);
  router.clear();
  assert.equal(output.paused, true);
  assert.equal(output.muted, true);
  assert.equal(output.srcObject, null);
});

test('a missing selected sink never plays on an available default device', async () => {
  const { OutputDeviceRouter } = await load();
  const output = element();
  const router = new OutputDeviceRouter(output, devices('default'));
  await assert.rejects(router.route('missing', {}), /見つかりません/);
  assert.equal(output.sinks.length, 0);
  assert.equal(output.plays.length, 0);
  assert.equal(output.muted, true);
  assert.equal(output.paused, true);
  assert.equal(output.srcObject, null);
  assert.equal(router.state.active, false);
  assert.ok(router.state.error);
});

test('setSinkId and play failures keep the element muted and detached', async () => {
  const { OutputDeviceRouter } = await load();
  for (const options of [
    { sink: async () => { throw new Error('sink rejected'); } },
    { play: async () => { throw new Error('play rejected'); } }
  ]) {
    const output = element(options);
    const router = new OutputDeviceRouter(output, devices('selected'));
    await assert.rejects(router.route('selected', {}), /rejected/);
    assert.equal(output.muted, true);
    assert.equal(output.volume, 0);
    assert.equal(output.paused, true);
    assert.equal(output.srcObject, null);
    assert.equal(router.state.active, false);
  }
});

test('an older asynchronous sink change cannot redirect a newer audible route', async () => {
  const { OutputDeviceRouter } = await load();
  const oldSink = deferred();
  const entered = deferred();
  const output = element({ sink: async id => {
    if (id === 'old') { entered.resolve(); await oldSink.promise; }
  } });
  const router = new OutputDeviceRouter(output, devices('old', 'new'));
  const previous = router.route('old', {});
  await entered.promise;
  const latest = router.route('new', {});
  assert.equal(output.muted, true);
  assert.equal(output.paused, true);
  assert.equal(output.plays.length, 0);
  oldSink.resolve();
  assert.equal(await previous, false);
  assert.equal(await latest, true);
  assert.equal(output.sinkId, 'new');
  assert.deepEqual(output.plays, [{ sinkId: 'new', muted: true }]);
  assert.equal(output.muted, false);
});

test('session cancellation while setSinkId is pending never resumes playback', async () => {
  const { OutputDeviceRouter } = await load();
  const selected = deferred();
  const entered = deferred();
  const output = element({ sink: async () => { entered.resolve(); await selected.promise; } });
  const router = new OutputDeviceRouter(output, devices('selected'));
  const pending = router.route('selected', {});
  await entered.promise;
  router.clear();
  selected.resolve();
  assert.equal(await pending, false);
  assert.equal(output.plays.length, 0);
  assert.equal(output.muted, true);
  assert.equal(output.paused, true);
  assert.equal(output.srcObject, null);
});

test('output and monitor failures stay independent', async () => {
  const { OutputDeviceRouter } = await load();
  const output = element();
  const monitor = element({ sink: async () => { throw new Error('monitor unavailable'); } });
  const available = devices('output', 'monitor');
  const outputRouter = new OutputDeviceRouter(output, available);
  const monitorRouter = new OutputDeviceRouter(monitor, available);
  assert.equal(await outputRouter.route('output', {}), true);
  await assert.rejects(monitorRouter.route('monitor', {}));
  assert.equal(output.muted, false);
  assert.equal(output.sinkId, 'output');
  assert.equal(monitor.muted, true);
  assert.equal(monitor.plays.length, 0);
});

test('removing an already selected sink silences it without playing on the new default', async () => {
  const { OutputDeviceRouter } = await load();
  const output = element();
  let available = [{ kind: 'audiooutput', deviceId: 'selected' }];
  const router = new OutputDeviceRouter(output, { enumerateDevices: async () => available });
  await router.route('selected', {});
  available = [{ kind: 'audiooutput', deviceId: 'default' }];
  await assert.rejects(router.route('selected', {}));
  assert.equal(output.plays.length, 1);
  assert.equal(output.muted, true);
  assert.equal(output.srcObject, null);
  assert.equal(router.state.active, false);
});
