/**
 * features/battle/simulator/core.ts
 *
 * 核心战斗模拟逻辑，移植自 poi/lib/utils/simulator.js
 *
 * 主要改动：
 */

import {
  SimShip, SimAttack, SimStage, SimResult, AerialInfo, EngagementInfo,
  AttackType, StageType, HitType, ShipOwner, Rank,
  MultiTargetAttackType, MultiTargetAttackOrder,
  DayAttackTypeMap, NightAttackTypeMap, AirControlMap, DetectionMap,
  FormationMap, EngagementMap, SupportTypeMap, BattleRankMap,
  FleetInput, RawFleetShip, MasterDataProvider, BattlePrediction,
} from './type';

// ─── 内部工具 ─────────────────────────────────────────────────────────────────

function toParam4(v?: number[] | null): [number,number,number,number] {
  return [v?.[0] ?? 0, v?.[1] ?? 0, v?.[2] ?? 0, v?.[3] ?? 0];
}

function param4(a=0,b=0,c=0,d=0): [number,number,number,number] {
  return [a,b,c,d];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** 大破判断所需的半数击沉表，key = 敌舰数量 */
const HalfSunkNumber: Record<number, number> = {
  2:1, 3:2, 4:2, 5:3, 6:3, 7:4,
};

// ─── 消耗品处理 ───────────────────────────────────────────────────────────────

function damageShip(
  fromShip: SimShip | null | undefined,
  toShip:   SimShip | null | undefined,
  damage:   number,
): { fromHP: number; toHP: number; item: number | null } {
  const fromHP = fromShip?.nowHP ?? 0;
  let   toHP   = toShip?.nowHP ?? 0;
  let   item: number | null = null;

  if (toShip != null) {
    toHP = Math.max(0, toShip.nowHP - damage);
    // 大破修理女神检查（api_useitem 中的女神补给）
    if (toHP <= 0 && toShip.useItem != null) {
      item  = toShip.useItem;
      toHP  = Math.floor(toShip.maxHP * 0.2);
      toShip.useItem = null;
    }
    toShip.nowHP = toHP;
    if (fromShip != null) fromShip.damage += damage;
  }
  return { fromHP, toHP, item };
}

// ─── Engagement / AerialInfo 生成 ─────────────────────────────────────────────

function generateAerialInfo(
  kouku:        Record<string, unknown>,
  mainShips:    (SimShip | null)[] | null,
  escortShips?: (SimShip | null)[] | null,
): AerialInfo {
  const o: AerialInfo = new AerialInfo();
  const s1 = isRecord(kouku.api_stage1) ? kouku.api_stage1 as Record<string,unknown> : null;
  const s2 = isRecord(kouku.api_stage2) ? kouku.api_stage2 as Record<string,unknown> : null;

  // Stage1
  if (s1 != null) {
    const fc   = typeof s1.api_f_count    === 'number' ? s1.api_f_count    : 0;
    const fl   = typeof s1.api_f_lostcount === 'number' ? s1.api_f_lostcount : 0;
    const ec   = typeof s1.api_e_count    === 'number' ? s1.api_e_count    : 0;
    const el   = typeof s1.api_e_lostcount === 'number' ? s1.api_e_lostcount : 0;
    const seiku = typeof s1.api_disp_seiku === 'number' ? s1.api_disp_seiku  : null;

    o.fPlaneInit1 = fc; o.fPlaneNow1 = fc - fl;
    o.ePlaneInit1 = ec; o.ePlaneNow1 = ec - el;
    if (seiku != null) o.control = AirControlMap[seiku];

    const touch = Array.isArray(s1.api_touch_plane) ? s1.api_touch_plane : [];
    o.fContact = (typeof touch[0] === 'number' && touch[0] > 0) ? touch[0] : null;
    o.eContact = (typeof touch[1] === 'number' && touch[1] > 0) ? touch[1] : null;
  }

  // Stage2
  if (s2 != null) {
    const fc   = typeof s2.api_f_count    === 'number' ? s2.api_f_count    : 0;
    const fl   = typeof s2.api_f_lostcount === 'number' ? s2.api_f_lostcount : 0;
    const ec   = typeof s2.api_e_count    === 'number' ? s2.api_e_count    : 0;
    const el   = typeof s2.api_e_lostcount === 'number' ? s2.api_e_lostcount : 0;
    o.fPlaneInit2 = fc; o.fPlaneNow2 = fc - fl;
    o.ePlaneInit2 = ec; o.ePlaneNow2 = ec - el;

    const fire = isRecord(s2.api_air_fire) ? s2.api_fire as Record<string,unknown> : null;
    if (fire != null) {
      o.aaciKind  = typeof fire.api_kind === 'number' ? fire.api_kind : null;
      const idx   = typeof fire.api_idx  === 'number' ? fire.api_idx  : -1;
      const ships = [...(mainShips ?? []), ...(escortShips ?? [])];
      o.aaciShip  = ships[idx] ?? null;
      o.aaciItems = Array.isArray(fire.api_use_items) ? fire.api_use_items as number[] : [];
    }
  }

  // Total plane counts from stage1 + stage2
  o.fPlaneInit = (o.fPlaneInit1 ?? 0) + (o.fPlaneInit2 ?? 0);
  o.fPlaneNow  = (o.fPlaneNow1  ?? 0) + (o.fPlaneNow2  ?? 0);
  o.ePlaneInit = (o.ePlaneInit1 ?? 0) + (o.ePlaneInit2 ?? 0);
  o.ePlaneNow  = (o.ePlaneNow1  ?? 0) + (o.ePlaneNow2  ?? 0);

  return o;
}

function generateEngagementInfo(
  packet:        Record<string, unknown>,
  ourShips:      (SimShip | null)[],
  enemyShips:    (SimShip | null)[],
  opts: { engagement?: boolean; night?: boolean } = {},
): EngagementInfo | null {
  const o = new EngagementInfo();
  let hasData = false;

  if (opts.engagement) {
    const formation = Array.isArray(packet.api_formation) ? packet.api_formation : [];
    const [fFmKey, eFmKey, engKey] = formation as number[];

    if (typeof fFmKey === 'number') { o.fFormation = FormationMap[fFmKey]; hasData = true; }
    if (typeof eFmKey === 'number') { o.eFormation = FormationMap[eFmKey]; hasData = true; }
    if (typeof engKey === 'number') { o.engagement  = EngagementMap[engKey]; hasData = true; }

    const api_search = Array.isArray(packet.api_search) ? packet.api_search : [];
    const fdk = api_search[0], edk = api_search[1];
    if (typeof fdk === 'number') { o.fDetection = DetectionMap[fdk]; hasData = true; }
    if (typeof edk === 'number') { o.eDetection = DetectionMap[edk]; hasData = true; }

    const { api_boss_damaged, api_xal01 } = packet;
    o.weakened  = [api_boss_damaged, api_xal01].find((x) => x != null);
    o.smokeType = typeof packet.api_smoke_type === 'number' ? packet.api_smoke_type : 0;
  }

  if (opts.night) {
    const planes = Array.isArray(packet.api_touch_plane)
      ? (packet.api_touch_plane as unknown[]).map(x => Number(x))
      : [];
    o.fContact = planes[0] > 0 ? planes[0] : null;
    o.eContact = planes[1] > 0 ? planes[1] : null;

    const flare = Array.isArray(packet.api_flare_pos) ? packet.api_flare_pos : [];
    o.fFlare = typeof flare[0] === 'number' ? (ourShips[flare[0]] ?? null) : null;
    o.eFlare = typeof flare[1] === 'number' ? (enemyShips[flare[1]] ?? null) : null;
    hasData  = true;
  }

  return hasData ? o : null;
}

// ─── Simulation helpers ──────────────────────────────────────────────────────

function simulateAerialAttack(
  fleet: (SimShip | null)[],
  edam?: number[] | null, ebak?: number[] | null,
  erai?: number[] | null, ecl?:  number[] | null,
): SimAttack[] {
  const dam = edam ?? [], bak = ebak ?? [], rai = erai ?? [], cl = ecl ?? [];
  const list: SimAttack[] = [];
  for (const [i, rawDmg] of dam.entries()) {
    if (rawDmg < 0 || ((bak[i] ?? 0) <= 0 && (rai[i] ?? 0) <= 0)) continue;
    const damage   = Math.floor(rawDmg);
    const toShip   = fleet[i] ?? null;
    const hit: HitType = cl[i] === 1 ? HitType.Critical : (damage > 0 ? HitType.Hit : HitType.Miss);
    const { fromHP, toHP, item } = damageShip(null, toShip, damage);
    list.push(new SimAttack({ type: AttackType.Normal, toShip, damage:[damage], hit:[hit], fromHP, toHP, useItem:item }));
  }
  return list;
}

function simulateAerial(
  mainFleet:   (SimShip | null)[] | null | undefined,
  escortFleet: (SimShip | null)[] | null | undefined,
  enemyFleet:  (SimShip | null)[] | null | undefined,
  enemyEscort: (SimShip | null)[] | null | undefined,
  kouku:       unknown,
  assault = false,
): SimStage | null {
  if (kouku == null || !isRecord(kouku)) return null;

  const mf = mainFleet ?? [], ef = escortFleet ?? [];
  const emf = enemyFleet ?? [], eef = enemyEscort ?? [];

  const s3 = isRecord(kouku.api_stage3) ? kouku.api_stage3 as Record<string,unknown> : null;
  const s3c = isRecord(kouku.api_stage3_combined) ? kouku.api_stage3_combined as Record<string,unknown> : null;

  let attacks: SimAttack[] = [];
  if (s3 != null) {
    attacks = attacks.concat(simulateAerialAttack(emf, s3.api_edam as number[], s3.api_ebak_flag as number[], s3.api_erai_flag as number[], s3.api_ecl_flag as number[]));
    attacks = attacks.concat(simulateAerialAttack(mf,  s3.api_fdam as number[], s3.api_fbak_flag as number[], s3.api_frai_flag as number[], s3.api_fcl_flag as number[]));
  }
  if (s3c != null) {
    attacks = attacks.concat(simulateAerialAttack(eef, s3c.api_edam as number[], s3c.api_ebak_flag as number[], s3c.api_erai_flag as number[], s3c.api_ecl_flag as number[]));
    attacks = attacks.concat(simulateAerialAttack(ef,  s3c.api_fdam as number[], s3c.api_fbak_flag as number[], s3c.api_frai_flag as number[], s3c.api_fcl_flag as number[]));
  }

  const aerial = generateAerialInfo(kouku, mf, ef);
  return new SimStage({
    type: StageType.Aerial,
    subtype: assault ? StageType.Assault : null,
    attacks, aerial, kouku,
  });
}

function simulateTorpedoAttack(
  mainFleet:   (SimShip | null)[],
  escortFleet: (SimShip | null)[],
  enemyFleet:  (SimShip | null)[],
  enemyEscort: (SimShip | null)[],
  eydam: number[] | null | undefined,
  erai:  number[] | null | undefined,
  ecl:   number[] | null | undefined,
): SimAttack[] {
  const dam = eydam ?? [], rai = erai ?? [], cl = ecl ?? [];
  const list: SimAttack[] = [];
  const mRange = mainFleet.length, eRange = enemyFleet.length;

  for (const [i, t] of rai.entries()) {
    if (i < 0 || t < 0 || dam[i] == null || cl[i] == null) continue;
    const fromShip = i < mRange ? mainFleet[i] : escortFleet[i - mRange];
    if (fromShip == null) continue;
    const toShip = t < eRange ? enemyFleet[t] : enemyEscort[t - eRange];
    if (toShip == null) continue;
    const damage = Math.floor(dam[i]);
    const hit: HitType = cl[i] === 2 ? HitType.Critical : (cl[i] === 1 ? HitType.Hit : HitType.Miss);
    const { fromHP, toHP, item } = damageShip(fromShip, toShip, damage);
    list.push(new SimAttack({ type: AttackType.Normal, fromShip, toShip, damage:[damage], hit:[hit], fromHP, toHP, useItem:item }));
  }
  return list;
}

function simulateOpeningTorpedoAttack(
  mainFleet:   (SimShip | null)[],
  escortFleet: (SimShip | null)[],
  enemyFleet:  (SimShip | null)[],
  enemyEscort: (SimShip | null)[],
  eydamList: number[][] | null | undefined,
  eraiList:  number[][] | null | undefined,
  eclList:   number[][] | null | undefined,
): SimAttack[] {
  const dam = eydamList ?? [], rai = eraiList ?? [], cl = eclList ?? [];
  const list: SimAttack[] = [];
  const mRange = mainFleet.length, eRange = enemyFleet.length;

  for (const [i, tList] of rai.entries()) {
    if (i < 0 || tList == null) continue;
    const fromShip = i < mRange ? mainFleet[i] : escortFleet[i - mRange];
    if (fromShip == null) continue;
    for (const [j, t] of (tList as number[]).entries()) {
      if (t < 0) continue;
      const toShip = t < eRange ? enemyFleet[t] : enemyEscort[t - eRange];
      if (toShip == null) continue;
      const damage = Math.floor(dam[i]?.[j] ?? 0);
      const hit: HitType = cl[i]?.[j] === 2 ? HitType.Critical : (cl[i]?.[j] === 1 ? HitType.Hit : HitType.Miss);
      const { fromHP, toHP, item } = damageShip(fromShip, toShip, damage);
      list.push(new SimAttack({ type: AttackType.Normal, fromShip, toShip, damage:[damage], hit:[hit], fromHP, toHP, useItem:item }));
    }
  }
  return list;
}

function simulateTorpedo(
  mainFleet: (SimShip|null)[]|null|undefined,
  escortFleet: (SimShip|null)[]|null|undefined,
  enemyFleet: (SimShip|null)[]|null|undefined,
  enemyEscort: (SimShip|null)[]|null|undefined,
  raigeki: unknown,
  subtype?: StageType,
): SimStage | null {
  if (!isRecord(raigeki)) return null;
  const mf=mainFleet??[], ef=escortFleet??[], emf=enemyFleet??[], eef=enemyEscort??[];

  let attacks: SimAttack[] = [];
  if (raigeki.api_frai != null) {
    const fydam = (raigeki.api_fydam ?? raigeki.api_fdam) as number[];
    attacks = attacks.concat(simulateTorpedoAttack(mf,ef,emf,eef,fydam,raigeki.api_frai as number[],raigeki.api_fcl as number[]));
  }
  if (raigeki.api_erai != null) {
    const eydam = (raigeki.api_eydam ?? raigeki.api_edam) as number[];
    attacks = attacks.concat(simulateTorpedoAttack(emf,eef,mf,ef,eydam,raigeki.api_erai as number[],raigeki.api_ecl as number[]));
  }
  return new SimStage({ type: StageType.Torpedo, attacks, subtype });
}

function simulateOpeningTorpedo(
  mainFleet: (SimShip|null)[]|null|undefined,
  escortFleet: (SimShip|null)[]|null|undefined,
  enemyFleet: (SimShip|null)[]|null|undefined,
  enemyEscort: (SimShip|null)[]|null|undefined,
  raigeki: unknown,
  subtype?: StageType,
): SimStage | null {
  if (!isRecord(raigeki)) return null;
  // 旧版格式兼容
  if (raigeki.api_frai != null) {
    return simulateTorpedo(mainFleet, escortFleet, enemyFleet, enemyEscort, raigeki, subtype);
  }
  const mf=mainFleet??[], ef=escortFleet??[], emf=enemyFleet??[], eef=enemyEscort??[];
  let attacks: SimAttack[] = [];
  if (raigeki.api_frai_list_items != null) {
    attacks = attacks.concat(simulateOpeningTorpedoAttack(mf,ef,emf,eef,
      raigeki.api_fydam_list_items as number[][],
      raigeki.api_frai_list_items as number[][],
      raigeki.api_fcl_list_items as number[][]));
  }
  if (raigeki.api_erai_list_items != null) {
    attacks = attacks.concat(simulateOpeningTorpedoAttack(emf,eef,mf,ef,
      raigeki.api_eydam_list_items as number[][],
      raigeki.api_erai_list_items as number[][],
      raigeki.api_ecl_list_items as number[][]));
  }
  return new SimStage({ type: StageType.Torpedo, attacks, subtype });
}

function simulateShelling(
  mainFleet: (SimShip|null)[]|null|undefined,
  escortFleet: (SimShip|null)[]|null|undefined,
  enemyFleet: (SimShip|null)[]|null|undefined,
  enemyEscort: (SimShip|null)[]|null|undefined,
  hougeki: unknown,
  subtype?: StageType,
): SimStage | null {
  if (!isRecord(hougeki)) return null;
  const mf=mainFleet??[], ef=escortFleet??[], emf=enemyFleet??[], eef=enemyEscort??[];
  const isNight = subtype === StageType.Night;
  const mRange = mf.length, eRange = emf.length;
  const list: SimAttack[] = [];

  for (const [i, rawAt] of ((hougeki.api_at_list ?? []) as number[]).entries()) {
    if (rawAt === -1) continue;

    const spKey = (hougeki.api_sp_list as number[])?.[i] ?? 0;
    const atKey = (hougeki.api_at_type as number[])?.[i] ?? 0;
    const attackType: AttackType = isNight
      ? (NightAttackTypeMap[spKey] ?? AttackType.Normal)
      : (DayAttackTypeMap[atKey]   ?? AttackType.Normal);

    if (!MultiTargetAttackType.has(attackType)) {
      // 单目标
      let df = (hougeki.api_df_list as number[][])[i][0];
      let at = rawAt;
      let fromEnemy: boolean;

      if (Array.isArray(hougeki.api_at_eflag)) {
        fromEnemy = (hougeki.api_at_eflag as number[])[i] === 1;
      } else {
        fromEnemy = df < mRange;
        if (at >= mRange) at -= mRange;
        if (df >= mRange) df -= mRange;
      }

      const fromShip = fromEnemy
        ? (at < eRange ? emf[at] : eef[at - eRange])
        : (at < mRange ? mf[at]  : ef[at - mRange]);
      const toShip   = fromEnemy
        ? (df < mRange ? mf[df]  : ef[df - mRange])
        : (df < eRange ? emf[df] : eef[df - eRange]);

      let damage: number[] = [], total = 0;
      for (let dmg of (hougeki.api_damage as number[][])[i]) {
        dmg = Math.floor(Math.max(0, dmg));
        damage.push(dmg); total += dmg;
      }
      const hit: HitType[] = ((hougeki.api_cl_list as number[][])[i]).map(cl =>
        cl === 2 ? HitType.Critical : (cl === 1 ? HitType.Hit : HitType.Miss));
      const { fromHP, toHP, item } = damageShip(fromShip ?? null, toShip ?? null, total);
      list.push(new SimAttack({ type: attackType, fromShip, toShip, damage, hit, fromHP, toHP, useItem: item }));

    } else {
      // 多目标特殊攻击
      const order = MultiTargetAttackOrder[attackType] ?? [];
      const dfList = (hougeki.api_df_list as number[][])[i];

      for (let j = 0; j < dfList.length; j++) {
        let df = dfList[j];
        let at = rawAt + (order[j] ?? 0);
        let fromEnemy: boolean;

        // Tanaka bug fix: combined night battle sp attack wrong attacker index
        if (isNight && ef.length && at < mRange) at += mRange;

        if (Array.isArray(hougeki.api_at_eflag)) {
          fromEnemy = (hougeki.api_at_eflag as number[])[i] === 1;
        } else {
          fromEnemy = df < mRange;
          if (at >= mRange) at -= mRange;
          if (df >= mRange) df -= mRange;
        }

        const fromShip = fromEnemy
          ? (at < eRange ? emf[at] : eef[at - eRange])
          : (at < mRange ? mf[at]  : ef[at - mRange]);
        const toShip   = fromEnemy
          ? (df < mRange ? mf[df]  : ef[df - mRange])
          : (df < eRange ? emf[df] : eef[df - eRange]);

        let dmg = (hougeki.api_damage as number[][])[i][j] ?? 0;
        dmg = Math.floor(Math.max(0, dmg));
        const cl = (hougeki.api_cl_list as number[][])[i][j];
        const hit: HitType = cl === 2 ? HitType.Critical : (cl === 1 ? HitType.Hit : HitType.Miss);
        const { fromHP, toHP, item } = damageShip(fromShip ?? null, toShip ?? null, dmg);
        list.push(new SimAttack({ type: attackType, fromShip, toShip, damage:[dmg], hit:[hit], fromHP, toHP, useItem: item }));
      }
    }
  }

  return new SimStage({ type: StageType.Shelling, attacks: list, subtype });
}

function simulateNight(
  fleetType:   number,
  mainFleet:   (SimShip|null)[]|null|undefined,
  escortFleet: (SimShip|null)[]|null|undefined,
  enemyType:   number,
  enemyFleet:  (SimShip|null)[]|null|undefined,
  enemyEscort: (SimShip|null)[]|null|undefined,
  hougeki:     unknown,
  packet:      Record<string, unknown>,
): SimStage | null {
  const stage = simulateShelling(mainFleet, escortFleet, enemyFleet, enemyEscort, hougeki, StageType.Night);
  if (stage == null) return null;

  let oursFleet   = fleetType === 0 ? (mainFleet   ?? []) : (escortFleet ?? []);
  let _enemyFleet = enemyType === 0 ? (enemyFleet  ?? []) : (enemyEscort ?? []);

  if (Array.isArray(packet.api_active_deck)) {
    const deck = packet.api_active_deck as number[];
    if (deck[0] === 1) oursFleet   = mainFleet   ?? [];
    if (deck[0] === 2) oursFleet   = escortFleet ?? [];
    if (deck[1] === 1) _enemyFleet = enemyFleet  ?? [];
    if (deck[1] === 2) _enemyFleet = enemyEscort ?? [];
  }

  stage.engagement = generateEngagementInfo(packet, oursFleet, _enemyFleet, { night: true });
  return stage;
}

function simulateSupport(
  enemyFleet:  (SimShip|null)[]|null|undefined,
  enemyEscort: (SimShip|null)[]|null|undefined,
  support:     unknown,
  flag:        unknown,
): SimStage | null {
  if (support == null || flag == null || !isRecord(support)) return null;
  const emf = enemyFleet ?? [], eef = enemyEscort ?? [];

  if (flag === 1 || flag === 4) {
    const kouku = isRecord(support.api_support_airatack) ? support.api_support_airatack as Record<string,unknown> : null;
    if (kouku == null) return null;
    const st3 = isRecord(kouku.api_stage3) ? kouku.api_stage3 as Record<string,unknown> : null;
    if (st3 == null) return null;
    const targetShips = [...emf, ...eef];
    const attacks = simulateAerialAttack(targetShips, st3.api_edam as number[], st3.api_ebak_flag as number[], st3.api_erai_flag as number[], st3.api_ecl_flag as number[]);
    const aerial  = generateAerialInfo(kouku, null, null);
    return new SimStage({ type: StageType.Support, subtype: SupportTypeMap[flag as number], attacks, aerial, kouku });
  }

  if (flag === 2 || flag === 3) {
    const hourai = isRecord(support.api_support_hourai) ? support.api_support_hourai as Record<string,unknown> : null;
    if (hourai == null) return null;
    const api_damage  = Array.isArray(hourai.api_damage)  ? hourai.api_damage  as number[] : [];
    const api_cl_list = Array.isArray(hourai.api_cl_list) ? hourai.api_cl_list as number[] : [];
    const attacks: SimAttack[] = [];
    const eRange = emf.length;
    for (const [i, rawDmg] of api_damage.entries()) {
      const toShip = i < eRange ? (emf[i] ?? null) : (eef[i - eRange] ?? null);
      if (toShip == null) continue;
      const damage = Math.floor(Math.max(0, rawDmg));
      const cl = api_cl_list[i];
      const hit: HitType = cl === 2 ? HitType.Critical : (cl === 1 ? HitType.Hit : HitType.Miss);
      if (hit === HitType.Miss) continue;
      const { fromHP, toHP, item } = damageShip(null, toShip, damage);
      attacks.push(new SimAttack({ type: AttackType.Normal, toShip, damage:[damage], hit:[hit], fromHP, toHP, useItem:item }));
    }
    return new SimStage({ type: StageType.Support, subtype: SupportTypeMap[flag as number], attacks });
  }

  return null;
}

function simulateLandBase(
  enemyFleet:  (SimShip|null)[]|null|undefined,
  enemyEscort: (SimShip|null)[]|null|undefined,
  kouku:       unknown,
  assault = false,
): SimStage | null {
  const stage = simulateAerial(null, null, enemyFleet, enemyEscort, kouku);
  if (stage == null) return null;
  stage.type    = StageType.LandBase;
  stage.subtype = assault ? StageType.Assault : null;
  return stage;
}

// ─── Battle rank calculation ─────────────────────────────────────────────────

function simulateBattleRank(
  mainFleet:   (SimShip|null)[]|null|undefined,
  escortFleet: (SimShip|null)[]|null|undefined,
  enemyFleet:  (SimShip|null)[]|null|undefined,
  enemyEscort: (SimShip|null)[]|null|undefined,
): Rank {
  function calStatus(fleet: (SimShip|null)[]) {
    let num=0, sunk=0, totalHP=0, lostHP=0;
    let flagshipSunk=false, flagshipCritical=false;
    for (const s of fleet) {
      if (s == null) continue;
      const nowHP = Math.max(0, s.nowHP);
      num++;
      sunk     += nowHP <= 0 ? 1 : 0;
      totalHP  += s.initHP;
      lostHP   += s.initHP - nowHP;
      if (s.pos === 0) {
        flagshipSunk     = nowHP <= 0;
        flagshipCritical = nowHP * 4 <= s.maxHP;
      }
    }
    return { num, sunk, rate: totalHP > 0 ? Math.floor(lostHP/totalHP*100) : 0, lostHP, flagshipSunk, flagshipCritical };
  }

  const ours  = calStatus([...(mainFleet??[]), ...(escortFleet??[])]);
  const enemy = calStatus([...(enemyFleet??[]), ...(enemyEscort??[])]);

  if (ours.sunk === 0) {
    if (enemy.sunk === enemy.num)
      return ours.lostHP <= 0 ? Rank.SS : Rank.S;
    if (enemy.num > 1 && enemy.sunk >= (HalfSunkNumber[enemy.num] ?? Infinity))
      return Rank.A;
  }
  if (enemy.flagshipSunk && ours.sunk < enemy.sunk) return Rank.B;
  if (ours.num === 1 && ours.flagshipCritical)        return Rank.D;
  if (2 * enemy.rate > 5 * ours.rate)                return Rank.B;
  if (10 * enemy.rate > 9 * ours.rate)               return Rank.C;
  if (ours.sunk > 0 && (ours.num - ours.sunk) === 1) return Rank.E;
  return Rank.D;
}

function simulateAirRaidBattleRank(
  mainFleet:   (SimShip|null)[]|null|undefined,
  escortFleet: (SimShip|null)[]|null|undefined,
): Rank {
  const ships     = [...(mainFleet??[]), ...(escortFleet??[])];
  const initHPSum = ships.reduce((x, s) => x + (s?.initHP ?? 0), 0);
  const nowHPSum  = ships.reduce((x, s) => x + (s?.nowHP  ?? 0), 0);
  const rate = initHPSum > 0 ? (initHPSum - nowHPSum) / initHPSum * 100 : 0;

  if (rate <= 0)  return Rank.SS;
  if (rate < 10)  return Rank.A;
  if (rate < 20)  return Rank.B;
  if (rate < 50)  return Rank.C;
  if (rate < 80)  return Rank.D;
  return Rank.E;
}

function simulateFleetMVP(fleet?: (SimShip|null)[] | null): number {
  let m = -1, mvp: SimShip | null = null;
  for (const [i, ship] of (fleet ?? []).entries()) {
    if (ship == null) continue;
    if (mvp == null || ship.damage > mvp.damage) { m = i; mvp = ship; }
  }
  return m;
}

function simulateFleetNightMVP(stages: (SimStage|null)[]): number {
  const sum = new Array<number>(6).fill(0);
  for (const stage of stages) {
    if (stage == null || stage.attacks == null) continue;
    if (!(stage.type === StageType.Shelling && stage.subtype === StageType.Night)) continue;
    for (const atk of stage.attacks) {
      const ship = atk.fromShip;
      if (ship == null || ship.owner !== ShipOwner.Ours) continue;
      if (6 <= ship.pos && ship.pos <= 11)
        sum[ship.pos - 7] += (atk.damage ?? []).reduce((x,y)=>x+y, 0);
    }
  }
  return sum.reduce((m, v, i) => (v > sum[m] ? i : m), 0);
}

function getEngagementStage(packet: Record<string, unknown>): SimStage | null {
  const eng = generateEngagementInfo(packet, [], [], { engagement: true });
  if (eng == null) return null;
  return new SimStage({ type: StageType.Engagement, engagement: eng });
}

// ─── Simulator2 ──────────────────────────────────────────────────────────────

export interface SimulatorOpts {
  /** 是否启用 master data 参数计算（需要提供 masterDataProvider） */
  useMasterData?: boolean;
  masterDataProvider?: MasterDataProvider;
}

/**
 * BattleSimulator
 *
 * 使用方法：
 * ```ts
 * const sim = new BattleSimulator(fleetInput, { useMasterData: false });
 * sim.simulate(dayBattlePacket);     // 昼战
 * sim.simulate(nightBattlePacket);   // 夜战（可选）
 * const pred = sim.getPrediction();
 * ```
 */
export class BattleSimulator {
  private fleetType:   number;
  mainFleet?:          (SimShip | null)[];
  escortFleet?:        (SimShip | null)[];
  private supportFleet?: (SimShip | null)[];
  private enemyFleet:  (SimShip | null)[] | null = null;
  private enemyEscort: (SimShip | null)[] | null = null;
  private friendFleet: (SimShip | null)[] | null = null;
  private enemyType:   number = 0;

  stages: (SimStage | null)[] = [];
  private _result: SimResult | null = null;
  private _isAirRaid       = false;
  private _isEngaged       = false;
  private _isNightOnlyMVP  = false;

  private useMasterData: boolean;
  private masterData?:   MasterDataProvider;

  constructor(fleet: FleetInput, opts: SimulatorOpts = {}) {
    this.useMasterData = opts.useMasterData ?? false;
    this.masterData    = opts.masterDataProvider;
    this.fleetType     = fleet.type ?? 0;
    this.mainFleet     = this._initFleet(fleet.main,   0);
    this.escortFleet   = this._initFleet(fleet.escort, 6);
    this.supportFleet  = this._initFleet(fleet.support);
  }

  // ── static factory ──────────────────────────────────────────────────────────

  static auto(
    battle: { fleet: FleetInput; packet: Record<string, unknown>[] } | null | undefined,
    opts?:  SimulatorOpts,
  ): BattleSimulator | undefined {
    if (battle == null || battle.fleet == null || battle.packet == null) return undefined;
    const s = new BattleSimulator(battle.fleet, opts);
    for (const pkt of battle.packet) s.simulate(pkt);
    return s;
  }

  // ── Fleet initialisation ─────────────────────────────────────────────────────

  private _initFleet(rawFleet: (RawFleetShip | null)[] | undefined, intl = 0): (SimShip | null)[] | undefined {
    if (rawFleet == null) return undefined;
    const fleet: (SimShip | null)[] = [];

    for (const [i, raw] of rawFleet.entries()) {
      if (raw == null) { fleet.push(null); continue; }

      const slots = [...(raw.api_slot ?? [])];
      if (raw.api_slot_ex != null && raw.api_slot_ex !== -1) slots.push(raw.api_slot_ex);

      let baseParam: [number,number,number,number] | undefined;
      let finalParam: [number,number,number,number] | undefined;

      if (this.useMasterData && this.masterData) {
        const kyouka = raw.api_kyouka ?? [];
        const $ship  = this.masterData.getShip(raw.api_ship_id);
        if ($ship != null) {
          baseParam = param4(
            $ship.api_houg[0] + (kyouka[0] ?? 0),
            $ship.api_raig[0] + (kyouka[1] ?? 0),
            $ship.api_tyku[0] + (kyouka[2] ?? 0),
            $ship.api_souk[0] + (kyouka[3] ?? 0),
          );
        }
        finalParam = param4(
          raw.api_karyoku?.[0] ?? 0,
          raw.api_raisou?.[0]  ?? 0,
          raw.api_taiku?.[0]   ?? 0,
          raw.api_soukou?.[0]  ?? 0,
        );
      }

      fleet.push(new SimShip({
        id: raw.api_ship_id,
        owner: ShipOwner.Ours,
        pos:   intl + i,
        maxHP: raw.api_maxhp,
        nowHP: raw.api_nowhp,
        items: slots,
        baseParam,
        finalParam,
        raw,
      }));
    }
    return fleet;
  }

  private _initEnemy(
    intl:         number,
    api_ship_ke:  number[] | undefined,
    api_eSlot:    number[][] | undefined,
    api_e_maxhps: number[] | undefined,
    api_e_nowhps: number[] | undefined,
    api_ship_lv:  number[] | undefined,
    api_param?:   number[][] | null,
    owner:        ShipOwner = ShipOwner.Enemy,
  ): (SimShip | null)[] | undefined {
    if (api_ship_ke == null) return undefined;
    const fleet: (SimShip | null)[] = [];

    for (let i = 0; i < api_ship_ke.length; i++) {
      const id    = api_ship_ke[i];
      const slots = api_eSlot?.[i] ?? [];
      let ship: SimShip | null = null;

      if (typeof id === 'number' && id > 0) {
        let baseParam:  [number,number,number,number] | undefined;
        let finalParam: [number,number,number,number] | undefined;

        if (this.useMasterData && this.masterData) {
          const bp  = toParam4(api_param?.[i]);
          baseParam = bp;
          finalParam = slots.reduce<[number,number,number,number]>((bonus, sid) => {
            const item = this.masterData!.getSlotItem(sid);
            if (item == null) return bonus;
            return [
              bonus[0] + (item.api_houg ?? 0),
              bonus[1] + (item.api_raig ?? 0),
              bonus[2] + (item.api_tyku ?? 0),
              bonus[3] + (item.api_souk ?? 0),
            ];
          }, bp);
        }

        ship = new SimShip({
          id, owner,
          pos:   intl + i,
          maxHP: api_e_maxhps?.[i] ?? 0,
          nowHP: api_e_nowhps?.[i] ?? 0,
          items: [],
          baseParam,
          finalParam,
        });
      }
      fleet.push(ship);
    }
    return fleet;
  }

  // ── simulate ─────────────────────────────────────────────────────────────────

  simulate(packet: Record<string, unknown>): void {
    const path = packet.poi_path ?? packet._path;
    if (typeof path !== 'string') return;
    this._prepare(packet, path);
    this._assert(path);

    // Engagement（仅首次）
    if (!this._isEngaged) {
      this._isEngaged = true;
      this.stages.push(getEngagementStage(packet));
    }

    if (DAY_BATTLE_PATHS.includes(path))          this._prcsDay(packet, path);
    if (NIGHT_BATTLE_PATHS.includes(path))        this._prcsNight(packet, path);
    if (path === '/kcsapi/api_req_combined_battle/ec_night_to_day') {
      this._prcsNight(packet, path);
      this._prcsDay(packet, path);
    }
    if (RESULT_PATHS.includes(path))              this._prcsResult(packet);
  }

  // ── prepare / assert ────────────────────────────────────────────────────────

  private _prepare(packet: Record<string, unknown>, path: string): void {
    if (this.enemyFleet == null) {
      const eMaxHps = (packet.api_e_maxhps ?? packet.api_maxhps) as number[];
      const eNowHps = (packet.api_e_nowhps ?? packet.api_nowhps) as number[];
      this.enemyFleet = this._initEnemy(
        0,
        packet.api_ship_ke as number[],
        packet.api_eSlot as number[][],
        eMaxHps, eNowHps,
        packet.api_ship_lv as number[],
        packet.api_eParam as number[][],
      ) ?? null;

      if (packet.api_ship_ke != null) {
        const emx = (packet.api_e_maxhps_combined ?? packet.api_maxhps_combined) as number[];
        const enw = (packet.api_e_nowhps_combined ?? packet.api_nowhps_combined) as number[];
        this.enemyEscort = this._initEnemy(
          (packet.api_ship_ke as number[]).length,
          packet.api_ship_ke_combined as number[],
          packet.api_eSlot_combined as number[][],
          emx, enw,
          packet.api_ship_lv_combined as number[],
          packet.api_eParam_combined as number[][],
        ) ?? null;
      }
    }

    this.enemyType = (path.includes('ec_') || path.includes('each_')) ? 1 : 0;

    if (isRecord(packet.api_friendly_info)) {
      const info = packet.api_friendly_info as Record<string, unknown>;
      this.friendFleet = this._initEnemy(
        0,
        info.api_ship_id as number[],
        info.api_Slot as number[][],
        info.api_maxhps as number[],
        info.api_nowhps as number[],
        info.api_ship_lv as number[],
        info.api_Param as number[][],
        ShipOwner.Friend,
      ) ?? null;
    }

    if (path === '/kcsapi/api_req_combined_battle/midnight_battle') {
      if (this.fleetType >= 1 && this.fleetType <= 3) this._isNightOnlyMVP = true;
    }
    if (AIR_RAID_PATHS.includes(path)) this._isAirRaid = true;
  }

  private _assert(path: string): void {
    const ft = this.fleetType;
    if (NORMAL_FLEET_PATHS.includes(path)  && ft !== 0)       this.fleetType = 0;
    if (CTF_TE_PATHS.includes(path)        && ft !== 1 && ft !== 3) this.fleetType = 1;
    if (STF_PATHS.includes(path)           && ft !== 2)        this.fleetType = 2;
  }

  // ── process day / night / result ────────────────────────────────────────────

  private _prcsDay(packet: Record<string, unknown>, path: string): void {
    const { fleetType, mainFleet:mf, escortFleet:ef, enemyType:et, enemyFleet:emf, enemyEscort:eef, friendFleet:ff, stages } = this;

    // Land base assault
    stages.push(simulateLandBase(emf, eef, packet.api_air_base_injection, true));
    // Jet assault
    stages.push(simulateAerial(mf, ef, emf, eef, packet.api_injection_kouku, true));
    // Land base attacks
    for (const k of (packet.api_air_base_attack as unknown[] ?? []))
      stages.push(simulateLandBase(emf, eef, k));
    // Friendly aerial
    stages.push(simulateAerial(ff, null, emf, eef, packet.api_friendly_kouku));
    // Aerial 1st
    stages.push(simulateAerial(mf, ef, emf, eef, packet.api_kouku));
    // Aerial 2nd
    stages.push(simulateAerial(mf, ef, emf, eef, packet.api_kouku2));
    // Support
    stages.push(simulateSupport(emf, eef, packet.api_support_info, packet.api_support_flag));

    // Normal fleet (fleetType 0)
    if (fleetType === 0) {
      if (et === 0) {
        stages.push(simulateShelling(mf, ef, emf, eef, packet.api_opening_taisen, StageType.Opening));
        stages.push(simulateOpeningTorpedo(mf, ef, emf, eef, packet.api_opening_atack, StageType.Opening));
        stages.push(simulateShelling(mf, ef, emf, eef, packet.api_hougeki1));
        stages.push(simulateShelling(mf, ef, emf, eef, packet.api_hougeki2));
        stages.push(simulateTorpedo(mf, ef, emf, eef, packet.api_raigeki));
      }
      if (et === 1) {
        stages.push(simulateShelling(mf, ef, emf, eef, packet.api_opening_taisen, StageType.Opening));
        stages.push(simulateOpeningTorpedo(mf, ef, emf, eef, packet.api_opening_atack, StageType.Opening));
        stages.push(simulateShelling(mf, ef, emf, eef, packet.api_hougeki1));
        stages.push(simulateTorpedo(mf, ef, emf, eef, packet.api_raigeki));
        stages.push(simulateShelling(mf, ef, emf, eef, packet.api_hougeki2));
        stages.push(simulateShelling(mf, ef, emf, eef, packet.api_hougeki3));
      }
    }

    // Surface Task Force (fleetType 2)
    if (fleetType === 2) {
      stages.push(simulateShelling(mf, ef, emf, eef, packet.api_opening_taisen, StageType.Opening));
      stages.push(simulateOpeningTorpedo(mf, ef, emf, eef, packet.api_opening_atack, StageType.Opening));
      stages.push(simulateShelling(mf, ef, emf, eef, packet.api_hougeki1, StageType.Main));
      stages.push(simulateShelling(mf, ef, emf, eef, packet.api_hougeki2, StageType.Main));
      stages.push(simulateShelling(mf, ef, emf, eef, packet.api_hougeki3, StageType.Escort));
      stages.push(simulateTorpedo(mf, ef, emf, eef, packet.api_raigeki));
    }

    // Carrier Task Force (1) / Transport Escort (3)
    if (fleetType === 1 || fleetType === 3) {
      if (et === 0) {
        stages.push(simulateShelling(mf, ef, emf, eef, packet.api_opening_taisen, StageType.Opening));
        stages.push(simulateOpeningTorpedo(mf, ef, emf, eef, packet.api_opening_atack, StageType.Opening));
        stages.push(simulateShelling(mf, ef, emf, eef, packet.api_hougeki1, StageType.Escort));
        stages.push(simulateTorpedo(mf, ef, emf, eef, packet.api_raigeki));
        stages.push(simulateShelling(mf, ef, emf, eef, packet.api_hougeki2, StageType.Main));
        stages.push(simulateShelling(mf, ef, emf, eef, packet.api_hougeki3, StageType.Main));
      }
      if (et === 1) {
        stages.push(simulateShelling(mf, ef, emf, eef, packet.api_opening_taisen, StageType.Opening));
        stages.push(simulateOpeningTorpedo(mf, ef, emf, eef, packet.api_opening_atack, StageType.Opening));
        stages.push(simulateShelling(mf, ef, emf, eef, packet.api_hougeki1, StageType.Main));
        stages.push(simulateShelling(mf, ef, emf, eef, packet.api_hougeki2, StageType.Escort));
        stages.push(simulateTorpedo(mf, ef, emf, eef, packet.api_raigeki));
        stages.push(simulateShelling(mf, ef, emf, eef, packet.api_hougeki3, StageType.Main));
      }
    }
  }

  private _prcsNight(packet: Record<string, unknown>, _path: string): void {
    const { fleetType, mainFleet:mf, escortFleet:ef, friendFleet:ff, enemyType:et, enemyFleet:emf, enemyEscort:eef, stages } = this;
    // Night-to-day support
    stages.push(simulateSupport(emf, eef, packet.api_n_support_info, packet.api_n_support_flag));
    // Night-to-day combat
    stages.push(simulateShelling(mf, ef, emf, eef, packet.api_n_hougeki1, StageType.Night));
    stages.push(simulateShelling(mf, ef, emf, eef, packet.api_n_hougeki2, StageType.Night));
    // NPC friend support
    const friendly = isRecord(packet.api_friendly_battle) ? (packet.api_friendly_battle as Record<string,unknown>).api_hougeki : undefined;
    stages.push(simulateShelling(ff, null, emf, eef, friendly, StageType.Night));
    // Night combat
    stages.push(simulateNight(fleetType, mf, ef, et, emf, eef, packet.api_hougeki, packet));
  }

  private _prcsResult(packet: Record<string, unknown>): void {
    const rankKey = (packet.api_win_rank ?? 'D') as string;
    let rank = BattleRankMap[rankKey] ?? Rank.D;

    if (rank === Rank.S) {
      const ships     = [...(this.mainFleet ?? []), ...(this.escortFleet ?? [])];
      const initHPSum = ships.reduce((x, s) => x + (s?.initHP ?? 0), 0);
      const nowHPSum  = ships.reduce((x, s) => x + (s?.nowHP  ?? 0), 0);
      if (nowHPSum >= initHPSum) rank = Rank.SS;
    }

    this._result = new SimResult({
      rank,
      mvp: [
        ((packet.api_mvp          as number ?? 0) - 1),
        ((packet.api_mvp_combined as number ?? 0) - 1),
      ],
      getShip: isRecord(packet.api_get_ship)    ? (packet.api_get_ship    as Record<string,unknown>).api_ship_id    as number : undefined,
      getItem: isRecord(packet.api_get_useitem) ? (packet.api_get_useitem as Record<string,unknown>).api_useitem_id as number : undefined,
    });
  }

  // ── result ──────────────────────────────────────────────────────────────────

  get result(): SimResult {
    if (this._result != null) return this._result;
    const rank = this._isAirRaid
      ? simulateAirRaidBattleRank(this.mainFleet, this.escortFleet)
      : simulateBattleRank(this.mainFleet, this.escortFleet, this.enemyFleet, this.enemyEscort);
    const mvp: [number, number] = this._isNightOnlyMVP
      ? [0, simulateFleetNightMVP(this.stages)]
      : [simulateFleetMVP(this.mainFleet), simulateFleetMVP(this.escortFleet)];
    return new SimResult({ rank, mvp });
  }

  getPrediction(): BattlePrediction {
    return {
      stages:      this.stages.filter((s): s is SimStage => s != null),
      mainFleet:   this.mainFleet,
      escortFleet: this.escortFleet,
      enemyFleet:  this.enemyFleet,
      enemyEscort: this.enemyEscort,
      result:      this.result,
    };
  }
}

// ─── API path sets ────────────────────────────────────────────────────────────

const DAY_BATTLE_PATHS = [
  '/kcsapi/api_req_practice/battle',
  '/kcsapi/api_req_sortie/battle',
  '/kcsapi/api_req_sortie/airbattle',
  '/kcsapi/api_req_sortie/ld_airbattle',
  '/kcsapi/api_req_sortie/ld_shooting',
  '/kcsapi/api_req_combined_battle/battle',
  '/kcsapi/api_req_combined_battle/battle_water',
  '/kcsapi/api_req_combined_battle/airbattle',
  '/kcsapi/api_req_combined_battle/ld_airbattle',
  '/kcsapi/api_req_combined_battle/ld_shooting',
  '/kcsapi/api_req_combined_battle/ec_battle',
  '/kcsapi/api_req_combined_battle/each_battle',
  '/kcsapi/api_req_combined_battle/each_battle_water',
];

const NIGHT_BATTLE_PATHS = [
  '/kcsapi/api_req_practice/midnight_battle',
  '/kcsapi/api_req_battle_midnight/battle',
  '/kcsapi/api_req_battle_midnight/sp_midnight',
  '/kcsapi/api_req_combined_battle/midnight_battle',
  '/kcsapi/api_req_combined_battle/sp_midnight',
  '/kcsapi/api_req_combined_battle/ec_midnight_battle',
  '!COMPAT/midnight_battle',
];

const RESULT_PATHS = [
  '/kcsapi/api_req_practice/battle_result',
  '/kcsapi/api_req_sortie/battleresult',
  '/kcsapi/api_req_combined_battle/battleresult',
];

const AIR_RAID_PATHS = [
  '/kcsapi/api_req_sortie/ld_airbattle',
  '/kcsapi/api_req_sortie/ld_shooting',
  '/kcsapi/api_req_combined_battle/ld_airbattle',
  '/kcsapi/api_req_combined_battle/ld_shooting',
];

const NORMAL_FLEET_PATHS = [
  '/kcsapi/api_req_practice/battle',
  '/kcsapi/api_req_sortie/battle',
  '/kcsapi/api_req_sortie/airbattle',
  '/kcsapi/api_req_sortie/ld_airbattle',
  '/kcsapi/api_req_sortie/ld_shooting',
  '/kcsapi/api_req_combined_battle/ec_battle',
  '/kcsapi/api_req_practice/midnight_battle',
  '/kcsapi/api_req_battle_midnight/battle',
  '/kcsapi/api_req_battle_midnight/sp_midnight',
];

const CTF_TE_PATHS = [
  '/kcsapi/api_req_combined_battle/battle',
  '/kcsapi/api_req_combined_battle/each_battle',
];

const STF_PATHS = [
  '/kcsapi/api_req_combined_battle/battle_water',
  '/kcsapi/api_req_combined_battle/each_battle_water',
];
