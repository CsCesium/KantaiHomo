import UIAbility from '@ohos.app.ability.UIAbility';
import AbilityConstant from '@ohos.app.ability.AbilityConstant';
import Want from '@ohos.app.ability.Want';
import window from '@ohos.window';
import notificationManager from '@ohos.notificationManager';
import { BusinessError } from '@kit.BasicServicesKit';
import { setAppContext } from '../infra/appContext'
import { initPersistDeps } from '../infra/deps';
import { initHandlerRegistry } from '../features/router/persist/registry';
import { initAlerts, initExpeditionScheduler, getExpeditionScheduler } from '../features/alerts';
import { getExpeditionLiveNotificationService } from '../features/alerts/module/expeditionNotification';
import { getRepositoryHub } from '../infra/storage/repo';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { webview } from '@kit.ArkWeb';
import BuildProfile from 'BuildProfile';
import { FairyService } from '../infra/fairy/service/FairyService';
const HILOG_DOM: number = 0x1357;

export default class EntryAbility extends UIAbility {
  private mainWindow?: window.Window;

  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    setAppContext(this.context);

    webview.WebCookieManager.putAcceptCookieEnabled(true);
    webview.WebCookieManager.putAcceptThirdPartyCookieEnabled(true);

  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    try {
      initPersistDeps();
      initHandlerRegistry();
      initAlerts();

      // 启动远征归来调度器（负责在远征到时触发 Toast / 震动 / 归来通知）
      const scheduler = initExpeditionScheduler(getRepositoryHub().expedition);
      void scheduler.start();

      hilog.info(HILOG_DOM, 'App', 'deps+registry+alerts+scheduler initialized (stageCreate)');
    } catch (e) {
      hilog.error(HILOG_DOM, 'App', 'init failed: %{public}s', String(e));
    }

    // 请求通知权限（用户首次弹窗，之后静默）
    notificationManager.requestEnableNotification(this.context).then(() => {
      hilog.info(HILOG_DOM, 'App', 'notification enabled');
      void getExpeditionLiveNotificationService().start();
    }).catch((e: BusinessError) => {
      hilog.warn(HILOG_DOM, 'App', 'notification not enabled: %{public}s', String(e));
      // 即使用户拒绝通知，常驻通知不可用，但 Toast/震动 仍然正常工作
    });
    windowStage.loadContent('app/pages/WebRoot', (err) => {
      if (err?.code) {
        console.error(`loadContent failed: ${JSON.stringify(err)}`)
      }
    });

    void FairyService.getInstance().init(windowStage);

    try {
      this.mainWindow = windowStage.getMainWindowSync();
      this.mainWindow.enableLandscapeMultiWindow().catch((error: BusinessError): void => {
        hilog.error(HILOG_DOM, 'App', 'enableLandscapeMultiWindow failed: %{public}s', JSON.stringify(error));
      });
    } catch (error) {
      hilog.error(HILOG_DOM, 'App', 'getMainWindowSync failed: %{public}s', String(error));
    }

    if (BuildProfile.DEBUG) {
      import('@hadss/debug-db').then(async (ns: ESObject) => {
        await ns.DebugDB.initialize(this.context, { port: 8080, defaultStart: true });
      });
      }
  }

  onWindowStageDestroy(): void {
    getExpeditionScheduler()?.stop();
    getExpeditionLiveNotificationService().stop();
    this.mainWindow?.disableLandscapeMultiWindow().catch((error: BusinessError): void => {
      hilog.error(HILOG_DOM, 'App', 'disableLandscapeMultiWindow failed: %{public}s', JSON.stringify(error));
    });
    void FairyService.getInstance().destroy();
  }

  onDestroy(): void | Promise<void> {
  }
}