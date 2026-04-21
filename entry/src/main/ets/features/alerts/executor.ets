/**
 * Alert Executor - 执行具体的通知动作
 *
 * 订阅 AlertBus，根据配置执行 Toast / 震动 / 系统通知
 *
 * 提醒触发时机：
 * 1. yasen_prompt   — 夜战选择 UI 出现（YasenDetect 注入）
 * 2. battle_result  — 收到 /battleresult API
 * 3. sortie_next    — 收到 api_req_map/next（所有节点类型，含战斗节点）
 */

import promptAction from '@ohos.promptAction';
import vibrator from '@ohos.vibrator';
import notificationManager from '@ohos.notificationManager';

import type {
  AnyAlert,
  ExpeditionReturnAlert,
  YasenPromptAlert,
  TaihaWarningAlert,
  SortieNextAlert,
  BattleResultAlert,
  RepairCompleteAlert,
} from './type';
import { getAlertBus } from '.';
import { getExpeditionLiveNotificationService } from './module/expeditionNotification';
import { getMissionName } from './module/missionCache';
import { getLaunchWantAgent } from './module/launchWantAgent';

// ========== 通知 ID 常量 ==========
const NOTIFICATION_ID_EXPEDITION_BASE = 1000;
const NOTIFICATION_ID_YASEN = 2000;
const NOTIFICATION_ID_TAIHA = 2001;
const NOTIFICATION_ID_SORTIE_NEXT = 2002;
const NOTIFICATION_ID_BATTLE_RESULT = 2003;
const NOTIFICATION_ID_REPAIR_BASE = 3000;

/** 根据 deckId / combinedType 生成舰队标签 */
function formatFleetLabel(deckId: number, combinedType: number): string {
  switch (combinedType) {
    case 1: return `第${deckId}舰队（机动联合）`;
    case 2: return `第${deckId}舰队（水上联合）`;
    case 3: return `第${deckId}舰队（输送联合）`;
    default: return `第${deckId}舰队`;
  }
}

// ========== 执行函数 ==========

async function executeToast(message: string, duration: number = 2000, textColor?: string): Promise<void> {
  try {
    if (textColor) {
      promptAction.showToast({ message, duration, textColor });
    } else {
      promptAction.showToast({ message, duration });
    }
  } catch (e) {
    console.warn('[AlertExecutor] toast failed:', e);
  }
}

async function executeVibrate(durationMs: number): Promise<void> {
  try {
    await vibrator.startVibration(
      { type: 'time', duration: durationMs },
      { id: 0, usage: 'alarm' }
    );
  } catch (e) {
    console.warn('[AlertExecutor] vibrate failed:', e);
  }
}

async function executeNotification(
  id: number,
  title: string,
  text: string,
  additionalText?: string
): Promise<void> {
  try {
    const agent = await getLaunchWantAgent();
    await notificationManager.publish({
      id,
      wantAgent: agent ?? undefined,
      tapDismissed: true,
      content: {
        notificationContentType: notificationManager.ContentType.NOTIFICATION_CONTENT_BASIC_TEXT,
        normal: { title, text, additionalText },
      },
    });
  } catch (e) {
    console.warn('[AlertExecutor] notification failed:', e);
  }
}

// ========== Alert 处理函数 ==========

async function handleExpeditionReturn(alert: ExpeditionReturnAlert): Promise<void> {
  const config = getAlertBus().getConfig();
  const deckId = alert.deckId;
  const missionName = getMissionName(alert.missionId);
  const timeStr = new Date(alert.timestamp).toLocaleTimeString();
  const body = `第 ${deckId} 舰队「${missionName}」已返回`;

  if (config.enableToast) {
    await executeToast(body);
  }

  if (config.enableVibrate) {
    await executeVibrate(config.vibrateDurationMs);
  }

  if (config.enableNotification) {
    await executeNotification(
      NOTIFICATION_ID_EXPEDITION_BASE + deckId,
      '远征归来',
      body,
      timeStr
    );
  }

  void getExpeditionLiveNotificationService().refresh();
}

async function handleYasenPrompt(alert: YasenPromptAlert): Promise<void> {
  const config = getAlertBus().getConfig();
  if (!config.enableYasenAlert) return;

  console.info(`[AlertExecutor] yasen prompt: yes=${alert.yesTex}, no=${alert.noTex}`);

  if (config.enableToast) {
    await executeToast('夜战选择');
  }

  if (config.enableVibrate) {
    await executeVibrate(config.vibrateDurationMs);
  }

  if (config.enableNotification) {
    await executeNotification(
      NOTIFICATION_ID_YASEN,
      '夜战选择出现',
      '请选择：夜战突入 / 追撃せず',
      alert.containerName || undefined
    );
  }
}

