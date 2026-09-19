// node scripts/test-ship-mods.cjs [path/to/typescript]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require(process.argv[2] || 'typescript');
const root = path.resolve(__dirname, '../entry/src/main/ets');
function compile(relative, imports = {}, globals = {}) {
  const exports = {};
  const output = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    fileName: relative.replace(/\.ets$/, '.ts'),
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(output, { exports, ArrayBuffer, Uint8Array, console,
    require(name) { assert.ok(name in imports, `Unexpected import: ${name}`); return imports[name]; }, ...globals });
  return exports;
}
const graph = compile('features/game/shipGraph.ts');
const model = compile('features/shipMods/model.ts', { '../game/shipGraph': graph });
const target = (masterId = 1, type = 'full', damaged = false) => ({ masterId, type, damaged });
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');

function harness() {
  const files = new Map([['photo://image', Buffer.from('input')]]);
  const directories = new Set(['/files']);
  const handles = new Map();
  const state = { next: 1, failPack: false, failRename: false, failRead: false, width: 1200, height: 720,
    bytes: png, shortRead: 7, packOptions: null, sourceReleased: 0, packerReleased: 0, pause: null };
  function open(name, mode) {
    if (mode & 4) files.set(name, Buffer.alloc(0));
    assert.ok(files.has(name), `Missing file: ${name}`);
    const fd = state.next++;
    handles.set(fd, { name, offset: 0 });
    return { fd };
  }
  const io = {
    OpenMode: { READ_ONLY: 1, READ_WRITE: 2, CREATE: 4, TRUNC: 8 },
    accessSync: p => files.has(p) || directories.has(p),
    mkdirSync(p) { const parts = p.split('/'); for (let i = 2; i <= parts.length; i++) directories.add(parts.slice(0, i).join('/')); },
    listFileSync(p) {
      return [...new Set([...files.keys(), ...directories].filter(k => k.startsWith(p + '/'))
        .map(k => k.slice(p.length + 1).split('/')[0]))];
    },
    statSync(p) {
      if (typeof p === 'number') p = handles.get(p).name;
      assert.ok(io.accessSync(p), `Missing stat: ${p}`);
      return { size: files.get(p)?.length || 0, mtime: 1, isFile: () => files.has(p), isDirectory: () => directories.has(p) };
    },
    openSync: open, open: async (p, mode) => open(p, mode),
    closeSync(fd) { assert.ok(handles.delete(fd), 'Double close'); },
    fsyncSync() {},
    renameSync(from, to) {
      if (state.failRename) throw new Error('disk error');
      files.set(to, files.get(from)); files.delete(from);
    },
    unlinkSync(p) { assert.ok(files.delete(p)); },
    readSync(fd, array, options) {
      if (state.failRead) throw new Error('read error');
      const h = handles.get(fd);
      const bytes = files.get(h.name);
      const offset = options?.offset ?? h.offset;
      const count = Math.min(state.shortRead, array.byteLength, bytes.length - offset);
      new Uint8Array(array).set(bytes.subarray(offset, offset + count));
      h.offset = offset + count;
      return count;
    },
  };
  const image = {
    createImageSource: () => ({ getImageInfo: async () => ({ size: { width: state.width, height: state.height } }),
      release: async () => { state.sourceReleased++; } }),
    createImagePacker: () => ({
      async packToFile(source, fd, options) {
        state.packOptions = options;
        files.set(handles.get(fd).name, Buffer.from('incomplete'));
        if (state.pause) await state.pause;
        if (state.failPack) throw new Error('encode error');
        files.set(handles.get(fd).name, state.bytes);
      },
      release: async () => { state.packerReleased++; },
    }),
  };
  const imports = { '@ohos.file.fs': { default: io }, '@ohos.multimedia.image': { default: image }, './model': model };
  const fresh = () => compile('features/shipMods/store.ts', imports);
  const store = fresh(); store.initShipMods('/files');
  return { store, fresh, files, handles, state, io };
}

