import { ShipItem } from '../../../../../../features/panel/type';
import { ShipDiems } from '../../../../../../features/panel/panelConfig';

/**
 * Ship banner display: background image + readability overlay layers
 * + flagship special-attack badge + ship name & level on the bottom-right.
 */
@ComponentV2
export default struct ShipBannerBlock {
  @Param ship: ShipItem = {
    id: 0, masterId: 0, name: '', shipType: '', level: 0,
    hp: 0, hpMax: 1, s1: 0, s2: 0, s3: 0, s4: 0,
    fuelMax: 0, ammoMax: 0,
    slots: [], slotTypes: [], slotIconTypes: [], slotAirs: [], slotLevels: [], slotAlvs: [],
    exSlot: 0, exSlotType: 0, exSlotIconType: 0, exSlotLevel: 0, exSlotAlv: 0,
  };
  @Param isFlag: boolean = false;
  /** Special-attack short label; empty string hides the badge. */
  @Param specialAttack: string = '';

  private resolveBannerSource(): ResourceStr {
    // 真实图后续接入；当前回退为测试 banner。
    return $rawfile('test/remodel.png');
  }

  build() {
    Stack() {
      // 第 1 层：背景 Banner 图（998×182 测试图，Cover 裁切）
      Image(this.resolveBannerSource())
        .width('100%')
        .height('100%')
        .objectFit(ImageFit.Cover)
        .borderRadius(ShipDiems.SHIP_BANNER_RADIUS)

      // 第 2 层：全局轻遮罩，避免白色文字在亮色背景上看不清
      Row()
        .width('100%')
        .height('100%')
        .borderRadius(ShipDiems.SHIP_BANNER_RADIUS)
        .backgroundColor('#18000000')

      // 第 3 层：右侧暗区（舰名/Lv 都靠右下，加点暗色提升可读性）
      Row() {
        Blank()
          .layoutWeight(1)

        Row()
          .width('58%')
          .height('100%')
          .backgroundColor('#30000000')
      }
      .width('100%')
      .height('100%')
      .borderRadius(ShipDiems.SHIP_BANNER_RADIUS)

      // 第 4 层：底部暗带（舰名 / Lv 偏下方）
      Column() {
        Blank()
          .layoutWeight(1)

        Row()
          .width('100%')
          .height('55%')
          .backgroundColor('#50000000')
      }
      .width('100%')
      .height('100%')
      .borderRadius(ShipDiems.SHIP_BANNER_RADIUS)

      // 第 5 层：左上角特殊攻击徽章（仅旗舰且有可触发的特攻时显示）
      Column() {
        Row() {
          if (this.isFlag && this.specialAttack !== '') {
            Text(`⚡ ${this.specialAttack}`)
              .fontSize(8)
              .fontColor('#FFD700')
              .backgroundColor('#661a1525')
              .padding({ left: 4, right: 4, top: 1, bottom: 1 })
              .borderRadius(2)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
          }

          Blank()
            .layoutWeight(1)
        }
        .width('100%')

        Blank()
          .layoutWeight(1)
      }
      .width('100%')
      .height('100%')
      .padding({ left: 6, right: 6, top: 5, bottom: 5 })

      // 第 6 层：舰名 + Lv，靠右下贴近角，不上下分散
      Column() {
        Blank()
          .layoutWeight(1)

        Row() {
          Blank()
            .layoutWeight(1)

          Column({ space: 0 }) {
            Text(this.ship.name)
              .fontSize(ShipDiems.SHIP_BANNER_NAME_FONT)
              .fontWeight(FontWeight.Bold)
              .fontColor('#FFFFFF')
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })

            Text(`Lv. ${this.ship.level}`)
              .fontSize(ShipDiems.SHIP_BANNER_LEVEL_FONT)
              .fontWeight(FontWeight.Medium)
              .fontColor('#EEEEEE')
              .backgroundColor('#52000000')
              .padding({ left: 5, right: 5, top: 1, bottom: 1 })
              .borderRadius(3)
              .maxLines(1)
          }
          .alignItems(HorizontalAlign.End)
        }
        .width('100%')
        .alignItems(VerticalAlign.Bottom)
      }
      .width('100%')
      .height('100%')
      .padding({ left: 8, right: 8, top: 6, bottom: 6 })
    }
    .width('100%')
    .height('100%')
    .borderRadius(ShipDiems.SHIP_BANNER_RADIUS)
    .clip(true)
  }
}
