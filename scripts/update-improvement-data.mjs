#!/usr/bin/env node
// @ts-nocheck
/**
 * update-improvement-data.mjs — 改修（装备改修）データの月次更新スクリプト。
 *
 * データソース: ElectronicObserver のデータリポジトリ
 *   https://raw.githubusercontent.com/ElectronicObserverEN/Data/master/Data/EquipmentUpgrades.json
 *
 * ElectronicObserver(EN) は現在も活発に更新されている艦これビューアで、その改修
 * データは日本語 wiki「改修表」由来かつ最新（新装备も収録）。各装备・各段階の
 * 完全な配方を持つ：
 *   - 開発資材（通常 devmats / 確保 devmats_sli）
 *   - 改修資材ネジ（通常 screws / 確保 screws_sli）
 *   - 消費装備（equips）/ 消費道具（consumable）
 *   - 基礎消費（燃弹钢铝）
 *   - 秘书艦（helpers の ship master id + 曜日）
 *   - MAX 改修更新先（convert.id_after）
 *
 * 装备名・カテゴリ・アイコンはアプリ内のマスターデータ(api_mst_slotitem)から
 * master id で解決するため、JSON には配方のみを格納する。
 *
 * 出力: entry/src/main/resources/rawfile/data/improvement.json
 *
 * 使い方:
 *   node scripts/update-improvement-data.mjs                  # ネットから取得
 *   node scripts/update-improvement-data.mjs <EquipmentUpgrades.json>
 *
 * 月次運用: 毎月 1 回実行し、生成された JSON をコミットする。
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(
  __dirname,
  '../entry/src/main/resources/rawfile/data/improvement.json'
);

const SOURCE =
  'https://raw.githubusercontent.com/ElectronicObserverEN/Data/master/Data/EquipmentUpgrades.json';

const WEEK = ['日', '月', '火', '水', '木', '金', '土']; // 0=日(Sun)..6=土(Sat)

async function loadJson(localPath) {
  let text;
  if (localPath) {
    console.log(`[improvement] reading local file: ${localPath}`);
    text = await readFile(localPath, 'utf-8');
  } else {
    console.log(`[improvement] fetching: ${SOURCE}`);
    const res = await fetch(SOURCE, { headers: { 'User-Agent': 'kantaihomo-updater' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${SOURCE}`);
    text = await res.text();
  }
  // EquipmentUpgrades.json は UTF-8 BOM 付き。
  return JSON.parse(text.replace(/^﻿/, ''));
}

/** EO の helpers[].days(曜日 index 配列) を 7 要素 bool 配列に。 */
function daysToBool(days) {
  const out = [false, false, false, false, false, false, false];
  if (Array.isArray(days)) for (const d of days) if (d >= 0 && d < 7) out[d] = true;
  return out;
}

/** consumed: equips(装备) + consumable(道具) を {id,count,use} 配列に。 */
function buildConsumed(phase) {
  const out = [];
  for (const e of phase.equips || []) {
    const id = Number(e.id) || 0;
    const count = Number(e.eq_count) || 0;
    if (id > 0 && count > 0) out.push({ id, count, use: false });
  }
  for (const c of phase.consumable || []) {
    const id = Number(c.id) || 0;
    const count = Number(c.eq_count) || 0;
    if (id > 0 && count > 0) out.push({ id, count, use: true });
  }
  return out;
}

/** EO phase(p1/p2/conv) → stage オブジェクト。無い段階は null。 */
function buildStage(phase) {
  if (!phase) return null;
  const dev = Number(phase.devmats) || 0;
  const devGS = Number(phase.devmats_sli) || 0;
  const screw = Number(phase.screws) || 0;
  const screwGS = Number(phase.screws_sli) || 0;
  const consumed = buildConsumed(phase);
  // 段階が完全に空（改修更新が無い等）の場合 null 扱い。
  if (dev === 0 && devGS === 0 && screw === 0 && screwGS === 0 && consumed.length === 0) return null;
  return { dev, devGS, screw, screwGS, consumed };
}

function transform(eo) {
  const equipment = [];
  for (const entry of eo) {
    const imps = entry.improvement;
    if (!Array.isArray(imps) || imps.length === 0) continue;

    // 配方・更新先は標準改修(improvement[0])を採用。曜日/秘书艦は全 entry の和集合。
    const main = imps[0];
    const costs = main.costs || {};
    const stages = [buildStage(costs.p1), buildStage(costs.p2), buildStage(costs.conv)];

    const base = [
      Number(costs.fuel) || 0,
      Number(costs.ammo) || 0,
      Number(costs.steel) || 0,
      Number(costs.baux) || 0,
    ];

    const reqs = [];
    const days = [false, false, false, false, false, false, false];
    for (const im of imps) {
      for (const h of im.helpers || []) {
        const hb = daysToBool(h.days);
        const ships = (h.ship_ids || []).filter((x) => typeof x === 'number' && x > 0);
        for (let d = 0; d < 7; d++) days[d] = days[d] || hb[d];
        reqs.push({ days: hb, ships });
      }
    }
    // helpers/曜日データが無い装备は「いつでも改修可」とみなす。
    if (!days.some(Boolean)) days.fill(true);

    const convertTo = Number((main.convert || {}).id_after) || 0;

    equipment.push({
      id: entry.eq_id,
      base,
      stages,
      convertTo,
      reqs,
      days,
      secretaryCount: reqs.reduce((n, r) => n + r.ships.length, 0),
    });
  }
  equipment.sort((a, b) => a.id - b.id);
  return equipment;
}

async function main() {
  const eo = await loadJson(process.argv[2]);
  if (!Array.isArray(eo)) throw new Error('unexpected source format (expected array)');

  const equipment = transform(eo);
  if (equipment.length === 0) throw new Error('parsed 0 equipment — source schema may have changed');

  const today = new Date();
  const payload = {
    source: 'https://raw.githubusercontent.com/ElectronicObserverEN/Data (wiki-derived, maintained)',
    note:
      'days & reqs[].days order: ' + WEEK.join('') + ' (0=Sun). ' +
      'stages = [★0-5, ★6-9, MAX]; null = stage not applicable. each stage ' +
      '{dev,devGS(確保),screw,screwGS(確保),consumed:[{id,count,use}]}. ' +
      'consumed.use=false→slotitem master id, use=true→useitem id. ' +
      'reqs[].ships = secretary ship master ids. convertTo = MAX 改修更新先 equip id (0=none). ' +
      '装备名/カテゴリ/アイコンは master id からアプリ内で解決。',
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
