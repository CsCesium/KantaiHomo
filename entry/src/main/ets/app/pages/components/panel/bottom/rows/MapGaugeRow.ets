import { PanelColors, PanelDimens } from '../../../../../../features/panel/panelConfig';
import { MapGaugeSnapshot } from '../../../../../../features/state';
import {
  getMapGaugeInfo,
  getMapGaugeBarValues,
  shouldShowMapGaugeBar,
  isGridStyleMapGauge,
  rangeIndices,
} from './shipHelpers';

/** 进度条/格子的固定颜色 —— 不随比例变化。 */
const BAR_FILL_COLOR: string = PanelColors.stat;
const BAR_TRACK_COLOR: string = PanelColors.overlayRow;

/**
 * 地图 Gauge 行（FloatOverlay 模式下紧凑布局）。
 *
 * 显示规则：
 * - 活动海图：hpNow/hpMax 数值 + 线性 HP 条
 * - EO 月度海域 (requiredDefeats ≥ 10)：defeatCount/requiredDefeats + 线性击破条
 * - EO 月度海域 (requiredDefeats < 10)：defeatCount/requiredDefeats + 格子风格
 *   每格代表 1 次击破，达成的格子填色，未达成的格子留底色
 */
@ComponentV2
export default struct MapGaugeRow {
  @Param gauge: MapGaugeSnapshot = {
    mapId: 0, cleared: false, defeatCount: 0,
    gaugeType: null, gaugeNum: 0,
    hpNow: null, hpMax: null,
    requiredDefeats: null, capturedAt: 0,
  };

  @Builder
  GridBar() {
    Row({ space: 2 }) {
      ForEach(rangeIndices(this.gauge.requiredDefeats ?? 0), (i: number) => {
        Row()
          .layoutWeight(1)
          .height(PanelDimens.hpBarCompH + 2)
          .borderRadius(2)
          .backgroundColor(i < this.gauge.defeatCount ? BAR_FILL_COLOR : BAR_TRACK_COLOR)
      }, (i: number) => `cell-${this.gauge.mapId}-${this.gauge.gaugeNum}-${i}`)
    }
    .width('100%')
  }

  @Builder
  LinearBar() {
    Progress({
      value: getMapGaugeBarValues(this.gauge).value,
      total: getMapGaugeBarValues(this.gauge).total,
      type: ProgressType.Linear,
    })
      .width('100%')
      .height(PanelDimens.hpBarCompH)
      .color(BAR_FILL_COLOR)
      .backgroundColor(BAR_TRACK_COLOR)
  }

  build() {
    Column({ space: 3 }) {
      Row() {
        Text(getMapGaugeInfo(this.gauge).label)
          .fontSize(PanelDimens.fontMd)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.gauge.cleared ? PanelColors.txtMuted : PanelColors.txtPrimary)
          .layoutWeight(1)

        // 数值显示：活动 HP / EO 击破计数 / 单纯击破数
        if (this.gauge.hpMax !== null) {
          Text(`${getMapGaugeInfo(this.gauge).hpNow}/${getMapGaugeInfo(this.gauge).hpMax}`)
            .fontSize(PanelDimens.fontMd)
            .fontColor(BAR_FILL_COLOR)
        } else if (this.gauge.requiredDefeats !== null && this.gauge.requiredDefeats > 0) {
          Text(`${this.gauge.defeatCount}/${this.gauge.requiredDefeats}`)
            .fontSize(PanelDimens.fontMd)
            .fontColor(BAR_FILL_COLOR)
        } else {
          Text(`x${this.gauge.defeatCount}`)
            .fontSize(PanelDimens.fontMd)
            .fontColor(PanelColors.stat)
        }

        Text(this.gauge.cleared ? ' ✓' : ` ${getMapGaugeInfo(this.gauge).gaugeLabel}`)
          .fontSize(PanelDimens.fontSm)
          .fontColor(this.gauge.cleared ? PanelColors.stat : PanelColors.txtSub)
          .margin({ left: 4 })
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)

      if (shouldShowMapGaugeBar(this.gauge)) {
        if (isGridStyleMapGauge(this.gauge)) {
          this.GridBar()
        } else {
          this.LinearBar()
        }
      }
    }
    .width('100%')
    .height(PanelDimens.rowCompH)
    .padding({ left: 8, right: 8, top: 4, bottom: 4 })
    .justifyContent(FlexAlign.Center)
    .borderWidth({ bottom: PanelDimens.borderW })
    .borderColor(PanelColors.overlayRow)
  }
}
