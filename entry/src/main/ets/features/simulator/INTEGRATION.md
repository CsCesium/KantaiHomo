/**
 * features/battle/INTEGRATION.md
 * 
 * ================================================================
 * BattlePredictionService 接入指南
 * ================================================================
 *
 * ## 文件结构
 *
 * features/battle/
 *   ├── simulator/
 *   │   ├── type.ts            所有类型定义（Stage, Attack, Ship, Result…）
 *   │   ├── core.ts            BattleSimulator 核心逻辑
 *   │   └── fleet_builder.ts   GameState → FleetInput 转换
 *   ├── service/
 *   │   └── battle_prediction_service.ts   生命周期管理 + AppStorage 发布
 *   └── index.ts               公共 API 出口
 *
 * ================================================================
 * ## Step 1：在 EntryAbility 初始化 Service
 * ================================================================
 *
 * ```ts
 * // entry/src/main/ets/entryability/EntryAbility.ts
 *
 * import { initBattlePredictionService } from '../features/battle';
 * import { getDecks, getShips, getCombinedFleetType } from '../features/state';
 *
 * onCreate(want, launchParam) {
 *   // ...其他初始化...
 *
 *   initBattlePredictionService({
 *     getDecks:             () => getDecks(),
 *     getShips:             () => getShips(),
 *     getCombinedFleetType: () => getCombinedFleetType(),
 *   });
 * }
 * ```
 *
 * ================================================================
 * ## Step 2：在 webDump/Router 层喂入 battle 包
 * ================================================================
 *
 * ```ts
 * // features/router/webDump.ts（现有文件）
 *
 * import { getBattlePredictionService } from '../battle';
 *
 * export async function ingestDump(dump: ApiDump): Promise<void> {
 *   // ...现有逻辑...
 *
 *   // 新增：战斗预测
 *   if (dump.body != null) {
 *     const svc = getBattlePredictionService();
 *     svc.onBattlePacket(dump.path, dump.body as Record<string, unknown>);
 *   }
 *
 *   // 港口回港：重置模拟器
 *   if (dump.path === '/kcsapi/api_port/port') {
 *     getBattlePredictionService().reset();
 *   }
 * }
 * ```
 *
 * ================================================================
 * ## Step 3：UI 组件响应式读取预测结果
 * ================================================================
 *
 * ```ts
 * // pages/components/panel/BattlePredictionPanel.ets
 *
 * import { BATTLE_PREDICTION_KEY } from '../../features/battle';
 * import type { BattlePredictionSnapshot } from '../../features/battle';
 *
 * @Component
 * struct BattlePredictionPanel {
 *   @StorageProp(BATTLE_PREDICTION_KEY)
 *   prediction: BattlePredictionSnapshot | null = null;
 *
 *   build() {
 *     Column() {
 *       if (this.prediction != null) {
 *         // 预测战绩
 *         Text(`预测战果：${this.prediction.rank}`)
 *           .fontSize(20)
 *           .fontColor(rankColor(this.prediction.rank))
 *
 *         // 我方主力舰队 HP
 *         ForEach(this.prediction.mainFleet, (ship) => {
 *           ShipHPBar({ ship })
 *         })
 *
 *         // 敌方舰队
 *         ForEach(this.prediction.enemyFleet, (ship) => {
 *           ShipHPBar({ ship, isEnemy: true })
 *         })
 *       } else {
 *         Text('战斗外').opacity(0.4)
 *       }
 *     }
 *   }
 * }
 *
 * @Component
 * struct ShipHPBar {
 *   @Prop ship: ShipHPSnapshot;
 *   @Prop isEnemy: boolean = false;
 *
 *   build() {
 *     Row() {
 *       Text(`${this.ship.shipId}`)
 *       Progress({
 *         value: this.ship.nowHP,
 *         total: this.ship.maxHP,
 *         type:  ProgressType.Linear,
 *       })
 *       .color(this.ship.isSunk  ? '#666' :
 *              this.ship.isTaiha ? '#f44'  :
 *              this.ship.isChuha ? '#fa0'  : '#4a4')
 *       Text(`${this.ship.nowHP}/${this.ship.maxHP}`)
 *     }
 *   }
 * }
 * ```
 *
 * ================================================================
 * ## Step 4（可选）：接入 Master Data 以获得舰娘参数
 * ================================================================
 *
 * 若你的 SQLite DB 中存有舰娘/装备 master data（kcs_const 表等），
 * 可实现 MasterDataProvider 接口，在初始化时传入：
 *
 * ```ts
 * import type { MasterDataProvider } from '../features/battle';
 *
 * class DbMasterDataProvider implements MasterDataProvider {
 *   getShip(id: number) {
 *     return shipMasterDb.get(id);  // 从内存缓存或 SQLite 查询
 *   }
 *   getSlotItem(id: number) {
 *     return slotItemMasterDb.get(id);
 *   }
 * }
 *
 * initBattlePredictionService(gameState, {
 *   useMasterData:      true,
 *   masterDataProvider: new DbMasterDataProvider(),
 * });
 * ```
 *
 * ================================================================
 * ## 数据流总览
 * ================================================================
 *
 * 游戏 WebView
 *     │ XHR hook
 *     ▼
 * ApiHook.ts ──→ WebHostController.ets
 *     │ parseBridgeMessage()
 *     ▼
 * webDump.ingestDump()
 *     ├─[现有] extractAndUpdateState() → GameState
 *     ├─[现有] parseDumpToPer... → Events → Handlers
 *     └─[新增] BattlePredictionService.onBattlePacket()
 *                  │
 *                  ├─ 首包：buildFleetInputFromApiPacket(GameState)
 *                  │        └─ new BattleSimulator(fleetInput)
 *                  ├─ 后续包：simulator.simulate(packet)
 *                  └─ 每包：AppStorage.set(BATTLE_PREDICTION_KEY, snapshot)
 *                                │
 *                                ▼
 *                          @StorageProp → Panel UI 自动刷新
 */
