import util from '@ohos.util';
import type { AbilityContext } from '../../infra/appContext';

const EQUIPMENT_CLASSIFICATION_RAWFILE = 'data/equipment_classification.json';
const DEPTH_CHARGE_GROUP_KEY = 'depthCharge';
const LAND_ATTACK_BOMBER_GROUP_KEY = 'landAttackBomber';
const ANTI_AIR_RESISTANCE_GROUP_PREFIX = 'antiAirResistanceType';
const ANTI_AIR_RESISTANCE_GROUP_COUNT = 5;

interface EquipmentGroupConfig {
  equipTypes?: number[];
  iconIds?: number[];
  includeMasterIds?: number[];
  excludeMasterIds?: number[];
  nameIncludesAny?: string[];
  nameExcludesAny?: string[];
}

interface EquipmentClassificationFile {
  equipmentGroups?: Record<string, EquipmentGroupConfig>;
}

let loadPromise: Promise<void> | null = null;
let depthChargeIconMasterIds: Set<number> = new Set();
let groupsByKey: Record<string, EquipmentGroupConfig> = {};

function numberSet(values: number[] | undefined): Set<number> {
  const result = new Set<number>();
  if (!Array.isArray(values)) return result;

  for (const value of values) {
    if (Number.isFinite(value) && value > 0) {
      result.add(value);
    }
  }
  return result;
}

async function loadClassification(ctx: AbilityContext): Promise<void> {
  try {
    const buf = await ctx.resourceManager.getRawFileContent(EQUIPMENT_CLASSIFICATION_RAWFILE);
    const text = new util.TextDecoder('utf-8').decode(buf);
    const config = JSON.parse(text) as EquipmentClassificationFile;
    const groups = config.equipmentGroups ?? {};
    groupsByKey = groups;

    depthChargeIconMasterIds = numberSet(groups[DEPTH_CHARGE_GROUP_KEY]?.includeMasterIds);
    console.info(`[equipmentClassification] loaded depthCharge icon ids=${depthChargeIconMasterIds.size}`);
  } catch (e) {
    depthChargeIconMasterIds = new Set();
    groupsByKey = {};
    console.warn('[equipmentClassification] load failed:', String(e));
  }
}

export function loadEquipmentClassification(ctx: AbilityContext): Promise<void> {
  if (loadPromise === null) {
    loadPromise = loadClassification(ctx);
  }
  return loadPromise;
}

export function isDepthChargeIconMasterId(masterId: number): boolean {
  return depthChargeIconMasterIds.has(masterId);
}

function textMatchesAny(text: string, patterns: string[] | undefined): boolean {
  if (!Array.isArray(patterns) || patterns.length === 0) return false;
  for (const pattern of patterns) {
    if (pattern.length > 0 && text.includes(pattern)) return true;
  }
  return false;
}

function groupMatches(
  groupKey: string,
  masterId: number,
  equipType: number,
  iconId: number,
  name: string,
): boolean {
  const group = groupsByKey[groupKey];
  if (!group || masterId <= 0) return false;

  const excluded = numberSet(group.excludeMasterIds);
  if (excluded.has(masterId)) return false;
  if (textMatchesAny(name, group.nameExcludesAny)) return false;

  const included = numberSet(group.includeMasterIds);
  if (included.has(masterId)) return true;

  const equipTypes = numberSet(group.equipTypes);
  if (equipType > 0 && equipTypes.has(equipType)) return true;

  const iconIds = numberSet(group.iconIds);
  if (iconId > 0 && iconIds.has(iconId)) return true;

  return textMatchesAny(name, group.nameIncludesAny);
}

export function isLandAttackBomber(
  masterId: number,
  equipType: number = 0,
  iconId: number = 0,
  name: string = '',
): boolean {
  return groupMatches(LAND_ATTACK_BOMBER_GROUP_KEY, masterId, equipType, iconId, name);
}

export function getAntiAirResistanceType(
  masterId: number,
  equipType: number = 0,
  iconId: number = 0,
  name: string = '',
): number {
  for (let type = 1; type <= ANTI_AIR_RESISTANCE_GROUP_COUNT; type++) {
    if (groupMatches(`${ANTI_AIR_RESISTANCE_GROUP_PREFIX}${type}`, masterId, equipType, iconId, name)) {
      return type;
    }
  }
  return 0;
}
