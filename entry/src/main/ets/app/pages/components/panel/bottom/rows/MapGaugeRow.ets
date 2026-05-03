import { PanelColors, PanelDimens } from '../../../../../../features/panel/panelConfig';
import { MapGaugeSnapshot } from '../../../../../../features/state';
import { getMapGaugeInfo, getMapGaugeBarValues, shouldShowMapGaugeBar } from './shipHelpers';

/**
 * 地图 Gauge 行（FloatOverlay 模式下紧凑布局）。
 *
 * 显示规则：
 * - 活动海图：hpNow/hpMax 数值 + HP 进度条
 * - EO 月度海域：defeatCount/requiredDefeats 数值 + 击破进度条
 *   （没有 requiredDefeats 时退化为单纯的 x{count}，无进度条）
 */
@ComponentV2
export default struct MapGaugeRow {
  @Param gauge: MapGaugeSnapshot = {
    mapId: 0, cleared: false, defeatCount: 0,
    gaugeType: null, gaugeNum: 0,
    hpNow: null, hpMax: null,
    requiredDefeats: null, capturedAt: 0,
  };

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
            .fontColor(getMapGaugeInfo(this.gauge).barColor)
        } else if (this.gauge.requiredDefeats !== null && this.gauge.requiredDefeats > 0) {
          Text(`${this.gauge.defeatCount}/${this.gauge.requiredDefeats}`)
            .fontSize(PanelDimens.fontMd)
            .fontColor(getMapGaugeBarValues(this.gauge).color)
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

      // 进度条：活动按 HP，EO 按击破计数
      if (shouldShowMapGaugeBar(this.gauge)) {
        Progress({
          value: getMapGaugeBarValues(this.gauge).value,
          total: getMapGaugeBarValues(this.gauge).total,
          type: ProgressType.Linear,
        })
          .width('100%')
          .height(PanelDimens.hpBarCompH)
          .color(getMapGaugeBarValues(this.gauge).color)
          .backgroundColor(PanelColors.overlayRow)
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
