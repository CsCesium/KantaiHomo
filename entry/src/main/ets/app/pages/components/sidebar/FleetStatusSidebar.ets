import {
  getDeckShips,
  getShipSpecialEquip,
  subscribeGameState,
} from '../../../../features/state';
import { ShipSpecialEquip, ShipState } from '../../../../features/state/type';
import { getSortieContext } from '../../../../domain/service/sortie';
import ShipStatusBadge from './ShipStatusBadge';

/** 侧边栏每条目（舰娘状态 + 特殊装备） */
interface ShipEntry {
  ship: ShipState;
  equip: ShipSpecialEquip;
}

/**
 * 舰队状态侧边栏 — 在 compact 模式下展示在游戏画面右侧黑边区域。
 *
 * 逻辑：
 * - 优先显示当前出击舰队（getSortieContext().deckId）
 * - 无出击时回退为第一舰队（deckId=1）
 * - 订阅 GameState 变化，实时刷新
 *
 * @param sidebarWidth  侧边栏宽度（vp），由父组件（WebHost）传入
 */
@ComponentV2
export default struct FleetStatusSidebar {
  @Param sidebarWidth: number = 48;

  @Local private entries: ShipEntry[] = [];

  private unsubscribe: (() => void) | null = null;

  aboutToAppear(): void {
    this.refreshEntries();
    this.unsubscribe = subscribeGameState((type) => {
      if (type === 'ships' || type === 'decks' || type === 'all') {
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

  /** 刷新舰队条目列表 */
  private refreshEntries(): void {
    const ctx = getSortieContext();
    const deckId = ctx ? ctx.deckId : 1;
    const ships = getDeckShips(deckId);

    this.entries = ships.map((s: ShipState): ShipEntry => ({
      ship: s,
      equip: getShipSpecialEquip(s.uid),
    }));
  }

  build() {
    Column() {
      if (this.entries.length > 0) {
        ForEach(
          this.entries,
          (entry: ShipEntry) => {
            ShipStatusBadge({
              ship: entry.ship,
              equip: entry.equip,
              // 每个徽章按侧边栏宽度确定正方形尺寸，由 layoutWeight(1) 均分高度
              totalWidth: this.sidebarWidth,
              totalHeight: this.sidebarWidth,
            })
              .layoutWeight(1)
          },
          (entry: ShipEntry) => entry.ship.uid.toString()
        )
      }
    }
    .width(this.sidebarWidth)
    .height('100%')
    .backgroundColor('#000000')
    .padding({ top: 4, bottom: 4 })
  }
}
