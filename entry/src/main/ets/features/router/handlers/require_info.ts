import type { RequireInfoUpdateEvent } from '../../../domain/events/require_info';
import { admiralToRow, kdockToRow } from '../../../domain/models';
import { updateAdmiral, updateKdocks } from '../../state';
import { registerHandler } from '../persist/registry';
import type { Handler, HandlerEvent, PersistDeps } from '../persist/type';

class RequireInfoPersistHandler implements Handler {
  async handle(ev: HandlerEvent, deps: PersistDeps): Promise<void> {
    if (ev.type !== 'REQUIRE_INFO_UPDATE') return;

    const payload = (ev as RequireInfoUpdateEvent).payload;

    updateAdmiral(payload.admiral);
    updateKdocks(payload.kdocks);

    if (deps.repos?.admiral) {
      await deps.repos.admiral.upsert(admiralToRow(payload.admiral));
    } else {
      console.warn('[persist][REQUIRE_INFO_UPDATE] admiral repo missing');
    }

    if (deps.repos?.build) {
      const rows = payload.kdocks.map(kdockToRow);
      await deps.repos.build.upsertBatch(rows);
    } else {
      console.warn('[persist][REQUIRE_INFO_UPDATE] build repo missing');
    }

    console.info(`[require_info] admiral + ${payload.kdocks.length} kdock(s); useItems=${payload.useItems.length} (in-memory only)`);
  }
}

registerHandler('REQUIRE_INFO_UPDATE', new RequireInfoPersistHandler());
