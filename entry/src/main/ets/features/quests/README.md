# 任务编成与计数

任务面板在已接取任务名称后显示 🆗，表示**第一舰队满足本地编成条件**，不表示海域、胜利等级、装备或任务进度已经达成。更换舰娘后即时更新。

## 数据与条件

- `rawfile/data/quest_req.json` 是用户提供的编成表。相同 ID 的多条定义取 OR，同一条定义内的要求取 AND。
- 条件支持舰种、指定舰名、舰型、国籍、位置（1 为旗舰）、最低等级，以及等于／至少／至多的数量限制。同一行的舰名、舰型、国籍取并集。
- 指定舰名通过 `api_aftershipid` 改造链匹配，支持改名后的舰娘；不使用名称子串，避免“潮”匹配“満潮”。指定舰名组按不同名称匹配，重复舰娘不能填补缺少的组员。
- 未收录任务、空舰队或舰船图鉴未就绪时不显示 🆗。原始条件表保持不变，提示准确性取决于其数据质量。
- `quest_nations.json` 覆盖当前条件表使用的美、英、法、澳、荷国籍，以当前舰型判断；舰型 ID 核对自 [ElectronicObserver ShipClass](https://github.com/ElectronicObserverEN/ElectronicObserver/blob/master/ElectronicObserver.Core/Types/ShipClass.cs)。新增舰型时需同步维护。

## 计数

参考 [poi 的事件计数](https://github.com/poooi/poi/blob/master/views/redux/middlewares/quests-cross-slice.ts)、[条件匹配](https://github.com/poooi/poi/blob/master/views/redux/info/quests/goal-matching.ts)和[进度校准](https://github.com/poooi/poi/blob/master/views/redux/info/quests/records.ts)，使用版本 `2026/09/15/02` 的 425 个任务定义。数据及 MIT 许可随应用打包，无运行时联网依赖。

- 只累计处于接取状态的任务；取消接取暂停，重新接取继续，领取奖励后清除。
- 支持出击、战斗／胜利／Boss／S 胜、指定舰种击沉、演习、成功远征、补给、入渠、开发、建造、解体、废弃、装备改修、成功近代化改修和到达指定节点。
- 地图、节点、编成、指定舰娘及改造阶段、敌舰种、远征名、装备种类／ID、改修素材条件按对应子目标过滤。
- 计数读取操作前的舰船、装备和模拟器快照；同一场战斗结算去重。昼战／夜战按最终结算记一场，演习不计入实战击沉。
- 批量开发按尝试数；解体按舰数；废弃装备按对应装备数，废弃次数任务按操作数；补给按操作数。
- 单目标任务根据游戏返回的 50%／80% 阶段校准；多目标不猜测各项目标分配。首次接入和重启后的历史可能不完整，显示 `≈`，完成状态以游戏为准。
- 面板显示各项目标累计次数之和／目标总和，点击任务查看各项明细。无目标规则的任务保留游戏原进度显示。
- 每次计数变更写入账号独立的 KV：`quests.counter.v1.<memberId>`。读写串行化，写入失败后会在下一次同步重试。
- 日常在日本时间 05:00、周常在周一 05:00、月常在每月 1 日 05:00、季常在 3／6／9／12 月 1 日 05:00 重置；年常按目标表规定月份重置。特殊任务支持子计数的独立重置周期。
- 任务列表逐页合并；只有遍历完数量一致的“全部”列表才删除缺失任务。任务接取／取消／领取会使未完成的分页快照失效。

## 更新与验证

```text
node scripts/update-quest-goals.mjs [本地 questgoal.json]
node scripts/test-quest-tracking.cjs [typescript 模块路径]
```

更新来源为 poi 的 `assets/data/fcd/questgoal.json`，脚本仅转换数据格式；变更后运行测试检查字段覆盖。构建不需要下载数据。

真机验收：打开多页任务列表；为第一舰队换旗舰／换船观察 🆗；接取日常后补给、入渠、批量废弃；取消后执行操作应不增加，重新接取后继续；重启检查计数恢复；出击后查看 Boss 与击沉子目标。
