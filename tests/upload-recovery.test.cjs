const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('failed model upload refreshes occupied slots and preserves the original error', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/hooks/useServerConfig.js'), 'utf8')
    .replace(/^import .*;\r?$/gm, '').replace(/import\.meta\.url/g, '"file:///synthetic/useServerConfig.js"')
    .replace(/export \{ useServerConfig \};/, '')
    + '\nglobalThis.runHook = useServerConfig;';
  for (const refreshFails of [false, true]) {
    let reads = 0;
    const failure = new Error('owned model_load_failed fixture');
    const api = {
      uploadRVCModelFile: async () => { throw failure; },
      getServerSlotInfos: async () => {
        reads++;
        if (refreshFails) throw new Error('owned disconnected fixture');
        return [{ slot_index: 0, registration_available: false }];
      }
    };
    const context = {
      ReactRuntime: { useState: value => [value, () => {}], useCallback: value => value,
        useMemo: callback => callback(), useEffect() {} },
      useTranslation: () => ({ t: key => key }),
      VoiceChangerApiClient: { getInstance: () => api },
      backendClient: { state: { protocol: 'legacy-vcc' } },
      logMessage() {}, VOICE_CHANGER_CLIENT_EXCEPTION: { ERR_HTTP_EXCEPTION: 'ERR_HTTP_EXCEPTION' }
    };
    vm.runInNewContext(source, context);
    const hook = context.runHook({ triggerToast() {} });
    await assert.rejects(hook.uploadModelFile(0, 'RVC', [{ kind: 'rvcModel', file: {} }], null, () => {}),
      error => error === failure);
    assert.equal(reads, 1);
  }
});
