'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');

test('preserved recovered baseline remains byte-identical', () => {
  const baseline = path.join(root, 'reference/v2.1.4-alpha');
  const hashes = JSON.parse(fs.readFileSync(path.join(baseline, 'SHA256.json')));
  for (const [name, expected] of Object.entries(hashes)) {
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(baseline, name))).digest('hex'), expected, name);
  }
});

test('application modules resolve named imports without cycles or vendor reverse dependencies', async () => {
  const { parse } = await import('@babel/parser');
  const sources = fs.readdirSync(path.join(root, 'src'), {recursive:true}).filter(name => name.endsWith('.js'));
  const graph = new Map();
  const exports = new Map();
  for (const name of sources) {
    const file = path.resolve(root, 'src', name);
    const ast = parse(fs.readFileSync(file, 'utf8'), {sourceType:'module'});
    const imports = [];
    const names = new Set();
    for (const node of ast.program.body) {
      if (node.type === 'ImportDeclaration' || (node.type === 'ExportNamedDeclaration' && node.source)) {
        const target = path.resolve(path.dirname(file), node.source.value);
        assert.ok(fs.existsSync(target), `${name}: ${node.source.value}`);
        imports.push({target, names:node.specifiers.filter(specifier => specifier.type === 'ImportSpecifier').map(specifier => specifier.imported.name)});
      }
      if (node.type === 'ExportNamedDeclaration') {
        node.specifiers.forEach(specifier => names.add(specifier.exported.name));
        if (node.declaration?.id) names.add(node.declaration.id.name);
        if (node.declaration?.declarations) node.declaration.declarations.forEach(declaration => names.add(declaration.id.name));
      }
    }
    graph.set(file, imports);
    exports.set(file, names);
  }
  const visited = new Set(), visiting = new Set();
  function visit(file) {
    if (visited.has(file)) return;
    assert.ok(!visiting.has(file), `Circular module dependency: ${file}`);
    visiting.add(file);
    for (const imported of graph.get(file) || []) {
      for (const name of imported.names) assert.ok(exports.get(imported.target)?.has(name), `Missing export ${name} in ${imported.target}`);
      visit(imported.target);
    }
    visiting.delete(file); visited.add(file);
  }
  for (const file of graph.keys()) visit(file);
  assert.deepEqual(graph.get(path.join(root, 'src/vendor/recovered-runtime.js')), []);
});

test('extracted API keeps configuration endpoints and JSON request semantics', async () => {
  const { VCRestClient } = await import('../src/api/VoiceChangerApiClient.js');
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async request => { requests.push(request); return new Response(JSON.stringify({current_slot_index:7}), {status:200}); };
  try {
    const client = new VCRestClient();
    client.setBaseUrl('http://localhost:18000/');
    assert.deepEqual(await client.getServerConfiguration(), {current_slot_index:7});
    await client.updateServerConfiguration({current_slot_index:9});
    assert.equal(requests[0].url, 'http://localhost:18000/api/configuration-manager/configuration');
    assert.equal(requests[0].method, 'GET');
    assert.equal(requests[1].method, 'PUT');
    assert.deepEqual(await requests[1].json(), {current_slot_index:9});
    client.setEnableFlatPath(true);
    await client.getServerConfiguration();
    assert.equal(requests[2].url, 'http://localhost:18000/api_configuration-manager_configuration');
  } finally { global.fetch = originalFetch; }
});
