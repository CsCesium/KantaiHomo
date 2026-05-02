import { PanelColors, PanelDimens } from '../../../../../../features/panel/panelConfig';
import { MapGaugeSnapshot } from '../../../../../../features/state';
import { getMapGaugeInfo } from './shipHelpers';

/** 地图 Gauge 行（FloatOverlay 模式下 4 行紧凑布局）。 */
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
        if (this.gauge.hpMax !== null) {
          Text(`${getMapGaugeInfo(this.gauge).hpNow}/${getMapGaugeInfo(this.gauge).hpMax}`)
            .fontSize(PanelDimens.fontMd)
            .fontColor(getMapGaugeInfo(this.gauge).barColor)
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

      if (this.gauge.hpMax !== null && this.gauge.hpMax > 0) {
        Progress({
          value: getMapGaugeInfo(this.gauge).hpNow,
          total: getMapGaugeInfo(this.gauge).hpMax,
          type: ProgressType.Linear,
        })
          .width('100%')
          .height(PanelDimens.hpBarCompH)
          .color(getMapGaugeInfo(this.gauge).barColor)
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
