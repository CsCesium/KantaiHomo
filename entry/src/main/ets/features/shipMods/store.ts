import fs from '@ohos.file.fs';
import image from '@ohos.multimedia.image';
import {
  MAX_MOD_BYTES, MAX_MOD_PIXELS, SHIP_MOD_TYPES, ShipModRecord, ShipModTarget,
  shipModRelativePath, shipModRequestPath, shipModResourcePath,
} from './model';

let baseDir: string = '';
let ready: boolean = false;
let importing: boolean = false;
const records: Map<string, ShipModRecord> = new Map();

function ensureDirectory(path: string): void {
  if (!fs.accessSync(path)) fs.mkdirSync(path, true);
}

function localPath(target: ShipModTarget): string {
  if (!baseDir) throw new Error('立绘存储尚未初始化');
  return `${baseDir}/${shipModRelativePath(target)}`;
}

function readRecord(target: ShipModTarget): ShipModRecord | null {
  const path = localPath(target);
  if (!fs.accessSync(path)) return null;
  const stat = fs.statSync(path);
  if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_MOD_BYTES) return null;
  return {
    masterId: target.masterId, type: target.type, damaged: target.damaged,
    resourcePath: shipModResourcePath(target), localPath: path,
    size: stat.size, modifiedAt: stat.mtime,
  };
}

function loadIndex(): void {
  if (ready) return;
  if (!baseDir) throw new Error('立绘存储尚未初始化');
  ensureDirectory(baseDir);
  const next: Map<string, ShipModRecord> = new Map();
  for (const dir of fs.listFileSync(baseDir)) {
    if (!/^[1-9]\d{0,3}$/.test(dir)) continue;
    const masterId = Number(dir);
    if (masterId >= 1500 || !fs.statSync(`${baseDir}/${dir}`).isDirectory()) continue;
    for (const spec of SHIP_MOD_TYPES) {
      const states: boolean[] = spec.damage === 'select' ? [false, true] : [spec.damage === 'always'];
      for (const damaged of states) {
        const record = readRecord({ masterId, type: spec.type, damaged });
        if (record) next.set(record.resourcePath, record);
      }
    }
  }
  records.clear();
  next.forEach((record: ShipModRecord, key: string) => records.set(key, record));
  ready = true;
}

export function initShipMods(filesDir: string): void {
  baseDir = `${filesDir}/ship_mods`;
  ready = false;
  records.clear();
  try { loadIndex(); } catch (error) {
    console.warn('[ShipMods] load:', String(error));
  }
}

export function listShipMods(): ShipModRecord[] {
  loadIndex();
  return Array.from(records.values()).sort((a: ShipModRecord, b: ShipModRecord) =>
    a.masterId - b.masterId || a.resourcePath.localeCompare(b.resourcePath));
}

/** Write a complete PNG beside the target, then atomically replace the previous image. */
export async function importShipMod(target: ShipModTarget, uri: string): Promise<void> {
  loadIndex();
  if (importing) throw new Error('请等待当前图片保存完成');
  const destination = localPath(target);
  const staging = `${destination}.importing`;
  importing = true;
  let input: fs.File | undefined;
  let output: fs.File | undefined;
  let source: image.ImageSource | undefined;
  let packer: image.ImagePacker | undefined;
  try {
    input = await fs.open(uri, fs.OpenMode.READ_ONLY);
    const stat = fs.statSync(input.fd);
    if (stat.size <= 0 || stat.size > MAX_MOD_BYTES) throw new Error('请选择不超过 32 MB 的图片');
    source = image.createImageSource(input.fd);
    const info = await source.getImageInfo();
    if (info.size.width <= 0 || info.size.height <= 0 || info.size.width * info.size.height > MAX_MOD_PIXELS) {
      throw new Error('图片尺寸过大，请缩小至 1600 万像素以内');
    }
    ensureDirectory(destination.substring(0, destination.lastIndexOf('/')));
    output = await fs.open(staging, fs.OpenMode.CREATE | fs.OpenMode.READ_WRITE | fs.OpenMode.TRUNC);
    packer = image.createImagePacker();
    await packer.packToFile(source, output.fd, { format: 'image/png', quality: 100 });
    const packedSize = fs.statSync(output.fd).size;
    if (packedSize <= 0 || packedSize > MAX_MOD_BYTES) throw new Error('转换后的 PNG 超过 32 MB，请缩小图片');
    fs.fsyncSync(output.fd);
    fs.closeSync(output.fd);
    output = undefined;
    fs.renameSync(staging, destination);
    const record = readRecord(target);
    if (record) records.set(record.resourcePath, record);
  } finally {
    // Cleanup is best effort so it cannot hide a successful commit or the original error.
    try { if (packer) await packer.release(); } catch (_) {}
    try { if (source) await source.release(); } catch (_) {}
    try { if (output) fs.closeSync(output.fd); } catch (_) {}
    try { if (input) fs.closeSync(input.fd); } catch (_) {}
    try { if (fs.accessSync(staging)) fs.unlinkSync(staging); } catch (_) {}
    importing = false;
  }
}

export function deleteShipMod(target: ShipModTarget): void {
  loadIndex();
  if (importing) throw new Error('请等待当前图片保存完成');
  const path = localPath(target);
  if (fs.accessSync(path)) fs.unlinkSync(path);
  records.delete(shipModResourcePath(target));
}

export function deleteShipMods(masterId: number): void {
  // Delete known images only; never recursively remove a path derived from external input.
  for (const record of listShipMods()) {
    if (record.masterId === masterId) deleteShipMod(record);
  }
}

export function readShipMod(requestUrl: string): ArrayBuffer | null {
  const path = shipModRequestPath(requestUrl);
  if (!path) return null;
  try {
    loadIndex();
    const record = records.get(path);
    if (!record) return null;
    const file = fs.openSync(record.localPath, fs.OpenMode.READ_ONLY);
    try {
      const size = fs.statSync(file.fd).size;
      if (size <= 0 || size > MAX_MOD_BYTES) return null;
      const bytes = new ArrayBuffer(size);
      let offset = 0;
      while (offset < size) {
        const chunk = new ArrayBuffer(size - offset);
        const count = fs.readSync(file.fd, chunk);
        if (count <= 0) return null;
        new Uint8Array(bytes).set(new Uint8Array(chunk, 0, count), offset);
        offset += count;
      }
      const signature = new Uint8Array(bytes, 0, Math.min(8, size));
      const png = [137, 80, 78, 71, 13, 10, 26, 10];
      if (signature.length !== 8 || png.some((value: number, index: number) => signature[index] !== value)) return null;
      return bytes;
    } finally { fs.closeSync(file.fd); }
  } catch (_) {
    // Missing/unreadable local images must not prevent the official resource from loading.
    return null;
  }
}
