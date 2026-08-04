import type { LbasBase, LbasSquadron } from '../../../../../domain/models/struct/lbas';
import {
  SlotItemAircraftCategory,
  SlotItemBookCategory,
  SlotItemEquipType,
  SlotItemIconId,
  SlotItemMajorType,
} from '../../../../../domain/models';
import type { SlotItemMaster } from '../../../../../domain/models';
import {
  calcLbasAirCorpsFighterPower,
  calcLbasSquadronFighterPower,
  LbasMode,
} from '../../../../../features/calc';
import type {
  LbasAirCorpsFighterPower,
  LbasSquadronFighterPower,
} from '../../../../../features/calc';
import { getGameState } from '../../../../../features/state';
import { PanelColors, PanelDimens, ShipDiems } from '../../../../../features/panel/panelConfig';
import EquipSlot from '../bottom/rows/EquipSlot';

const LBAS_EQUIP_SLOT_GAP = 3;

function lbasSquadronKey(squadron: LbasSquadron): string {
  const st = getGameState().getState();
  const masterId = squadron.slotId > 0 ? (st.slotItemIndex.get(squadron.slotId) ?? 0) : 0;
  const iconType = masterId > 0 ? (st.slotItemIconTypes.get(masterId) ?? 0) : 0;
  const equipType = masterId > 0 ? (st.slotItemEquipTypes.get(masterId) ?? 0) : 0;
  const level = squadron.slotId > 0 ? (st.slotItemLevels.get(squadron.slotId) ?? 0) : 0;
  const alv = squadron.slotId > 0 ? (st.slotItemAlvs.get(squadron.slotId) ?? 0) : 0;
  return [
    squadron.squadronId,
    squadron.state,
    squadron.slotId,
    masterId,
    iconType,
    equipType,
    squadron.count,
    squadron.maxCount,
    squadron.cond,
    level,
    alv,
  ].join('-');
}

function lbasRowKey(base: LbasBase): string {
  return [
    base.areaId,
    base.baseId,
    base.actionKind,
    base.distanceBase,
    base.distanceBonus,
    base.squadrons.map((sq: LbasSquadron): string => {
      return lbasSquadronKey(sq);
    }).join('|'),
  ].join('_');
}

function lbasModeLabel(actionKind: number): string {
  switch (actionKind) {
    case 1: return '出击';
    case 2: return '防空';
    case 3: return '退避';
    case 4: return '休息';
    default: return '待机';
  }
}

function lbasModeColor(actionKind: number): string {
  switch (actionKind) {
    case 1: return '#1b5e20';
    case 2: return '#0d47a1';
    case 3: return '#6d4c41';
    case 4: return '#455a64';
    default: return '#4e342e';
  }
}

function toLbasMode(actionKind: number): LbasMode {
  switch (actionKind) {
    case 1: return LbasMode.Sortie;
    case 2: return LbasMode.AirDefense;
    case 3: return LbasMode.Retreat;
    case 4: return LbasMode.Rest;
    default: return LbasMode.Standby;
  }
}

function fallbackAreaName(areaId: number): string {
  switch (areaId) {
    case 1: return '镇守府海域';
    case 2: return '南西诸岛海域';
    case 3: return '北方海域';
    case 4: return '西方海域';
    case 5: return '南方海域';
    case 6: return '中部海域';
    case 7: return '南西海域';
    default: return '活动海域';
  }
}

@ComponentV2
export default struct LbasPanel {
  @Param bases: LbasBase[] = [];
  @Param currentAreaId: number = 0;
  @Param compact: boolean = false;
  @Param showKaisyuu: boolean = true;
  @Param showProficiency: boolean = true;

  @Local detailUid: number = 0;

