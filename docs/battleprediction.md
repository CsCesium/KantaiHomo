# Battle Prediction — 战斗预测开发文档

## 概览

Battle Prediction 系统在游戏 API 响应到达时实时计算战斗结果预测，包括各舰 HP 变化、损伤状态、以及预测战果等级（S/A/B/C/D/E）。整个系统横跨 domain、features、infra 三层。

---

## 数据流

```
Game WebView (XHR intercept)
        │
        ▼
  [ApiDump] — url + responseText + requestBody
        │
        ▼
parseBattle()                          features/parsers/module/battle.ts
  ├── parseMapStart()  → SortieStartEvent
  ├── parseMapNext()   → SortieNextEvent
  ├── parseDayBattle()
  │     ├── normalizeBattleSegment()   domain/models/normalizer/battle.ts
  │     └── predictBattle()            domain/service/battle_prediction.ts
  │           └── → BattleDayEvent { segment, prediction }
  ├── parseNightBattle()
  │     └── (同上) → BattleNightEvent { segment, prediction }
  └── parseBattleResultDump()
        └── normalizeBattleResult() → BattleResultEvent { result }
        │
        ▼
  Event Bus (infra/bus)
        │
        ▼
BattleHandler                          features/router/handlers/battle.ts
  ├── handleDayBattle()
  │     ├── enrichPredictionWithShipInfo()  (填充舰名/uid)
  │     └── buildBattleStatusSnapshot()    → 更新内存 UI 状态
  ├── handleNightBattle()
  │     ├── mergeBattleSegments()           (合并昼夜战段)
  │     ├── predictBattle()                 (对合并段重新预测)
  │     └── buildNightBattleStatus()
  └── handleBattleResult()
        ├── 创建 BattleRecord
        ├── checkTaihaAdvanceRisk()        → 发出大破警告
        └── battleRecordToRow()            → 持久化至 SQLite
```

---

## 关键文件

| 文件 | 层 | 职责 |
|---|---|---|
| `domain/service/battle_prediction.ts` | domain | 核心预测逻辑，`predictBattle()` |
| `domain/models/struct/battle.ts` | domain | `BattleSegment` 等结构定义 |
| `domain/models/struct/battle_record.ts` | domain | `BattlePrediction`、`ShipPrediction`、`BattleRecord` |
| `domain/models/normalizer/battle.ts` | domain | 原始 API JSON → `BattleSegment` |
| `domain/service/battle.ts` | domain | 高层战斗流程（处理 context、ammo 消耗等） |
| `domain/events/battle.ts` | domain | 事件类型定义 |
| `features/parsers/module/battle.ts` | features | URL 匹配 + 事件生成 |
| `features/router/handlers/battle.ts` | features | 事件处理 + 持久化 |
| `features/state/battle_state.ts` | features | 预测 → UI 快照转换 |
| `domain/models/mapper/battle.ts` | domain | `BattleRecord` ↔ 数据库行 |

---

## 核心类型

### `BattleSegment`
`domain/models/struct/battle.ts`

表示一次 API 返回的战斗段（昼战或夜战各为一段，合并后为完整战斗）：

```typescript
interface BattleSegment {
  meta: BattleMeta;       // 阵型、制空、deckId 等元信息
  start: BattleHpSnapshot;  // 战斗开始时的 HP 快照
  phases: BattlePhase[];    // 各战斗阶段（按 seq 排序）
  end: BattleHpSnapshot;    // 应用所有伤害后的 HP 快照
  enemy?: BattleEnemyInfo;  // 敌方 masterId / level
  createdAt: number;
}
```

`BattlePhaseKind` 枚举值（按出现顺序）：
`airBase` → `air` → `supportAir` → `supportShelling` → `openingASW` → `openingTorpedo` → `shelling1` → `shelling2` → `shelling3` → `torpedo` → `nightShelling` → `nightTorpedo`

### `BattlePrediction`
`domain/models/struct/battle_record.ts`

`predictBattle()` 的输出：

```typescript
interface BattlePrediction {
  friendMain: ShipPrediction[];
  friendEscort?: ShipPrediction[];
  enemyMain: ShipPrediction[];
  enemyEscort?: ShipPrediction[];

  predictedRank: string;        // 'S'|'A'|'B'|'C'|'D'|'E'
  friendSunkCount: number;
  friendTaihaCount: number;
  enemySunkCount: number;
  hasTaihaFriend: boolean;
  hasSunkFriend: boolean;
  calculatedAt: number;
}
```

### `ShipPrediction`

```typescript
interface ShipPrediction {
  uid: number;       // 初始为 0，由 enrichPredictionWithShipInfo() 填充
  name: string;      // 初始为 ''，由 enrichPredictionWithShipInfo() 填充
  hpBefore: number;
  hpAfter: number;   // max(0, computed)
  hpMax: number;

  damageReceived: number;   // hpBefore - hpAfter
  damageTaken: number;      // (1 - hpAfter/hpMax) * 100，百分比

  isSunk: boolean;
  isTaiha: boolean;   // hpAfter/hpMax ≤ 0.25（且未击沉）
  isChuuha: boolean;  // 0.25 < ratio ≤ 0.50
  isShouha: boolean;  // 0.50 < ratio ≤ 0.75
}
```

**注意**：`uid` 和 `name` 在 `predictBattle()` 返回时为空值，需在 handler 中调用 `enrichPredictionWithShipInfo()` 填充。

