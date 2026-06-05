import UIAbility from '@ohos.app.ability.UIAbility';
import AbilityConstant from '@ohos.app.ability.AbilityConstant';
import Want from '@ohos.app.ability.Want';
import window from '@ohos.window';
import notificationManager from '@ohos.notificationManager';
import { BusinessError } from '@kit.BasicServicesKit';
import { setAppContext, setMainWindow } from '../infra/appContext'
import { initPersistDeps } from '../infra/deps';
import { initHandlerRegistry } from '../features/router/persist/registry';
import { initAlerts, initExpeditionScheduler, getExpeditionScheduler, setAlertConfig,
  initRepairScheduler, getRepairScheduler } from '../features/alerts';
import { getExpeditionLiveNotificationService } from '../features/alerts/module/expeditionNotification';
import { getExpeditionReminderService } from '../features/alerts/module/expeditionReminder';
import { addOnExpeditionChanged } from '../features/alerts/module/expeditionTrigger';
import { addOnNdockChanged } from '../features/alerts/module/ndockTrigger';
import { getRepositoryHub } from '../infra/storage/repo';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { webview } from '@kit.ArkWeb';
import BuildProfile from 'BuildProfile';
import { FairyService } from '../infra/fairy/service/FairyService';
import { kvGetBool, kvGetNumber, kvGetString } from '../infra/storage/kv';
import { loadSenkaFromKV } from '../features/state/senkaInit';
import { APP_STORAGE_RESOURCE_CACHE_AUDIO, APP_STORAGE_RESOURCE_CACHE_ENABLED, initResourceCache } from '../features/resourceCache';
import { updateShipGraphFilenames } from '../features/state';
import { ShipGraphRow } from '../infra/storage/types';
import { shipGraphFilename } from '../features/state/type';
import { initBattlePredictionService, gameStateAdapter } from '../features/simulator';
import { initAppVolumeMuteStorage } from '../infra/audio/appVolume';
import { GAME_SIZE_DEFAULT_PERCENT, normalizeGameSizePercent } from '../infra/web/layout/gameSize';
import {
  TOUCH_WHEEL_SENSITIVITY_DEFAULT_PERCENT,
  normalizeTouchWheelSensitivityPercent
} from '../infra/web/input/touchWheelSensitivity';
import { loadEquipmentClassification } from '../features/panel/equipmentClassification';

const HILOG_DOM: number = 0x1357;

/** AppStorage key for fleet sidebar visibility preference */
export const APP_STORAGE_SHOW_SIDEBAR = 'ui.showSidebar';
/** AppStorage key for fleet sidebar ship avatar visibility preference */
export const APP_STORAGE_SIDEBAR_SHOW_AVATAR = 'ui.sidebar.showAvatar';
/** AppStorage key controlling automatic FloatOverlay opening for battle preview on narrow landscape screens */
export const APP_STORAGE_FLOAT_OVERLAY_AUTO_BATTLE_PREVIEW = 'ui.floatOverlay.autoBattlePreview';
/** AppStorage key controlling whether YasenDetect JS is injected */
export const APP_STORAGE_YASEN_DETECT_ENABLED = 'alerts.yasen.enabled';
/** AppStorage key controlling whether AdvanceDetect (进击大破警告) is enabled */
export const APP_STORAGE_ADVANCE_GUARD_ENABLED = 'alerts.advanceGuard.enabled';
/** AppStorage key controlling whether repair completion alerts are enabled */
export const APP_STORAGE_REPAIR_ALERT_ENABLED = 'alerts.repair.enabled';
/** AppStorage keys for optional WebView injection feature flags */
export const APP_STORAGE_INJECT_FPS = 'inject.fps';
export const APP_STORAGE_INJECT_TOUCH_PATCH = 'inject.touchPatch';
export const APP_STORAGE_INJECT_TOUCH_HOVER = 'inject.touchHover';
export const APP_STORAGE_INJECT_TOUCH_WHEEL = 'inject.touchWheel';
export const APP_STORAGE_INJECT_TOUCH_WHEEL_SENSITIVITY = 'inject.touchWheel.sensitivityPercent';
export const APP_STORAGE_INJECT_TICKER_RAF = 'inject.tickerRaf';
export const APP_STORAGE_INJECT_PIXI_PATCH = 'inject.pixiPatch';
/** AppStorage keys for equipment label badge overlays in the main panel */
export const APP_STORAGE_PANEL_SHOW_KAISYUU = 'panel.equip.showKaisyuu';
export const APP_STORAGE_PANEL_SHOW_PROFICIENCY = 'panel.equip.showProficiency';
/** AppStorage keys for mode-specific game viewport size percent */
export const APP_STORAGE_GAME_SIZE_COMPACT = 'ui.gameSize.compact';
export const APP_STORAGE_GAME_SIZE_EXPANDED = 'ui.gameSize.expanded';

export default class EntryAbility extends UIAbility {
  private mainWindow?: window.Window;

  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    setAppContext(this.context);
    initResourceCache(this.context.filesDir);
    void loadEquipmentClassification(this.context);

