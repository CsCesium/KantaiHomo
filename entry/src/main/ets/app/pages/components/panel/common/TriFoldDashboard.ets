import {
  DeckSnapshot, NDockSnapShot, QuestSnapshot,
  getDecks, getNDocks, getQuests, subscribeGameState,
} from '../../../../../features/state';
import { PanelColors, PanelDimens } from '../../../../../features/panel/panelConfig';
import { getRepositoryHub } from '../../../../../infra/storage/repo';
import { kvGetNumber, kvSet } from '../../../../../infra/storage/kv';
import { MissionRow } from '../../../../../infra/storage/types';
import ExpeditionStatusPanel from './ExpeditionStatusPanel';
import QuestPanel from './QuestPanel';
import { claimableQuestCount } from '../../../../../features/quests/presentation';
import NdockPanel from './NdockPanel';

const DASHBOARD_TITLES: string[] = ['远征', '任务', '入渠'];
const DASHBOARD_KIND_KEY: string = 'ui.triFold.dashboardKind';
// Keep writes ordered even when folding destroys and recreates the component.
let dashboardSave: Promise<void> = Promise.resolve();

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
  private kindLoadSeq: number = 0;

  aboutToAppear(): void {
    void this.restoreActiveKind();
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
    this.kindLoadSeq++;
  }

  private normalizeKind(kind: number): number {
    return Number.isInteger(kind) && kind >= 0 && kind < DASHBOARD_TITLES.length ? kind : 0;
  }

  private async restoreActiveKind(): Promise<void> {
    const seq: number = ++this.kindLoadSeq;
    const cached: number | undefined = AppStorage.get<number>(DASHBOARD_KIND_KEY);
    if (cached !== undefined) {
      this.activeKind = this.normalizeKind(cached);
      return;
    }
    try {
      const saved: number = await kvGetNumber(DASHBOARD_KIND_KEY, 0);
      if (seq !== this.kindLoadSeq) {
        return;
      }
      // A newer component may have selected another card while the disk read was pending.
      const current: number | undefined = AppStorage.get<number>(DASHBOARD_KIND_KEY);
      this.activeKind = this.normalizeKind(current ?? saved);
      AppStorage.setOrCreate(DASHBOARD_KIND_KEY, this.activeKind);
    } catch (e) {
      console.warn('[TriFoldDashboard] restore selected card failed:', e);
    }
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
    this.selectKind((this.activeKind + 1) % DASHBOARD_TITLES.length);
  }

  private selectKind(kind: number): void {
    this.kindLoadSeq++;
    this.activeKind = kind;
    const selected: number = this.activeKind;
    // Update memory synchronously so an immediate remount never reads an older disk value.
    AppStorage.setOrCreate(DASHBOARD_KIND_KEY, selected);
    dashboardSave = dashboardSave.then(() => kvSet(DASHBOARD_KIND_KEY, selected)).catch((e: Error) => {
      console.warn('[TriFoldDashboard] save selected card failed:', e);
    });
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
        if (claimableQuestCount(this.quests) > 0) {
          Text(`✦ ${claimableQuestCount(this.quests)} 项可交付`)
            .fontSize(PanelDimens.fontSm)
            .fontWeight(FontWeight.Bold)
            .fontColor(PanelColors.questReady)
            .padding({ left: 6, right: 6 })
            .onClick(() => { this.selectKind(1); })
        }
        Text(`双击切换 · ${this.activeKind + 1}/${DASHBOARD_TITLES.length}`)
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.txtMuted)
      }
      .width('100%')
      .height(32)
      .padding({ left: 10, right: 10 })
      .backgroundColor(this.activeKind === 1 && claimableQuestCount(this.quests) > 0 ?
        PanelColors.questReadyBg : PanelColors.bgHeader)
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
    .borderWidth(this.activeKind === 1 && claimableQuestCount(this.quests) > 0 ? 2 : 1)
    .borderColor(this.activeKind === 1 && claimableQuestCount(this.quests) > 0 ?
      PanelColors.questReady : PanelColors.rowBorder)
    .clip(true)
    .priorityGesture(
      TapGesture({ count: 2 })
        .onAction(() => this.nextKind())
    )
  }
}
