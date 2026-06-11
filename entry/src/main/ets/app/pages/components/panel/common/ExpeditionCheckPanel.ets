import util from '@ohos.util';
import { common } from '@kit.AbilityKit';
import { PanelColors, PanelDimens } from '../../../../../features/panel/panelConfig';
import {
  subscribeGameState,
  getGameState,
} from '../../../../../features/state';
import type { StateChangeType } from '../../../../../features/state';
import {
  displayExpeditionName,
  evaluateExpedition,
  formatBigSuccessRate,
  formatReward,
  isKnownExpeditionArea,
} from '../../../../../features/expedition/expeditionCheck';
import type {
  ExpeditionRequirement,
  ExpeditionCheckResult,
} from '../../../../../features/expedition/expeditionCheck';

const EXPEDITION_REQ_RAWFILE = 'data/expedition_req.json';
const CHECK_DECK_IDS: number[] = [2, 3, 4];

interface AreaFilterDef {
  area: number;
  label: string;
}

const AREA_FILTERS: AreaFilterDef[] = [
  { area: 0, label: '全' },
  { area: 1, label: '1' },
  { area: 2, label: '2' },
  { area: 3, label: '3' },
  { area: 4, label: '4' },
  { area: 5, label: '5' },
  { area: 7, label: '7' },
  { area: -1, label: '他' },
];

function resultKey(req: ExpeditionRequirement, deckId: number, stateVersion: number): string {
  return `${req.id}-${deckId}-${stateVersion}`;
}

@ComponentV2
export default struct ExpeditionCheckPanel {
  @Param compact: boolean = false;

  @Local private requirements: ExpeditionRequirement[] = [];
  @Local private activeArea: number = 0;
  @Local private loadError: string = '';
  @Local private stateVersion: number = 0;

  private unsubscribe: (() => void) | null = null;

  aboutToAppear(): void {
    void this.loadRequirements();
    this.unsubscribe = subscribeGameState((changeType: StateChangeType, _state) => {
      if (changeType === 'all' || changeType === 'ships' || changeType === 'decks') {
        this.stateVersion++;
      }
    });
  }

