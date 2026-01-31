import UIAbility from '@ohos.app.ability.UIAbility';
import AbilityConstant from '@ohos.app.ability.AbilityConstant';
import Want from '@ohos.app.ability.Want';
import window from '@ohos.window';
import { setAppContext } from '../infra/appContext'
import { initPersistDeps } from '../infra/deps';
import { initHandlerRegistry } from '../features/router/persist/registry';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { webview } from '@kit.ArkWeb';
import BuildProfile from 'BuildProfile';
const HILOG_DOM: number = 0x1357;

export default class EntryAbility extends UIAbility {
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

    if (BuildProfile.DEBUG) {
      import('@hadss/debug-db').then(async (ns: ESObject) => {
        await ns.DebugDB.initialize(this.context, { port: 8080, defaultStart: true });
      });
      }
  }

  onWindowStageDestroy(): void {
  }

  onDestroy(): void | Promise<void> {
  }
}