test('official filenames and all normal/damaged types have independent storage paths', () => {
  assert.equal(model.shipModResourcePath(target(1, 'banner')), '/kcs2/resources/ship/banner/0001_2910.png');
  assert.equal(model.shipModRelativePath(target()), '1/full/0001_5865.png');
  assert.equal(model.shipModRelativePath(target(1, 'full', true)), '1/full_dmg/0001_6245.png');
  const unique = new Set();
  for (const spec of model.SHIP_MOD_TYPES) {
    for (const damaged of spec.damage === 'select' ? [false, true] : [spec.damage === 'always']) {
      const key = model.shipModRelativePath(target(1, spec.type, damaged));
      assert.ok(!unique.has(key)); unique.add(key);
    }
  }
  assert.equal(unique.size, 18);
  assert.equal(model.shipModResourcePath(target(1, 'banner_g', false)), model.shipModResourcePath(target(1, 'banner_g', true)));
  for (const id of [0, -1, 1.5, 1500, NaN]) assert.throws(() => model.shipModRelativePath(target(id)));
  assert.throws(() => model.shipModRelativePath(target(1, '../full')));
});

test('resource matching ignores version queries but rejects unrelated/traversal URLs', () => {
  const resource = model.shipModResourcePath(target());
  assert.equal(model.shipModRequestPath('https://game.test' + resource + '?version=9#x'), resource);
  for (const url of ['file://' + resource, 'https://game.test/other' + resource, 'https://game.test/kcs2/resources/ship/../secret.png',
    'https://game.test' + resource + '.bak', 'https://game.test/kcsapi/api_port/port']) {
    assert.equal(model.shipModRequestPath(url), null);
  }
});

test('import creates per-ship folders, encodes PNG, restores on restart and handles partial reads', async () => {
  const h = harness();
  await h.store.importShipMod(target(), 'photo://image');
  const record = h.store.listShipMods()[0];
  assert.equal(record.localPath, '/files/ship_mods/1/full/0001_5865.png');
  assert.equal(h.state.packOptions.format, 'image/png');
  assert.equal(h.handles.size, 0);
  const restarted = h.fresh(); restarted.initShipMods('/files');
  assert.equal(restarted.listShipMods().length, 1);
  assert.deepEqual(Buffer.from(restarted.readShipMod('https://server.test' + record.resourcePath + '?v=2')), png);
  assert.equal(h.handles.size, 0);
});

test('replacement failure keeps old image and releases all handles/temporary files', async () => {
  const h = harness();
  await h.store.importShipMod(target(), 'photo://image');
  const record = h.store.listShipMods()[0];
  for (const flag of ['failPack', 'failRename']) {
    h.state[flag] = true;
    await assert.rejects(h.store.importShipMod(target(), 'photo://image'));
    assert.deepEqual(h.files.get(record.localPath), png);
    assert.ok(![...h.files.keys()].some(p => p.endsWith('.importing')));
    assert.equal(h.handles.size, 0);
    h.state[flag] = false;
  }
  h.state.bytes = Buffer.concat([png, Buffer.from('changed')]);
  await h.store.importShipMod(target(), 'photo://image');
  assert.deepEqual(Buffer.from(h.store.readShipMod('https://server.test' + record.resourcePath)), h.state.bytes);
  assert.equal(h.store.listShipMods().length, 1);
});

test('oversized input/decoded image/packed image fails without destroying previous replacement', async () => {
  const h = harness();
  await h.store.importShipMod(target(), 'photo://image');
  const record = h.store.listShipMods()[0];
  h.files.set('photo://image', { length: model.MAX_MOD_BYTES + 1 });
  await assert.rejects(h.store.importShipMod(target(), 'photo://image'), /32 MB/);
  h.files.set('photo://image', Buffer.from('input'));
  h.state.width = h.state.height = 10000;
  await assert.rejects(h.store.importShipMod(target(), 'photo://image'), /像素/);
  h.state.width = h.state.height = 10;
  h.state.bytes = { length: model.MAX_MOD_BYTES + 1 };
  await assert.rejects(h.store.importShipMod(target(), 'photo://image'), /32 MB/);
  assert.deepEqual(h.files.get(record.localPath), png);
  assert.equal(h.handles.size, 0);
});

