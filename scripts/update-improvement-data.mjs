#!/usr/bin/env node
// @ts-nocheck
/**
 * update-improvement-data.mjs — 改修（装备改修）データの月次更新スクリプト。
 *
 * データソース: akashi-list.me （https://akashi-list.me/ , gh-pages の index.html に
 * 改修可能装备が `<div class="weapon" id="wNNN">` ブロックとして埋め込まれている）。
 *
 * 取得できる情報（akashi-list が公開している範囲）:
 *   - 装备 master id（= weapon id）/ 名称
 *   - akashi カテゴリ（type）
 *   - 改修资材（ネジ）の段階別消費数  ★0〜5 / ★6〜9 / MAX
 *   - 秘书艦（改修補助艦）の曜日別可否（日〜土）
 *
 * 取得できない情報（akashi-list に存在しない → JSON にも入らない）:
 *   - 開発资材 / 消費装备（→ 日本語 wiki「改修表」が必要）
 *   - 秘书艦の艦名（akashi はスプライト index のみ持ち、艦名対応表が無い）
 *
 * 出力: entry/src/main/resources/rawfile/data/improvement.json
 *
 * 使い方:
 *   node scripts/update-improvement-data.mjs            # akashi-list から取得
 *   node scripts/update-improvement-data.mjs <file.html> # ローカル HTML から生成
 *
 * 月次運用: 毎月 1 回このスクリプトを実行し、生成された JSON をコミットする。
 * （CI のデータセンター IP は Cloudflare にブロックされることがあるため、
 *  ネットワーク制限の無い通常マシン上で実行すること。）
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(
  __dirname,
  '../entry/src/main/resources/rawfile/data/improvement.json'
);

// akashi-list.me 本体は Cloudflare で弾かれることがあるため gh-pages の生 HTML を優先。
const SOURCES = [
  'https://raw.githubusercontent.com/yukikuri/akashi-list/gh-pages/index.html',
  'https://akashi-list.me/',
];

const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

async function loadHtml(localPath) {
  if (localPath) {
    console.log(`[improvement] reading local file: ${localPath}`);
    return await readFile(localPath, 'utf-8');
  }
  for (const url of SOURCES) {
    try {
      console.log(`[improvement] fetching: ${url}`);
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        },
      });
      if (res.ok) return await res.text();
      console.warn(`[improvement]   -> HTTP ${res.status}`);
    } catch (e) {
      console.warn(`[improvement]   -> ${String(e)}`);
    }
  }
  throw new Error('all sources failed; pass a local HTML file as argument');
}

/** aia-all スクリプト内の weapon メタ表 {id:"NNN",type:"key"} から id→type を作る。 */
function parseTypeMap(html) {
  const m = html.match(/<script id=aia-all>([\s\S]*?)<\/script>/);
  const map = new Map();
  if (!m) return map;
  const re = /\{id:"(\d+)",type:"([a-zA-Z]+)"/g;
  let g;
  while ((g = re.exec(m[1])) !== null) {
    map.set(parseInt(g[1], 10), g[2]);
  }
  return map;
}

/** 1 つの support-ship セグメントから {sprite, days[7]} を作る。 */
function parseSecretary(seg) {
  const sm = seg.match(/\/img\/s(\d+)\.png/);
  if (!sm) return null;
  const days = [];
  const re = /<span( class=enable)?>[日月火水木金土]<\/span>/g;
  let g;
  while ((g = re.exec(seg)) !== null) days.push(Boolean(g[1]));
  // 7 つの曜日 span が揃わない場合は欠落を false 扱いで 7 個に整える
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

function parseEquipment(html, typeMap) {
  const marker = '<div class=weapon id=w';
  const starts = [];
  for (let i = html.indexOf(marker); i >= 0; i = html.indexOf(marker, i + 1)) {
    starts.push(i);
  }
  const out = [];
  for (let k = 0; k < starts.length; k++) {
    const block = html.slice(starts[k], starts[k + 1] ?? html.length);
    // id は `id=wNNN>` または `id=wNNN data-tip-style=...>` の両形がある。
    const idm = block.match(/id=w(\d+)/);
    if (!idm) continue;
    const id = parseInt(idm[1], 10);
    // alt は `alt="019: 名称"`（引用符あり）と `alt=091:名称>`（引用符なし）の両形がある。
    const namem = block.match(/alt="?\d+:\s*([^">]+)/);
    const name = namem ? namem[1].trim() : '';
    const kit = parseKit(block);

    // remodelkit が無い／全段 null の装备は「改修不可」。改修一覧には載せない。
    if (kit.every((x) => x === null)) continue;

    const secretaries = [];
    const segs = block.split('class=support-ship>');
    for (let s = 1; s < segs.length; s++) {
      const sec = parseSecretary(segs[s]);
      if (sec) secretaries.push(sec);
    }

    // 改修可能曜日 = 全秘书艦の可否の OR。秘书艦が無ければ全曜日可とみなす。
    const days = [false, false, false, false, false, false, false];
    if (secretaries.length === 0) days.fill(true);
    else for (const sec of secretaries) for (let d = 0; d < 7; d++) days[d] = days[d] || sec.days[d];

    out.push({ id, name, type: typeMap.get(id) ?? 'etc', kit, days, secretaries });
  }
  return out;
}

async function main() {
  const localPath = process.argv[2];
  const html = await loadHtml(localPath);
  const typeMap = parseTypeMap(html);
  const equipment = parseEquipment(html, typeMap);
  equipment.sort((a, b) => a.id - b.id);

  if (equipment.length === 0) throw new Error('parsed 0 equipment — source layout may have changed');

  const today = new Date();
  const payload = {
    source: 'https://akashi-list.me/',
    note: 'Generated by scripts/update-improvement-data.mjs. days/secretaries[].days order: ' + WEEK.join(''),
    fetchedAt: `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`,
    count: equipment.length,
    equipment,
  };

  await writeFile(OUT_PATH, JSON.stringify(payload, null, 0) + '\n', 'utf-8');
  console.log(`[improvement] wrote ${equipment.length} entries -> ${OUT_PATH}`);
}

main().catch((e) => {
  console.error('[improvement] FAILED:', e);
  process.exit(1);
});