async function handleTaihaWarning(alert: TaihaWarningAlert): Promise<void> {
  const config = getAlertBus().getConfig();
  const names = alert.shipNames?.join('、') || alert.shipUids.map(u => `#${u}`).join('、');

  console.warn(`[AlertExecutor] TAIHA WARNING: ${names}`);

  if (config.enableToast) {
    await executeToast(`⚠️ 大破警告：${names}`, 3000);
  }

  if (config.enableVibrate) {
    await executeVibrate(config.vibrateDurationMs);
    setTimeout(() => {
      void executeVibrate(config.vibrateDurationMs);
    }, config.vibrateDurationMs + 100);
  }

  if (config.enableNotification) {
    await executeNotification(
      NOTIFICATION_ID_TAIHA,
      '⚠️ 大破警告',
      `${names} 已大破，请注意！`
    );
  }
}

/**
 * 进入下一节点提醒（api_req_map/next 触发，适用于所有节点类型）
 */
async function handleSortieNext(alert: SortieNextAlert): Promise<void> {
  const config = getAlertBus().getConfig();
  const fleetLabel = formatFleetLabel(alert.deckId, alert.combinedType);
  const bossStr = alert.isBoss ? '[BOSS]' : '';
  const taihaStr = alert.hasTaihaRisk ? ' - ⚠大破警告！' : '';
  const line1 = `${fleetLabel} → ${alert.cellId}${bossStr}: ${alert.eventDesc}${taihaStr}`;
  const line2 = alert.enemyFlagshipName ? `敌旗舰：[${alert.enemyFlagshipName}]` : '';
  const message = line2 ? `${line1}\n${line2}` : line1;

  console.info(`[AlertExecutor] sortie next: ${line1}`);

  if (config.enableToast) {
    const color = alert.hasTaihaRisk ? '#FF4444' : undefined;
    await executeToast(message, alert.isBoss ? 3000 : 2000, color);
  }

  if (config.enableVibrate && alert.isBoss) {
    await executeVibrate(alert.hasTaihaRisk ? 3000 : config.vibrateDurationMs * 2);
  } else if (config.enableVibrate && alert.hasTaihaRisk) {
    await executeVibrate(3000);
  }

  if (config.enableNotification) {
    await executeNotification(
      NOTIFICATION_ID_SORTIE_NEXT,
      alert.isBoss ? '到达 BOSS 点' : '进击中',
      line1,
      line2 || undefined
    );
  }
}

async function handleBattleResult(alert: BattleResultAlert): Promise<void> {
  const config = getAlertBus().getConfig();
  if (!config.enableBattleResultAlert) return;

  const bossStr = alert.isBoss ? '[BOSS]' : '';

  if (alert.hasTaihaRisk) {
    const message = `[${alert.cellId}${bossStr}]战斗结束 - ⚠大破警告！`;
    console.warn(`[AlertExecutor] battle result (taiha risk): ${message}`);

    if (config.enableToast) {
      await executeToast(message, 4000, '#FF4444');
    }

    if (config.enableVibrate) {
      await executeVibrate(3000);
    }

    if (config.enableNotification) {
      await executeNotification(
        NOTIFICATION_ID_BATTLE_RESULT,
        `⚠ 大破警告！战斗结算：${alert.rank}`,
        message
      );
    }
  } else {
    const message = `[${alert.cellId}${bossStr}]战斗结束`;
    console.info(`[AlertExecutor] battle result: ${message} rank=${alert.rank}`);

    if (config.enableToast) {
      await executeToast(message, 2000);
    }

    if (config.enableVibrate) {
      await executeVibrate(config.vibrateDurationMs);
    }

    if (config.enableNotification) {
      await executeNotification(
        NOTIFICATION_ID_BATTLE_RESULT,
        `战斗结算：${alert.rank}`,
        message
      );
    }
  }
}

async function handleRepairComplete(alert: RepairCompleteAlert): Promise<void> {
  const config = getAlertBus().getConfig();
  if (!config.enableRepairAlert) return;

  const body = `第 ${alert.dockId} 船坞修理完成`;

  if (config.enableToast) {
    await executeToast(body);
  }

  if (config.enableVibrate) {
    await executeVibrate(config.vibrateDurationMs);
  }

  if (config.enableNotification) {
    await executeNotification(
      NOTIFICATION_ID_REPAIR_BASE + alert.dockId,
      '修理完成',
      body,
      new Date(alert.timestamp).toLocaleTimeString()
    );
  }
}

// ========== 主处理函数 ==========

async function handleAlert(alert: AnyAlert): Promise<void> {
  switch (alert.type) {
    case 'expedition_return':
      await handleExpeditionReturn(alert);
      break;
    case 'yasen_prompt':
      await handleYasenPrompt(alert);
      break;
    case 'taiha_warning':
      await handleTaihaWarning(alert);
      break;
    case 'sortie_next':
      await handleSortieNext(alert);
      break;
    case 'battle_result':
      await handleBattleResult(alert);
      break;
    case 'repair_complete':
      await handleRepairComplete(alert);
      break;
  }
}

// ========== Initialize ==========

let initialized = false;

export function initAlertExecutor(): void {
  if (initialized) return;
  initialized = true;

  getAlertBus().subscribeAll(handleAlert);
  console.info('[AlertExecutor] initialized');
}
