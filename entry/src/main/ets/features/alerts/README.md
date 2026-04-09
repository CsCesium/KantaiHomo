# Alerts 模块 — 远征提醒管线文档

## 目录结构

```
features/alerts/
├── README.md                       # 本文档
├── index.ets                       # 模块公共导出 + initAlerts()
├── type.ts                         # 类型定义（AlertType, AlertConfig, ExpeditionDaoLike …）
├── bus.ts                          # AlertBus — 去抖事件发布/订阅
├── executor.ets                    # AlertExecutor — Toast / 震动 / 系统通知执行
└── module/
    ├── expedition.ts               # ExpeditionReturnScheduler — 归来定时器
    ├── expeditionNotification.ets  # ExpeditionLiveNotificationService — 常驻通知栏
    ├── expeditionTrigger.ts        # 桥接层 — .ts handler → .ets 平台层解耦
    └── missionCache.ts             # 任务名称内存缓存（missionId → 名称）
```

---

## 完整管线

### 阶段 0：数据接入（`infra/web` → `features/router`）

```
游戏 WebView
  │ XHR hooked（JS 注入）
  ▼
WebBridge.post(msg)                  infra/web/bridge/
  │ BridgeMessage { type:'API_DUMP', url, requestBody, responseText }
  ▼
WebHostController.onHookPayload()    infra/web/controller/
  │ enqueuePersist(dump)
  ▼
drainPersistQueue() → ingestDump()   features/router/persist/ingest/webDump.ets
```

### 阶段 1：解析（`features/parsers`）

`ingestDump` 调用 `parseDump(dump)`，遍历已注册的 `DUMP_PIPELINES`：

| URL 匹配                   | Pipeline            | 产生事件                  |
|---------------------------|---------------------|--------------------------|
| `/api_start2`             | expeditionPipeline  | `EXPEDITION_CATALOG`     |
| `/api_port/port`          | portPipeline        | `SESSION_BIND` + `PORT_*`|
| `/api_port/port`          | expeditionPipeline  | `EXPEDITION_UPDATE`      |
| `/api_get_member/deck`    | expeditionPipeline  | `EXPEDITION_UPDATE`      |
| `/api_req_mission/start`  | expeditionPipeline  | `EXPEDITION_START`       |
| `/api_req_mission/result` | expeditionPipeline  | `EXPEDITION_RESULT`      |

> `/api_port/port` 同时命中两条 pipeline。`SESSION_BIND` 在 `preEvents`（串行先执行），
> `EXPEDITION_UPDATE` 在 `mainEvents`（并发），保证数据库切换先于写入。

**`parseDeckState`** 同时处理 `api_deck`（来自 `/api_get_member/deck`）和
`api_deck_port`（来自 `/api_port/port`），解析每个舰队的：
```
ApiDeckMissionTuple = [state, missionId, returnTimeMs, reserved]
→ ExpeditionSlotState { deckId, progress, missionId, returnTime, updatedAt }
```

### 阶段 2：持久化（`features/router/handlers/expedition.ts`）

`executeParseResult` 分发事件到对应 Handler：

```
EXPEDITION_CATALOG  → cacheMissionNames()          仅内存，不落库
EXPEDITION_START    → expeditions.upsertBatch()    progress=RUNNING, returnTime=complTime
EXPEDITION_UPDATE   → expeditions.upsertBatch()    全量更新所有舰队状态
EXPEDITION_RESULT   → expeditions.upsertBatch()    progress=IDLE, returnTime=0
                    → expedition_results.insert()   记录掉落/经验历史
```

写入完成后调用 `triggerExpeditionChanged()`。

### 阶段 3：触发层（`module/expeditionTrigger.ts`）

纯 `.ts` 桥接，解耦 domain handler 与 `.ets` 平台层：

```typescript
// .ts handler 调用：
triggerExpeditionChanged()
  → 遍历所有已注册 listeners：
      listener[0]: scheduler.poke()           // Entry.ets 启动时注册，无条件
      listener[1]: liveNotification.refresh() // liveNotification.start() 时注册，需通知权限
```

**设计要点**：调度器 poke 与通知权限无关，即使用户拒绝通知权限，timer 也会在数据更新后正确重新规划。

### 阶段 4：定时调度（`module/expedition.ts` — `ExpeditionReturnScheduler`）

