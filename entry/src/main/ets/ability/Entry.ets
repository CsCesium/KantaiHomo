import UIAbility from '@ohos.app.ability.UIAbility';
import AbilityConstant from '@ohos.app.ability.AbilityConstant';
import Want from '@ohos.app.ability.Want';
import window from '@ohos.window';
import { BusinessError } from '@kit.BasicServicesKit';
import { setAppContext } from '../infra/appContext'
import { initPersistDeps } from '../infra/deps';
import { initHandlerRegistry } from '../features/router/persist/registry';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { webview } from '@kit.ArkWeb';
import BuildProfile from 'BuildProfile';
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
      hilog.info(HILOG_DOM, 'App', 'deps+registry initialized (stageCreate)');
    } catch (e) {
      hilog.error(HILOG_DOM, 'App', 'init failed: %{public}s', String(e));
    }
    windowStage.loadContent('app/pages/WebRoot', (err) => {
      if (err?.code) {
        console.error(`loadContent failed: ${JSON.stringify(err)}`)
      }
    })

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
    this.mainWindow?.disableLandscapeMultiWindow().catch((error: BusinessError): void => {
      hilog.error(HILOG_DOM, 'App', 'disableLandscapeMultiWindow failed: %{public}s', JSON.stringify(error));
    });
  }

  onDestroy(): void | Promise<void> {
  }
}