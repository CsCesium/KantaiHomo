/**
 * 工厂事件处理：开发 / 建造领取 / 改修结果 → Toast 提示。
 *
 * 仅负责把事件转换为 Alert 发布到 AlertBus（名称从 start2 图鉴缓存解析），
 * 装备/舰娘库存本身由后续的 port / slot_item 全量刷新维护。
 */
import type {
  CreateShipStartEvent,
  DevItemEntry,
  DevItemResultEvent,
  GetShipResultEvent,
  KdockEntry,
  KdockUpdateEvent,
  RemodelSlotResultEvent,
} from '../../../domain/events/kousyou';
import { publishAlert } from '../../alerts/bus';
import { getShipMasterName, getSlotItemMasterName } from '../../state';
import { registerHandler } from '../persist/registry';
import { Handler, HandlerEvent, PersistDeps } from '../persist/type';

const DEV_FAIL_LABEL = '失败';

/** createship 之后等待 kdock 数据补全舰娘名的最长时间 */
const PENDING_BUILD_TTL_MS = 60_000;

interface PendingBuild {
  kdockId: number;
  isLarge: boolean;
  startedAt: number;
}

function slotItemName(masterId: number): string {
  if (masterId <= 0) return '';
  const name = getSlotItemMasterName(masterId);
  return name !== '' ? name : `装备#${masterId}`;
}

class KousyouHandler implements Handler {
  /**
   * createship 响应不含舰娘信息；记录待定建造渠，等紧随其后的
   * /api_get_member/kdock 响应带回 api_created_ship_id 后再发提示。
   */
  private pendingBuild: PendingBuild | null = null;

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
      case 'KOUSYOU_CREATESHIP_START':
        this.handleCreateShipStart(ev as CreateShipStartEvent);
        break;
      case 'KOUSYOU_KDOCK_UPDATE':
        this.handleKdockUpdate(ev as KdockUpdateEvent);
        break;
    }
  }

  private handleCreateShipStart(ev: CreateShipStartEvent): void {
    this.pendingBuild = {
      kdockId: ev.payload.kdockId,
      isLarge: ev.payload.isLarge,
      startedAt: ev.timestamp,
    };
  }

  private handleKdockUpdate(ev: KdockUpdateEvent): void {
    const pending = this.pendingBuild;
    if (!pending) return;
    if (ev.timestamp - pending.startedAt > PENDING_BUILD_TTL_MS) {
      this.pendingBuild = null;
      return;
    }

    const dock = ev.payload.docks.find((d: KdockEntry): boolean =>
      d.dockId === pending.kdockId && d.shipMasterId > 0);
    if (!dock) return;

    this.pendingBuild = null;
    publishAlert({
      type: 'build_start',
      timestamp: ev.timestamp,
      shipName: getShipMasterName(dock.shipMasterId) ?? `舰娘#${dock.shipMasterId}`,
      kdockId: dock.dockId,
      isLarge: pending.isLarge,
    });
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
registerHandler('KOUSYOU_CREATESHIP_START', handler);
registerHandler('KOUSYOU_KDOCK_UPDATE', handler);
