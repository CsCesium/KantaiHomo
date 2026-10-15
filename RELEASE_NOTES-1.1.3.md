# KanColleObserver v1.1.3

对比版本：`v1.1.2` → `v1.1.3`

## 主要更新

- **立绘魔改**：按舰娘改造形态、资源类型与通常/中破状态导入 PNG/JPG/WebP，支持预览、替换和删除。默认关闭，开启并刷新游戏后生效。
- **系统日历提醒**：远征、演习、战果、EO 和泊地提醒新增日历登记，提供授权、登记状态、重要事项模式与日程时长设置。
- **明石维修/野埼给粮计时**：按账号保存计时，支持明石 20 分钟、野埼 15/30/45 分钟档位；修改勾选不重置计时，到点提示可回母港结算。
- **近代化改修提示**：Toast 展示各属性本次上升值及剩余可增加值，可单独关闭。
- **战斗与舰队显示**：结算展示主力/护卫 MVP 名称并高亮，突出大破舰名，新增港内补给图标；航空数量按 S2 攻击机结算后/前展示，敌我使用红/绿图标区分。
- **任务与能力判定**：新增任务达标数量提示，修复小目标 50%/80% 进度校准；扩展对空 CI 15/27/53 种及舰娘共享条件，更新先制对潜标签。

## 稳定性改进

- API 数据增加顺序重试、接收确认和去重，队列满时延后投递，改善恢复前台或网络后的状态同步。
- 失败响应不再清空有效状态，大响应解析支持超时回退，日历登记不再阻塞游戏数据接入。
- 修复日历查询兼容性、重复日程清理和额外提前提醒的问题。

## 升级须知

- 请在设置中点击“授权日历并登记”，并保持系统日历通知开启；声音和振动由系统日历控制。重要事项模式默认关闭，日程时长默认 30 分钟，可设置为 15 至 360 分钟。
- 演习只登记北京时间当天剩余提醒，次日需运行应用续登；月度提醒改为未来 11 个周期。已登记日程在退出应用后保留，旧代理提醒按原生命周期保留和撤销。
- 明石/野埼计时是本地估算，到点不代表服务器已结算恢复；默认提醒档位为明石 20 分钟、野埼 15/30 分钟。任务本地达标提示同样以游戏确认为准。
- 本地立绘建议与原图尺寸一致；普通缓存清理不会删除魔改图片，同路径季节立绘也会被替换。

完整记录见 [中文 ChangeLog](CHANGELOG.zh-CN.md)。数据与图标来源见 [README 致谢](README.zh-CN.md#数据来源与致谢)。

---

## English

Compared with `v1.1.2`.

### Highlights

- **Custom ship artwork:** Import PNG/JPG/WebP by ship form, resource type, and normal/damaged state; preview, replace, and delete overrides. Disabled by default; enable it and refresh the game to reload textures.
- **Calendar reminders:** Calendar-backed expedition, practice, ranking, EO, and harbor reminders, with authorization, registration status, optional important-event mode, and configurable event duration.
- **Akashi/Nozaki timers:** Per-account repair/food-supply timing with repair at 20 minutes and food supply at 15/30/45 minutes. Changing selections preserves the timer; alerts indicate when to return to port for settlement.
- **Modernization Toasts:** Show individual stat gains and remaining improvement capacity, with an independent toggle.
- **Battle and fleet display:** Main/escort MVP names and highlighting, heavily damaged ship names, and in-port resupply icons. Colored aircraft indicators show attacking aircraft after/before stage 2.
- **Quest and capability checks:** Quest completion/locally satisfied counts, corrected small-goal progress calibration, expanded AACI types 15/27/53 and shared ship rules, and updated opening-ASW tags.

### Reliability

- Ordered API retries, acknowledgements, duplicate suppression, and deferred delivery on queue saturation improve recovery after backgrounding or network interruptions.
- Failed responses preserve valid state, heavy parsing falls back after timeout, and calendar registration no longer blocks game-state ingestion.
- Fixed calendar query compatibility, stale recurring events, and unintended extra alert lead time.

### Upgrade Notes

- Authorize calendar access in Settings and keep system calendar notifications enabled. Sounds and vibration follow calendar settings. Important-event mode defaults to off; event duration defaults to 30 minutes, configurable from 15 to 360.
- Practice reminders cover only remaining occurrences on the current Beijing calendar day; run the app the next day to register new ones. Monthly reminders cover 11 future cycles. Registered events survive app exit; existing agent reminders retain their original lifecycle.
- Harbor timers are local estimates, not confirmation of server-side recovery. Default stages are 20 minutes for Akashi and 15/30 minutes for Nozaki. Quest completion also remains subject to game confirmation.
- Match custom artwork to the original dimensions. Ordinary cache clearing preserves overrides, which also replace seasonal artwork using the same path.

See the [English changelog](CHANGELOG.md) and [source acknowledgements](README.md#data-sources-and-acknowledgements).
