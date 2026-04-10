/**
 * 提供一个指向游戏主界面（EntryAbility）的 WantAgent，
 * 用于点击通知时唤起 / 切换到前台。
 */
import { wantAgent, Want } from '@kit.AbilityKit';
import type { WantAgent } from '@kit.AbilityKit';


let _agent: WantAgent | null = null;

export async function getLaunchWantAgent(): Promise<WantAgent | null> {
  if (_agent) return _agent;
  try {
    _agent = await wantAgent.getWantAgent({
      wants: [{
        bundleName: 'com.cesium.kchomo',
        abilityName: 'EntryAbility',
      }],
      operationType: wantAgent.OperationType.START_ABILITY,
      requestCode: 0,
      wantAgentFlags: [wantAgent.WantAgentFlags.UPDATE_PRESENT_FLAG],
    });
    return _agent;
  } catch (e) {
    console.warn('[WantAgent] getWantAgent failed:', e);
    return null;
  }
}