  private visibleBases(): LbasBase[] {
    const activeAreaId = this.currentAreaId > 0 &&
      this.bases.some((base: LbasBase): boolean => base.areaId === this.currentAreaId)
      ? this.currentAreaId
      : 0;
    return this.bases.slice().sort((a: LbasBase, b: LbasBase): number => {
      if (activeAreaId > 0 && a.areaId !== b.areaId) {
        if (a.areaId === activeAreaId) return -1;
        if (b.areaId === activeAreaId) return 1;
      }
      return a.areaId - b.areaId || a.baseId - b.baseId;
    });
  }

  private masterIdOf(squadron: LbasSquadron): number {
    if (squadron.slotId <= 0) return 0;
    return getGameState().getState().slotItemIndex.get(squadron.slotId) ?? 0;
  }

  private slotItemMaster(masterId: number): SlotItemMaster | null {
    if (masterId <= 0) return null;
    const st = getGameState().getState();
    const equipType = st.slotItemEquipTypes.get(masterId) ?? 0;
    if (equipType <= 0) return null;
    return {
      id: masterId,
      sortNo: 0,
      name: st.slotItemNames.get(masterId) ?? `#${masterId}`,
      type: {
        major: SlotItemMajorType.Unknown,
        book: SlotItemBookCategory.Unknown,
        equipType: equipType as SlotItemEquipType,
        iconId: (st.slotItemIconTypes.get(masterId) ?? 0) as SlotItemIconId,
        aircraft: SlotItemAircraftCategory.NonAircraft,
      },
      rarity: 0,
      range: 0,
      stats: {
        hp: 0,
        armor: 0,
        firepower: 0,
        torpedo: 0,
        speed: 0,
        bomb: 0,
        aa: st.slotItemAa.get(masterId) ?? 0,
        asw: st.slotItemAsw.get(masterId) ?? 0,
        hit: st.slotItemHit.get(masterId) ?? 0,
        evasion: st.slotItemEvasion.get(masterId) ?? 0,
        los: st.slotItemLos.get(masterId) ?? 0,
        luck: 0,
      },
      broken: [],
      distance: st.slotItemDistance.get(masterId) ?? 0,
      updatedAt: 0,
    };
  }

  private calcBase(base: LbasBase): LbasAirCorpsFighterPower {
    const st = getGameState().getState();
    const squadrons: LbasSquadronFighterPower[] = [];
    for (const squadron of base.squadrons) {
      const masterId = this.masterIdOf(squadron);
      const master = this.slotItemMaster(masterId);
      if (!master || squadron.slotId <= 0) continue;
      const level = st.slotItemLevels.get(squadron.slotId) ?? 0;
      const proficiency = st.slotItemAlvs.get(squadron.slotId) ?? 0;
      squadrons.push(calcLbasSquadronFighterPower(master, level, proficiency, squadron.count));
    }
    const calc = calcLbasAirCorpsFighterPower(
      base.baseId,
      squadrons,
      toLbasMode(base.actionKind),
      base.name,
    );
    if (calc.extendedDistance <= 0) {
      calc.distance = base.distanceBase;
      calc.extendedDistance = base.distanceBase + base.distanceBonus;
    }
    return calc;
  }

  private distanceText(base: LbasBase): string {
    const calc = this.calcBase(base);
    if (calc.extendedDistance <= 0) return '--';
    if (calc.distance > 0 && calc.distance !== calc.extendedDistance) {
      return `${calc.distance}→${calc.extendedDistance}`;
    }
    return `${calc.extendedDistance}`;
  }

  private sortiePowerText(base: LbasBase): string {
    const calc = this.calcBase(base);
    const min = calc.totalSortieFighterPowerMin;
    const max = calc.totalSortieFighterPowerMax;
    if (max <= 0) return '--';
    return min === max ? `${min}` : `${min}~${max}`;
  }

  private defensePowerText(base: LbasBase): string {
    const calc = this.calcBase(base);
    const min = calc.totalDefenseFighterPowerMin;
    const max = calc.totalDefenseFighterPowerMax;
    if (max <= 0) return '--';
    return min === max ? `${min}` : `${min}~${max}`;
  }

