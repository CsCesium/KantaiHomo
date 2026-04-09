# 内存态数据管线梳理（舰队 / 提督 / 任务 / 维修改修）

## 1. 数据入口

所有接口抓包都会以 `ApiDump` 进入 `ingestDump`：

1. `features/router/persist/ingest/webDump.ets#ingestDump`
2. 先走一次轻量 `extractAndUpdateState`（当前覆盖提督/资源/舰队/舰船）
3. 再进入 `parseDump`，由 pipeline 产出事件
4. 最后通过 `dispatchEvent` 交给各 handler，同步更新内存态 + 持久化

## 2. 四类核心数据的事件来源

### 提督 / 舰队 / 维修改修（ndock）

- 来源接口：`/api_port/port`
- 解析器：`features/parsers/module/port.ts#parsePort`
- 事件：
  - `PORT_BASIC`（提督）
  - `PORT_FLEETS`（舰队）
  - `PORT_NDOCK`（入渠）
- handler：`features/router/handlers/port.ts`

### 接取任务（quest）

- 来源接口：`/api_get_member/questlist`
- 解析器：`features/parsers/module/quest.ts#parseQuest`
- 事件：`QUEST_LIST`
- handler：`features/router/handlers/quest.ts`

## 3. 内存态落点（GameState）

统一落到 `features/state/game_state.ts` 的 `GameStateManager`：

- `updateAdmiral`：提督
- `updateDecks`：舰队（最多四队）
- `updateNDocks`：入渠
- `updateQuests`：任务列表（当前可见页）

对应结构定义在 `features/state/type.ts`：

- `GameState.decks`
- `GameState.admiral`
- `GameState.Ndocks`
- `GameState.quests`

## 4. 持久化落点（RepositoryHub）

事件 handler 在更新内存态后会写入 repo：

- 提督：`repos.admiral.upsert`
- 舰队：`repos.deck.upsertBatch`
- 入渠：`repos.repair.upsertBatch`
- 任务：`repos.quest.upsertBatch`

这保证了「内存态用于即时展示」「DB 用于重启恢复与历史分析」两条链路并存。

## 5. 当前实现边界（后续可完善）

1. `QUEST_LIST` 目前只基于 questlist 页面数据更新；如需“接取/放弃”实时性，可补充：
   - `/api_req_quest/start`
   - `/api_req_quest/stop`
2. 任务现在维护“当前可见列表”；若要全量任务统一视图，可在内存态做按 `questId` merge。
3. `extractAndUpdateState` 仍是通用兜底快照更新；核心逻辑建议继续以事件 handler 为准。
