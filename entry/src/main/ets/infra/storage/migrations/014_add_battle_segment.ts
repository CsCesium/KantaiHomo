/**
 * Migration 014: 战斗记录新增 segmentJson 列
 *
 * 持久化合并后的 BattleSegment —— 含各阶段 phase（航空/支援/开幕雷击/炮击/夜战）、
 * 每一次攻击（attacker / target / damage / critical）以及航空·陆航 meta。
 * 「出击日志」详情页据此回放每一次交战及血条变化。
 *
 * 旧记录该列为 NULL（升级前的战斗没有逐次攻击数据，详情页仅显示概要）。
 */

import type relationalStore from '@ohos.data.relationalStore';
import { Migration } from '.';

const m014: Migration = {
  version: 14,
  name: 'add_battle_segment',

  async up(db: relationalStore.RdbStore): Promise<void> {
    await db.executeSql(`ALTER TABLE battle_records ADD COLUMN segmentJson TEXT;`);
  },

  async down(db: relationalStore.RdbStore): Promise<void> {
    // SQLite 不支持简单的 DROP COLUMN；回滚时清空该列内容即可。
    await db.executeSql(`UPDATE battle_records SET segmentJson = NULL;`);
  },
};

export default m014;