  private squadronSlotWidth(base: LbasBase): number {
    const count = base.squadrons.length;
    if (count <= 0) return 0;
    return count * ShipDiems.SHIP_EQUIP_ICON_SIZE + (count - 1) * LBAS_EQUIP_SLOT_GAP;
  }

  private openEquipDetail(uid: number): void {
    if (uid <= 0) return;
    this.detailUid = uid;
  }

  private closeEquipDetail(uid: number): void {
    if (this.detailUid === uid) {
      this.detailUid = 0;
    }
  }

  private rowHeight(): number {
    return this.compact ? PanelDimens.rowCompH + 34 : PanelDimens.rowH + 34;
  }

  private badgeWidth(): number {
    return this.compact ? 38 : PanelDimens.avatarW;
  }

  private titleFontSize(): number {
    return this.compact ? PanelDimens.fontSm : PanelDimens.fontMd;
  }

  private metricColumnWidth(): number {
    return this.compact ? 84 : 90;
  }

  private metricColumnHeight(): number {
    return this.compact ? 40 : 42;
  }

  private areaText(base: LbasBase): string {
    if (base.areaId <= 0) return '--';
    return `${base.areaId} ${fallbackAreaName(base.areaId)}`;
  }

  @Builder private BaseBadge(base: LbasBase): void {
    Column() {
      Text('陆航')
        .fontSize(PanelDimens.fontSm)
        .fontColor('#ffffff')
      Text(`${base.baseId}`)
        .fontSize(this.compact ? PanelDimens.fontLg : 16)
        .fontWeight(FontWeight.Bold)
        .fontColor('#ffffff')
    }
    .width(this.badgeWidth())
    .height('100%')
    .backgroundColor(lbasModeColor(base.actionKind))
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
  }

  @Builder private Metric(label: string, value: string): void {
    Row() {
      Text(label)
        .fontSize(PanelDimens.fontSm)
        .fontColor(PanelColors.txtSub)
        .maxLines(1)
      Blank()
        .layoutWeight(1)
      Text(value)
        .fontSize(PanelDimens.fontSm)
        .fontWeight(FontWeight.Medium)
        .fontColor(PanelColors.stat)
        .margin({ left: 3 })
        .maxLines(1)
    }
    .width('100%')
    .height(this.compact ? 12 : 13)
    .alignItems(VerticalAlign.Center)
  }

