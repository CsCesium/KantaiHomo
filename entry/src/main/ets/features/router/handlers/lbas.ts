/**
 * LBAS Handler - 基地航空队处理器
 *
 * 订阅 LBAS_UPDATE 事件，将基地状态合并到 GameStateManager。
 * 使用装备实例索引将 slotId → masterId，以便 UI 和出击快照使用。
 */

import type { LbasUpdateEvent } from '../../../domain/events/lbas';
import type { LbasBase, LbasSquadron } from '../../../domain/models/struct/lbas';
import { updateLbas, getSlotItemMasterId } from '../../state/game_state';
import { registerHandler } from '../persist/registry';
import type { Handler, HandlerEvent, PersistDeps } from '../persist/type';

/**
 * 将 LbasSquadron.slotId 解析为 masterId。
 * slotId=0（未配置槽位）保持 masterId=0，跳过查询。
 */
function enrichSquadron(sq: LbasSquadron): LbasSquadron & { masterId: number } {
  const masterId = sq.slotId > 0 ? (getSlotItemMasterId(sq.slotId) ?? 0) : 0;
  return { ...sq, masterId };
}

class LbasHandler implements Handler {
  async handle(ev: HandlerEvent, _deps: PersistDeps): Promise<void> {
    if (ev.type !== 'LBAS_UPDATE') return;

    const bases = (ev as LbasUpdateEvent).payload;

    // 将 slotId 解析为 masterId（从 GameState 的装备实例索引中查询）
    const enriched: LbasBase[] = bases.map(base => ({
      ...base,
      squadrons: base.squadrons.map(enrichSquadron),
    }));

    updateLbas(enriched);
    console.info(`[lbas] updated ${enriched.length} base(s)`);
  }
}

const handler = new LbasHandler();
registerHandler('LBAS_UPDATE', handler);
