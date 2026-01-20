//@/features/router/persist/adapters/rdb/expedition.ts
import {  upsertBatch as rdbUpsert } from "../../../../../infra/storage/dao/expeditions";
import { ExpeditionRowWrite, ExpeditionsDAO } from "../../type";

export class ExpeditionRdbDAO implements ExpeditionsDAO {
  async upsertBatch(rows: ExpeditionRowWrite[]): Promise<void> {
    await rdbUpsert(rows);
  }
}

export const expeditionRdbDAO: ExpeditionsDAO = new ExpeditionRdbDAO();