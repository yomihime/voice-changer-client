const test = require('node:test');
const assert = require('node:assert/strict');

test('recording WAV uses its actual sample rate and a complete RIFF size', async () => {
  const { downloadAsWav } = await import('../src/audio/wav.js');
  const originalDocument = global.document;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  let blob;
  global.document = { body: { appendChild() {}, removeChild() {} }, createElement: () => ({ click() {} }) };
  URL.createObjectURL = value => { blob = value; return 'blob:owned-recording-fixture'; };
  URL.revokeObjectURL = () => {};
  try {
    for (const rate of [44100, undefined]) {
      downloadAsWav(new Float32Array([0, 0.5, -0.5, 0]), 'owned.wav', rate);
      const data = new DataView(await blob.arrayBuffer());
      assert.equal(data.getUint32(4, true), data.byteLength - 8);
      assert.equal(data.getUint32(24, true), rate || 48000);
      assert.equal(data.getUint32(28, true), (rate || 48000) * 2);
      assert.equal(data.getUint32(40, true), 8);
    }
  } finally {
    global.document = originalDocument;
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  }
});
