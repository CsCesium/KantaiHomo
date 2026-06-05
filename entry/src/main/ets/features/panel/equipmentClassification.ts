import util from '@ohos.util';
import type { AbilityContext } from '../../infra/appContext';

const EQUIPMENT_CLASSIFICATION_RAWFILE = 'data/equipment_classification.json';
const DEPTH_CHARGE_GROUP_KEY = 'depthCharge';

interface EquipmentGroupConfig {
  includeMasterIds?: number[];
}

interface EquipmentClassificationFile {
  equipmentGroups?: Record<string, EquipmentGroupConfig>;
}

let loadPromise: Promise<void> | null = null;
let depthChargeIconMasterIds: Set<number> = new Set();

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

    depthChargeIconMasterIds = numberSet(groups[DEPTH_CHARGE_GROUP_KEY]?.includeMasterIds);
    console.info(`[equipmentClassification] loaded depthCharge icon ids=${depthChargeIconMasterIds.size}`);
  } catch (e) {
    depthChargeIconMasterIds = new Set();
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
