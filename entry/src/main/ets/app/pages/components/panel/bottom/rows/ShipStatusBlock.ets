import { ShipItem } from '../../../../../../features/panel/type';
import { hpColor, PanelColors, ShipDiems } from '../../../../../../features/panel/panelConfig';
import { getShipStatusText, getShipStatusColor } from './shipHelpers';

/** 中列：HP 数值 / 状态文字 / HP 进度条。 */
@ComponentV2
export default struct ShipStatusBlock {
  @Param ship: ShipItem = {
    id: 0, masterId: 0, name: '', shipType: '', level: 0,
    hp: 0, hpMax: 1, s1: 0, s2: 0, s3: 0, s4: 0,
    fuelMax: 0, ammoMax: 0,
    slots: [], slotTypes: [], slotIconTypes: [], slotAirs: [], slotLevels: [], slotAlvs: [],
    exSlot: 0, exSlotType: 0, exSlotIconType: 0, exSlotLevel: 0, exSlotAlv: 0,
  };

  build() {
    Column({ space: 4 }) {
      Row() {
        // 左侧：当前 HP / 最大 HP
        Text(`${this.ship.hp} / ${this.ship.hpMax}`)
          .fontSize(ShipDiems.SHIP_HP_FONT)
          .fontWeight(FontWeight.Medium)
          .fontColor(hpColor(this.ship.hp, this.ship.hpMax))
          .maxLines(1)

        Blank()
          .layoutWeight(1)

        // 右侧：状态（cond / 退避）
        Text(getShipStatusText(this.ship))
          .fontSize(ShipDiems.SHIP_STATUS_FONT)
          .fontWeight(FontWeight.Medium)
          .fontColor(getShipStatusColor(this.ship))
          .maxLines(1)
          .textAlign(TextAlign.End)
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)

      // HP 线性进度条
      Progress({
        value: this.ship.hp,
        total: this.ship.hpMax > 0 ? this.ship.hpMax : 1,
        type: ProgressType.Linear,
      })
        .width('100%')
        .height(ShipDiems.SHIP_HP_BAR_HEIGHT)
        .color(hpColor(this.ship.hp, this.ship.hpMax))
        .backgroundColor(PanelColors.overlayRow)
    }
    .width('100%')
    .justifyContent(FlexAlign.Center)
  }
}
