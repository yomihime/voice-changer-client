'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

async function processor(rate = 44100) {
  const { workerjs } = await import('../src/audio/worker-source.js');
  let Processor;
  const messages = [];
  class Base {
    constructor() { this.port = { postMessage: message => messages.push(message) }; }
  }
  vm.runInNewContext(workerjs, { AudioWorkletProcessor: Base, Float32Array, sampleRate: rate,
    registerProcessor: (name, value) => { assert.equal(name, 'voice-changer-worklet-processor'); Processor = value; } });
  const instance = new Processor();
  let requestId = 0;
  const command = (commandType, payload = {}) => {
    const id = ++requestId;
    instance.port.onmessage({ data: { commandType, requestId: id, epoch: instance.epoch, ...payload } });
    return messages.findLast(message => message.requestId === id);
  };
  const process = (value = 0.5, length = 128) => {
    const output = [new Float32Array(length).fill(99), new Float32Array(length).fill(99)];
    instance.process([[new Float32Array(length).fill(value)]], [output]);
    return output;
  };
  return { instance, messages, command, process };
}

test('processor uses its real sample rate and a finite chunk at a non-48k rate', async () => {
  const { instance, messages, command, process } = await processor(44100);
  assert.equal(command('config', { config: { sendingChunkSec: 0.021 } }).status, 'ok');
  command('start', { epoch: 1 });
  for (let count = 0; count < 8; count++) process();
  const sent = messages.filter(message => message.commandType === 'sendOriginalVoice');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].voice.length, Math.round(44100 * 0.021));
  assert.equal(sent[0].epoch, 1);
  assert.equal(instance.inputFill, 1024 - sent[0].voice.length);
  assert.ok(instance.inputFill < instance.inputBuffer.length);
  for (const value of [0, -1, NaN, Infinity, 5.1]) {
    assert.equal(command('config', { config: { sendingChunkSec: value } }).status, 'error');
  }
  assert.equal(instance.config.sendingChunkSec, 0.021);
});

test('main-thread input and status backpressure retain one outstanding and one latest block', async () => {
  const { instance, messages, command, process } = await processor(8000);
  command('config', { config: { sendingChunkSec: 0.02, realtimeOutputStatusEnabled: true,
    realtimeOutputStatusSendIntervalSec: 0.02 } });
  command('start', { epoch: 1 });
  for (let count = 0; count < 100; count++) process(count / 100);
  assert.equal(messages.filter(message => message.commandType === 'sendOriginalVoice').length, 1);
  assert.equal(messages.filter(message => message.commandType === 'sendRealtimeOutputStatus').length, 1);
  assert.equal(instance.pendingInput.length, 160);
  assert.ok(instance.stats.droppedInputChunks > 0);
  assert.ok(instance.inputFill < 160);
  command('inputConsumed');
  assert.equal(messages.filter(message => message.commandType === 'sendOriginalVoice').length, 2);
  assert.equal(instance.pendingInput, null);
  command('statusConsumed');
  process();
  assert.equal(messages.filter(message => message.commandType === 'sendRealtimeOutputStatus').length, 2);
});

test('output ring is duration bounded and drops the oldest PCM with counters', async () => {
  const { instance, command, process } = await processor(8000);
  command('config', { config: { sendingChunkSec: 0.02, maxOutputBufferSec: 0.02 } });
  command('start', { epoch: 1 });
  command('sendConvertedVoice', { voice: new Float32Array(160).fill(0.1) });
  command('sendConvertedVoice', { voice: new Float32Array(160).fill(0.7) });
  assert.equal(instance.metrics().queuedFrames, 287);
  assert.equal(instance.metrics().droppedOutputFrames, 33);
  const output = process();
  assert.ok(output[0].subarray(0, 127).every(value => Math.abs(value - 0.1) < 1e-6));
  assert.ok(Math.abs(output[0][127] - 0.7) < 1e-6);
  assert.deepEqual(output[0], output[1]);
  assert.equal(instance.metrics().queuedFrames, 159);
  command('sendConvertedVoice', { voice: new Float32Array(1000).fill(0.8) });
  assert.equal(instance.metrics().queuedFrames, 287);
  assert.equal(instance.outputBuffer.length, 287);
  assert.equal(instance.metrics().droppedOutputFrames, 33 + 713 + 159);
  for (let count = 0; count < 100; count++) {
    command('sendConvertedVoice', { voice: new Float32Array(160).fill(0.8) });
    process();
    assert.ok(instance.metrics().queuedFrames <= 287);
  }
  assert.ok(instance.metrics().droppedOutputFrames > 905);
});

test('2/3-second responses retain all PCM and 4/5-second settings emit whole input blocks', async () => {
  for (const seconds of [2, 3, 4, 5]) {
    const { instance, messages, command, process } = await processor(48000);
    const frames = 48000 * seconds;
    assert.equal(command('config', { config: { sendingChunkSec: seconds }, chunkFrames: frames }).status, 'ok');
    assert.equal(instance.metrics().maxQueuedFrames, frames + 127);
    assert.ok(instance.metrics().maxQueuedFrames <= 48000 * 6);
    command('start', { epoch: 1 });
    const voice = Float32Array.from({ length: frames }, (_, index) => (index % 97) / 100);
    command('sendConvertedVoice', { voice });
    assert.equal(instance.metrics().droppedOutputFrames, 0);
    const rendered = new Float32Array(frames);
    for (let offset = 0; offset < frames; offset += 128) rendered.set(process()[0], offset);
    assert.deepEqual(rendered, voice);
    assert.equal(instance.metrics().droppedOutputFrames, 0);
    assert.equal(instance.metrics().queuedFrames, 0);
    const sent = messages.filter(message => message.commandType === 'sendOriginalVoice');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].voice.length, frames);
    // A sub-quantum tail from the preceding response also fits with the next full block.
    command('sendConvertedVoice', { voice: new Float32Array(127).fill(0.9) });
    command('sendConvertedVoice', { voice });
    assert.equal(instance.metrics().queuedFrames, frames + 127);
    assert.equal(instance.metrics().droppedOutputFrames, 0);
    command('sendConvertedVoice', { voice });
    assert.equal(instance.metrics().queuedFrames, frames + 127);
    assert.equal(instance.metrics().droppedOutputFrames, frames);
  }
});

