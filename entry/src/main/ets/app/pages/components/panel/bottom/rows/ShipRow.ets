import { ShipItem } from '../../../../../../features/panel/type';
import { PanelColors, PanelDimens, ShipDiems } from '../../../../../../features/panel/panelConfig';
import ShipBannerBlock from './ShipBannerBlock';
import ShipStatusBlock from './ShipStatusBlock';
import ShipEquipBlock from './ShipEquipBlock';

/**
 * 舰娘行：左 Banner + 中 HP/状态 + 右 装备列。
 *
 * - 左中右使用 layoutWeight 5/3/5 分配宽度
 * - 行高固定为 SHIP_ROW_HEIGHT，纵向居中对齐三列
 * - 装备槽弹窗的"当前展开槽 uid"由父面板用 detailUid 集中持有；具体的
 *   row 数据由 EquipSlot 内部按需加载，不在 @Param 链路里透传。
 */
@ComponentV2
export default struct ShipRow {
  @Param ship: ShipItem = {
    id: 0, masterId: 0, name: '', shipType: '', level: 0,
    hp: 0, hpMax: 1, s1: 0, s2: 0, s3: 0, s4: 0,
    fuelMax: 0, ammoMax: 0,
    slots: [], slotTypes: [], slotIconTypes: [], slotAirs: [], slotLevels: [], slotAlvs: [],
    exSlot: 0, exSlotType: 0, exSlotIconType: 0, exSlotLevel: 0, exSlotAlv: 0,
  };
  @Param isFlag: boolean = false;
  @Param specialAttack: string = '';

  @Param showKaisyuu: boolean = true;
  @Param showProficiency: boolean = true;
  @Param detailUid: number = 0;

  @Event onOpenDetail: (uid: number) => void = () => {};
  @Event onToggleDetail: (uid: number) => void = () => {};
  @Event onCloseDetail: (uid: number) => void = () => {};

  build() {
    Row({ space: 8 }) {
      // 左列：身份 Banner
      Row() {
        ShipBannerBlock({
          ship: this.ship,
          isFlag: this.isFlag,
          specialAttack: this.specialAttack,
        })
      }
      .layoutWeight(5)
      .constraintSize({ minWidth: 0 })

      // 中列：HP / 状态 / 进度条
      Row() {
        ShipStatusBlock({ ship: this.ship })
      }
      .layoutWeight(3)
      .constraintSize({ minWidth: 0 })

      // 右列：装备槽（不换行）
      Row() {
        ShipEquipBlock({
          ship: this.ship,
          showKaisyuu: this.showKaisyuu,
          showProficiency: this.showProficiency,
          detailUid: this.detailUid,
          onOpenDetail: (u: number) => this.onOpenDetail(u),
          onToggleDetail: (u: number) => this.onToggleDetail(u),
          onCloseDetail: (u: number) => this.onCloseDetail(u),
        })
      }
      .layoutWeight(5)
      .constraintSize({ minWidth: 0 })
      .height('100%')
      .alignItems(VerticalAlign.Center)
      .justifyContent(FlexAlign.Start)
    }
    .width('100%')
    .height(ShipDiems.SHIP_ROW_HEIGHT)
    .padding({ left: 8, right: 8, top: 4, bottom: 4 })
    .alignItems(VerticalAlign.Center)
    .borderWidth({ bottom: PanelDimens.borderW })
    .borderColor(PanelColors.overlayRow)
  }
}
