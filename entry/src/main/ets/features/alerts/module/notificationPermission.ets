import common from '@ohos.app.ability.common';
import notificationManager from '@ohos.notificationManager';
import { getAppContext } from '../../../infra/appContext';

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!await notificationManager.isNotificationEnabled()) {
    await notificationManager.requestEnableNotification(getAppContext() as common.UIAbilityContext);
  }
  return notificationManager.isNotificationEnabled();
}