    webview.WebCookieManager.putAcceptCookieEnabled(true);
    webview.WebCookieManager.putAcceptThirdPartyCookieEnabled(true);

    // Pre-seed AppStorage with defaults so @StorageProp bindings are valid
    // before any page renders. Actual persisted values are loaded below.
    initAppVolumeMuteStorage();

    AppStorage.setOrCreate(APP_STORAGE_SHOW_SIDEBAR, true);
    void kvGetBool(APP_STORAGE_SHOW_SIDEBAR, true).then((v: boolean) => {
      AppStorage.set(APP_STORAGE_SHOW_SIDEBAR, v);
    });

    AppStorage.setOrCreate(APP_STORAGE_SIDEBAR_SHOW_AVATAR, true);
    void kvGetBool(APP_STORAGE_SIDEBAR_SHOW_AVATAR, true).then((v: boolean) => {
      AppStorage.set(APP_STORAGE_SIDEBAR_SHOW_AVATAR, v);
    });

    AppStorage.setOrCreate(APP_STORAGE_FLOAT_OVERLAY_AUTO_BATTLE_PREVIEW, true);
    void kvGetBool(APP_STORAGE_FLOAT_OVERLAY_AUTO_BATTLE_PREVIEW, true).then((v: boolean) => {
      AppStorage.set(APP_STORAGE_FLOAT_OVERLAY_AUTO_BATTLE_PREVIEW, v);
    });

    AppStorage.setOrCreate(APP_STORAGE_GAME_SIZE_COMPACT, GAME_SIZE_DEFAULT_PERCENT);
    void kvGetNumber(APP_STORAGE_GAME_SIZE_COMPACT, GAME_SIZE_DEFAULT_PERCENT).then((v: number) => {
      AppStorage.set(APP_STORAGE_GAME_SIZE_COMPACT, normalizeGameSizePercent(v));
    });

    AppStorage.setOrCreate(APP_STORAGE_GAME_SIZE_EXPANDED, GAME_SIZE_DEFAULT_PERCENT);
    void kvGetNumber(APP_STORAGE_GAME_SIZE_EXPANDED, GAME_SIZE_DEFAULT_PERCENT).then((v: number) => {
      AppStorage.set(APP_STORAGE_GAME_SIZE_EXPANDED, normalizeGameSizePercent(v));
    });

    // Optional local cache for game resources.
    AppStorage.setOrCreate(APP_STORAGE_RESOURCE_CACHE_ENABLED, false);
    void kvGetBool(APP_STORAGE_RESOURCE_CACHE_ENABLED, false).then((v: boolean) => {
      AppStorage.set(APP_STORAGE_RESOURCE_CACHE_ENABLED, v);
    });
    AppStorage.setOrCreate(APP_STORAGE_RESOURCE_CACHE_AUDIO, false);
    void kvGetBool(APP_STORAGE_RESOURCE_CACHE_AUDIO, false).then((v: boolean) => {
      AppStorage.set(APP_STORAGE_RESOURCE_CACHE_AUDIO, v);
    });

    // Yasen detect: default enabled; drives inject options in WebHost.
    AppStorage.setOrCreate(APP_STORAGE_YASEN_DETECT_ENABLED, true);
    void kvGetBool(APP_STORAGE_YASEN_DETECT_ENABLED, true).then((v: boolean) => {
      AppStorage.set(APP_STORAGE_YASEN_DETECT_ENABLED, v);
    });

    // Advance guard warning: default enabled; drives inject options in WebHost.
    AppStorage.setOrCreate(APP_STORAGE_ADVANCE_GUARD_ENABLED, true);
    void kvGetBool(APP_STORAGE_ADVANCE_GUARD_ENABLED, true).then((v: boolean) => {
      AppStorage.set(APP_STORAGE_ADVANCE_GUARD_ENABLED, v);
    });

    // Optional injection features. Touch hover is enabled by default because it
    // restores PC-only hover menus on touch devices.
    AppStorage.setOrCreate(APP_STORAGE_INJECT_FPS, false);
    void kvGetBool(APP_STORAGE_INJECT_FPS, false).then((v: boolean) => {
      AppStorage.set(APP_STORAGE_INJECT_FPS, v);
    });

    AppStorage.setOrCreate(APP_STORAGE_INJECT_TOUCH_PATCH, false);
    void kvGetBool(APP_STORAGE_INJECT_TOUCH_PATCH, false).then((v: boolean) => {
      AppStorage.set(APP_STORAGE_INJECT_TOUCH_PATCH, v);
    });

    AppStorage.setOrCreate(APP_STORAGE_INJECT_TOUCH_HOVER, true);
    void kvGetBool(APP_STORAGE_INJECT_TOUCH_HOVER, true).then((v: boolean) => {
      AppStorage.set(APP_STORAGE_INJECT_TOUCH_HOVER, v);
    });

