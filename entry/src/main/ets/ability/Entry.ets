import UIAbility from '@ohos.app.ability.UIAbility';
import AbilityConstant from '@ohos.app.ability.AbilityConstant';
import Want from '@ohos.app.ability.Want';
import window from '@ohos.window';

export default class EntryAbility extends UIAbility{
  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    windowStage.loadContent('webhost',(err)=>{
      if (err?.code) {
        console.error(`loadContent failed: ${JSON.stringify(err)}`)
      }
    })
  }

  onWindowStageDestroy(): void {
  }

  onDestroy(): void | Promise<void> {
  }

}