```
scheduler.poke() / scheduler.start()
  │
  ▼
planNext()
  │ dao.getNextAfter(now)
  │   SELECT deckId, missionId, returnTime
  │   FROM expeditions
  │   WHERE returnTime > ?          ← 自动过滤 IDLE(0) 和已过期的 RETURNED
  │   ORDER BY returnTime ASC LIMIT 1
  │
  ├─ 无结果 → setTimeout(planNext, 60s)  轮询兜底
  │
  └─ 有结果
      ├─ 未到时 → setTimeout(fire, returnTime - now)
      └─ 已过期
          ├─ ≤ 60s → 立即 fire (+ minDelay 500ms)
          └─ > 60s → 跳过，setTimeout(planNext, 60s)

fire(deckId, missionId, when)
  → publishAlert({ type:'expedition_return', deckId, missionId, timestamp })
  → planNext()   自动规划下一条
```

**容错**：
- DAO 报错 → 5 秒后重试
- 过期超过 60 秒的记录跳过（避免应用后台唤醒时刷屏）

### 阶段 5：告警执行（`bus.ts` + `executor.ets`）

```
AlertBus.publish(alert)
  │ 去抖检查（同签名 1200ms 内不重复）
  │ 签名规则：exp:{deckId}:{missionId}
  ▼
AlertExecutor.handleAlert()
  │
  └─ handleExpeditionReturn(alert)
      ├─ executeToast(`第 N 舰队「任务名」已返回`)
      ├─ executeVibrate(150ms)
      ├─ executeNotification(id=1000+deckId, title='远征归来', body=同上, sub=时间)
      └─ liveNotification.refresh()    从通知栏移除已归来舰队
```

### 阶段 6：常驻通知栏（`module/expeditionNotification.ets`）

每次 `refresh()` 时：

```
hub.expedition.list() → 过滤 progress=RUNNING && returnTime>0
hub.deck.list()       → 获取舰队名称

→ 按 returnTime 升序排列
→ notificationManager.publish({
    id: 100,
    isOngoing: true,
    contentType: MULTILINE,
    title: '舰队远征倒计时',
    text:  'N 支舰队远征中',
    longTitle: '最快返回: H:MM:SS',
    lines: [
      '第1舰队: 〇〇远征  1:23:45',
      '第2舰队: 〇〇远征  3:00:00',
      ...
    ]
  })

无活跃远征 → cancel(100)
```

`refresh()` 的触发时机：
- `start()` 调用时（立即一次）
- `setInterval(60s)`（每分钟更新倒计时）
- `triggerExpeditionChanged()`（任何远征状态写入 DB 后）
- `handleExpeditionReturn()`（归来通知触发后）

---

## 初始化顺序（`Entry.ets`）

```
onWindowStageCreate()
  1. initPersistDeps()                          建立 DB 连接 + RepositoryHub
  2. initHandlerRegistry()                      触发所有 handler 模块副作用注册
  3. initAlerts()                               订阅 AlertBus → AlertExecutor
  4. initExpeditionScheduler(expedition repo)   创建调度器单例
  5. addOnExpeditionChanged(scheduler.poke)     注册 poke 监听（无条件）
  6. scheduler.start()                          首次 planNext()

  7. requestEnableNotification()
     ├─ 授权 → liveNotification.start()
     │           ├─ addOnExpeditionChanged(refresh)  注册刷新监听
     │           ├─ refresh() 立即同步一次
     │           └─ setInterval(refresh, 60s)
     └─ 拒绝 → scheduler 与 Toast/震动 继续正常工作

onWindowStageDestroy()
  - scheduler.stop()
  - liveNotification.stop() → clearInterval + cancel(100)
```

---

## 任务名称缓存（`missionCache.ts`）

- 来源：`/api_start2` 响应中的 `api_mst_mission` 数组
- 时机：游戏初次加载（`EXPEDITION_CATALOG` 事件）
- 用途：Live Notification 每行显示任务名；归来通知 Toast / 系统通知正文

缓存为内存 Map，应用重启后由下一次 `/api_start2` 重新填充。在缓存填充前显示 `任务 {id}`。

---

## 关键常量

| 常量 | 值 | 位置 |
|------|----|------|
| `LIVE_NOTIFICATION_ID` | `100` | `expeditionNotification.ets` |
| `NOTIFICATION_ID_EXPEDITION_BASE` | `1000` | `executor.ets` |
| `minDelayMs` | `500ms` | `expedition.ts` scheduler |
| `maxSnoozeMs` | `60000ms` | `expedition.ts` scheduler |
| `pollIntervalMs` | `60000ms` | `expedition.ts` scheduler |
| `REFRESH_INTERVAL_MS` | `60000ms` | `expeditionNotification.ets` |
| `debounceMs` | `1200ms` | `type.ts` DEFAULT_ALERT_CONFIG |
