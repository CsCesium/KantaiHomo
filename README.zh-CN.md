# KantaiHomo

[English](README.md) | 简体中文 | [更新日志](CHANGELOG.zh-CN.md)

KanColleObserver(KCO) 是面向《舰队 Collection》（HTML5）的 HarmonyOS 原生游戏容器与辅助应用。它使用 ArkWeb 嵌入 DMM 游戏页面，并在游戏外提供原生信息面板、本地数据持久化、提醒、计算器以及移动端输入和布局适配。

本项目为非官方项目，与 DMM、C2、KADOKAWA 无关联。

## 当前范围

- 支持 phone、tablet、2in1 设备的 HarmonyOS 应用。
- Bundle name: `io.github.cesium.kchomo`。
- 当前配置的应用版本: `1.1.1`。
- 默认游戏入口: `https://play.games.dmm.com/game/kancolle`。
- 基于 ArkTS、ArkWeb、Hvigor 和 HarmonyOS SDK 6.x 构建。

## 功能

- 启动页与 WebView 游戏宿主，支持 DMM 登录自动填充、会话保持、登出、缓存控制、自定义主页 URL 和 User Agent。
- 响应式游戏布局，支持横竖屏、游戏画面缩放、舰队状态图标、联合舰队主力/护卫切换、游击部队自动选择、底部面板和浮动面板。
- 本地游戏数据管线：通过 XHR/Fetch 注入采集游戏 API 响应，规范化领域模型，并持久化舰娘、装备、舰队、资源、任务、远征、入渠、工厂、战斗、地图、战斗记录和战斗过程段。
- 实时辅助面板，展示舰队 HP/状态、装备、资源、任务、远征检查、入渠、基地航空队、地图血条、制空范围、航空战详情、运输量、索敌、战斗预测、战斗结算、单舰战斗场景估算和对空 CI 检测。
- 战斗解析支持通常/联合舰队、开幕夜战、夜战转昼战、敌联合舰队夜战目标判断和基地空袭损伤追踪；单舰估算覆盖航母夜间航空攻击与当前损伤状态修正。
- 舰娘、装备、出击日志、装备改修配方等信息页，以及远征、装备分类和远征条件规则等静态信息与数据。
- 夜战选择、进击风险、演习/战斗结算大破、远征归还、入渠完成、开发、建造和装备改修结果提醒，支持震动、系统通知和 Toast 模式。
- 游戏图片资源本地缓存，支持实验性音频缓存、缓存统计和手动清理。
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

- 装备改修数据（`entry/src/main/resources/rawfile/data/improvement.json`）由外部舰队 Collection 改修数据生成。当前随包数据声明来源为 [akashi-list.me](https://akashi-list.me/)；更新脚本也可从 [ElectronicObserverEN/Data](https://github.com/ElectronicObserverEN/Data) 的 `EquipmentUpgrades.json` 获取数据，该数据由 ElectronicObserver 项目维护并源自日文 wiki 改修表。
- 这些数据仅用于应用内查询和计算辅助；原始数据、名称与相关权利归各自项目和权利方所有。
- 项目自维护的静态规则数据，例如装备分类和远征条件规则，位于 `entry/src/main/resources/rawfile/data/`。

## 注意事项

- 通知与提醒功能依赖 HarmonyOS 通知/提醒权限。应用会请求网络、网络状态、后台运行、提醒发布和震动权限。
- 部分设置，尤其是 WebView 注入相关开关，需要重新进入游戏页面后生效。
