import notificationManager from '@ohos.notificationManager';
import vibrator from '@ohos.vibrator';
import promptAction from '@ohos.promptAction';
import type { Notifier } from './type';

export class SystemNotifier implements Notifier {
  async notifyExpeditionReturn(deckId: number, missionId: number, when: number): Promise<void> {
    await notificationManager.publish({
      id: 1000 + deckId,
      content: {
        notificationContentType: notificationManager.ContentType.NOTIFICATION_CONTENT_BASIC_TEXT,
        normal: {
          title: '远征归来',
          text: `第 ${deckId} 舰队远征 ${missionId} 已返回`,
          additionalText: new Date(when).toLocaleString(),
        },
      },
    });
  }

  async notifyYasenPrompt(yesId: string, noId: string, containerName: string, when: number): Promise<void> {
    // 通知
    await notificationManager.publish({
      id: 2000,
      content: {
        notificationContentType: notificationManager.ContentType.NOTIFICATION_CONTENT_BASIC_TEXT,
        normal: {
          title: '夜战选择出现',
          text: '请选择：夜战突入 / 追撃せず',
          additionalText: (containerName !== '' ? containerName + ' ' : '') + `(${yesId} / ${noId})`,
        },
      },
    });

    // TODO：震动（可通过 KV 开关控制）
    try {
      await vibrator.startVibration(
        { type: 'time', duration: 150 },
        { id: 0, usage: 'alarm' }
      );
    } catch {
      // 忽略震动错误
    }

    // TODO：可通过 KV 开关控制
    try {
      promptAction.showToast({ message: '夜战选择出现：夜战突入 / 追撃せず' });
    } catch {
      // 部分场景下可能失败
    }
  }
}