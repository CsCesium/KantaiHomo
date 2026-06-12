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
  ExpeditionCheckItem,
  ExpeditionSchemeCheck,
} from '../../../../../features/expedition/expeditionCheck';

const EXPEDITION_REQ_RAWFILE = 'data/expedition_req.json';
const CHECK_DECK_IDS: number[] = [2, 3, 4];

// 三态配色：红=必定失败/条件不满足，绿=普通成功，金=必定大成功
const BADGE_BG_FAIL = '#4a2228';
const BADGE_FG_FAIL = '#ff9f9f';
const BADGE_BG_PASS = '#173f2a';
const BADGE_FG_PASS = '#b7f7c8';
const BADGE_BG_GOLD = '#3c3520';
const BADGE_FG_GOLD = '#ffd86b';

const CHECK_OK_COLOR = '#5fd08a';
const CHECK_FAIL_COLOR = '#ff6f78';
const BANNER_PASS_BG = '#1f6b3a';
const BANNER_FAIL_BG = '#c4404a';
const BANNER_GOLD_BG = '#8a6c1c';
const BANNER_NEUTRAL_BG = '#3a4060';
const SCHEME_CHIP_BG = '#2a2e44';

interface AreaFilterDef {
  area: number;
  label: string;
}

const AREA_FILTERS: AreaFilterDef[] = [
  { area: 0, label: '全' },
  { area: 1, label: '1' },
  { area: 2, label: '2' },
  { area: 3, label: '3' },
  { area: 7, label: '7' },
  { area: 4, label: '4' },
  { area: 5, label: '5' },
  { area: -1, label: '他' },
];

function resultKey(req: ExpeditionRequirement, deckId: number, stateVersion: number): string {
  return `${req.id}-${deckId}-${stateVersion}`;
}

@ComponentV2
export default struct ExpeditionCheckPanel {
  @Param compact: boolean = false;

  @Local private requirements: ExpeditionRequirement[] = [];
  @Local private visible: ExpeditionRequirement[] = [];
  @Local private activeArea: number = 0;
  @Local private loadError: string = '';
  @Local private stateVersion: number = 0;
  @Local private detailReq: ExpeditionRequirement | null = null;
  @Local private detailDeckId: number = 0;

  private unsubscribe: (() => void) | null = null;

