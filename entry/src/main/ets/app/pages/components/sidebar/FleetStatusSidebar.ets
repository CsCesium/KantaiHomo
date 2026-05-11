import {
  getDeckShips,
  getShipSpecialEquip,
  subscribeGameState,
  getCurrentBattle,
} from '../../../../features/state';
import {
  ShipSpecialEquip,
  ShipState,
} from '../../../../features/state/type';
import {
  applyBattleHp,
  buildHpOverrideMap,
  pickSourceFleet,
} from '../../../../features/state/battleHpOverride';
import { getSortieContext } from '../../../../domain/service/sortie';
import ShipStatusBadge from './ShipStatusBadge';

/** 侧边栏每条目（舰娘状态 + 特殊装备） */
interface ShipEntry {
  ship: ShipState;
  equip: ShipSpecialEquip;
}

function shipEntryKey(entry: ShipEntry): string {
  const ship = entry.ship;
  const equip = entry.equip;
  return [
    ship.uid,
    ship.masterId,
    ship.hpNow,
    ship.hpMax,
    ship.cond,
    ship.fuel,
    ship.ammo,
    ship.needsResupply ? 1 : 0,
    equip.hasDamageControl ? 1 : 0,
    equip.hasGoddess ? 1 : 0,
  ].join('_');
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

    // 从战斗状态取最新的 HP 覆盖数据（仅使用已结算的 BATTLE_RESULT）
    const overrides = buildHpOverrideMap(pickSourceFleet(deckId, getCurrentBattle()));

    this.entries = ships.map((s: ShipState): ShipEntry => ({
      ship: applyBattleHp(s, overrides),
      equip: getShipSpecialEquip(s.uid),
    }));
  }

  build() {
    Column() {
      if (this.isCombined) {
        Text(this.showingEscort ? '伴随艦隊' : '主力部隊')
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
          (entry: ShipEntry) => shipEntryKey(entry)
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
