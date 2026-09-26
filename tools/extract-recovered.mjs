// One-time migration tool. Normal builds use editable src/ and never run this tool.
// Re-running overwrites generated modules: use only on a clean migration branch.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!process.argv.includes('--write')) throw new Error('Migration overwrites extracted src modules. Re-run with --write only on a clean migration branch.');
const require = createRequire(import.meta.url);
async function dependency(name) {
  // Optional bootstrap toolchain, never required by normal standalone builds.
  const resolver = process.env.VOICE_CLIENT_TOOLCHAIN ? createRequire(process.env.VOICE_CLIENT_TOOLCHAIN) : require;
  return import(pathToFileURL(resolver.resolve(name)).href);
}
const parser = await dependency('@babel/parser');
const traverse = (await dependency('@babel/traverse')).default;
const generate = (await dependency('@babel/generator')).default;
const source = fs.readFileSync(path.join(root, 'reference/v2.1.4-alpha/app.js'), 'utf8');
const moduleMap = JSON.parse(fs.readFileSync(path.join(root, 'tools/module-map.json')));
const namingFile = path.join(root, 'tools/semantic-names.json');
const semanticNames = fs.existsSync(namingFile) ? JSON.parse(fs.readFileSync(namingFile)) : {};
const ast = parser.parse(source, { sourceType: 'module' });
let program;
traverse(ast, { Program(p) { program = p; } });
const units = [];
for (const statement of ast.program.body) {
  if (statement.type === 'VariableDeclaration') for (const node of statement.declarations) units.push({ node, kind: statement.kind });
  else units.push({ node: statement, kind: statement.type });
}
function owner(position) { let low = 0, high = units.length - 1; while (low <= high) { const middle = (low + high) >> 1; const unit = units[middle]; if (position < unit.node.start) high = middle - 1; else if (position >= unit.node.end) low = middle + 1; else return unit; } }
const nameModules = new Map(Object.entries(moduleMap).flatMap(([module, names]) => names.map(name => [name, module])));
for (const unit of units) Object.assign(unit, { names: [], dependencies: new Set(), module: null });
for (const [name, binding] of Object.entries(program.scope.bindings)) {
  const declaration = owner(binding.identifier.start);
  declaration.names.push(name);
  if (nameModules.has(name)) {
    const module = nameModules.get(name);
    if (declaration.module && declaration.module !== module) throw new Error(`Mixed module declaration: ${name}`);
    declaration.module = module;
  }
  for (const ref of [...binding.referencePaths, ...binding.constantViolations]) { const unit = owner(ref.node.start); if (unit && unit !== declaration) unit.dependencies.add(name); }
}
for (const name of nameModules.keys()) if (!program.scope.bindings[name]) throw new Error(`Missing recovered declaration: ${name}`);
// Attach displayName assignments and enum initialization to their owning module.
for (const unit of units) {
  if (unit.module || unit.names.length || unit.node.type !== 'ExpressionStatement') continue;
  const groups = new Set([...unit.dependencies].map(name => nameModules.get(name) || 'vendor/recovered-runtime.js'));
  if (groups.size === 1 && !groups.has('vendor/recovered-runtime.js')) unit.module = [...groups][0];
  if (unit.dependencies.has('clientExports') && unit.dependencies.has('AppRootProvider')) unit.module = 'app/mount.js';
  if (unit.dependencies.has('instance') && unit.dependencies.has('initReactI18next') && unit.dependencies.has('Backend')) unit.module = 'i18n/setup.js';
}
const modules = new Map();
for (const unit of units) {
  if (unit.node.type === 'ExportNamedDeclaration') continue;
  unit.module ||= 'vendor/recovered-runtime.js';
  if (!modules.has(unit.module)) modules.set(unit.module, { units: [], imports: new Map(), exports: new Set() });
  modules.get(unit.module).units.push(unit);
}
for (const unit of units) for (const name of unit.dependencies) {
  const declared = owner(program.scope.bindings[name].identifier.start);
  if (declared.module === unit.module || unit.node.type === 'ExportNamedDeclaration') continue;
  if (unit.module === 'vendor/recovered-runtime.js' && declared.module !== unit.module) throw new Error(`Vendor depends on business: ${name} at line ${unit.node.loc.start.line}`);
  const target = modules.get(unit.module);
  if (!target.imports.has(declared.module)) target.imports.set(declared.module, new Set());
  target.imports.get(declared.module).add(name);
  modules.get(declared.module).exports.add(name);
}
const runtime = modules.get('vendor/recovered-runtime.js');
runtime.exports.add('commonjsGlobal$1'); runtime.exports.add('getDefaultExportFromCjs');
function relative(from, to) { const name = path.posix.relative(path.posix.dirname(from), to); return name.startsWith('.') ? name : './' + name; }
const renamed = [];
function readable(code, moduleName) {
  const tree = parser.parse(code, {sourceType:'module'});
  function rename(scope, oldName, newName, reason) {
    if (oldName === newName || !/^[$A-Z_a-z][$\w]*$/.test(newName)) return;
    const binding = scope.getBinding(oldName);
    if (!binding || scope.hasBinding(newName) || scope.hasGlobal(newName)) return;
    if (binding.referencePaths.some(reference => reference.scope.getBinding(newName))) return;
    binding.scope.rename(oldName, newName);
    renamed.push({ module: moduleName, original: oldName, readable: newName, reason });
  }
  // High-confidence local names, scoped to their actual destructuring declaration.
  traverse(tree, { ObjectPattern(p) {
    for (const property of p.node.properties) {
      if (property.type !== 'ObjectProperty' || property.computed || property.key.type !== 'Identifier' || property.value.type !== 'Identifier') continue;
      rename(p.scope, property.value.name, property.key.name, 'destructured property');
    }
  }});
  // Explicit names are audited against a top-level function's lexical scope.
  traverse(tree, { Function(p) {
    let name = p.node.id?.name;
    if (!name && p.parentPath.isVariableDeclarator()) name = p.parentPath.node.id.name;
    if (!name && (p.isClassMethod() || p.parentPath.isClassProperty())) {
      const property = p.isClassMethod() ? p.node : p.parentPath.node;
      const classPath = p.findParent(parent => parent.isClassDeclaration());
      if (classPath && property.key.type === 'Identifier') name = `${classPath.node.id.name}.${property.key.name}`;
    }
    const names = semanticNames[name];
    if (!names || typeof names !== 'object') return;
    for (const [oldName, newName] of Object.entries(names)) if (typeof newName === 'string') rename(p.scope, oldName, newName, `semantic map: ${name}`);
  }});
  const publicNames = { invokeDesktop: 'invokePlatform', listenDesktop: 'listenPlatformEvent', jsxRuntimeExports: 'jsxRuntime', reactExports: 'ReactRuntime', clientExports: 'ReactDOMClient', 'log$1': 'logMessage', y: 'toast', Lt: 'ToastContainer', VCRestClient: 'VoiceChangerApiClient', RightButtonArea: 'ModelActions', IconArea: 'ModelIcon', InfoArea: 'ModelInfo', SampleModelDailog: 'SampleModelDialog', Demo: 'VoiceChangerPage', defaultAppGuiSettin: 'defaultAppGuiSettings' };
  traverse(tree, { Program(p) { for (const [oldName, newName] of Object.entries(publicNames)) rename(p.scope, oldName, newName, 'public module name'); },
    ClassDeclaration(p) { if (!['FileUploaderClient','RestClient'].includes(p.node.id.name)) return; p.traverse({PrivateName(privatePath) { if (privatePath.node.id.name === 'e') privatePath.node.id.name = 'baseUrl'; }}); },
    UnaryExpression(p) { if (p.node.operator === '!' && p.node.argument.type === 'NumericLiteral' && [0,1].includes(p.node.argument.value)) p.replaceWith({type:'BooleanLiteral',value:!p.node.argument.value}); },
    ObjectProperty(p) { if (!p.node.computed && p.node.key.type === 'Identifier' && p.node.value.type === 'Identifier' && p.node.key.name === p.node.value.name) p.node.shorthand = true; },
    ExpressionStatement(p) { if(p.node.expression.type === 'SequenceExpression') p.replaceWithMultiple(p.node.expression.expressions.map(expression=>({type:'ExpressionStatement',expression}))); }
  });
  return generate(tree, { comments: true, compact: false }).code + '\n';
}
const manifest = [];
for (const [moduleName, data] of modules) {
  const imports = [...data.imports].map(([dependency, names]) => `import { ${[...names].join(', ')} } from ${JSON.stringify(relative(moduleName, dependency))};`).join('\n');
  const body = data.units.map(unit => {
    let text = source.slice(unit.node.start, unit.node.end);
    if (['const','let','var'].includes(unit.kind)) text = `${unit.kind} ${text};`;
    if (unit.node.type === 'ImportDeclaration') text = 'import { invokePlatform as invokeDesktop, listenPlatformEvent as listenDesktop } from "./browser-adapter.js";';
    return text;
  }).join('\n');
  let code = `${imports}\n${body}\n${data.exports.size ? `export { ${[...data.exports].join(', ')} };` : ''}\n`;
  if (moduleName === 'app/mount.js') code = 'import "../i18n/setup.js";\n' + code;
  if (moduleName === 'vendor/recovered-runtime.js') {
    code = code.replaceAll('"./browser-ponyfill-8xTspxQN.js"', '"../../recovered/browser-ponyfill-8xTspxQN.js"');
    code += 'export { commonjsGlobal$1 as c, getDefaultExportFromCjs as g };\n';
  } else code = readable(code, moduleName);
  const filename = path.join(root, 'src', moduleName);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const fileContent = '// Extracted from the preserved 2.1.4-alpha baseline; editable application source.\n' + code;
  fs.writeFileSync(filename, fileContent);
  manifest.push({ module: `src/${moduleName}`, bindings: data.units.flatMap(unit => unit.names), sourceRanges: data.units.map(unit => [unit.node.loc.start.line, unit.node.loc.end.line]), imports: [...(moduleName === 'app/mount.js' ? ['i18n/setup.js'] : []), ...data.imports.keys()], sha256: crypto.createHash('sha256').update(fileContent).digest('hex') });
}
fs.writeFileSync(path.join(root,'tools/extraction-manifest.json'), JSON.stringify({baselineSha256:crypto.createHash('sha256').update(source).digest('hex'),modules:manifest},null,2)+'\n');
fs.writeFileSync(path.join(root,'tools/renamed-bindings.json'),JSON.stringify(renamed,null,2)+'\n');
const index = ['# 前端代码导航', '', '日常开发编辑 `src/`。`reference/v2.1.4-alpha/` 为不可变恢复基线，`tools/extract-recovered.mjs` 仅用于重放此次迁移，不参与正常构建。', '', '| 可编辑模块 | 原始名称 | 基线行范围 |', '| --- | --- | --- |', ...manifest.filter(item=>!item.module.includes('/vendor/')).map(item=>`| [${item.module}](${item.module}) | ${item.bindings.map(name=>'`'+name+'`').join(', ')} | ${item.sourceRanges.map(range=>range.join('–')).join(', ')} |`), '', '第三方打包代码保留在 [src/vendor/recovered-runtime.js](src/vendor/recovered-runtime.js)，应用模块只通过命名导出使用它。不要在 vendor 内添加业务逻辑。', '', '`tools/module-map.json` 记录模块归属；`semantic-names.json` 是经人工确认的作用域命名；`renamed-bindings.json` 记录实际成功的重命名；`extraction-manifest.json` 记录初次迁移来源，不是后续开发约束。', ''];
fs.writeFileSync(path.join(root,'CODE_INDEX.md'),index.join('\n'));
fs.writeFileSync(path.join(root,'recovered/app.js'), '// Compatibility entry for recovered chunks. Editable code lives in src/.\nimport "../src/app/mount.js";\nexport { c, g } from "../src/vendor/recovered-runtime.js";\n');
const ponyfill = fs.readFileSync(path.join(root,'reference/v2.1.4-alpha/browser-ponyfill-8xTspxQN.js'),'utf8').replace('"./app.js"','"../src/vendor/recovered-runtime.js"');
fs.writeFileSync(path.join(root,'recovered/browser-ponyfill-8xTspxQN.js'),ponyfill);
console.log(`Extracted ${modules.size} modules; renamed ${renamed.length} scoped bindings.`);
