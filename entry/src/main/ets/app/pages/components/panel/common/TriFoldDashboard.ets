import {
  DeckSnapshot, NDockSnapShot, QuestSnapshot,
  getDecks, getNDocks, getQuests, subscribeGameState,
} from '../../../../../features/state';
import { PanelColors, PanelDimens } from '../../../../../features/panel/panelConfig';
import { getRepositoryHub } from '../../../../../infra/storage/repo';
import { MissionRow } from '../../../../../infra/storage/types';
import ExpeditionStatusPanel from './ExpeditionStatusPanel';
import QuestPanel from './QuestPanel';
import NdockPanel from './NdockPanel';

const DASHBOARD_TITLES: string[] = ['远征', '任务', '入渠'];

/** Fixed slot below the tri-fold battle preview. Double-tap cycles its content. */
@ComponentV2
export default struct TriFoldDashboard {
  @Local activeKind: number = 0;
  @Local decks: DeckSnapshot[] = [];
  @Local quests: QuestSnapshot[] = [];
  @Local ndocks: NDockSnapShot[] = [];
  @Local missions: MissionRow[] = [];
  private scroller: Scroller = new Scroller();
  private unsubscribe: (() => void) | null = null;
  private missionLoadSeq: number = 0;

  aboutToAppear(): void {
    this.refreshState();
    void this.loadMissions();
    this.unsubscribe = subscribeGameState((changeType, _state) => {
      if (changeType === 'all' || changeType === 'decks' || changeType === 'quests' ||
        changeType === 'ndocks' || changeType === 'ships') {
        this.refreshState();
      }
      if (changeType === 'all') {
        void this.loadMissions();
      }
    });
  }

  aboutToDisappear(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.missionLoadSeq++;
  }

  private refreshState(): void {
    this.decks = [...getDecks()];
    this.quests = [...getQuests()];
    this.ndocks = [...getNDocks()];
  }

  private async loadMissions(): Promise<void> {
    const seq: number = ++this.missionLoadSeq;
    try {
      const missions: MissionRow[] = await getRepositoryHub().mission.listAll();
      if (seq === this.missionLoadSeq) {
        this.missions = missions;
      }
    } catch (e) {
      console.warn('[TriFoldDashboard] load mission names failed:', e);
    }
  }

  private nextKind(): void {
    this.activeKind = (this.activeKind + 1) % DASHBOARD_TITLES.length;
    this.scroller.scrollTo({ xOffset: 0, yOffset: 0 });
  }

  build() {
    Column() {
      Row() {
        Text(DASHBOARD_TITLES[this.activeKind])
          .fontSize(PanelDimens.fontLg)
          .fontWeight(FontWeight.Medium)
          .fontColor(PanelColors.txtPrimary)
        Blank().layoutWeight(1)
        Text(`双击切换 · ${this.activeKind + 1}/${DASHBOARD_TITLES.length}`)
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.txtMuted)
      }
      .width('100%')
      .height(32)
      .padding({ left: 10, right: 10 })
      .backgroundColor(PanelColors.bgHeader)
      .alignItems(VerticalAlign.Center)

      Scroll(this.scroller) {
        Column() {
          if (this.activeKind === 0) {
            ExpeditionStatusPanel({ decks: this.decks, missions: this.missions })
          } else if (this.activeKind === 1) {
            QuestPanel({ quests: this.quests, compact: true, includeCompleted: true })
          } else {
            NdockPanel({ ndocks: this.ndocks, compact: true })
          }
        }
        .width('100%')
      }
      .width('100%')
      .layoutWeight(1)
      .align(Alignment.TopStart)
      .scrollBar(BarState.Auto)
      .edgeEffect(EdgeEffect.None)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(PanelColors.bg)
    .borderWidth({ top: 1 })
    .borderColor(PanelColors.rowBorder)
    .clip(true)
    .priorityGesture(
      TapGesture({ count: 2 })
        .onAction(() => this.nextKind())
    )
  }
}
