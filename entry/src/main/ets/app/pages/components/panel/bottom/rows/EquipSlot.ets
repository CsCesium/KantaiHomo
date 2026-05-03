import { PanelPopupStateChangeEvent } from '../../../../../../features/panel/type';
import { equipLabel, isAircraftEquipType, kaisyuuIcon, airMasteryIcon } from '../../../../../../features/panel/panelConfig';
import { SlotItemJoinedRow } from '../../../../../../infra/storage/types';
import { EquipDetailPanel } from '../../EquipDetailPanel';

/**
 * 单个装备槽：装备图标 + 改修星 + 熟练度 + 携带机数 + 长按弹出详情。
 *
 * 详情弹窗的可见状态由父组件持有（detailUid / detailRow），
 * 子组件通过 onOpen / onToggle / onClose 回调通知父组件状态变更，
 * 这样同一面板内多个槽共享同一弹窗实例。
 */
@ComponentV2
export default struct EquipSlot {
  @Param uid: number = 0;
  @Param iconType: number = 0;
  @Param equipType: number = 0;
  @Param air: number = 0;
  @Param level: number = 0;
  @Param alv: number = 0;
  @Param slotSize: number = 16;
  @Param tagSize: number = 10;
  @Param isExSlot: boolean = false;

  @Param showKaisyuu: boolean = true;
  @Param showProficiency: boolean = true;

  /** 当前已打开详情的槽位 uid（0 = 未打开任何弹窗）。 */
  @Param detailUid: number = 0;
  /** 已加载的装备详细数据（仅当本槽就是当前打开的弹窗时有效）。 */
  @Param detailRow: SlotItemJoinedRow | null = null;

  @Event onOpen: (uid: number) => void = () => {};
  @Event onToggle: (uid: number) => void = () => {};
  @Event onClose: (uid: number) => void = () => {};

  @Builder EquipPopup() {
    EquipDetailPanel({ row: this.detailRow })
  }

  build() {
    Stack() {
      Image(equipLabel(this.iconType))
        .width(this.slotSize)
        .height(this.slotSize)
        .padding(1)
      if (this.showKaisyuu && this.level > 0 && kaisyuuIcon(this.level) !== null) {
        Image(kaisyuuIcon(this.level)!)
          .width(Math.floor(this.tagSize * 1.8))
          .height(Math.floor(this.tagSize * 0.6))
          .position({ top: 0, right: 0 })
      }
      if (this.showProficiency && this.alv > 0 && airMasteryIcon(this.alv) !== null) {
        Image(airMasteryIcon(this.alv)!)
          .width(Math.floor(this.tagSize * 0.7))
          .height(Math.floor(this.tagSize * 0.7))
          .position({ bottom: 0, left: 0 })
      }
      if (isAircraftEquipType(this.equipType) && this.air > 0) {
        Text(`${this.air}`)
          .fontSize(this.slotSize >= 14 ? 7 : 6)
          .fontColor('#ffffff')
          .backgroundColor('#cc000000')
          .borderRadius(2)
          .padding({ left: 1, right: 1 })
          .position({ bottom: 0, right: 0 })
      }
    }
    .width(this.slotSize)
    .height(this.slotSize)
    .borderRadius(2)
    .backgroundColor(this.isExSlot ? '#1a2855' : '#252940')
    .gesture(
      LongPressGesture({ repeat: false, duration: 400 })
        .onAction(() => { this.onOpen(this.uid); })
    )
    .onClick(() => { this.onToggle(this.uid); })
    .bindPopup(this.detailUid === this.uid, {
      builder: this.EquipPopup,
      placement: Placement.Top,
      enableArrow: true,
      onStateChange: (e: PanelPopupStateChangeEvent) => {
        if (!e.isVisible && this.detailUid === this.uid) {
          this.onClose(this.uid);
        }
      },
    })
  }
}
