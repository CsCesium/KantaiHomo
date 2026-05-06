import type { SlotItemsUpdateEvent } from '../../../domain/events/slotitem';
import { SlotItem, slotItemToRow } from '../../../domain/models';
import { updateSlotItemIndex } from '../../state';
import { registerHandler } from '../persist/registry';
import type { Handler, HandlerEvent, PersistDeps } from '../persist/type';

class SlotItemPersistHandler implements Handler {
  async handle(ev: HandlerEvent, deps: PersistDeps): Promise<void> {
    if (ev.type !== 'SLOTITEMS_UPDATE') return;

    const payload = (ev as SlotItemsUpdateEvent).payload;
    this.updateState(payload);

    if (!deps.repos?.slotitem) {
      console.warn('[persist][SLOTITEMS_UPDATE] repository not provided');
      return;
    }

    const rows = payload.map(slotItemToRow);
    await deps.repos.slotitem.upsertBatch(rows);
    console.info(`[slotitem] updated ${payload.length} item(s)`);
  }

  private updateState(payload: SlotItem[]): void {
    updateSlotItemIndex(payload.map(item => ({
      uid: item.uid,
      masterId: item.masterId,
      level: item.level ?? 0,
      alv: item.alv ?? 0,
    })));
  }
}

registerHandler('SLOTITEMS_UPDATE', new SlotItemPersistHandler());
