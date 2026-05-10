import { ShipItem } from '../../../../../../features/panel/type';
import { ShipDiems } from '../../../../../../features/panel/panelConfig';
import { getShipGraphFilename, getGameServerUrl } from '../../../../../../features/state';
import { getShipBannerUrl } from '../../../../../../features/game/shipGraph';
import ShipCapabilityTag from './ShipCapabilityTag';

/**
 * Ship banner display: background image + readability overlay layers
 * + flagship special-attack badge + ship name & level on the bottom-right.
 */
@ComponentV2
export default struct ShipBannerBlock {
  @Param ship: ShipItem = {
    id: 0, masterId: 0, name: '', shipType: '', level: 0,
    expToNext: 0,
    tags: [],
    hp: 0, hpMax: 1, s1: 0, s2: 0, s3: 0, s4: 0,
    fuelMax: 0, ammoMax: 0,
    slots: [], slotTypes: [], slotIconTypes: [], slotAirs: [], slotLevels: [], slotAlvs: [],
    exSlot: 0, exSlotType: 0, exSlotIconType: 0, exSlotLevel: 0, exSlotAlv: 0,
  };
  @Param isFlag: boolean = false;
  /** Special-attack short label; empty string hides the badge. */
  @Param specialAttack: string = '';

  /** Last URL that failed to load — suppresses retry loops on the same source. */
  @Local private failedBannerUrl: string = '';

  @Computed
  get bannerUrl(): string {
    const filename = getShipGraphFilename(this.ship.masterId);
    const serverBase = getGameServerUrl();
    if (!filename || !serverBase) return '';
    return getShipBannerUrl(this.ship.masterId, filename, serverBase);
  }

  @Computed
  get shouldUseRealBanner(): boolean {
    return this.bannerUrl.length > 0 && this.failedBannerUrl !== this.bannerUrl;
  }

  @Computed
  get capabilityTags(): string[] {
    const tags: string[] = [];
    if (this.isFlag && this.specialAttack !== '') {
      tags.push(this.specialAttack);
    }
    for (const tag of this.ship.tags) {
      tags.push(tag);
    }
    return tags;
  }

  build() {
    Stack() {
      // 第 1 层：背景 Banner 图。优先使用真实 remodel banner（基于
      // api_mst_shipgraph 文件名 + 当前服务器地址计算的 cipher URL），
      // 资源不可用或加载失败时回退到内置测试 banner。
      if (this.shouldUseRealBanner) {
        Image(this.bannerUrl)
          .width('100%')
          .height('100%')
          .objectFit(ImageFit.Cover)
          .borderRadius(ShipDiems.SHIP_BANNER_RADIUS)
          .onError(() => {
            this.failedBannerUrl = this.bannerUrl;
          })
      } else {
        Image($rawfile('test/remodel.png'))
          .width('100%')
          .height('100%')
          .objectFit(ImageFit.Cover)
          .borderRadius(ShipDiems.SHIP_BANNER_RADIUS)
      }

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

      // 第 5 层：舰名 + Lv/能力标签，靠右下贴近角
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

            Row({ space: 3 }) {
              ForEach(this.capabilityTags, (tag: string, idx: number) => {
                ShipCapabilityTag({ label: tag })
              }, (tag: string, idx: number) => `cap-${idx}-${tag}`)

              Text(`Lv. ${this.ship.level}`)
                .fontSize(ShipDiems.SHIP_BANNER_LEVEL_FONT)
                .fontWeight(FontWeight.Medium)
                .fontColor('#EEEEEE')
                .backgroundColor('#52000000')
                .padding({ left: 5, right: 5, top: 1, bottom: 1 })
                .borderRadius(3)
                .maxLines(1)

              Text(`next: ${this.ship.expToNext}`)
                .fontSize(ShipDiems.SHIP_BANNER_LEVEL_FONT)
                .fontWeight(FontWeight.Medium)
                .fontColor('#EEEEEE')
                .backgroundColor('#52000000')
                .padding({ left: 5, right: 5, top: 1, bottom: 1 })
                .borderRadius(3)
                .maxLines(1)
            }
            .alignItems(VerticalAlign.Center)
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
