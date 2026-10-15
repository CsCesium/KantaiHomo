# KantaiHomo

[English](README.md) | 简体中文 | [更新日志](CHANGELOG.zh-CN.md)

KanColleObserver(KCO) 是面向《舰队 Collection》（HTML5）的 HarmonyOS 原生游戏容器与辅助应用。它使用 ArkWeb 嵌入 DMM 游戏页面，并在游戏外提供原生信息面板、本地数据持久化、提醒、计算器以及移动端输入和布局适配。

本项目为非官方项目，与 DMM、C2、KADOKAWA 无关联。

## 当前范围

- 支持 phone、tablet、2in1 设备的 HarmonyOS 应用。
- Bundle name: `io.github.cesium.kchomo`。
- 当前配置的应用版本: `1.1.3`。
- 默认游戏入口: `https://play.games.dmm.com/game/kancolle`。
- 基于 ArkTS、ArkWeb、Hvigor 和 HarmonyOS SDK 6.x 构建。

## 功能

- 启动页与 WebView 游戏宿主，支持 DMM 登录自动填充、会话保持、登出、缓存控制、自定义主页 URL 和 User Agent。
- 响应式游戏布局，支持横竖屏、游戏画面缩放、舰队状态图标、联合舰队主力/护卫切换、游击部队自动选择、底部面板和浮动面板。
- 完全展开的三折叠设备及满足尺寸条件的全屏横屏平板支持三屏模式：游戏区与信息区按 2:1 分配，支持左右互换、独立游戏缩放、单列战斗预览，以及可切换远征、任务、入渠的看板。
- 本地游戏数据管线：通过 XHR/Fetch 注入采集游戏 API 响应，规范化领域模型，并持久化舰娘、装备、舰队、资源、任务、远征、入渠、工厂、战斗、地图、战斗记录和战斗过程段。
- 实时辅助面板，展示舰队 HP/状态、装备、资源、任务、远征检查、入渠、基地航空队、地图血条、制空范围、航空战详情、运输量、索敌、战斗预测、战斗结算、单舰战斗场景估算和对空 CI 检测。
- 战斗解析支持通常/联合舰队、开幕夜战、夜战转昼战、敌联合舰队夜战目标判断和基地空袭损伤追踪；单舰估算覆盖航母夜间航空攻击与当前损伤状态修正。
- 战斗结算显示主力/护卫舰队 MVP 名称，并突出 MVP 与大破舰；航空图标按敌我配色，展示 S2 攻击机结算后/前数量。
- 舰娘、装备、出击日志、装备改修配方等信息页，以及远征、装备分类和远征条件规则等静态信息与数据。
- 第一舰队任务编成检查与子目标进度追踪，随包提供 425 个任务目标定义；计数按账号保存并按任务周期重置，取消接取暂停计数，重新接取后继续。
- 夜战选择、进击风险、演习/战斗结算大破、远征归还、入渠完成、开发、建造和装备改修结果提醒，支持震动、系统通知和 Toast 模式。
- 远征归来、演习刷新、月度战果周期结算和月底 EO 勋章提醒使用系统日历登记，提供状态、重试、重要事项模式与日程时长设置；三个时间点提醒开关默认关闭。
- 明石维修与野埼给粮计时，支持维修 20 分钟、给粮 15/30/45 分钟档位，按账号保存计时并在常驻通知中展示，到点提示可回母港结算。
- 近代化改修结果 Toast 展示各属性本次上升值及剩余可增加值，提供独立开关。
- 应用静音偏好持久化，重启后恢复。
- 游戏图片资源本地缓存，支持实验性音频缓存、缓存统计和手动清理。
- [立绘魔改](entry/src/main/ets/features/shipMods/README.md)：按舰娘改造形态、资源类型与通常/中破状态导入本地 PNG/JPG/WebP 图片，支持预览、替换和删除；默认关闭，在设置中开启并刷新游戏后加载替换立绘。
- 可选 WebView 注入：触摸悬停、双指滚轮、FPS 显示、ticker RAF、Pixi 渲染兼容补丁。

## 项目结构

```text
entry/src/main/ets/app/pages/        UI 页面与游戏信息面板
entry/src/main/ets/infra/web/        ArkWeb 宿主、桥接与注入模块
entry/src/main/ets/features/router/  API 事件路由与持久化处理
entry/src/main/ets/features/parsers/ 游戏 API 解析管线
entry/src/main/ets/domain/           领域模型、事件与服务
entry/src/main/ets/infra/storage/    KV、数据库、迁移与 DAO
entry/src/main/ets/features/alerts/  提醒与通知系统
entry/src/main/ets/features/calc/    制空、索敌、运输量、AACI、伤害与概率计算
entry/src/main/ets/features/expedition/ 远征条件检查
entry/src/main/ets/features/quests/  任务编成检查与进度追踪
entry/src/main/ets/features/shipMods/ 本地立绘管理与资源替换
entry/src/main/resources/rawfile/    静态数据、舰娘头像与图标资源
```

