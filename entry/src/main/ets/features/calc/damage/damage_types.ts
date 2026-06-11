/**
 * Battle Scenario Damage Estimation Types
 *
 * Types shared by the attack power / attack type scenario calculators that
 * back the ship battle-scenario panel (双击舰名弹出的战斗能力估计面板).
 */

// ==================== Attack Type Identifiers ====================

/**
 * Day shelling attack types (砲撃戦).
 *
 * Artillery spotting cut-ins (弾着観測射撃) require an embarked seaplane
 * recon/bomber and air superiority or better. Carrier cut-ins (戦爆連合)
 * require embarked bomber combinations. Jet carrier cut-ins require jet fighter
 * / jet bomber combinations and are rolled separately from ordinary FBA.
 */
export enum DayAttackType {
  /** 通常砲撃 */
  Normal = 'day_normal',
  /** 連撃 (主砲×2) */
  DoubleAttack = 'day_double',
  /** 主主CI (主砲×2 + 徹甲弾) */
  MainMainCI = 'day_main_main_ci',
  /** 主徹CI (主砲 + 副砲 + 徹甲弾) */
  MainApCI = 'day_main_ap_ci',
  /** 主電CI (主砲 + 副砲 + 電探) */
  MainRadarCI = 'day_main_radar_ci',
  /** 主副CI (主砲 + 副砲) */
  MainSecCI = 'day_main_sec_ci',
  /** 戦爆攻CI (艦戦 + 艦爆 + 艦攻) */
  CarrierFBA = 'day_cvci_fba',
  /** 爆爆攻CI (艦爆×2 + 艦攻) */
  CarrierBBA = 'day_cvci_bba',
  /** 爆攻CI (艦爆 + 艦攻) */
  CarrierBA = 'day_cvci_ba',
  /** 噴式戦爆爆CI (噴戦 + 噴爆×2) */
  CarrierJetFBB = 'day_cvci_jet_fbb',
  /** 噴式戦爆CI (噴戦 + 噴爆) */
  CarrierJetFB = 'day_cvci_jet_fb',
  /** 噴式戦爆攻CI (噴戦 + 艦爆 + 艦攻) */
  CarrierJetFBA = 'day_cvci_jet_fba',
}

// ==================== Input ====================

/** Air control state assumed when estimating day cut-in rates. */
export type ScenarioAirState = 'supremacy' | 'superiority';

/** One equipped slot item with the master stats needed by the formulas. */
export interface ScenarioEquip {
  /** SlotItem master id (api_slotitem_id) */
  masterId: number;
  /** SlotItem master name (api_name), used for special equipment detection */
  name: string;
  /** SlotItemEquipType (api_type[2]) */
  equipType: number;
  /** Icon id (api_type[3]); used for night plane detection */
  iconType: number;
  /** 火力 (api_houg) */
  firepower: number;
  /** 雷装 (api_raig) */
  torpedo: number;
  /** 爆装 (api_baku) */
  bomb: number;
  /** 対潜 (api_tais) */
  asw: number;
  /** 索敵 (api_saku) */
  los: number;
  /** 改修度 (api_level, ★0..10) */
  level: number;
  /** Carried aircraft count for this slot (0 = not embarked) */
  onslot: number;
}

/** Input describing one ship and its fleet context. */
export interface ShipScenarioInput {
  /** Ship type (api_stype) */
  stype: number;
  level: number;
  /** Displayed luck (运, incl. modernization) */
  luck: number;
  /** Displayed firepower (api_karyoku[0], incl. equipment) */
  firepower: number;
  /** Displayed torpedo (api_raisou[0], incl. equipment) */
  torpedo: number;
  /** Displayed ASW (api_taisen[0], incl. equipment) */
  asw: number;
  isFlagship: boolean;
  hpNow: number;
  hpMax: number;
  equips: ScenarioEquip[];
  /**
   * Fleet LoS term used by the day artillery-spotting rate formula:
   * Σ(recon plane LoS × 2) + Σ(radar LoS) + Σ⌊√(ship intrinsic LoS)⌋
   */
  fleetLoSTerm: number;
  /** Assumed air state for day cut-in rates */
  airState: ScenarioAirState;
  /** Fleet has a searchlight equipped (night CI bonus) */
  fleetSearchlight: boolean;
  /** Fleet has a star shell equipped (night CI bonus) */
  fleetStarShell: boolean;
}

// ==================== Output ====================

/** One possible attack with its estimated trigger rate and damage. */
export interface ScenarioAttack {
  /** Stable identifier (DayAttackType / NightCutInType value or 'normal') */
  id: string;
  /** Display label, e.g. '主主CI', '連撃', '普通攻击' */
  label: string;
  /** Number of hits per attack */
  hits: number;
  /** Estimated trigger probability 0..1 (already chained against higher-priority types) */
  rate: number;
  /** Post-cap, post-modifier attack power per hit (平击) */
  normal: number;
  /** Critical attack power per hit (爆击, ×1.5) */
  critical: number;
  /** Post-cap power modifier of this attack type */
  modifier: number;
}

/** Attack scenarios for the phases shown in the panel (no 支援). */
export interface ShipBattleScenarios {
  /** 昼战 (砲撃戦); empty = ship cannot shell in day battle */
  day: ScenarioAttack[];
  /** 雷击 (雷撃戦); empty = ship cannot join the torpedo phase */
  torpedo: ScenarioAttack[];
  /** 对潜 (対潜攻撃); empty = ship cannot attack submarines */
  asw: ScenarioAttack[];
  /** 夜战; empty = ship cannot attack at night */
  night: ScenarioAttack[];
}
