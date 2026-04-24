/**
 * features/battle/simulator/fleet_builder.ts
 *
 * 将 GameState 中的舰娘数据转换为 BattleSimulator 所需的 FleetInput 格式。
 *
 * 依赖项（按项目现有接口）：
 *   - getDecks()     → DeckSnapshot[]
 *   - getShips()     → Map<number, ShipState>  （或类似接口）
 */

import { FleetInput, RawFleetShip } from './type';

// ─── 项目内 GameState 类型（与项目现有定义对齐，按需调整路径）──────────────────

// 这里使用鸭子类型，避免与项目其他模块产生循环依赖
export interface ShipStateLike {
  uid:          number;
  api_ship_id:  number;
  api_maxhp:    number;
  api_nowhp:    number;
  /** 装备槽 slot item IDs，[4]（-1 表示空） */
  api_slot?:    number[];
  /** 补强增设 */
  api_slot_ex?: number;
  /** 近代化改修 */
  api_kyouka?:  number[];
  /** 现在火力 [current, max] */
  api_karyoku?:  [number, number];
  api_raisou?:   [number, number];
  api_taiku?:    [number, number];
  api_soukou?:   [number, number];
}

export interface DeckSnapshotLike {
  id:      number;
  /** 舰船 UID 列表（最多 6 艘，空槽为 -1） */
  shipIds: number[];
  /** 舰队类型：0=通常 1=机动 2=水上打击 3=输送 */
  type?:   number;
}

// ─── 构建函数 ──────────────────────────────────────────────────────────────────

/**
 * 将单个 DeckSnapshot 的舰娘列表转换为 RawFleetShip 数组。
 * 空槽（uid === -1 或查不到）会填 null。
 */
function buildRawFleet(
  shipIds: number[],
  ships:   Map<number, ShipStateLike>,
): (RawFleetShip | null)[] {
  return shipIds.map(uid => {
    if (uid <= 0) return null;
    const s = ships.get(uid);
    if (s == null) return null;
    return {
      api_ship_id:  s.api_ship_id,
      api_maxhp:    s.api_maxhp,
      api_nowhp:    s.api_nowhp,
      api_slot:     s.api_slot    ?? [],
      api_slot_ex:  s.api_slot_ex,
      api_kyouka:   s.api_kyouka,
      api_karyoku:  s.api_karyoku,
      api_raisou:   s.api_raisou,
      api_taiku:    s.api_taiku,
      api_soukou:   s.api_soukou,
    } satisfies RawFleetShip;
  });
}

/**
 * 通常出击（单一舰队）时，构建 FleetInput。
 *
 * @param deckId  出击舰队编号（1-based）
 * @param decks   所有舰队快照
 * @param ships   舰娘状态 Map (uid → state)
 */
export function buildNormalFleetInput(
  deckId: number,
  decks:  DeckSnapshotLike[],
  ships:  Map<number, ShipStateLike>,
): FleetInput | null {
  const deck = decks.find(d => d.id === deckId);
  if (deck == null) return null;
  return {
    type: 0,
    main: buildRawFleet(deck.shipIds, ships),
  };
}

/**
 * 联合舰队出击时，构建 FleetInput。
 *
 * @param mainDeckId    主力舰队编号（通常为 1）
 * @param escortDeckId  护卫舰队编号（通常为 2）
 * @param fleetType     联合舰队类型（1=机动 2=水上打击 3=输送）
 * @param decks         所有舰队快照
 * @param ships         舰娘状态 Map
 */
export function buildCombinedFleetInput(
  mainDeckId:   number,
  escortDeckId: number,
  fleetType:    number,
  decks:        DeckSnapshotLike[],
  ships:        Map<number, ShipStateLike>,
): FleetInput | null {
  const main   = decks.find(d => d.id === mainDeckId);
  const escort = decks.find(d => d.id === escortDeckId);
  if (main == null || escort == null) return null;
  return {
    type:   fleetType,
    main:   buildRawFleet(main.shipIds,   ships),
    escort: buildRawFleet(escort.shipIds, ships),
  };
}

/**
 * 根据战斗 API 路径自动判断是否联合舰队，并构建 FleetInput。
 *
 * 简化版：外部传入 deckId（来自 api_deck_id）和 combinedType（来自 GameState.combinedFleetType）。
 * 联合舰队：combinedType > 0，主力舰队 = deckId，护卫舰队固定为 2。
 */
export function buildFleetInputFromApiPacket(opts: {
  deckId:           number;
  combinedFleetType: number;   // 0=通常, 1=机动, 2=水上, 3=输送
  decks:            DeckSnapshotLike[];
  ships:            Map<number, ShipStateLike>;
}): FleetInput | null {
  const { deckId, combinedFleetType, decks, ships } = opts;

  if (combinedFleetType > 0) {
    return buildCombinedFleetInput(deckId, 2, combinedFleetType, decks, ships);
  }
  return buildNormalFleetInput(deckId, decks, ships);
}
