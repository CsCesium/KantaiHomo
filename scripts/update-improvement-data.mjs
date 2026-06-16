#!/usr/bin/env node
// @ts-nocheck
/**
 * update-improvement-data.mjs — 改修（装备改修）データの月次更新スクリプト。
 *
 * 2 つのデータソースをマージして「改修可能装备 + 全消費配方」を生成する。
 *
 *  1) akashi-list.me （gh-pages の index.html に埋め込み）
 *       - 現在 改修可能な装备の一覧（master id / 名称 / カテゴリ）
 *       - 改修資材(ネジ) の段階別消費数  ★0〜5 / ★6〜9 / MAX（最新値）
 *       - 秘书艦の曜日別可否（日〜土）
 *
 *  2) WhoCallsTheFleet item DB （KC3Kai が同梱しているミラー）
 *       - 段階別の完全な配方： 開発資材(通常/確保) / 改修資材(通常/確保) / 消費装備
 *       - 秘书艦の master id + 曜日（→ アプリ内で艦名解決可能）
 *       - 注意: WCTFDB は ~2018 で更新停止。新装备(akashi にのみ存在)は
 *         「改修資材のみ」で開発資材/消費装備は不明(—)になる。
 *
 * 出力: entry/src/main/resources/rawfile/data/improvement.json
 *
 * 使い方:
 *   node scripts/update-improvement-data.mjs                       # 両ソースを取得
 *   node scripts/update-improvement-data.mjs <akashi.html> [wctf.nedb]
 *
 * 月次運用: 毎月 1 回実行し、生成された JSON をコミットする。
 * 開発資材・消費装備・確保量まで最新化したい場合は日本語 wiki「改修表」が
 * 必要だが、本スクリプトは GitHub 上の安定ソースのみを使う（再現性重視）。
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(
  __dirname,
  '../entry/src/main/resources/rawfile/data/improvement.json'
);

const AKASHI_SOURCES = [
  'https://raw.githubusercontent.com/yukikuri/akashi-list/gh-pages/index.html',
  'https://akashi-list.me/',
];
const WCTF_SOURCE =
  'https://raw.githubusercontent.com/KC3Kai/KC3Kai/master/src/data/WhoCallsTheFleet_items.nedb';

const WEEK = ['日', '月', '火', '水', '木', '金', '土']; // index 0=日(Sun)..6=土(Sat)

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

async function fetchFirst(urls) {
  for (const url of urls) {
    try {
      console.log(`[improvement] fetching: ${url}`);
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (res.ok) return await res.text();
      console.warn(`[improvement]   -> HTTP ${res.status}`);
    } catch (e) {
      console.warn(`[improvement]   -> ${String(e)}`);
    }
  }
  return null;
}

// ─────────────────────────── akashi-list parsing ───────────────────────────

function parseTypeMap(html) {
  const m = html.match(/<script id=aia-all>([\s\S]*?)<\/script>/);
  const map = new Map();
  if (!m) return map;
  const re = /\{id:"(\d+)",type:"([a-zA-Z]+)"/g;
  let g;
  while ((g = re.exec(m[1])) !== null) map.set(parseInt(g[1], 10), g[2]);
  return map;
}

function parseSecretary(seg) {
  const sm = seg.match(/\/img\/s(\d+)\.png/);
  if (!sm) return null;
  const days = [];
  const re = /<span( class=enable)?>[日月火水木金土]<\/span>/g;
  let g;
  while ((g = re.exec(seg)) !== null) days.push(Boolean(g[1]));
  while (days.length < 7) days.push(false);
  return { sprite: parseInt(sm[1], 10), days: days.slice(0, 7) };
}

function parseKit(block) {
  const m = block.match(/class=remodelkit>([^<]+)</);
  if (!m) return [null, null, null];
  const parts = m[1].split('/').map((s) => s.trim());
  const toNum = (s) => {
    if (s === undefined || s === '' || s === '-' || s === '−') return null;
    const n = parseInt(s.replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(n) ? n : null;
  };
  return [toNum(parts[0]), toNum(parts[1]), toNum(parts[2])];
}

function parseAkashi(html) {
  const typeMap = parseTypeMap(html);
  const marker = '<div class=weapon id=w';
  const starts = [];
  for (let i = html.indexOf(marker); i >= 0; i = html.indexOf(marker, i + 1)) starts.push(i);
  const out = new Map();
  for (let k = 0; k < starts.length; k++) {
    const block = html.slice(starts[k], starts[k + 1] ?? html.length);
    const idm = block.match(/id=w(\d+)/);
    if (!idm) continue;
    const id = parseInt(idm[1], 10);
    const namem = block.match(/alt="?\d+:\s*([^">]+)/);
    const name = namem ? namem[1].trim() : '';
    const kit = parseKit(block);
    if (kit.every((x) => x === null)) continue; // 改修不可

    const secretaries = [];
    const segs = block.split('class=support-ship>');
    for (let s = 1; s < segs.length; s++) {
      const sec = parseSecretary(segs[s]);
      if (sec) secretaries.push(sec);
    }
    const days = [false, false, false, false, false, false, false];
    if (secretaries.length === 0) days.fill(true);
    else for (const sec of secretaries) for (let d = 0; d < 7; d++) days[d] = days[d] || sec.days[d];

    out.set(id, { id, name, type: typeMap.get(id) ?? 'etc', kit, days, secretaries });
  }
  return out;
}

// ─────────────────────── WhoCallsTheFleet parsing ───────────────────────────

/** consumed list element [idOrStr, count] -> {id, count, use} | null */
function parseConsumed(pair) {
  if (!Array.isArray(pair) || pair.length < 2) return null;
  const v = pair[0];
  const count = Number(pair[1]) || 0;
  if (v === null || v === undefined || count <= 0) return null;
  if (typeof v === 'string') {
    const m = v.match(/_(\d+)$/);
    if (!m) return null;
    return { id: Number(m[1]), count, use: true };
  }
  if (typeof v === 'number' && v > 0) return { id: v, count, use: false };
  return null;
}

