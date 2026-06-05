# KantaiHomo

[English](README.md) | 简体中文

KanColleOberserver(KCO) 是面向《舰队 Collection》（HTML5）的 HarmonyOS 原生游戏容器与辅助应用。它使用 ArkWeb
嵌入 DMM 游戏页面，并在游戏外提供原生信息面板、本地数据持久化、提醒、计算器以及移动端输入和布局适配。

本项目为非官方项目，与 DMM、C2、KADOKAWA 无关联。

## 当前范围

- 支持 phone、tablet、2in1 设备的 HarmonyOS 应用。
- Bundle name: `io.github.cesium.kchomo`。
- 当前配置的应用版本: `1.0.0`。
- 默认游戏入口: `https://play.games.dmm.com/game/kancolle`。
- 基于 ArkTS、ArkWeb、Hvigor 和 HarmonyOS SDK 6.x 构建。

## 功能

- 启动页与 WebView 游戏宿主，支持 DMM 登录自动填充、会话保持、登出、缓存控制、自定义主页 URL 和 User Agent。
- 响应式游戏布局，支持横竖屏、游戏画面缩放、舰队状态侧边栏、底部面板和浮动面板。
- 本地游戏数据管线：通过 XHR/Fetch 注入采集游戏 API 响应，规范化领域模型，并持久化舰娘、装备、舰队、资源、任务、远征、入渠、战斗、地图和战斗记录。
- 实时辅助面板，展示舰队 HP/状态、装备、资源、任务、地图血条、制空、运输量、索敌、战斗预测和战斗结算。
- 舰娘、装备、远征信息页；远征信息会在可用时展示判断条件。
- 夜战选择、进击风险、战斗结算/大破、远征归还、入渠完成提醒，支持震动和系统通知模式。
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
entry/src/main/ets/features/calc/    制空、索敌、运输量、AACI 与概率计算
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

## 注意事项

- 通知与提醒功能依赖 HarmonyOS 通知/提醒权限。应用会请求网络、网络状态、后台运行、提醒发布和震动权限。
- 部分设置，尤其是 WebView 注入相关开关，需要重新进入游戏页面后生效。
