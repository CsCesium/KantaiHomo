/**
 * 工厂事件处理：开发 / 建造领取 / 改修结果 → Toast 提示。
 *
 * 仅负责把事件转换为 Alert 发布到 AlertBus（名称从 start2 图鉴缓存解析），
 * 装备/舰娘库存本身由后续的 port / slot_item 全量刷新维护。
 */
import type {
  DevItemEntry,
  DevItemResultEvent,
  GetShipResultEvent,
  RemodelSlotResultEvent,
} from '../../../domain/events/kousyou';
import { publishAlert } from '../../alerts/bus';
import { getShipMasterName, getSlotItemMasterName } from '../../state';
import { registerHandler } from '../persist/registry';
import { Handler, HandlerEvent, PersistDeps } from '../persist/type';

const DEV_FAIL_LABEL = '失败';

function slotItemName(masterId: number): string {
  if (masterId <= 0) return '';
  const name = getSlotItemMasterName(masterId);
  return name !== '' ? name : `装备#${masterId}`;
}

class KousyouHandler implements Handler {
  async handle(ev: HandlerEvent, _deps: PersistDeps): Promise<void> {
    switch (ev.type) {
      case 'KOUSYOU_DEV_RESULT':
        this.handleDevResult(ev as DevItemResultEvent);
        break;
      case 'KOUSYOU_GETSHIP_RESULT':
        this.handleGetShipResult(ev as GetShipResultEvent);
        break;
      case 'KOUSYOU_REMODEL_RESULT':
        this.handleRemodelResult(ev as RemodelSlotResultEvent);
        break;
    }
  }

  private handleDevResult(ev: DevItemResultEvent): void {
    const items = ev.payload.items;
    if (items.length === 0) return;

    const itemNames = items.map((item: DevItemEntry): string =>
      item.success ? slotItemName(item.masterId) : DEV_FAIL_LABEL);
    publishAlert({
      type: 'dev_result',
      timestamp: ev.timestamp,
      itemNames,
      failCount: items.filter((item: DevItemEntry): boolean => !item.success).length,
    });
  }

  private handleGetShipResult(ev: GetShipResultEvent): void {
    const masterId = ev.payload.shipMasterId;
    publishAlert({
      type: 'build_result',
      timestamp: ev.timestamp,
      shipName: getShipMasterName(masterId) ?? `舰娘#${masterId}`,
      kdockId: ev.payload.kdockId,
    });
  }

  private handleRemodelResult(ev: RemodelSlotResultEvent): void {
    // 成功时按改修后的图鉴显示（更新改修会变更装备），失败时按改修前显示
    const masterId = ev.payload.success ? ev.payload.afterMasterId : ev.payload.beforeMasterId;
    publishAlert({
      type: 'remodel_result',
      timestamp: ev.timestamp,
      success: ev.payload.success,
      itemName: slotItemName(masterId),
      level: ev.payload.afterLevel,
    });
  }
}

const handler = new KousyouHandler();
registerHandler('KOUSYOU_DEV_RESULT', handler);
registerHandler('KOUSYOU_GETSHIP_RESULT', handler);
registerHandler('KOUSYOU_REMODEL_RESULT', handler);
