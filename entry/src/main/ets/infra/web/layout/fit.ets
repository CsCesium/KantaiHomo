//entry/src/main/ets/infra/web/layout/Fit
import { webview } from '@kit.ArkWeb';

export class FitAndDisplay {
  private ctl: webview.WebviewController;
  private timerId: number = -1;

  constructor(ctl: webview.WebviewController) { this.ctl = ctl; }

  resetFitCache(): void {
    this.run(`window.kcFitReset && window.kcFitReset();`);
  }

  applyFitLock(locked: boolean): void {
    const leftGap = locked? 0:90;
    this.run(`window.kcSetLeftGap && window.kcSetLeftGap(${leftGap});`+
      `window.kcFitLock && window.kcFitLock(${locked ? 'true' : 'false'});`);
  }

  pushFitPolicy(policy: string): void {
    const js: string =
      `window.kcFitSetPolicy && window.kcFitSetPolicy("${policy}");` +
        `window.kcFitReflow && window.kcFitReflow();` +
        `setTimeout(()=>{window.kcFitReflow && window.kcFitReflow();},60);`;
    this.run(js);
  }

  onDisplayChangeDebounced(policy: string, locked: boolean): void {
    if (this.timerId >= 0) {
      clearTimeout(this.timerId);
    }
    this.timerId = setTimeout((): void => {
      this.applyFitLock(locked);
      this.pushFitPolicy(policy);
      this.timerId = -1;
    }, 60);
  }

  private run(js: string): void {
    if (typeof this.ctl.runJavaScript === 'function') {
      this.ctl.runJavaScript(js);
    }
  }
}