## 构建

前置条件：

- DevEco Studio 与 HarmonyOS SDK 6.x。
- 可通过 DevEco Studio 或 PATH 使用 `ohpm` 和 `hvigor`。
- 用于真机安装的本地签名配置。

```powershell
cd app
ohpm install
hvigor build --mode debug
```

构建 release：

```powershell
hvigor build --mode release
```

可以使用 `build-profile.example.json5` 作为模板，也可以让 DevEco Studio 生成本机签名配置。机器相关的签名路径与密码应保存在本地构建配置中。

## 测试

```powershell
hvigor test --type unit
hvigor test --type ohos
```

## 数据来源与致谢

- 任务目标数据（`entry/src/main/resources/rawfile/data/quest_goals.json`）转换自 [poi](https://github.com/poooi/poi) 的 `assets/data/fcd/questgoal.json`，随包快照版本为 `2026/09/15/02`，包含 425 个任务定义。事件计数、目标匹配和进度校准亦参考 poi 实现。感谢 poi 贡献者；数据的 MIT 版权及许可声明随包保存在 [quest_goals.LICENSE.txt](entry/src/main/resources/rawfile/data/quest_goals.LICENSE.txt)。
- 任务国籍映射（`quest_nations.json`）的舰型 ID 核对自 [ElectronicObserver 的 ShipClass 定义](https://github.com/ElectronicObserverEN/ElectronicObserver/blob/master/ElectronicObserver.Core/Types/ShipClass.cs)；编成条件（`quest_req.json`）为用户提供的规则表。覆盖范围、更新方式与限制见[任务追踪说明](entry/src/main/ets/features/quests/README.md)，随包规则无需运行时下载。
- 装备改修数据（`entry/src/main/resources/rawfile/data/improvement.json`）由外部舰队 Collection 改修数据生成。当前随包数据声明来源为 [akashi-list.me](https://akashi-list.me/)；更新脚本也可从 [ElectronicObserverEN/Data](https://github.com/ElectronicObserverEN/Data) 的 `EquipmentUpgrades.json` 获取数据，该数据由 ElectronicObserver 项目维护并源自日文 wiki 改修表。
- 战斗面板飞机图标采用 Microsoft Windows 8.0 的 Airplane 图稿，图片来源为 EmojiAll，随包附有[来源声明](entry/src/main/resources/rawfile/icons/airplane_windows8.NOTICE.txt)。图稿归属 Microsoft，此处不将其声明为开源数据。
- 这些数据仅用于应用内查询和计算辅助；原始数据、名称与相关权利归各自项目和权利方所有。
- 项目自维护的静态规则数据，例如装备分类和远征条件规则，位于 `entry/src/main/resources/rawfile/data/`。

## 注意事项

- 通知与提醒功能依赖 HarmonyOS 通知/提醒权限。应用会请求网络、网络状态、后台运行、提醒发布和震动权限。
- 新建后台提醒需日历读写权限，请在设置中“授权日历并登记”，日程写入本应用专属日历。声音、振动与通知送达受系统日历设置控制；重要事项模式默认关闭，日程时长默认 30 分钟，可设为 15 至 360 分钟。
- `dist/` 可存放未签名 HAP 与 `SHA256SUMS.txt`，安装前需根据设备要求完成签名。在 `app` 目录运行 `bash dist/generate-checksum.sh` 可为 `dist` 顶层唯一的 HAP 生成校验文件；存在多个 HAP 时需传入文件名。
- 任务编成提示仅检查第一舰队编成，不代表海域、装备或完成条件均已达成。历史操作或其他设备上的进度不完整时以 `≈` 标记估算值，任务完成以游戏确认为准。
- 已登记日历日程在退出应用后保留；旧代理提醒按原生命周期保留和撤销。演习只登记北京时间当天剩余时点，次日需运行应用续登；月度提醒按未来 11 个周期滚动登记。修改设备时区后应重新打开应用校准。
- 泊地计时从观察到的编成估算，不修改本地 HP/士气，也不代表服务器已完成恢复。默认提醒档位为明石 20 分钟、野埼 15/30 分钟，修改勾选不重置本轮计时。
- 自定义立绘保存在本机，普通资源缓存清理不会删除；建议使用与原立绘相同尺寸的图片，同路径的季节立绘也会被替换。
- 部分设置，尤其是 WebView 注入相关开关，需要重新进入游戏页面后生效。