  aboutToAppear(): void {
    void this.loadRequirements();
    this.unsubscribe = subscribeGameState((changeType: StateChangeType, _state) => {
      if (changeType === 'all' || changeType === 'ships' || changeType === 'decks') {
        this.stateVersion++;
        this.applyFilter();
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
    this.applyFilter();
  }

  private applyFilter(): void {
    if (this.activeArea === 0) {
      this.visible = this.requirements.slice();
    } else if (this.activeArea === -1) {
      this.visible = this.requirements.filter((req: ExpeditionRequirement): boolean => !isKnownExpeditionArea(req.area));
    } else {
      this.visible = this.requirements.filter((req: ExpeditionRequirement): boolean => req.area === this.activeArea);
    }
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
      return this.missingText(result);
    }
    if (result.bigSuccess.ok) {
      return '大成功';
    }
    if (result.bigSuccess.rate > 0) {
      return `大成功${formatBigSuccessRate(result.bigSuccess.rate)}`;
    }
    return '可成功';
  }

  private deckBadgeNote(req: ExpeditionRequirement, deckId: number): string {
    const result = this.check(req, deckId);
    if (!result.ok) return '';
    return result.bigSuccess.note;
  }

  private deckBadgeBg(req: ExpeditionRequirement, deckId: number): string {
    const result = this.check(req, deckId);
    if (!result.ok) return BADGE_BG_FAIL;
    return result.bigSuccess.ok ? BADGE_BG_GOLD : BADGE_BG_PASS;
  }

  private deckBadgeFg(req: ExpeditionRequirement, deckId: number): string {
    const result = this.check(req, deckId);
    if (!result.ok) return BADGE_FG_FAIL;
    return result.bigSuccess.ok ? BADGE_FG_GOLD : BADGE_FG_PASS;
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
      .onClick(() => {
        this.activeArea = filter.area;
        this.applyFilter();
      })
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
    .onClick(() => {
      this.detailReq = req;
      this.detailDeckId = deckId;
    })
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

  @Builder private DetailHeader(req: ExpeditionRequirement): void {
    Row({ space: 6 }) {
      Text('‹ 返回')
        .fontSize(PanelDimens.fontLg)
        .fontColor(PanelColors.txtTabOn)
        .padding({ left: 8, right: 6, top: 4, bottom: 4 })
        .onClick(() => {
          this.detailReq = null;
          this.detailDeckId = 0;
        })

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

      Text(`第${this.detailDeckId}舰队`)
        .fontSize(PanelDimens.fontSm)
        .fontColor(PanelColors.txtMuted)
        .margin({ right: 8 })
    }
    .width('100%')
    .height(28)
    .alignItems(VerticalAlign.Center)
    .backgroundColor(PanelColors.bgTabs)
    .borderWidth({ bottom: PanelDimens.borderW })
    .borderColor(PanelColors.rowBorder)
  }

  @Builder private SectionBanner(title: string, ok: boolean, bg: string): void {
    Row({ space: 6 }) {
      Text(ok ? '☑' : '☐')
        .fontSize(PanelDimens.fontMd)
        .fontColor('#ffffff')
      Text(title)
        .fontSize(PanelDimens.fontMd)
        .fontWeight(FontWeight.Medium)
        .fontColor('#ffffff')
    }
    .width('100%')
    .padding({ left: 8, right: 8, top: 6, bottom: 6 })
    .backgroundColor(bg)
    .borderRadius(PanelDimens.radius)
  }

  @Builder private SchemeFlow(item: ExpeditionCheckItem): void {
    Flex({ wrap: FlexWrap.Wrap, alignItems: ItemAlign.Center }) {
      Text(`${item.label}: `)
        .fontSize(PanelDimens.fontMd)
        .fontColor(item.ok ? PanelColors.txtPrimary : BADGE_FG_FAIL)
        .margin({ top: 2, bottom: 2, right: 2 })
      ForEach(item.schemes, (scheme: ExpeditionSchemeCheck, idx: number) => {
        if (idx > 0) {
          Text('or')
            .fontSize(PanelDimens.fontSm)
            .fontColor(PanelColors.txtMuted)
            .margin({ left: 4, right: 4, top: 2, bottom: 2 })
        }
        Text(scheme.text)
          .fontSize(PanelDimens.fontSm)
          .fontColor(scheme.ok ? CHECK_OK_COLOR : CHECK_FAIL_COLOR)
          .padding({ left: 5, right: 5, top: 2, bottom: 2 })
          .backgroundColor(SCHEME_CHIP_BG)
          .borderRadius(PanelDimens.radius)
          .margin({ top: 2, bottom: 2 })
      }, (scheme: ExpeditionSchemeCheck, idx: number) => `scheme-${idx}-${scheme.ok}`)
    }
    .layoutWeight(1)
  }

  @Builder private CheckItemRow(item: ExpeditionCheckItem): void {
    Row({ space: 6 }) {
      Text(item.ok ? '☑' : '☐')
        .fontSize(PanelDimens.fontMd)
        .fontColor(item.ok ? CHECK_OK_COLOR : CHECK_FAIL_COLOR)
      if (item.schemes.length > 0) {
        this.SchemeFlow(item)
      } else {
        Text(item.label)
          .fontSize(PanelDimens.fontMd)
          .fontColor(item.ok ? PanelColors.txtPrimary : BADGE_FG_FAIL)
          .layoutWeight(1)
      }
    }
    .width('100%')
    .padding({ left: 8, right: 8, top: 7, bottom: 7 })
    .alignItems(VerticalAlign.Top)
    .backgroundColor(PanelColors.bgSection)
    .borderWidth({ bottom: PanelDimens.borderW })
    .borderColor(PanelColors.rowBorder)
  }

  @Builder private DetailBody(result: ExpeditionCheckResult): void {
    Column({ space: 8 }) {
      this.SectionBanner(
        result.ok ? '常规检查: 通过' : '常规检查: 未通过',
        result.ok,
        result.ok ? BANNER_PASS_BG : BANNER_FAIL_BG,
      )
      Column() {
        ForEach(result.items, (item: ExpeditionCheckItem) => {
          this.CheckItemRow(item)
        }, (item: ExpeditionCheckItem, idx: number) => `chk-${idx}-${item.ok}`)
      }
      .width('100%')
      .borderRadius(PanelDimens.radius)
      .clip(true)

      this.SectionBanner(
        result.bigSuccess.ok
          ? '大成功判定: 必定大成功'
          : `大成功判定: ${formatBigSuccessRate(result.bigSuccess.rate)}`,
        result.bigSuccess.ok,
        result.bigSuccess.ok ? BANNER_GOLD_BG : BANNER_NEUTRAL_BG,
      )
      Column() {
        ForEach(result.bigSuccess.items, (item: ExpeditionCheckItem) => {
          this.CheckItemRow(item)
        }, (item: ExpeditionCheckItem, idx: number) => `big-${idx}-${item.ok}`)
      }
      .width('100%')
      .borderRadius(PanelDimens.radius)
      .clip(true)
    }
    .width('100%')
    .padding(8)
  }

  @Builder private DetailRoot(req: ExpeditionRequirement): void {
    Column() {
      this.DetailHeader(req)
      Scroll() {
        Column() {
          ForEach([this.stateVersion], (_v: number) => {
            this.DetailBody(this.check(req, this.detailDeckId))
          }, (v: number) => `detail-${req.id}-${this.detailDeckId}-${v}`)
        }
        .width('100%')
      }
      .layoutWeight(1)
      .width('100%')
      .scrollBar(BarState.Off)
      .edgeEffect(EdgeEffect.None)
    }
    .width('100%')
    .layoutWeight(1)
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
      if (this.detailReq !== null) {
        this.DetailRoot(this.detailReq!)
      } else {
        this.AreaBar()

        Scroll() {
          Column() {
            if (this.visible.length > 0) {
              ForEach(this.visible, (req: ExpeditionRequirement) => {
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
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.compact ? PanelColors.overlayBg : PanelColors.bg)
  }
}