  aboutToDisappear(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  private async loadRequirements(): Promise<void> {
    try {
      const ctx = getContext(this) as common.UIAbilityContext;
      const buf = await ctx.resourceManager.getRawFileContent(EXPEDITION_REQ_RAWFILE);
      const text = new util.TextDecoder('utf-8').decode(buf);
      const data = JSON.parse(text) as ExpeditionRequirement[];
      this.requirements = Array.isArray(data)
        ? data.filter((req: ExpeditionRequirement): boolean => req.id > 0)
        : [];
      this.loadError = '';
    } catch (e) {
      this.requirements = [];
      this.loadError = String(e);
    }
  }

  private visibleRequirements(): ExpeditionRequirement[] {
    if (this.activeArea === 0) {
      return this.requirements;
    }
    if (this.activeArea === -1) {
      return this.requirements.filter((req: ExpeditionRequirement): boolean => !isKnownExpeditionArea(req.area));
    }
    return this.requirements.filter((req: ExpeditionRequirement): boolean => req.area === this.activeArea);
  }

  private check(req: ExpeditionRequirement, deckId: number): ExpeditionCheckResult {
    return evaluateExpedition(req, deckId, getGameState().getState());
  }

  private missingText(result: ExpeditionCheckResult): string {
    if (result.missing.length === 0) return 'OK';
    return result.missing.slice(0, this.compact ? 1 : 2).join(' ');
  }

  private deckBadgeText(req: ExpeditionRequirement, deckId: number): string {
    const result = this.check(req, deckId);
    if (!result.ok) {
      return `D${deckId} ${this.missingText(result)}`;
    }
    return `D${deckId} 大成${formatBigSuccessRate(result.bigSuccess.rate)}`;
  }

  private deckBadgeNote(req: ExpeditionRequirement, deckId: number): string {
    const result = this.check(req, deckId);
    if (!result.ok) return '';
    return result.bigSuccess.note;
  }

  private deckBadgeBg(req: ExpeditionRequirement, deckId: number): string {
    const result = this.check(req, deckId);
    if (!result.ok) return '#4a2228';
    return result.bigSuccess.ok ? '#173f2a' : '#3c3520';
  }

  private deckBadgeFg(req: ExpeditionRequirement, deckId: number): string {
    const result = this.check(req, deckId);
    if (!result.ok) return '#ff9f9f';
    return result.bigSuccess.ok ? '#b7f7c8' : '#ffd86b';
  }

  @Builder private AreaChip(filter: AreaFilterDef): void {
    Text(filter.label)
      .fontSize(PanelDimens.fontLg)
      .fontWeight(this.activeArea === filter.area ? FontWeight.Bold : FontWeight.Normal)
      .fontColor(this.activeArea === filter.area ? PanelColors.txtTabOn : PanelColors.txtMuted)
      .padding({ left: this.compact ? 7 : 10, right: this.compact ? 7 : 10, top: 4, bottom: 4 })
      .backgroundColor(this.activeArea === filter.area ? '#2e3355' : PanelColors.bgTabInactive)
      .opacity(this.activeArea === filter.area ? 1.0 : 0.62)
      .borderRadius(PanelDimens.radius)
      .onClick(() => { this.activeArea = filter.area; })
  }

  @Builder private AreaBar(): void {
    Scroll() {
      Row({ space: 4 }) {
        Text('远征判定')
          .fontSize(PanelDimens.fontLg)
          .fontWeight(FontWeight.Medium)
          .fontColor(PanelColors.txtPrimary)
          .margin({ right: 4 })

        ForEach(AREA_FILTERS, (filter: AreaFilterDef) => {
          this.AreaChip(filter)
        }, (filter: AreaFilterDef) => `area-${filter.area}`)
      }
      .height(28)
      .padding({ left: 8, right: 8 })
      .alignItems(VerticalAlign.Center)
    }
    .width('100%')
    .height(28)
    .scrollable(ScrollDirection.Horizontal)
    .scrollBar(BarState.Off)
    .edgeEffect(EdgeEffect.None)
    .backgroundColor(PanelColors.bgTabs)
    .borderWidth({ bottom: PanelDimens.borderW })
    .borderColor(PanelColors.rowBorder)
  }

  @Builder private DeckBadge(req: ExpeditionRequirement, deckId: number): void {
    Column({ space: 1 }) {
      Text(this.deckBadgeText(req, deckId))
        .fontSize(PanelDimens.fontSm)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.deckBadgeFg(req, deckId))
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
      if (!this.compact && this.deckBadgeNote(req, deckId).length > 0) {
        Text(this.deckBadgeNote(req, deckId))
          .fontSize(9)
          .fontColor(PanelColors.txtMuted)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
    }
    .width(this.compact ? 58 : 86)
    .height(this.compact ? 22 : 32)
    .padding({ left: 4, right: 4, top: 2, bottom: 2 })
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(this.deckBadgeBg(req, deckId))
    .borderRadius(PanelDimens.radius)
  }

  @Builder private MissionRow(req: ExpeditionRequirement): void {
    Column({ space: 5 }) {
      Row({ space: 6 }) {
        Text(req.code)
          .fontSize(PanelDimens.fontSm)
          .fontWeight(FontWeight.Bold)
          .fontColor('#ffffff')
          .width(this.compact ? 30 : 38)
          .height(18)
          .textAlign(TextAlign.Center)
          .backgroundColor('#36435f')
          .borderRadius(PanelDimens.radius)

        Text(displayExpeditionName(req))
          .fontSize(PanelDimens.fontMd)
          .fontColor(PanelColors.txtPrimary)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .layoutWeight(1)

        if (!this.compact) {
          Text(formatReward(req))
            .fontSize(PanelDimens.fontSm)
            .fontColor(PanelColors.stat)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)

      Row({ space: 4 }) {
        ForEach(CHECK_DECK_IDS, (deckId: number) => {
          this.DeckBadge(req, deckId)
        }, (deckId: number) => resultKey(req, deckId, this.stateVersion))
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)
    }
    .width('100%')
    .padding({ left: 8, right: 8, top: 7, bottom: 7 })
    .backgroundColor(PanelColors.bgSection)
    .borderWidth({ bottom: PanelDimens.borderW })
    .borderColor(PanelColors.rowBorder)
  }

  @Builder private EmptyState(): void {
    Column({ space: 6 }) {
      Text(this.loadError.length > 0 ? '远征数据加载失败' : '无远征数据')
        .fontSize(PanelDimens.fontMd)
        .fontColor(PanelColors.txtMuted)
      if (this.loadError.length > 0 && !this.compact) {
        Text(this.loadError)
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.txtFainter)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
    }
    .width('100%')
    .padding({ top: 24 })
    .alignItems(HorizontalAlign.Center)
  }

  build() {
    Column() {
      this.AreaBar()

      Scroll() {
        Column() {
          if (this.visibleRequirements().length > 0) {
            ForEach(this.visibleRequirements(), (req: ExpeditionRequirement) => {
              this.MissionRow(req)
            }, (req: ExpeditionRequirement) => `exp-${req.id}-${this.stateVersion}`)
          } else {
            this.EmptyState()
          }
        }
        .width('100%')
      }
      .layoutWeight(1)
      .width('100%')
      .scrollBar(BarState.Off)
      .edgeEffect(EdgeEffect.None)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.compact ? PanelColors.overlayBg : PanelColors.bg)
  }
}
