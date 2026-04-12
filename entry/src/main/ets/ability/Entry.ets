import UIAbility from '@ohos.app.ability.UIAbility';
import AbilityConstant from '@ohos.app.ability.AbilityConstant';
import Want from '@ohos.app.ability.Want';
import window from '@ohos.window';
import notificationManager from '@ohos.notificationManager';
import { BusinessError } from '@kit.BasicServicesKit';
import { setAppContext, setMainWindow } from '../infra/appContext'
import { initPersistDeps } from '../infra/deps';
import { initHandlerRegistry } from '../features/router/persist/registry';
import { initAlerts, initExpeditionScheduler, getExpeditionScheduler, setAlertConfig } from '../features/alerts';
import { getExpeditionLiveNotificationService } from '../features/alerts/module/expeditionNotification';
import { addOnExpeditionChanged } from '../features/alerts/module/expeditionTrigger';
import { getRepositoryHub } from '../infra/storage/repo';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { webview } from '@kit.ArkWeb';
import BuildProfile from 'BuildProfile';
import { FairyService } from '../infra/fairy/service/FairyService';
import { kvGetBool, kvGetString } from '../infra/storage/kv';

const HILOG_DOM: number = 0x1357;

/** AppStorage key for fleet sidebar visibility preference */
export const APP_STORAGE_SHOW_SIDEBAR = 'ui.showSidebar';
/** AppStorage key controlling whether YasenDetect JS is injected */
export const APP_STORAGE_YASEN_DETECT_ENABLED = 'alerts.yasen.enabled';

export default class EntryAbility extends UIAbility {
  private mainWindow?: window.Window;

  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    setAppContext(this.context);

    webview.WebCookieManager.putAcceptCookieEnabled(true);
    webview.WebCookieManager.putAcceptThirdPartyCookieEnabled(true);

    // Pre-seed AppStorage with defaults so @StorageProp bindings are valid
    // before any page renders. Actual persisted values are loaded below.
    AppStorage.setOrCreate(APP_STORAGE_SHOW_SIDEBAR, true);
    void kvGetBool(APP_STORAGE_SHOW_SIDEBAR, true).then((v: boolean) => {
      AppStorage.set(APP_STORAGE_SHOW_SIDEBAR, v);
    });

    // Yasen detect: default enabled; drives inject options in WebHost.
    AppStorage.setOrCreate(APP_STORAGE_YASEN_DETECT_ENABLED, true);
    void kvGetBool(APP_STORAGE_YASEN_DETECT_ENABLED, true).then((v: boolean) => {
      AppStorage.set(APP_STORAGE_YASEN_DETECT_ENABLED, v);
    });
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    try {
      initPersistDeps();
      initHandlerRegistry();
      initAlerts();

      // 从 KV 加载提醒配置，应用到运行中的 AlertBus
      void Promise.all([
        kvGetBool('alerts.yasen.enabled', true),
        kvGetBool('alerts.battle.enabled', true),
        kvGetString('alerts.mode', 'both'),
      ]).then((results: Array<boolean | string>) => {
        const yasen = results[0] as boolean;
        const battle = results[1] as boolean;
        const mode = results[2] as string;
        setAlertConfig({
          enableYasenAlert: yasen,
          enableBattleResultAlert: battle,
          enableVibrate: mode === 'vibrate' || mode === 'both',
          enableNotification: mode === 'ring' || mode === 'both',
        });
      });

      // 启动远征归来调度器（负责在远征到时触发 Toast / 震动 / 归来通知）
      const scheduler = initExpeditionScheduler(getRepositoryHub().expedition);
      // 每当 expedition 状态写入 DB 后立即重新规划 timer，与通知权限无关
      addOnExpeditionChanged(() => { void getExpeditionScheduler()?.poke(); });
      void scheduler.start();

      hilog.info(HILOG_DOM, 'App', 'deps+registry+alerts+scheduler initialized (stageCreate)');
    } catch (e) {
      hilog.error(HILOG_DOM, 'App', 'init failed: %{public}s', String(e));
    }

    void getExpeditionLiveNotificationService().start();

    // 异步申请/确认通知权限：先用 isNotificationEnabled() 探查，
    notificationManager.isNotificationEnabled().then((enabled: boolean) => {
      hilog.info(HILOG_DOM, 'App', 'notification enabled=%{public}s', String(enabled));
      if (!enabled) {
        notificationManager.requestEnableNotification(this.context).catch((e: BusinessError) => {
          hilog.warn(HILOG_DOM, 'App', 'requestEnableNotification rejected: %{public}s', String(e));
        });
      }
    }).catch((e: BusinessError) => {
      hilog.warn(HILOG_DOM, 'App', 'isNotificationEnabled failed: %{public}s', String(e));
    });

    windowStage.loadContent('app/pages/Launcher', (err) => {
      if (err?.code) {
        console.error(`loadContent failed: ${JSON.stringify(err)}`)
      }
    });

    //void FairyService.getInstance().init(windowStage);

    try {
      this.mainWindow = windowStage.getMainWindowSync();
      setMainWindow(this.mainWindow);
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