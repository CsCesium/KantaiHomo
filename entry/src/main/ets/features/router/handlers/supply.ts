import type { SupplyChargeEvent } from '../../../domain/events/supply';
import { getMaterials, updateMaterials, patchShipsSupply } from '../../state';
import { materialsToRow } from '../../../domain/models';
import { registerHandler } from '../persist/registry';
import { Handler, HandlerEvent, PersistDeps } from '../persist/type';
import { patchSupplyBatch } from '../../../infra/storage/dao/ship';

class SupplyPersistHandler implements Handler {
  async handle(ev: HandlerEvent, deps: PersistDeps): Promise<void> {
    const e = ev as SupplyChargeEvent;
    const { ships, fuel, ammo, steel, bauxite, updatedAt } = e.payload;

    // 1. 更新 GameState：舰船补给字段（仅 fuel/ammo/onslot）
    patchShipsSupply(ships);

    // 2. 更新 GameState：基础资源（保留道具资源字段不变）
    const current = getMaterials();
    const merged = {
      fuel,
      ammo,
      steel,
      bauxite,
      instantBuild: current?.instantBuild ?? 0,
      instantRepair: current?.instantRepair ?? 0,
      devMaterial: current?.devMaterial ?? 0,
      screw: current?.screw ?? 0,
      updatedAt,
    };
    updateMaterials(merged);

    // 3. 持久化舰船补给字段到 DB
    if (ships.length > 0) {
      try {
        await patchSupplyBatch(ships.map(s => ({
          uid: s.uid,
          fuel: s.fuel,
          bull: s.ammo,
          onslotJson: JSON.stringify(s.onslot),
          updatedAt,
        })));
      } catch (e2) {
        console.warn('[supply] ship patch failed:', String(e2));
      }
    }

    // 4. 持久化资源到 DB
    if (deps.repos?.material) {
      try {
        await deps.repos.material.appendIfChanged(materialsToRow(merged));
      } catch (e3) {
        console.warn('[supply] material persist failed:', String(e3));
      }
    }
  }
}

const handler = new SupplyPersistHandler();
registerHandler('SUPPLY_CHARGE', handler);
