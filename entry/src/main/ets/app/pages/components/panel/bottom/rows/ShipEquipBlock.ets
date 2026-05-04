import { ShipItem } from '../../../../../../features/panel/type';
import { ShipDiems } from '../../../../../../features/panel/panelConfig';
import EquipSlot from './EquipSlot';
import { numAt } from './shipHelpers';

/** 右列：单行装备槽列表（不换行），左对齐。 */
@ComponentV2
export default struct ShipEquipBlock {
  @Param ship: ShipItem = {
    id: 0, masterId: 0, name: '', shipType: '', level: 0,
    hp: 0, hpMax: 1, s1: 0, s2: 0, s3: 0, s4: 0,
    fuelMax: 0, ammoMax: 0,
    slots: [], slotTypes: [], slotIconTypes: [], slotAirs: [], slotLevels: [], slotAlvs: [],
    exSlot: 0, exSlotType: 0, exSlotIconType: 0, exSlotLevel: 0, exSlotAlv: 0,
  };

  @Param showKaisyuu: boolean = true;
  @Param showProficiency: boolean = true;
  @Param detailUid: number = 0;

  @Event onOpenDetail: (uid: number) => void = () => {};
  @Event onToggleDetail: (uid: number) => void = () => {};
  @Event onCloseDetail: (uid: number) => void = () => {};

  build() {
    Row({ space: 2 }) {
      ForEach(this.ship.slots, (uid: number, idx: number) => {
        if (uid > 0) {
          EquipSlot({
            uid,
            iconType: numAt(this.ship.slotIconTypes, idx),
            equipType: numAt(this.ship.slotTypes, idx),
            air: numAt(this.ship.slotAirs, idx),
            level: numAt(this.ship.slotLevels, idx),
            alv: numAt(this.ship.slotAlvs, idx),
            slotSize: ShipDiems.SHIP_EQUIP_ICON_SIZE,
            tagSize: ShipDiems.SHIP_TAG_SIZE,
            isExSlot: false,
            showKaisyuu: this.showKaisyuu,
            showProficiency: this.showProficiency,
            detailUid: this.detailUid,
            onOpen: (u: number) => this.onOpenDetail(u),
            onToggle: (u: number) => this.onToggleDetail(u),
            onClose: (u: number) => this.onCloseDetail(u),
          })
        } else {
          // 空槽占位
          Row()
            .width(ShipDiems.SHIP_EQUIP_ICON_SIZE)
            .height(ShipDiems.SHIP_EQUIP_ICON_SIZE)
            .borderRadius(2)
            .backgroundColor('#55c8cce0')
        }
      }, (uid: number, idx: number) => `sl-${idx}-${uid}`)

      if (this.ship.exSlot > 0) {
        EquipSlot({
          uid: this.ship.exSlot,
          iconType: this.ship.exSlotIconType,
          equipType: this.ship.exSlotType,
          air: 0,
          level: this.ship.exSlotLevel,
          alv: this.ship.exSlotAlv,
          slotSize: ShipDiems.SHIP_EQUIP_ICON_SIZE,
          tagSize: ShipDiems.SHIP_TAG_SIZE,
          isExSlot: true,
          showKaisyuu: this.showKaisyuu,
          showProficiency: this.showProficiency,
          detailUid: this.detailUid,
          onOpen: (u: number) => this.onOpenDetail(u),
          onToggle: (u: number) => this.onToggleDetail(u),
          onClose: (u: number) => this.onCloseDetail(u),
        })
      }
    }
    .width('100%')
    .height(ShipDiems.SHIP_EQUIP_ICON_SIZE)
    .justifyContent(FlexAlign.Start)
    .alignItems(VerticalAlign.Center)
    .clip(true)
  }
}