test('requested output capacity and frame tickets are checked against actual processor geometry', async () => {
  const { instance, command } = await processor(96000);
  assert.equal(command('config', { config: { sendingChunkSec: 5, maxOutputBufferSec: 6 }, chunkFrames: 480000 }).status, 'ok');
  assert.equal(instance.inputBuffer.length, 480000);
  assert.equal(instance.metrics().maxQueuedFrames, 576000);
  assert.equal(command('config', { config: { sendingChunkSec: 4 }, chunkFrames: 192000 }).status, 'error');
  assert.equal(instance.config.sendingChunkSec, 5);
  assert.equal(command('config', { config: { maxOutputBufferSec: 6.01 } }).status, 'error');
});

test('stop and reset clear incomplete tails, pending input and all queued output', async () => {
  const { instance, messages, command, process } = await processor(8000);
  command('config', { config: { sendingChunkSec: 0.02 } });
  command('start', { epoch: 1 });
  process();
  command('sendConvertedVoice', { voice: new Float32Array(135).fill(0.9) });
  command('stop', { epoch: 2 });
  assert.equal(instance.inputFill, 0);
  assert.equal(instance.outputFrames, 0);
  assert.equal(instance.pendingInput, null);
  assert.ok(process()[0].every(value => value === 0));
  command('start', { epoch: 3 });
  const first = process();
  assert.ok(first[0].every(value => value === 0));
  assert.equal(messages.filter(message => message.commandType === 'sendOriginalVoice').length, 0);
  command('sendConvertedVoice', { voice: new Float32Array([0.4, 0.5, 0.6]) });
  command('resetBuffer', { epoch: 4 });
  command('start', { epoch: 5 });
  assert.ok(process()[0].every(value => value === 0));
  const stale = command('sendConvertedVoice', { epoch: 3, voice: new Float32Array(128).fill(1) });
  assert.equal(stale.status, 'stale');
  assert.equal(instance.outputFrames, 0);
});

test('start/stop acknowledgements are idempotent and concurrent requests keep distinct IDs', async () => {
  const { command } = await processor();
  const replies = [command('stop'), command('stop'), command('start'), command('start'),
    command('config', { config: { sendingChunkSec: 0.1 } }), command('config', { config: { sendingChunkSec: 0.2 } })];
  assert.ok(replies.every(reply => reply.status === 'ok'));
  assert.equal(new Set(replies.map(reply => reply.requestId)).size, 6);
});

test('recording bounds stop accumulation and report truncated clips without retaining downloaded arrays', async () => {
  const { instance, command, process } = await processor(8000);
  command('config', { config: { maxRecordingSec: 0.02 } });
  command('start', { epoch: 1 });
  command('startInputRecording');
  command('startOutputRecording');
  for (let count = 0; count < 100; count++) process();
  assert.equal(instance.inputRecordingFrames, 160);
  assert.equal(instance.outputRecordingFrames, 160);
  assert.equal(instance.stats.inputRecordingTruncated, true);
  assert.equal(instance.stats.outputRecordingTruncated, true);
  assert.equal(instance.isInputRecordingStarted, false);
  assert.equal(instance.isOutputRecordingStarted, false);
  const input = command('stopInputRecording').inputRecording;
  const output = command('stopOutputRecording').outputRecording;
  assert.equal(input.reduce((sum, chunk) => sum + chunk.length, 0), 160);
  assert.equal(output.reduce((sum, chunk) => sum + chunk.length, 0), 160);
  assert.equal(instance.inputRecording.length, 0);
  assert.equal(instance.outputRecording.length, 0);
});

test('local passthrough emits no server PCM and stops to silence', async () => {
  const { messages, command, process } = await processor(48000);
  command('config', { config: { isPassthroughEnabled: true } });
  command('start', { epoch: 1 });
  for (let count = 0; count < 100; count++) assert.ok(process(0.25)[0].every(value => value === 0.25));
  assert.equal(messages.some(message => message.commandType === 'sendOriginalVoice'), false);
  command('stop', { epoch: 2 });
  assert.ok(process(0.25)[0].every(value => value === 0));
});

test('dispose releases recording and audio buffers and ends processor scheduling', async () => {
  const { instance, command, process } = await processor(8000);
  command('start', { epoch: 1 });
  command('startInputRecording');
  process();
  command('sendConvertedVoice', { voice: new Float32Array(7).fill(0.4) });
  command('dispose', { epoch: 2 });
  const output = new Float32Array(128).fill(1);
  assert.equal(instance.process([[new Float32Array(128)]], [[output]]), false);
  assert.ok(output.every(value => value === 0));
  assert.equal(instance.outputFrames, 0);
  assert.equal(instance.inputRecording.length, 0);
  assert.equal(instance.pendingInput, null);
});