---

## 战果等级预测逻辑

`predictRank()` 内 `domain/service/battle_prediction.ts:123`

按优先级从高到低：

| 条件 | 等级 |
|---|---|
| 我方旗舰击沉 | **E** |
| 敌全灭 + 我方无沉没 | **S** |
| 敌全灭 + 我方有沉没 | **A** |
| 敌旗舰沉没 + 我方无沉没 + 敌过半沉没 | **A** |
| 敌旗舰沉没 | **B** |
| 敌过半（>50%）沉没 | **B** |
| 敌旗舰大破 | **B** |
| 敌我伤害比 ≥ 2.5 | **B** |
| 敌我伤害比 > 1.0 | **C** |
| 其余 | **D** |

伤害比计算（`calculateDamageRatio`）：`totalDamage / totalMaxHp`，分母为该侧所有舰的最大 HP 之和。最终比值为 `敌方伤害率 / 我方伤害率`。

**当前已知与实际游戏的偏差**：
- 联合舰队的护卫队沉没计入了旗舰保护逻辑，但 E 级判定只看主力旗舰
- 对 S 级的判定未区分敌方护卫队 vs 主力队全灭（游戏实际逻辑略有不同）

---

## 损伤状态阈值

`getDamageState()` in `domain/models/struct/battle_record.ts:185`

| 状态 | HP 比例 |
|---|---|
| 正常 (normal) | > 75% |
| 小破 (shouha) | 50% < ratio ≤ 75% |
| 中破 (chuuha) | 25% < ratio ≤ 50% |
| 大破 (taiha) | 0% < ratio ≤ 25% |
| 击沉 (sunk) | HP ≤ 0 |

---

## 战斗 URL 匹配模式

`features/parsers/module/battle.ts:19`

```
昼战:    /api_req_(sortie|combined_battle)/(battle|airbattle|ld_airbattle|battle_water|each_battle|each_battle_water|ec_battle)/
夜战:    /api_req_(battle_midnight|combined_battle)/(battle|sp_midnight|midnight_battle|ec_midnight_battle)/
结果:    /api_req_(sortie|combined_battle)/battleresult/
演习昼:  /api_req_practice/battle/
演习夜:  /api_req_practice/midnight_battle/
演习结:  /api_req_practice/battle_result/
```

---

## 大破进击风险检查

`checkTaihaAdvanceRisk()` in `domain/service/battle_prediction.ts:197`

- 遍历主力舰队 **index 1 起**（跳过旗舰，旗舰大破可以进击）
- 遍历护卫舰队 **全部**（index 0 起）
- 返回 `{ hasRisk, ships: [{ idx, name, hpPercent }] }`
- 护卫舰的 `idx` 偏移量为 +6（与主力队区分）

---

## UI 状态快照

`features/state/battle_state.ts`

`buildBattleStatusSnapshot()` 将 `BattlePrediction` + `SortieContext` + `BattleContext` 合并为 `BattleStatusSnapshot`，供 UI 层消费：

```typescript
interface BuildBattleStatusOptions {
  battleId?: string;         // 不传则自动生成
  sortieContext: SortieContext;
  battleContext: BattleContext;
  prediction: BattlePrediction;
  battlePhase: 'day' | 'night' | 'day_to_night';
}
```

便捷封装：
- `buildDayBattleStatus(sortieCtx, battleCtx, prediction)` — `battlePhase = 'day'`
- `buildNightBattleStatus(sortieCtx, battleCtx, prediction)` — 自动判断 `'night'` 或 `'day_to_night'`（依据 `battleContext.daySegment` 是否存在）

---

## 昼夜战合并

`mergeBattleSegments(a, b, opt?)` in `domain/models/struct/battle.ts:125`

- `start` 取自第一段（昼战）
- `end` 取自第二段（夜战计算后的最终 HP）
- `phases` 合并并重新编号 `seq`
- `meta.apiPath` 拼接为 `"day_path+night_path"`

handler 中，夜战时对**合并段**重新调用 `predictBattle()` 得到综合预测。

---

## 持久化

`BattleRecord` 通过 `battleRecordToRow()` / `rowToBattleRecord()` 序列化：
- `domain/models/mapper/battle.ts`
- `friendFleet`、`enemyFleet`、`hpStart`、`hpEnd` 等复杂字段以 JSON 字符串存储
- 演习（`isPractice = true`）不写入数据库

---

## 扩展指南

### 添加新的战斗类型 URL

1. 在 `features/parsers/module/battle.ts` 的 `PATTERNS` 对象中增加正则
2. 在 `parseBattle()` 的分发逻辑中增加对应 `if` 分支
3. 若需要新的 phase 解析，在 `domain/models/normalizer/battle.ts` 实现 `mkXxxPhase()`

### 改进等级预测精度

修改 `domain/service/battle_prediction.ts` 中的 `predictRank()`，函数已接收完整的 `ShipPrediction[]`，可以读取任意字段做更细致的判断。

### 在 UI 中消费预测数据

订阅 `BattlePredictedNotification` 事件（`domain/events/battle.ts`），payload 包含：
- `prediction: BattlePrediction`
- `hasTaiha: boolean`
- `taihaShips: { idx, name, hpPercent }[]`
- `kind: 'day' | 'night' | 'day_to_night'`
