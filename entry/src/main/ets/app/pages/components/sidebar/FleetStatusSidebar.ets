import {
  getDeckShips,
  getShipSpecialEquip,
  subscribeGameState,
  getCurrentBattle,
} from '../../../../features/state';
import {
  ShipSpecialEquip,
  ShipState,
  FleetBattleStatus,
  ShipBattleStatus,
} from '../../../../features/state/type';
import { getSortieContext } from '../../../../domain/service/sortie';
import ShipStatusBadge from './ShipStatusBadge';

/** 侧边栏每条目（舰娘状态 + 特殊装备） */
interface ShipEntry {
  ship: ShipState;
  equip: ShipSpecialEquip;
}

/**
 * 用战斗快照中的 hpAfter 覆盖 ShipState 的 HP 字段，返回新对象。
 * 只有当快照中有对应 uid 的数据时才覆盖，否则原样返回。
 */
function applyBattleHp(
  base: ShipState,
  overrides: Map<number, ShipBattleStatus>
): ShipState {
  const bss = overrides.get(base.uid);
  if (!bss) return base;
  return {
    uid:          base.uid,
    masterId:     base.masterId,
    name:         base.name,
    level:        base.level,
    hpNow:        bss.hpAfter,
    hpMax:        bss.hpMax,
    cond:         base.cond,
    fuel:         base.fuel,
    ammo:         base.ammo,
    fuelMax:      base.fuelMax,
    ammoMax:      base.ammoMax,
    needsResupply: base.needsResupply,
    slots:        base.slots,
    exSlot:       base.exSlot,
    hpPercent:    bss.hpPercent,
    isTaiha:      bss.isTaiha,
    isChuuha:     bss.isChuuha,
  };
}

/**
 * 将 FleetBattleStatus 中的 ships 数组转成 uid→ShipBattleStatus 的 Map。
 */
function buildHpOverrideMap(fleet: FleetBattleStatus | undefined): Map<number, ShipBattleStatus> {
  const m = new Map<number, ShipBattleStatus>();
  if (!fleet) return m;
  for (const s of fleet.ships) {
    m.set(s.uid, s);
  }
  return m;
}

/**
 * 舰队状态侧边栏 — 在 compact 全屏模式下展示在游戏画面右侧黑边区域。
 *
 * HP 数据来源优先级：
 *   1. 战斗结算快照（BATTLE_RESULT）中的 hpAfter — 结算后立即生效
 *   2. GameState 中的 ShipState.hpNow — 入港时写入的真实值
 * 昼/夜战预测值不在侧边栏显示，避免与实际结果产生混淆。
 *
 * 舰队选择：优先出击舰队（getSortieContext().deckId），无出击时回退第一舰队。
 * 联合舰队出击时，双击侧边栏可在第一（主力）与第二（护卫）舰队间切换。
 */
@ComponentV2
export default struct FleetStatusSidebar {
  @Param sidebarWidth: number = 72;

  @Local private entries: ShipEntry[] = [];
  /** 联合舰队出击时是否正在显示护卫舰队（第二舰队） */
  @Local private showingEscort: boolean = false;
  /** 当前是否处于联合舰队出击状态 */
  @Local private isCombined: boolean = false;

  private unsubscribe: (() => void) | null = null;

  aboutToAppear(): void {
    this.refreshEntries();
    this.unsubscribe = subscribeGameState((type) => {
      if (type === 'ships' || type === 'decks' || type === 'all' || type === 'battle') {
        this.refreshEntries();
      }
    });
  }

  aboutToDisappear(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  /** 刷新舰队条目，并用战斗快照覆盖 HP */
  private refreshEntries(): void {
    const ctx = getSortieContext();
    const combined = ctx !== null && ctx.combinedType > 0;
    this.isCombined = combined;

    // 离开联合出击时重置护卫标志
    if (!combined && this.showingEscort) {
      this.showingEscort = false;
    }

    // 联合出击护卫舰队固定为第二舰队（deckId=2）
    const deckId = combined && this.showingEscort ? 2 : (ctx ? ctx.deckId : 1);
    const ships = getDeckShips(deckId);

    // 从战斗状态取最新的 HP 覆盖数据
    const battle = getCurrentBattle();
    // 仅使用已结算的战斗结果（BATTLE_RESULT）
    const sourceFleet: FleetBattleStatus | undefined =
      battle.result?.friendMain?.deckId === deckId ? battle.result!.friendMain :
      battle.result?.friendEscort?.deckId === deckId ? battle.result!.friendEscort :
      undefined;

    const overrides = buildHpOverrideMap(sourceFleet);

    this.entries = ships.map((s: ShipState): ShipEntry => ({
      ship: applyBattleHp(s, overrides),
      equip: getShipSpecialEquip(s.uid),
    }));
  }

  build() {
    Column() {
      // 联合舰队出击时在顶部显示当前观看的舰队编号，提示可双击切换
      if (this.isCombined) {
        Text(this.showingEscort ? '二' : '一')
          .fontSize(11)
          .fontColor(this.showingEscort ? '#FFD700' : '#FFFFFF')
          .fontWeight(FontWeight.Bold)
          .textAlign(TextAlign.Center)
          .width(this.sidebarWidth)
          .height(16)
          .opacity(0.85)
      }
      if (this.entries.length > 0) {
        ForEach(
          this.entries,
          (entry: ShipEntry) => {
            ShipStatusBadge({
              ship: entry.ship,
              equip: entry.equip,
              totalWidth: this.sidebarWidth,
              totalHeight: this.sidebarWidth,
            })
              .layoutWeight(1)
          },
          (entry: ShipEntry) => `${entry.ship.uid}_${entry.ship.hpNow}_${entry.ship.hpMax}_${entry.ship.cond}`
        )
      }
    }
    .width(this.sidebarWidth)
    .height('100%')
    .backgroundColor('#000000')
    .padding({ top: 4, bottom: 4 })
    .gesture(
      TapGesture({ count: 2 })
        .onAction(() => {
          if (this.isCombined) {
            this.showingEscort = !this.showingEscort;
            this.refreshEntries();
          }
        })
    )
  }
}
