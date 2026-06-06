import { NDockSnapShot, ShipState, getShip } from '../../../../../features/state';
import { hpColor, PanelColors, PanelDimens } from '../../../../../features/panel/panelConfig';

const NDOCK_STATE_REPAIRING = 1;

function pad2(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0');
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '--';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${pad2(m)}:${pad2(s)}`;
  return `${pad2(m)}:${pad2(s)}`;
}

function sameLocalDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function formatLocalDateTime(ts: number, now: number): string {
  if (!Number.isFinite(ts) || ts <= 0) return '--';
  const d = new Date(ts);
  const n = new Date(now);
  const clock = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  if (sameLocalDate(d, n)) return clock;
  return `${d.getMonth() + 1}/${d.getDate()} ${clock}`;
}

@ComponentV2
export default struct NdockPanel {
  @Param ndocks: NDockSnapShot[] = [];
  @Param compact: boolean = false;
  @Local now: number = Date.now();

  private tickTimer: number = -1;

  aboutToAppear(): void {
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

  private activeDocks(): NDockSnapShot[] {
    return this.ndocks
      .filter((dock: NDockSnapShot) => dock.state === NDOCK_STATE_REPAIRING && dock.shipUid > 0)
      .sort((a: NDockSnapShot, b: NDockSnapShot) => a.dockId - b.dockId);
  }

  private shipOf(dock: NDockSnapShot): ShipState | undefined {
    return getShip(dock.shipUid);
  }

  private shipName(dock: NDockSnapShot): string {
    return this.shipOf(dock)?.name ?? `#${dock.shipUid}`;
  }

  private shipLevelText(dock: NDockSnapShot): string {
    const lv = this.shipOf(dock)?.level ?? 0;
    return lv > 0 ? `Lv.${lv}` : 'Lv.--';
  }

  private shipHpText(dock: NDockSnapShot): string {
    const ship = this.shipOf(dock);
    if (!ship) return 'HP --/--';
    return `HP ${ship.hpNow}/${ship.hpMax}`;
  }

  private shipHpColor(dock: NDockSnapShot): string {
    const ship = this.shipOf(dock);
    if (!ship) return PanelColors.txtSub;
    return hpColor(ship.hpNow, ship.hpMax);
  }

  private repairDurationMs(dock: NDockSnapShot): number {
    return this.shipOf(dock)?.ndockTimeMs ?? 0;
  }

  private remainingMs(dock: NDockSnapShot): number {
    return Math.max(0, dock.completeTime - this.now);
  }

  private repairDurationText(dock: NDockSnapShot): string {
    return formatDuration(this.repairDurationMs(dock));
  }

  private remainingText(dock: NDockSnapShot): string {
    const remain = this.remainingMs(dock);
    return remain > 0 ? formatDuration(remain) : '完成';
  }

  private completeTimeText(dock: NDockSnapShot): string {
    return formatLocalDateTime(dock.completeTime, this.now);
  }

  private startTimeText(dock: NDockSnapShot): string {
    const duration = this.repairDurationMs(dock);
    if (duration <= 0 || dock.completeTime <= 0) return '--';
    return formatLocalDateTime(dock.completeTime - duration, this.now);
  }

  private timeLineText(dock: NDockSnapShot): string {
    if (this.compact) {
      return `入渠 ${this.startTimeText(dock)} / 本机 ${this.completeTimeText(dock)}`;
    }
    return `入渠 ${this.startTimeText(dock)}    本机完成 ${this.completeTimeText(dock)}    耗时 ${this.repairDurationText(dock)}`;
  }

  private fuelCost(dock: NDockSnapShot): number {
    const ship = this.shipOf(dock);
    return dock.fuelCost > 0 ? dock.fuelCost : (ship?.ndockFuel ?? 0);
  }

  private steelCost(dock: NDockSnapShot): number {
    const ship = this.shipOf(dock);
    return dock.steelCost > 0 ? dock.steelCost : (ship?.ndockSteel ?? 0);
  }

  private costText(dock: NDockSnapShot): string {
    const fuel = this.fuelCost(dock);
    const steel = this.steelCost(dock);
    if (fuel <= 0 && steel <= 0) return '消耗 --';
    return `油 ${fuel}  钢 ${steel}`;
  }

  private progressTotal(dock: NDockSnapShot): number {
    const duration = this.repairDurationMs(dock);
    return duration > 0 ? duration : 1;
  }

  private progressValue(dock: NDockSnapShot): number {
    const duration = this.repairDurationMs(dock);
    if (duration <= 0) return 0;
    return Math.max(0, Math.min(duration, duration - this.remainingMs(dock)));
  }

  private rowHeight(): number {
    return this.compact ? PanelDimens.rowCompH + 10 : PanelDimens.rowH + 10;
  }

  private titleFontSize(): number {
    return this.compact ? PanelDimens.fontSm : PanelDimens.fontMd;
  }

  private remainingFontSize(): number {
    return this.compact ? PanelDimens.fontMd : PanelDimens.fontLg;
  }

  private dockBadgeWidth(): number {
    return this.compact ? 34 : PanelDimens.avatarW;
  }

  private remainingWidth(): number {
    return this.compact ? 52 : 64;
  }

  private dockRowKey(dock: NDockSnapShot): string {
    const ship = this.shipOf(dock);
    return [
      dock.dockId,
      dock.state,
      dock.shipUid,
      dock.completeTime,
      dock.capturedAt,
      dock.fuelCost,
      dock.steelCost,
      ship?.level ?? 0,
      ship?.hpNow ?? 0,
      ship?.hpMax ?? 0,
      ship?.ndockTimeMs ?? 0,
      Math.floor(this.now / 1000),
    ].join('_');
  }

  @Builder private DockBadge(dock: NDockSnapShot): void {
    Column() {
      Text('渠')
        .fontSize(PanelDimens.fontSm)
        .fontColor('#ffffff')
      Text(`${dock.dockId}`)
        .fontSize(this.compact ? PanelDimens.fontLg : 16)
        .fontWeight(FontWeight.Bold)
        .fontColor('#ffffff')
    }
    .width(this.dockBadgeWidth())
    .height('100%')
    .backgroundColor('#006064')
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
  }

  @Builder private DockRow(dock: NDockSnapShot): void {
    Row() {
      this.DockBadge(dock)

      Column({ space: 3 }) {
        Row({ space: 5 }) {
          Text(this.shipName(dock))
            .fontSize(this.titleFontSize())
            .fontWeight(FontWeight.Medium)
            .fontColor(PanelColors.txtPrimary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .layoutWeight(1)

          Text(this.shipLevelText(dock))
            .fontSize(PanelDimens.fontSm)
            .fontColor(PanelColors.txtSub)
            .maxLines(1)

          Text(this.shipHpText(dock))
            .fontSize(PanelDimens.fontSm)
            .fontColor(this.shipHpColor(dock))
            .maxLines(1)
        }
        .width('100%')
        .alignItems(VerticalAlign.Center)

        Text(this.timeLineText(dock))
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.txtSub)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .width('100%')

        Progress({
          value: this.progressValue(dock),
          total: this.progressTotal(dock),
          type: ProgressType.Linear,
        })
          .width('100%')
          .height(PanelDimens.hpBarCompH)
          .color(PanelColors.stat)
          .backgroundColor(PanelColors.bgHpTrack)
      }
      .layoutWeight(1)
      .padding({ left: this.compact ? 6 : 8, right: this.compact ? 5 : 8 })
      .justifyContent(FlexAlign.Center)

      Column({ space: 2 }) {
        Text(this.remainingText(dock))
          .fontSize(this.remainingFontSize())
          .fontWeight(FontWeight.Bold)
          .fontColor(this.remainingMs(dock) > 0 ? PanelColors.stat : PanelColors.hpOk)
          .maxLines(1)
          .textAlign(TextAlign.End)

        Text(this.remainingMs(dock) > 0 ? '剩余' : '待刷新')
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.txtSub)
          .maxLines(1)

        Text(this.costText(dock))
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.txtMuted)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .width(this.remainingWidth())
      .height('100%')
      .padding({ right: this.compact ? 5 : 8 })
      .justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.End)
    }
    .width('100%')
    .height(this.rowHeight())
    .backgroundColor(PanelColors.bgSection)
    .borderWidth({ bottom: PanelDimens.borderW })
    .borderColor(PanelColors.rowBorder)
    .alignItems(VerticalAlign.Center)
  }

  @Builder private EmptyState(): void {
    Column() {
      Text('暂无入渠舰娘')
        .fontSize(this.titleFontSize())
        .fontColor(PanelColors.txtMuted)
        .margin({ top: this.compact ? 16 : 24 })
      Text(this.ndocks.length > 0 ? '所有修理渠空闲' : '打开入渠界面或回港以获得数据')
        .fontSize(PanelDimens.fontSm)
        .fontColor(PanelColors.txtFainter)
        .margin({ top: 6 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Center)
  }

  build() {
    Column() {
      if (this.activeDocks().length > 0) {
        ForEach(this.activeDocks(), (dock: NDockSnapShot) => {
          this.DockRow(dock)
        }, (dock: NDockSnapShot) => this.dockRowKey(dock))
      } else {
        this.EmptyState()
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}