test('concurrent mutation cannot delete or overwrite an in-progress import', async () => {
  const h = harness();
  let resume;
  h.state.pause = new Promise(resolve => { resume = resolve; });
  const pending = h.store.importShipMod(target(), 'photo://image');
  await assert.rejects(h.store.importShipMod(target(2), 'photo://image'), /等待/);
  assert.throws(() => h.store.deleteShipMod(target()), /等待/);
  resume(); await pending;
  assert.equal(h.store.listShipMods().length, 1);
});

test('single and whole-ship deletion isolate ships/types and immediately fall back', async () => {
  const h = harness();
  for (const t of [target(), target(1, 'full', true), target(2)]) await h.store.importShipMod(t, 'photo://image');
  h.store.deleteShipMod(target());
  assert.equal(h.store.readShipMod('https://game.test' + model.shipModResourcePath(target())), null);
  assert.equal(h.store.listShipMods().length, 2);
  h.store.deleteShipMods(1);
  assert.deepEqual(Array.from(h.store.listShipMods(), r => r.masterId), [2]);
  const restarted = h.fresh(); restarted.initShipMods('/files');
  assert.equal(restarted.listShipMods().length, 1);
});

test('missing, invalid and unreadable files return null for official resource fallback', async () => {
  const h = harness();
  await h.store.importShipMod(target(), 'photo://image');
  const record = h.store.listShipMods()[0];
  const url = 'http://game.test' + record.resourcePath;
  h.state.failRead = true; assert.equal(h.store.readShipMod(url), null); h.state.failRead = false;
  h.files.set(record.localPath, Buffer.from('broken image')); assert.equal(h.store.readShipMod(url), null);
  h.files.delete(record.localPath); assert.equal(h.store.readShipMod(url), null);
  assert.equal(h.handles.size, 0);
});

test('interceptor serves PNG with no-store headers and ignores non-GET/unknown requests', async () => {
  const h = harness();
  await h.store.importShipMod(target(), 'photo://image');
  class Response {
    setResponseCode(v) { this.code = v; } setReasonMessage(v) {} setResponseMimeType(v) { this.mime = v; }
    setResponseData(v) { this.data = v; } setResponseHeader(v) { this.headers = v; }
  }
  const interceptor = compile('features/shipMods/interceptor.ets', { './store': h.store }, { WebResourceResponse: Response });
  const request = { getRequestMethod: () => 'GET', getRequestUrl: () => 'https://game.test' + model.shipModResourcePath(target()) };
  const response = interceptor.shipModInterceptor({ request });
  assert.equal(response.code, 200); assert.equal(response.mime, 'image/png');
  assert.deepEqual(Buffer.from(response.data), png);
  assert.equal(response.headers.find(h => h.headerKey === 'Cache-Control').headerValue, 'no-store');
  assert.equal(interceptor.shipModInterceptor({ request: { ...request, getRequestMethod: () => 'POST' } }), null);
  assert.equal(interceptor.shipModInterceptor({ request: { ...request, getRequestUrl: () => 'https://game.test/not-a-ship.png' } }), null);
});

test('GameWeb honors enable switch independently of cache and gives mods first priority', () => {
  const source = fs.readFileSync(path.join(root, 'infra/web/components/GameWeb.ets'), 'utf8');
  const callback = source.split('.onInterceptRequest(')[1].split('.onPageBegin')[0].trim().slice(0, -1);
  const output = ts.transpileModule('var callback = ' + callback, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const context = { shipModsEnabled: false, resourceCacheEnabled: true, resourceCacheAudioEnabled: false,
    shouldBlock: () => false, createEmptyResp: () => 'blocked', shipModInterceptor: () => 'mod', gameAssetInterceptor: () => 'cache' };
  vm.createContext(context); vm.runInContext(output, context);
  const event = { request: { getRequestUrl: () => 'https://game.test/image' } };
  assert.equal(context.callback(event), 'cache');
  context.shipModsEnabled = true; assert.equal(context.callback(event), 'mod');
  context.resourceCacheEnabled = false; assert.equal(context.callback(event), 'mod');
  context.shipModInterceptor = () => null; assert.equal(context.callback(event), undefined);
  context.resourceCacheEnabled = true; assert.equal(context.callback(event), 'cache');
  context.shouldBlock = () => true; assert.equal(context.callback(event), 'blocked');
});