    AppStorage.setOrCreate(APP_STORAGE_INJECT_TOUCH_WHEEL, true);
    void kvGetBool(APP_STORAGE_INJECT_TOUCH_WHEEL, true).then((v: boolean) => {
      AppStorage.set(APP_STORAGE_INJECT_TOUCH_WHEEL, v);
    });

    AppStorage.setOrCreate(APP_STORAGE_INJECT_TOUCH_WHEEL_SENSITIVITY, TOUCH_WHEEL_SENSITIVITY_DEFAULT_PERCENT);
    void kvGetNumber(APP_STORAGE_INJECT_TOUCH_WHEEL_SENSITIVITY, TOUCH_WHEEL_SENSITIVITY_DEFAULT_PERCENT)
      .then((v: number) => {
        AppStorage.set(APP_STORAGE_INJECT_TOUCH_WHEEL_SENSITIVITY, normalizeTouchWheelSensitivityPercent(v));
      });

    AppStorage.setOrCreate(APP_STORAGE_INJECT_TICKER_RAF, false);
    void kvGetBool(APP_STORAGE_INJECT_TICKER_RAF, false).then((v: boolean) => {
      AppStorage.set(APP_STORAGE_INJECT_TICKER_RAF, v);
    });

    AppStorage.setOrCreate(APP_STORAGE_INJECT_PIXI_PATCH, false);
    void kvGetBool(APP_STORAGE_INJECT_PIXI_PATCH, false).then((v: boolean) => {
      AppStorage.set(APP_STORAGE_INJECT_PIXI_PATCH, v);
    });

    // Equipment badge overlays in main panel — both default on.
    AppStorage.setOrCreate(APP_STORAGE_PANEL_SHOW_KAISYUU, true);
    void kvGetBool(APP_STORAGE_PANEL_SHOW_KAISYUU, true).then((v: boolean) => {
      AppStorage.set(APP_STORAGE_PANEL_SHOW_KAISYUU, v);
    });

    AppStorage.setOrCreate(APP_STORAGE_PANEL_SHOW_PROFICIENCY, true);
    void kvGetBool(APP_STORAGE_PANEL_SHOW_PROFICIENCY, true).then((v: boolean) => {
      AppStorage.set(APP_STORAGE_PANEL_SHOW_PROFICIENCY, v);
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
        kvGetBool(APP_STORAGE_REPAIR_ALERT_ENABLED, true),
        kvGetString('alerts.mode', 'both'),
      ]).then((results: Array<boolean | string>) => {
        const yasen = results[0] as boolean;
        const battle = results[1] as boolean;
        const repair = results[2] as boolean;
        const mode = results[3] as string;
        setAlertConfig({
          enableYasenAlert: yasen,
          enableBattleResultAlert: battle,
          enableRepairAlert: repair,
          enableVibrate: mode === 'vibrate' || mode === 'both',
          enableNotification: mode === 'ring' || mode === 'both',
        });
      });

      // 启动远征归来调度器（负责在远征到时触发 Toast / 震动 / 归来通知）
      const scheduler = initExpeditionScheduler(getRepositoryHub().expedition);
      // 每当 expedition 状态写入 DB 后立即重新规划 timer，与通知权限无关
      addOnExpeditionChanged(() => { void getExpeditionScheduler()?.poke(); });
      void scheduler.start();
      void getExpeditionReminderService().start();

      // 启动入渠修理完成调度器
      const repairScheduler = initRepairScheduler(getRepositoryHub().repair);
      addOnNdockChanged(() => { void getRepairScheduler()?.poke(); });
      void repairScheduler.start();

      // 恢复战果跟踪数据（每日起点 + 战绩快照）
      void loadSenkaFromKV();

      // 从 DB 恢复舰娘图像文件名到内存缓存
      void getRepositoryHub().shipGraph.listAll().then(rows => {
        if (rows.length > 0) {
          updateShipGraphFilenames(rows.map(r=>{
            const i:shipGraphFilename = {id:r.id,filename:r.filename};
            return i;
          }));
          hilog.info(HILOG_DOM, 'App', 'restored %{public}d ship graph filenames from DB', rows.length);
        }
      }).catch((_e: Error) => {
        hilog.warn(HILOG_DOM, 'App', 'failed to restore ship graph filenames from DB');
      });

      initBattlePredictionService(gameStateAdapter);

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
    getRepairScheduler()?.stop();
    getExpeditionReminderService().stop();
    getExpeditionLiveNotificationService().stop();
    this.mainWindow?.disableLandscapeMultiWindow().catch((error: BusinessError): void => {
      hilog.error(HILOG_DOM, 'App', 'disableLandscapeMultiWindow failed: %{public}s', JSON.stringify(error));
    });
    void FairyService.getInstance().destroy();
  }

  onDestroy(): void | Promise<void> {
  }

  onForeground(): void {
    void getExpeditionLiveNotificationService().refresh();
    void getExpeditionReminderService().syncFromDb();
  }

  onBackground(): void {
    void getExpeditionLiveNotificationService().refresh();
    void getExpeditionReminderService().syncFromDb();
  }
}