/** WCTF resource stage [dev, devGS, screw, screwGS, consumedList] -> stage obj */
function parseStage(st) {
  if (!Array.isArray(st)) return null;
  const dev = Number(st[0]) || 0;
  const devGS = Number(st[1]) || 0;
  const screw = Number(st[2]) || 0;
  const screwGS = Number(st[3]) || 0;
  const consumed = [];
  if (Array.isArray(st[4])) {
    for (const pair of st[4]) {
      const c = parseConsumed(pair);
      if (c) consumed.push(c);
    }
  }
  return { dev, devGS, screw, screwGS, consumed };
}

function parseWctf(text) {
  const map = new Map();
  for (const line of text.split('\n')) {
    const l = line.trim();
    if (!l) continue;
    let o;
    try { o = JSON.parse(l); } catch { continue; }
    if (!o || !o.improvement || !Array.isArray(o.improvement) || o.improvement.length === 0) continue;
    // 標準改修(improvement[0])を採用。
    const imp = o.improvement[0];
    const res = imp.resource || [];
    const base = Array.isArray(res[0]) ? res[0].slice(0, 4).map((n) => Number(n) || 0) : null;
    const stages = [parseStage(res[1]), parseStage(res[2]), parseStage(res[3])];

    // req: [[days[7], [shipIds]], ...] -> reqs + 曜日 union
    const reqs = [];
    const days = [false, false, false, false, false, false, false];
    if (Array.isArray(imp.req)) {
      for (const r of imp.req) {
        const rdays = Array.isArray(r[0]) ? r[0].map(Boolean) : [];
        const ships = Array.isArray(r[1]) ? r[1].filter((x) => typeof x === 'number' && x > 0) : [];
        while (rdays.length < 7) rdays.push(false);
        for (let d = 0; d < 7; d++) days[d] = days[d] || rdays[d];
        reqs.push({ days: rdays.slice(0, 7), ships });
      }
    }
    map.set(o.id, { base, stages, reqs, days });
  }
  return map;
}

// ─────────────────────────────── merge ─────────────────────────────────────

function merge(akashi, wctf) {
  const equipment = [];
  for (const a of akashi.values()) {
    const w = wctf.get(a.id);
    let entry;
    if (w) {
      // 完全配方（WCTF）。改修資材の通常値は段階データに含まれる。
      entry = {
        id: a.id,
        name: a.name,
        type: a.type,
        full: true,
        base: w.base,
        stages: w.stages,
        reqs: w.reqs,            // 实秘书艦 master id + 曜日
        days: w.days.some(Boolean) ? w.days : a.days,
        secretaryCount: w.reqs.reduce((n, r) => n + r.ships.length, 0),
      };
    } else {
      // akashi のみ：改修資材(ネジ)段階値だけ。開発資材/消費装備は不明。
      const stages = a.kit.map((screw) =>
        screw === null ? null : { dev: -1, devGS: -1, screw, screwGS: -1, consumed: [] });
      entry = {
        id: a.id,
        name: a.name,
        type: a.type,
        full: false,
        base: null,
        stages,
        reqs: a.secretaries.map((s) => ({ days: s.days, ships: [] })),
        days: a.days,
        secretaryCount: a.secretaries.length,
      };
    }
    equipment.push(entry);
  }
  equipment.sort((x, y) => x.id - y.id);
  return equipment;
}

// ─────────────────────────────── main ──────────────────────────────────────

async function main() {
  const localAkashi = process.argv[2];
  const localWctf = process.argv[3];

  const akashiHtml = localAkashi
    ? await readFile(localAkashi, 'utf-8')
    : await fetchFirst(AKASHI_SOURCES);
  if (!akashiHtml) throw new Error('akashi-list source unavailable');

  const wctfText = localWctf
    ? await readFile(localWctf, 'utf-8')
    : await fetchFirst([WCTF_SOURCE]);
  if (!wctfText) throw new Error('WhoCallsTheFleet source unavailable');

  const akashi = parseAkashi(akashiHtml);
  const wctf = parseWctf(wctfText);
  const equipment = merge(akashi, wctf);
  if (equipment.length === 0) throw new Error('parsed 0 equipment — source layout may have changed');

  const fullCount = equipment.filter((e) => e.full).length;
  const today = new Date();
  const payload = {
    source: 'akashi-list.me (set/screws/days) + WhoCallsTheFleet/KC3Kai (full recipe)',
    note:
      'days & reqs[].days order: ' + WEEK.join('') + ' (0=Sun). ' +
      'stages = [★0-5, ★6-9, MAX]; each {dev,devGS(確保),screw,screwGS(確保),consumed:[{id,count,use}]}. ' +
      'dev/devGS/screwGS = -1 means unknown (item newer than WCTF; only akashi screws known). ' +
      'consumed.id: use=false→slotitem master id, use=true→useitem id. reqs[].ships = secretary ship master ids.',
    fetchedAt: `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`,
    count: equipment.length,
    fullRecipeCount: fullCount,
    equipment,
  };

  await writeFile(OUT_PATH, JSON.stringify(payload, null, 0) + '\n', 'utf-8');
  console.log(`[improvement] wrote ${equipment.length} entries (${fullCount} with full recipe) -> ${OUT_PATH}`);
}

main().catch((e) => {
  console.error('[improvement] FAILED:', e);
  process.exit(1);
});
