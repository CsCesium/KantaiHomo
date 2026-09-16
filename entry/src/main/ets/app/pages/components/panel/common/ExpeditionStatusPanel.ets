import { DeckSnapshot } from '../../../../../features/state';
import { PanelColors, PanelDimens } from '../../../../../features/panel/panelConfig';
import { MissionRow } from '../../../../../infra/storage/types';

@ComponentV2
export default struct ExpeditionStatusPanel {
  @Param decks: DeckSnapshot[] = [];
  @Param missions: MissionRow[] = [];
  @Local now: number = Date.now();
  private tickTimer: number = -1;

  aboutToAppear(): void {
    this.now = Date.now();
    this.scheduleTick();
  }

  aboutToDisappear(): void {
    this.clearTick();
  }

  private scheduleTick(): void {
    this.clearTick();
    this.tickTimer = setTimeout((): void => {
      this.now = Date.now();
      this.scheduleTick();
    }, 1000);
  }

  private clearTick(): void {
    if (this.tickTimer >= 0) {
      clearTimeout(this.tickTimer);
      this.tickTimer = -1;
    }
  }

  private activeDecks(): DeckSnapshot[] {
    // Keep elapsed expeditions visible until the game confirms their return.
    return this.decks.filter((deck: DeckSnapshot) => deck.expeditionMissionId > 0 &&
      deck.expeditionReturnTime !== null && deck.expeditionReturnTime > 0)
      .sort((a: DeckSnapshot, b: DeckSnapshot) => a.deckId - b.deckId);
  }

  private missionName(deck: DeckSnapshot): string {
    const mission = this.missions.find((row: MissionRow) => row.id === deck.expeditionMissionId);
    return mission ? `${mission.code || mission.id} · ${mission.name}` : `远征 #${deck.expeditionMissionId}`;
  }

  private remainingText(deck: DeckSnapshot): string {
    const end: number = deck.expeditionReturnTime ?? 0;
    if (!Number.isFinite(end) || end <= 0) return '--';
    const seconds: number = Math.ceil(Math.max(0, end - this.now) / 1000);
    if (seconds === 0) return '已归来';
    const hours: number = Math.floor(seconds / 3600);
    const minutes: string = String(Math.floor(seconds % 3600 / 60)).padStart(2, '0');
    const rest: string = String(seconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${rest}`;
  }

  private returnTimeText(deck: DeckSnapshot): string {
    const end: number = deck.expeditionReturnTime ?? 0;
    if (!Number.isFinite(end) || end <= 0) return '归来时间未知';
    const date: Date = new Date(end);
    const today: Date = new Date(this.now);
    const clock: string = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
    const sameDay: boolean = date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
    return `归来 ${sameDay ? '' : `${date.getMonth() + 1}/${date.getDate()} `}${clock}`;
  }

  @Builder private ExpeditionRow(deck: DeckSnapshot) {
    Row({ space: 8 }) {
      Column() {
        Text('舰队')
          .fontSize(PanelDimens.fontSm)
          .fontColor('#fff')
        Text(`${deck.deckId}`)
          .fontSize(PanelDimens.fontLg)
          .fontWeight(FontWeight.Bold)
          .fontColor('#fff')
      }
      .width(34)
      .height('100%')
      .justifyContent(FlexAlign.Center)
      .backgroundColor('#28536a')

      Column({ space: 3 }) {
        Text(this.missionName(deck))
          .fontSize(PanelDimens.fontMd)
          .fontColor(PanelColors.txtPrimary)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.returnTimeText(deck))
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.txtSub)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      Text(this.remainingText(deck))
        .fontSize(PanelDimens.fontMd)
        .fontWeight(FontWeight.Bold)
        .fontColor((deck.expeditionReturnTime ?? 0) > this.now ? PanelColors.stat : PanelColors.hpOk)
        .maxLines(1)
        .width(64)
        .textAlign(TextAlign.End)
        .margin({ right: 6 })
    }
    .width('100%')
    .height(PanelDimens.rowCompH + 10)
    .alignItems(VerticalAlign.Center)
    .backgroundColor(PanelColors.bgSection)
    .borderWidth({ bottom: PanelDimens.borderW })
    .borderColor(PanelColors.rowBorder)
  }

  build() {
    Column() {
      if (this.activeDecks().length > 0) {
        ForEach(this.activeDecks(), (deck: DeckSnapshot) => {
          this.ExpeditionRow(deck)
        }, (deck: DeckSnapshot) => `${deck.deckId}-${deck.expeditionMissionId}-${deck.expeditionReturnTime}`)
      } else {
        Column({ space: 6 }) {
          Text('当前没有进行中的远征')
            .fontSize(PanelDimens.fontSm)
            .fontColor(PanelColors.txtMuted)
          Text(this.decks.length > 0 ? '派出舰队后显示归来时间' : '回港以获取舰队信息')
            .fontSize(PanelDimens.fontSm)
            .fontColor(PanelColors.txtFainter)
        }
        .width('100%')
        .padding({ top: 16 })
      }
    }
    .width('100%')
  }
}
