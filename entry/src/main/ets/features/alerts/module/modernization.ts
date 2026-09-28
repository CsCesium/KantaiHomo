/**
 * 近代化改修（/api_req_kaisou/powerup）Toast。
 *
 * 响应只带改修后的舰船，所以本模块必须在 ingestDumpCore 把响应写进 GameState 之前运行
 * （见 features/router/persist/ingest/webDump.ets 的调用点）：x 由「改修前后的显示值差」得出，
 * 改修期间装备不变，因此该差值就是本次强化量。
 *
 * N（剩余可增加值）按游戏自身的算法推导：
 *   火力/雷装/对空/装甲/运  上限 = 图鉴最大值 − 图鉴基础值，减去已累计的 api_kyouka
 *   耐久                    上限 2（游戏内 ShipModel.VHP），且当前 maxhp 需低于图鉴耐久上限
 *   对潜                    上限 9（游戏内 ShipModel.VAS），且该舰 api_taisen[1] 需大于 0
 */
import type { ApiShipRaw } from '../../../domain/models/api/ship';
import type { ApiPowerupResponse } from '../../../domain/models/api/response';
import type { ApiDump } from '../../../infra/web/types';
import type { ShipModernizationCaps } from '../../state';
import { getShip, getShipMasterName, getShipModernizationCaps } from '../../state';
import { parseFormBody, parseSvdata } from '../../utils/common';
import { publishAlert } from '../bus';
import type { ModernizationGain } from '../type';

export type { ModernizationGain };

export const POWERUP_ENDPOINT = '/api_req_kaisou/powerup';

/** 游戏内写死的耐久强化上限（ShipModel.VHP）。 */
const HP_MODERNIZATION_LIMIT = 2;
/** 游戏内写死的对潜强化上限（ShipModel.VAS）。 */
const ASW_MODERNIZATION_LIMIT = 9;

/** 改修前的显示值快照，字段取自 ShipState。 */
export interface ModernizationBefore {
  hpMax: number;
  fireCur: number;
  torpCur: number;
  aaCur: number;
  armorCur: number;
  luckCur: number;
  aswCur: number;
}

function pair(value: [number, number] | undefined, index: number): number {
  return value?.[index] ?? 0;
}

function atLeastZero(value: number): number {
  return value > 0 ? value : 0;
}

export function modernizationGains(
  before: ModernizationBefore,
  after: ApiShipRaw,
  caps?: ShipModernizationCaps,
): ModernizationGain[] {
  const kyouka: number[] = Array.isArray(after.api_kyouka) ? after.api_kyouka : [];
  const applied = (index: number): number => kyouka[index] ?? 0;
  const aswMax = pair(after.api_taisen, 1);

  const rows: ModernizationGain[] = [
    { key: 'firepower', label: '火力', gain: pair(after.api_karyoku, 0) - before.fireCur,
      remaining: caps ? atLeastZero(caps.firepower - applied(0)) : undefined },
    { key: 'torpedo', label: '雷装', gain: pair(after.api_raisou, 0) - before.torpCur,
      remaining: caps ? atLeastZero(caps.torpedo - applied(1)) : undefined },
    { key: 'antiAir', label: '对空', gain: pair(after.api_taiku, 0) - before.aaCur,
      remaining: caps ? atLeastZero(caps.antiAir - applied(2)) : undefined },
    { key: 'armor', label: '装甲', gain: pair(after.api_soukou, 0) - before.armorCur,
      remaining: caps ? atLeastZero(caps.armor - applied(3)) : undefined },
    { key: 'luck', label: '运', gain: pair(after.api_lucky, 0) - before.luckCur,
      remaining: caps ? atLeastZero(caps.luck - applied(4)) : undefined },
    { key: 'hp', label: '耐久', gain: (after.api_maxhp ?? 0) - before.hpMax,
      remaining: caps
        ? Math.min(atLeastZero(HP_MODERNIZATION_LIMIT - applied(5)), atLeastZero(caps.taikMax - (after.api_maxhp ?? 0)))
        : undefined },
    { key: 'asw', label: '对潜', gain: pair(after.api_taisen, 0) - before.aswCur,
      remaining: aswMax > 0 ? atLeastZero(ASW_MODERNIZATION_LIMIT - applied(6)) : 0 },
  ];

  return rows.filter((row: ModernizationGain): boolean => row.gain > 0);
}

/**
 * 摄取期钩子：必须在 extractAndUpdateState 之前调用，否则读到的已是改修后的状态。
 */
export function publishModernizationAlert(dump: ApiDump): void {
  const url = dump.url ?? '';
  if (!url.includes(POWERUP_ENDPOINT)) return;

  const root = parseSvdata<{ api_result?: number | string; api_data?: ApiPowerupResponse | null }>(dump.responseText);
  if (!root) return;
  if (root.api_result !== undefined && Number(root.api_result) !== 1) return;
  const data = root.api_data;
  if (!data || data.api_powerup_flag === undefined) return;

  const uid = parseFormBody(dump.requestBody).getInt('api_id', 0);

  if (data.api_powerup_flag !== 1) {
    publishAlert({ type: 'powerup_result', timestamp: Date.now(), success: false, shipName: '', gains: [] });
    return;
  }

  const ships: ApiShipRaw[] = Array.isArray(data.api_ship) ? data.api_ship :
    (data.api_ship ? [data.api_ship] : []);
  const after = ships.find((ship: ApiShipRaw): boolean => ship.api_id === uid);
  if (!after) return;

  const before = getShip(uid);
  if (!before) return;

  const gains = modernizationGains({
    hpMax: before.hpMax,
    fireCur: before.fireCur,
    torpCur: before.torpCur,
    aaCur: before.aaCur,
    armorCur: before.armorCur,
    luckCur: before.luckCur,
    aswCur: before.aswCur,
  }, after, getShipModernizationCaps(after.api_ship_id));

  // 成功但所有属性都没动（罕见）时不打扰用户。
  if (gains.length === 0) return;

  publishAlert({
    type: 'powerup_result',
    timestamp: Date.now(),
    success: true,
    shipName: getShipMasterName(after.api_ship_id) ?? before.name,
    gains,
  });
}
