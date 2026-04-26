/**
 * Alerts 模块入口
 *
 * 提供统一的警报事件系统：
 * - AlertBus: 事件发布/订阅
 * - AlertExecutor: 执行 Toast/震动/通知
 * - ExpeditionScheduler: 远征返回定时提醒
 */

import { initAlertExecutor } from './executor';

// ========== 类型导出 ==========

export type {
  AlertType,
  AlertMode,
  AnyAlert,
  BaseAlert,
  ExpeditionReturnAlert,
  YasenPromptAlert,
  TaihaWarningAlert,
  SortieNextAlert,
  BattleResultAlert,
  SortieAdvanceAlert,
  FleetStatusAlert,
  RepairCompleteAlert,
  AlertConfig,
  ExpeditionNext,
  ExpeditionDaoLike,
  RepairNext,
  RepairDaoLike,
  Clock,
  Cancelable,
} from './type';

export { DEFAULT_ALERT_CONFIG } from './type';

// ========== AlertBus ==========

export {
  getAlertBus,
  publishAlert,
  subscribeAlert,
  setAlertConfig,
  getAlertConfig,
} from './bus';

// ========== AlertExecutor ==========

export { initAlertExecutor } from './executor';

// ========== ExpeditionScheduler ==========

export {
  ExpeditionReturnScheduler,
  SystemClock,
  getExpeditionScheduler,
  initExpeditionScheduler,
  type ExpeditionSchedulerOptions,
} from './module/expedition';

// ========== ExpeditionLiveNotification ==========

export {
  getExpeditionLiveNotificationService,
} from './module/expeditionNotification';

export {
  cacheMissionNames,
  getMissionName,
} from './module/missionCache';

// ========== RepairScheduler ==========

export {
  RepairCompleteScheduler,
  getRepairScheduler,
  initRepairScheduler,
  type RepairSchedulerOptions,
} from './module/repair';

// ========== 统一初始化 ==========

let _initialized = false;

/**
 * 初始化 Alerts 模块
 *
 * 调用后会自动订阅 AlertBus 并执行通知动作
 */
export function initAlerts(): void {
  if (_initialized) return;
  _initialized = true;

  initAlertExecutor();
  console.info('[Alerts] module initialized');
}
