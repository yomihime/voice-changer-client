'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const load = () => import(pathToFileURL(path.join(__dirname, '../src/api/BackendClient.js')).href);
const fixture = { status:'OK', modelSlots:[], gpus:[], python:'3.12 fixture',
  voiceChangerParams:{ model_dir:'model_dir' }, serverAudioStated:0 };

test('backend URL preserves explicit paths and supports LAN, DNS, IPv6 and HTTPS', async () => {
  const { normalizeBackendAddress } = await load();
  for (const [input, expected] of [
    ['http://localhost:18888', 'http://localhost:18888/'],
    ['https://host.local:9443/vcc', 'https://host.local:9443/vcc/'],
    ['http://[::1]:18888/base/', 'http://[::1]:18888/base/'],
    ['http://192.168.1.2:18889/', 'http://192.168.1.2:18889/'],
  ]) assert.equal(normalizeBackendAddress(input), expected);
  for (const input of ['file:///tmp/x','http://user:secret@host/','http://host/?query=1',
    'http://host/#fragment','http://host:0/', 'http://host/path\\bad', 'http://host/with space']) {
    assert.throws(() => normalizeBackendAddress(input));
  }
});

test('identity rejects HTML or arbitrary HTTP 200 and recognizes model-free legacy service', async () => {
  const { BackendClient, isLegacyVccInfo } = await load();
  assert.equal(isLegacyVccInfo({ status:'OK' }), false);
  assert.equal(isLegacyVccInfo(fixture), true);
  const configured = [], requests = [];
  const client = new BackendClient({ native:true, origin:'http://127.0.0.1:29000/',
    configure:async (address, remember) => configured.push({address,remember}),
    fetcher:async address => { requests.push(address); return Response.json(fixture); } });
  assert.equal(await client.connect(undefined, {probing:true}), true);
  assert.equal(client.state.protocol, 'legacy-vcc');
  assert.equal(configured[0].address, 'http://localhost:18888/');
  assert.deepEqual(requests, ['http://127.0.0.1:29000/info']);
  const other = new BackendClient({ fetcher:async () => new Response('<html>other</html>') });
  assert.equal(await other.connect('http://localhost:19000'), false);
  assert.equal(other.state.phase, 'incompatible');
});

test('switching connection aborts old requests and ignores a late old discovery result', async () => {
  const { BackendClient } = await load();
  let finish, oldSignal;
  const client = new BackendClient({ fetcher:async (address, options) => {
    if (address.includes(':19001/')) { oldSignal = options.signal; return new Promise(resolve => { finish=resolve; }); }
    return Response.json(fixture);
  } });
  const old = client.connect('http://localhost:19001/');
  assert.equal(await client.connect('http://localhost:19002/'), true);
  assert.equal(oldSignal.aborted, true);
  finish(Response.json(fixture)); assert.equal(await old, false);
  assert.equal(client.state.address, 'http://localhost:19002/');
  assert.equal(client.state.phase, 'ready');
});

test('retry recovers when backend appears and a real 2.x config is distinct from legacy', async () => {
  const { BackendClient } = await load();
  let ready = false;
  const client = new BackendClient({ fetcher:async address => {
    if (!ready) throw new TypeError('not running');
    return address.endsWith('/info') ? new Response('not found', {status:404}) :
      Response.json({ current_slot_index:-1, voice_changer_input_mode:'client', pass_through:false });
  } });
  assert.equal(await client.connect(), false);
  assert.equal(client.state.phase, 'needs-address');
  ready = true;
  assert.equal(await client.connect(), true);
  assert.equal(client.state.protocol, 'vcc-2x');
});

test("a bounded discovery timeout leaves an editable address state", async()=>{
  const { BackendClient } = await load();
  const client = new BackendClient({timeoutMs:25,fetcher:async(address,{signal})=>new Promise((resolve,reject)=>{signal.addEventListener("abort",()=>reject(signal.reason),{once:true});})});
  const hold=setTimeout(()=>{},100);
  try { assert.equal(await client.connect(),false);assert.equal(client.state.phase,"needs-address"); } finally {clearTimeout(hold);}
});

test('REST body conversion remains bound to its original connection', async () => {
  const { backendClient } = await load();
  const { RestClient } = await import('../src/api/RestClient.js');
  const originalFetch = global.fetch;
  const client = new RestClient();
  client.setBaseUrl('http://localhost:18888');
  try {
    for (const responseType of ['json', 'blob', 'error']) {
      let releaseBody, enterBody, requestSignal;
      const entered = new Promise(resolve => { enterBody = resolve; });
      const body = new Promise(resolve => { releaseBody = resolve; });
      const readBody = async () => { enterBody(); return body; };
      global.fetch = async request => {
        requestSignal = request.signal;
        return { ok: responseType !== 'error', status: responseType === 'error' ? 500 : 200,
          json: readBody, blob: readBody, text: readBody };
      };
      const result = client.getRequest('/delayed', responseType === 'blob' ? 'blob' : 'json');
      const rejected = assert.rejects(result, error => error.code === 'stale_session');
      await entered;
      backendClient.invalidate();
      assert.equal(requestSignal.aborted, true);
      releaseBody(responseType === 'error' ? '{}' : { old: true });
      await rejected;
    }
  } finally { global.fetch = originalFetch; }
});

test('audio control changes block capture until completion and failures require explicit recovery', async () => {
  const { BackendClient } = await load();
  const client = new BackendClient();
  const events = [];
  client.onAudioChange(state => events.push({ ...state }));
  const finish = client.beginAudioChange('model switch');
  assert.equal(client.audioState.blocked, true);
  assert.equal(client.clearAudioError(), false);
  finish(new Error('model failed'));
  assert.equal(client.audioState.blocked, true);
  const revision = client.audioState.revision;
  assert.equal(client.clearAudioError(), true);
  assert.equal(client.audioState.revision, revision);
  assert.equal(client.audioState.blocked, false);
  const oldFinish = client.beginAudioChange('old address');
  client.invalidate();
  oldFinish(new Error('late old failure'));
  assert.equal(client.audioState.blocked, false);
  assert.equal(events[0].blocked, false);
});
