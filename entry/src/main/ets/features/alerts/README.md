# Alerts 模块 

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
      ├─ 系统提醒未登记成功时：executeVibrate / executeNotification(id=1000+deckId)
      └─ liveNotification.refresh()    更新远征时间表
```

### 阶段 6：远征时间表（`module/expeditionNotification.ets`）

普通通知的文字不会自行倒计时，应用后台冻结后 ArkTS 定时器也不能保证运行。
通知统一显示本地绝对归来日期和时刻（`MM-DD HH:mm:ss`），以免静态剩余时间误导用户。
普通通知的 `isCountDown` / `isStopwatch` 在官方文档中为预留能力，不能用于可靠的后台刷新。

每次 `refresh()` 时：

```
hub.expedition.list() → 过滤 progress=RUNNING && returnTime>0
hub.deck.list()       → 获取舰队名称

→ 按 returnTime 升序排列
→ notificationManager.publish({
    id: 100,
    isOngoing: true,
    contentType: MULTILINE,
    title: '舰队远征时间表',
    text:  'N 支舰队远征中',
    longTitle: '预计归来: 舰队「任务」 MM-DD HH:mm:ss',
    lines: [
      '第2舰队: 〇〇远征  预计 09-16 00:01:00 归来',
      '第3舰队: 〇〇远征  预计 09-16 02:00:00 归来',
      ...
    ]
  })

无活跃远征 → cancel(100)
```

`refresh()` 的触发时机：
- `start()` 调用时（立即一次）
- `setTimeout(30s)` 串行循环（应用可运行时重新检查状态；内容相同不重复发布）
- `triggerExpeditionChanged()`（任何远征状态写入 DB 后）
- `handleExpeditionReturn()`（归来通知触发后）
- 回到前台、通知授权完成、设置页“检查并重试”时强制刷新

所有刷新和停止时的取消串行执行，防止旧查询覆盖新状态、退出后未完成的发布重新留下通知。

### 阶段 7：系统后台提醒（`module/expeditionReminder.ets`）

- 使用 `ReminderRequestCalendar` 按归来时间登记一次性代理提醒，精确到秒（向上取整）。
- 系统接管已登记任务，应用冻结或退出后仍可提醒。此 API 的“日历类型”指提醒时间类型，不会向系统日历应用写入日程。
- 通知权限未开启时不发布；授权完成立即同步，应用运行时每 30 秒重试失败任务。
- 每支舰队使用 `1000 + deckId` 作为通知 ID，以舰队、任务、归来时间组成 groupId，重启通过系统有效提醒列表恢复。
- 重复、改期、已领取结果的旧提醒会撤销；未来的旧倒计时提醒会迁移。仅因到达归来时刻不会撤销提醒，也不会补建已经过期的提醒。
- `stop()` 只停止应用内监听和重试，保留系统任务。设置页关闭“远征后台提醒”才会撤销全部本模块登记的任务。
- 已成功登记的远征由系统发送通知，前台仅补 Toast；未登记成功时保留原有前台通知/震动兜底。
- 设置 → 日常提醒提供后台提醒开关、登记状态和重试按钮。系统提醒的声音/震动由系统设置控制。

平台说明：[代理提醒](https://github.com/openharmony/docs/blob/master/zh-cn/application-dev/task-management/agent-powered-reminder.md)、[普通通知属性](https://github.com/openharmony/docs/blob/master/zh-cn/application-dev/reference/apis-notification-kit/js-apis-inner-notification-notificationRequest.md)。

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

  7. reminderService.start() / liveNotification.start()
     注册状态变更监听和 30 秒重试；发布前检查通知权限
  8. ensureNotificationPermission()
     ├─ 授权完成 → reminderService.syncFromDb() + liveNotification.refresh(true)
     └─ 拒绝 → scheduler 与 Toast/震动继续工作，设置页显示未开启通知

onWindowStageDestroy()
  - scheduler.stop()
  - liveNotification.stop() → clearTimeout + cancel(100)
  - reminderService.stop() → 停止本地重试，保留系统提醒
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
| `REFRESH_INTERVAL_MS` | `30000ms` | `expeditionNotification.ets` |
| `RETRY_INTERVAL_MS` | `30000ms` | `expeditionReminder.ets` |
| `debounceMs` | `1200ms` | `type.ts` DEFAULT_ALERT_CONFIG |

## 回归验证

`node scripts/test-expedition-alerts.cjs [typescript 模块路径]` 使用真实服务代码与内存平台适配器，覆盖授权后登记、跨午夜时间、到点保留、改期撤销、开关、失败重试、旧提醒迁移、重启去重、通知刷新竞争、前台去重和兜底。

真机验收：允许通知后发起远征，在设置页确认“已登记”，退出应用并锁屏，检查到点通知及点击跳转；再验证改期和关闭开关后的撤销。此测试需要实际设备，单元测试不能证明系统后台投递行为。