  @Builder private MetricsColumn(base: LbasBase): void {
    Column({ space: 1 }) {
      this.Metric('半径', this.distanceText(base))
      this.Metric('出击制空', this.sortiePowerText(base))
      this.Metric('守家制空', this.defensePowerText(base))
    }
    .width(this.metricColumnWidth())
    .height(this.metricColumnHeight())
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Start)
  }

  @Builder private SquadronSlot(squadron: LbasSquadron): void {
    if (squadron.slotId > 0 && this.masterIdOf(squadron) > 0) {
      EquipSlot({
        uid: squadron.slotId,
        masterId: this.masterIdOf(squadron),
        iconType: getGameState().getState().slotItemIconTypes.get(this.masterIdOf(squadron)) ?? 0,
        equipType: getGameState().getState().slotItemEquipTypes.get(this.masterIdOf(squadron)) ?? 0,
        air: squadron.count,
        level: getGameState().getState().slotItemLevels.get(squadron.slotId) ?? 0,
        alv: getGameState().getState().slotItemAlvs.get(squadron.slotId) ?? 0,
        slotSize: ShipDiems.SHIP_EQUIP_ICON_SIZE,
        tagSize: ShipDiems.SHIP_TAG_SIZE,
        isExSlot: false,
        showKaisyuu: this.showKaisyuu,
        showProficiency: this.showProficiency,
        detailUid: this.detailUid,
        onOpen: (uid: number) => { this.openEquipDetail(uid); },
        onClose: (uid: number) => { this.closeEquipDetail(uid); },
      })
    } else {
      Row()
        .width(ShipDiems.SHIP_EQUIP_ICON_SIZE)
        .height(ShipDiems.SHIP_EQUIP_ICON_SIZE)
        .borderRadius(2)
        .backgroundColor('#55c8cce0')
    }
  }

  @Builder private SquadronSlots(base: LbasBase): void {
    Scroll() {
      Row({ space: LBAS_EQUIP_SLOT_GAP }) {
        ForEach(base.squadrons, (squadron: LbasSquadron) => {
          this.SquadronSlot(squadron)
        }, (squadron: LbasSquadron) => `lbas-slot-${base.areaId}-${base.baseId}-${lbasSquadronKey(squadron)}`)
      }
      .height(ShipDiems.SHIP_EQUIP_ICON_SIZE)
      .constraintSize({ minWidth: this.squadronSlotWidth(base) })
      .justifyContent(FlexAlign.Start)
      .alignItems(VerticalAlign.Center)
    }
    .width('100%')
    .height(ShipDiems.SHIP_EQUIP_ICON_SIZE)
    .scrollable(ScrollDirection.Horizontal)
    .scrollBar(BarState.Off)
    .edgeEffect(EdgeEffect.None)
  }

  @Builder private BaseRow(base: LbasBase): void {
    Row() {
      this.BaseBadge(base)

      Column({ space: 4 }) {
        Row({ space: 6 }) {
          Text(base.name || `基地航空队 ${base.baseId}`)
            .fontSize(this.titleFontSize())
            .fontWeight(FontWeight.Medium)
            .fontColor(PanelColors.txtPrimary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .layoutWeight(1)

          Text(lbasModeLabel(base.actionKind))
            .fontSize(PanelDimens.fontSm)
            .fontColor('#ffffff')
            .padding({ left: 5, right: 5, top: 1, bottom: 1 })
            .backgroundColor(lbasModeColor(base.actionKind))
            .borderRadius(PanelDimens.radius)

          Text(this.areaText(base))
            .fontSize(PanelDimens.fontSm)
            .fontColor(PanelColors.txtSub)
            .padding({ left: 5, right: 5, top: 1, bottom: 1 })
            .backgroundColor(PanelColors.bgTabs)
            .borderRadius(PanelDimens.radius)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .constraintSize({ maxWidth: this.compact ? 82 : 130 })
        }
        .width('100%')
        .alignItems(VerticalAlign.Center)

        Row({ space: this.compact ? 6 : 8 }) {
          this.MetricsColumn(base)

          Row() {
            this.SquadronSlots(base)
          }
          .layoutWeight(1)
          .constraintSize({ minWidth: 0 })
          .height(ShipDiems.SHIP_EQUIP_ICON_SIZE)
          .alignItems(VerticalAlign.Center)
        }
        .width('100%')
        .height(this.metricColumnHeight())
        .alignItems(VerticalAlign.Center)
      }
      .layoutWeight(1)
      .padding({ left: this.compact ? 6 : 8, right: this.compact ? 6 : 8 })
      .justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .height(this.rowHeight())
    .backgroundColor(PanelColors.bgSection)
    .borderWidth({ bottom: PanelDimens.borderW })
    .borderColor(PanelColors.rowBorder)
    .alignItems(VerticalAlign.Center)
  }

  @Builder private EmptyState(): void {
    Column() {
      Text('暂无陆航数据')
        .fontSize(this.titleFontSize())
        .fontColor(PanelColors.txtMuted)
        .margin({ top: this.compact ? 16 : 24 })
      Text('进入对应海图或打开基地航空队界面以获得数据')
        .fontSize(PanelDimens.fontSm)
        .fontColor(PanelColors.txtFainter)
        .margin({ top: 6 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Center)
  }

  build() {
    Column() {
      if (this.visibleBases().length > 0) {
        ForEach(this.visibleBases(), (base: LbasBase) => {
          this.BaseRow(base)
        }, (base: LbasBase) => lbasRowKey(base))
      } else {
        this.EmptyState()
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}
