import { PanelPopupStateChangeEvent } from '../../../../../../features/panel/type';
import { equipLabel, isAircraftEquipType, kaisyuuIcon, airMasteryIcon } from '../../../../../../features/panel/panelConfig';
import { SlotItemJoinedRow } from '../../../../../../infra/storage/types';
import { getPersistDeps } from '../../../../../../infra/deps';
import { EquipDetailPanel } from '../../EquipDetailPanel';

/**
 * 单个装备槽：装备图标 + 改修星 + 熟练度 + 携带机数 + 长按弹出详情。
 *
 * 弹窗的"哪一个槽当前展开"由父组件用 detailUid 集中持有，确保同时只有一个
 * 槽的弹窗可见。具体的 row 数据则在槽内部按需加载（@Local），避免通过多层
 * @Param 透传复合对象 —— V2 里 @Builder 注册到 bindPopup 后，深层透传的
 * @Param 复合对象更新不一定能触发重绘，会出现一直停在"加载中"的问题。
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

  /** 当前已打开详情的槽位 uid（0 = 未打开任何弹窗），由父组件持有。 */
  @Param detailUid: number = 0;

  @Event onOpen: (uid: number) => void = () => {};
  @Event onToggle: (uid: number) => void = () => {};
  @Event onClose: (uid: number) => void = () => {};

  /** 本槽弹窗当前已加载的装备详情；只在本槽是当前展开槽时才有效。 */
  @Local row: SlotItemJoinedRow | null = null;
  /** 标记当前正在加载的请求，避免快速切换槽时旧请求覆盖新数据。 */
  private loadingForUid: number = 0;

  @Monitor('detailUid')
  onDetailUidChange(): void {
    if (this.detailUid === this.uid && this.uid > 0) {
      void this.loadRow();
    } else {
      this.row = null;
      this.loadingForUid = 0;
    }
  }

  private async loadRow(): Promise<void> {
    const targetUid = this.uid;
    this.loadingForUid = targetUid;
    this.row = null;
    try {
      const repo = getPersistDeps()?.repos?.slotitem;
      if (!repo) return;
      const loaded = await repo.getWithMaster(targetUid);
      if (this.loadingForUid === targetUid && this.detailUid === targetUid) {
        this.row = loaded;
      }
    } catch (_e) { /* ignore */ }
  }

  @Builder EquipPopup() {
    EquipDetailPanel({ row: this.row })
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
