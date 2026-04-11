/**
 * Alert Bus - 统一的警报事件总线
 *
 * 功能：
 * - 事件发布/订阅
 * - 内置去抖（同类型事件在 debounceMs 内不重复触发）
 * - 支持多订阅者
 */

import type { AnyAlert, AlertType, AlertConfig } from './type';
import { DEFAULT_ALERT_CONFIG } from './type';

type AlertHandler<T extends AnyAlert = AnyAlert> = (alert: T) => void | Promise<void>;

interface Subscription {
  type: AlertType | '*';  // '*' 订阅所有
  handler: AlertHandler;
}

class AlertBusImpl {
  private subscriptions: Subscription[] = [];
  private lastAlertMap: Map<string, number> = new Map();  // 去抖: signature → timestamp
  private config: AlertConfig = { ...DEFAULT_ALERT_CONFIG };

  /**
   * 更新配置
   */
  setConfig(partial: Partial<AlertConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  getConfig(): AlertConfig {
    return { ...this.config };
  }

  /**
   * 订阅特定类型的警报
   */
  subscribe<T extends AnyAlert>(type: T['type'], handler: AlertHandler<T>): () => void {
    const sub: Subscription = { type, handler: handler as AlertHandler };
    this.subscriptions.push(sub);
    return () => {
      const idx = this.subscriptions.indexOf(sub);
      if (idx >= 0) this.subscriptions.splice(idx, 1);
    };
  }

  /**
   * 订阅所有警报
   */
  subscribeAll(handler: AlertHandler): () => void {
    const sub: Subscription = { type: '*', handler };
    this.subscriptions.push(sub);
    return () => {
      const idx = this.subscriptions.indexOf(sub);
      if (idx >= 0) this.subscriptions.splice(idx, 1);
    };
  }

  /**
   * 发布警报
   */
  publish(alert: AnyAlert): void {
    const sig = this.getSignature(alert);
    const now = Date.now();
    const lastTime = this.lastAlertMap.get(sig) ?? 0;

    // 去抖
    if (now - lastTime < this.config.debounceMs) {
      console.debug(`[AlertBus] debounced: ${alert.type}`);
      return;
    }
    this.lastAlertMap.set(sig, now);

    console.info(`[AlertBus] publish: ${alert.type}`);

    // 触发订阅者
    for (const sub of this.subscriptions) {
      if (sub.type === '*' || sub.type === alert.type) {
        try {
          const result = sub.handler(alert);
          if (result instanceof Promise) {
            result.catch(e => console.error(`[AlertBus] handler error:`, e));
          }
        } catch (e) {
          console.error(`[AlertBus] handler error:`, e);
        }
      }
    }
  }

  /**
   * 清除订阅和去抖缓存
   */
  clear(): void {
    this.subscriptions = [];
    this.lastAlertMap.clear();
  }

  /**
   * 生成去抖签名
   */
  private getSignature(alert: AnyAlert): string {
    switch (alert.type) {
      case 'expedition_return':
        return `exp:${alert.deckId}:${alert.missionId}`;
      case 'yasen_prompt':
        return `yasen:${alert.yesTex}:${alert.noTex}`;
      case 'taiha_warning':
        return `taiha:${alert.shipUids.slice().sort((a, b) => a - b).join(',')}`;
      case 'sortie_next':
        return `sortie:${alert.mapAreaId}-${alert.mapInfoNo}:${alert.cellId}`;
      case 'battle_start':
        return `bstart:${alert.cellId}`;
      case 'battle_result':
        return `bresult:${alert.cellId}`;
      default:
        return `unknown`;
    }
  }
}

// 单例
const alertBus = new AlertBusImpl();

export function getAlertBus(): AlertBusImpl {
  return alertBus;
}

// 便捷方法
export function publishAlert(alert: AnyAlert): void {
  alertBus.publish(alert);
}

export function subscribeAlert<T extends AnyAlert>(
  type: T['type'],
  handler: AlertHandler<T>
): () => void {
  return alertBus.subscribe(type, handler);
}

export function setAlertConfig(config: Partial<AlertConfig>): void {
  alertBus.setConfig(config);
}

export function getAlertConfig(): AlertConfig {
  return alertBus.getConfig();
}
