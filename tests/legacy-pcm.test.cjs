const test = require('node:test');
const assert = require('node:assert/strict');

test('legacy wire PCM is mono signed little-endian Int16 without a WAV header', async () => {
  const { float32ToInt16Base64, int16Base64ToFloat32 } = await import('../src/api/LegacyPcmCodec.js');
  const values = new Float32Array([-2, -1, -0.5, 0, 0.5, 1, 2]);
  const encoded = float32ToInt16Base64(values);
  const bytes = Buffer.from(encoded, 'base64');
  assert.equal(bytes.length, values.length * 2);
  assert.deepEqual(Array.from({ length: values.length }, (_, index) => bytes.readInt16LE(index * 2)),
    [-32768, -32768, -16384, 0, 16384, 32767, 32767]);
  const decoded = int16Base64ToFloat32(encoded);
  assert.equal(decoded.length, values.length);
  assert.equal(decoded[0], -1);
  assert.equal(decoded[5], 1);
  assert.ok(Math.abs(decoded[4] - 0.5) < 0.00004);
  for (const invalid of ['', 'AA==', 'abcd!', 'AAAA=', 'AAAA\n']) {
    assert.throws(() => int16Base64ToFloat32(invalid));
  }
  assert.throws(() => float32ToInt16Base64(new Float32Array([NaN])));
});

test('legacy audio errors and mismatched responses cannot become playable PCM', async () => {
  const { backendClient } = await import('../src/api/BackendClient.js');
  const { convertLegacyAudio } = await import('../src/api/LegacyPcmCodec.js');
  const originalFetch = global.fetch;
  const originalAddress = backendClient.state.address;
  backendClient.state.address = 'http://localhost:18888/';
  try {
    global.fetch = async (url, options) => {
      assert.equal(url, 'http://localhost:18888/test');
      const request = JSON.parse(options.body);
      assert.equal(request.timestamp, 7);
      assert.equal(Buffer.from(request.buffer, 'base64').length, 4);
      return Response.json({ timestamp: 7, changedVoiceBase64: request.buffer });
    };
    assert.equal((await convertLegacyAudio(new Float32Array([0, 1]), { timestamp: 7 })).length, 2);
    global.fetch = async () => Response.json({ timestamp: 8, changedVoiceBase64: 'AAAA' });
    await assert.rejects(convertLegacyAudio(new Float32Array([0]), { timestamp: 7 }), { code: 'invalid_audio_response' });
    global.fetch = async () => Response.json({ timestamp: 7, changedVoiceBase64: 'AAA=' });
    await assert.rejects(convertLegacyAudio(new Float32Array(128), { timestamp: 7 }), { code: 'model_unavailable' });
    global.fetch = async () => Response.json({ timestamp: 7, changedVoiceBase64: 'AAAAAA==' });
    await assert.rejects(convertLegacyAudio(new Float32Array(128), { timestamp: 7 }), { code: 'invalid_audio_response' });
    global.fetch = async () => Response.json('engine failed');
    await assert.rejects(convertLegacyAudio(new Float32Array([0])), { code: 'invalid_audio_response' });
    global.fetch = async () => new Response('failure', { status: 500 });
    await assert.rejects(convertLegacyAudio(new Float32Array([0])), { code: 'http_error' });
  } finally {
    global.fetch = originalFetch;
    backendClient.state.address = originalAddress;
  }
});

test('audio epoch and sequence are echoed exactly and stale errors remain actionable', async () => {
  const { backendClient } = await import('../src/api/BackendClient.js');
  const { convertLegacyAudio } = await import('../src/api/LegacyPcmCodec.js');
  const originalFetch = global.fetch;
  try {
    global.fetch = async (_url, init) => {
      const request = JSON.parse(init.body);
      assert.equal(request.stream_epoch, 'owned-epoch');
      assert.equal(request.sequence, 2);
      return Response.json({ timestamp: request.timestamp, changedVoiceBase64: request.buffer,
        stream_epoch: request.stream_epoch, sequence: request.sequence });
    };
    const options = { streamEpoch: 'owned-epoch', sequence: 2 };
    assert.equal((await convertLegacyAudio(new Float32Array(128), options)).length, 128);
    global.fetch = async () => Response.json({ error: { code: 'stale_session', reason: 'expired' } }, { status: 409 });
    await assert.rejects(convertLegacyAudio(new Float32Array(128), options), { code: 'stale_session' });
  } finally { global.fetch = originalFetch; }
});
