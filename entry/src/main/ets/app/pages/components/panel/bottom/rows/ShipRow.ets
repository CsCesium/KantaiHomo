import { PanelPopupStateChangeEvent, ShipItem } from '../../../../../../features/panel/type';
import { PanelColors, PanelDimens, ShipDiems } from '../../../../../../features/panel/panelConfig';
import { isShipEscaped } from '../../../../../../features/state';
import ShipBannerBlock from './ShipBannerBlock';
import ShipStatusBlock from './ShipStatusBlock';
import ShipEquipBlock from './ShipEquipBlock';
import { ShipScenarioPanel } from '../../ShipScenarioPanel';

/**
 * 舰娘行：左 Banner + 中 HP/状态 + 右 装备列。
 *
 * - 左中右使用 layoutWeight 5/3/5 分配宽度
 * - 行高固定为 SHIP_ROW_HEIGHT
 * - 装备槽弹窗的"当前展开槽 uid"由父面板用 detailUid 集中持有；具体的
 *   row 数据由 EquipSlot 内部按需加载，不在 @Param 链路里透传。
 * - 双击舰名 Banner 区域弹出战斗场景估算面板（昼战/雷击/夜战），
 *   开合状态行内自持，点击面板外区域自动关闭。
 */
@ComponentV2
export default struct ShipRow {
  @Param ship: ShipItem = {
    id: 0, masterId: 0, name: '', shipType: '', level: 0,
    expToNext: 0,
    tags: [],
    hp: 0, hpMax: 1, s1: 0, s2: 0, s3: 0, s4: 0, range: 0,
    fuelMax: 0, ammoMax: 0,
    slots: [], slotMasterIds: [], slotTypes: [], slotIconTypes: [], slotAirs: [], slotLevels: [], slotAlvs: [],
    exSlot: 0, exSlotMasterId: 0, exSlotType: 0, exSlotIconType: 0, exSlotLevel: 0, exSlotAlv: 0,
  };
  @Param isFlag: boolean = false;
  @Param specialAttacks: string[] = [];

  @Param showAvatar: boolean = true;
  @Param showKaisyuu: boolean = true;
  @Param showProficiency: boolean = true;
  @Param detailUid: number = 0;

  @Event onOpenDetail: (uid: number) => void = () => {};
  @Event onCloseDetail: (uid: number) => void = () => {};

  /** 战斗场景估算弹窗是否展开（双击舰名区域切换）。 */
  @Local scenarioOpen: boolean = false;

  @Builder ScenarioPopup() {
    ShipScenarioPanel({ uid: this.ship.id })
  }

  build() {
    Stack() {
      Row({ space: 8 }) {
        // 左列：身份 Banner（双击弹出战斗场景估算面板）
        Row() {
          ShipBannerBlock({
            ship: this.ship,
            isFlag: this.isFlag,
            specialAttacks: this.specialAttacks,
            showAvatar: this.showAvatar,
          })
        }
        .layoutWeight(5)
        .constraintSize({ minWidth: 0 })
        .gesture(
          TapGesture({ count: 2 })
            .onAction(() => { this.scenarioOpen = !this.scenarioOpen; })
        )
        .bindPopup(this.scenarioOpen, {
          builder: this.ScenarioPopup,
          placement: Placement.Top,
          enableArrow: true,
          onStateChange: (e: PanelPopupStateChangeEvent) => {
            if (!e.isVisible && this.scenarioOpen) {
              this.scenarioOpen = false;
            }
          },
        })

        // 中列：HP / 状态 / 进度条
        Row() {
          ShipStatusBlock({ ship: this.ship })
        }
        .layoutWeight(3)
        .constraintSize({ minWidth: 0 })

        Row() {
          ShipEquipBlock({
            ship: this.ship,
            showKaisyuu: this.showKaisyuu,
            showProficiency: this.showProficiency,
            detailUid: this.detailUid,
            onOpenDetail: (u: number) => this.onOpenDetail(u),
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
      .height('100%')
      .padding({ left: 8, right: 8, top: 4, bottom: 4 })
      .alignItems(VerticalAlign.Center)

      if (isShipEscaped(this.ship.id)) {
        Row()
          .width('100%')
          .height('100%')
          .backgroundColor(PanelColors.escapeOverlay)
          .enabled(false)
      }
    }
    .width('100%')
    .height(ShipDiems.SHIP_ROW_HEIGHT)
    .borderWidth({ bottom: PanelDimens.borderW })
    .borderColor(PanelColors.overlayRow)
  }
}
