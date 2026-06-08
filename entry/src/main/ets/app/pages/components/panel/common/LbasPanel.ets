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
import { PanelColors, PanelDimens } from '../../../../../features/panel/panelConfig';

function lbasRowKey(base: LbasBase): string {
  return [
    base.areaId,
    base.baseId,
    base.actionKind,
    base.distanceBase,
    base.distanceBonus,
    base.squadrons.map((sq: LbasSquadron): string => {
      return `${sq.squadronId}-${sq.state}-${sq.slotId}-${sq.count}-${sq.maxCount}-${sq.cond}`;
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

@ComponentV2
export default struct LbasPanel {
  @Param bases: LbasBase[] = [];
  @Param currentAreaId: number = 0;
  @Param compact: boolean = false;

  private visibleBases(): LbasBase[] {
    const areaId = this.currentAreaId > 0
      ? this.currentAreaId
      : (this.bases.length > 0 ? this.bases[0].areaId : 0);
    const filtered = areaId > 0
      ? this.bases.filter((base: LbasBase): boolean => base.areaId === areaId)
      : this.bases;
    return filtered.slice().sort((a: LbasBase, b: LbasBase): number => a.baseId - b.baseId);
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
    const power = this.calcBase(base).totalSortieFighterPower;
    return power > 0 ? `${power}` : '--';
  }

  private defensePowerText(base: LbasBase): string {
    const power = this.calcBase(base).totalDefenseFighterPower;
    return power > 0 ? `${power}` : '--';
  }

  private squadronText(squadron: LbasSquadron): string {
    const masterId = this.masterIdOf(squadron);
    if (squadron.slotId <= 0 || masterId <= 0) return `${squadron.squadronId}: 空`;
    const st = getGameState().getState();
    const name = st.slotItemNames.get(masterId) ?? `#${masterId}`;
    return `${squadron.squadronId}: ${name} ${squadron.count}/${squadron.maxCount}`;
  }

  private squadronsLine(base: LbasBase): string {
    if (base.squadrons.length === 0) return '无中队数据';
    return base.squadrons
      .slice()
      .sort((a: LbasSquadron, b: LbasSquadron): number => a.squadronId - b.squadronId)
      .map((squadron: LbasSquadron): string => this.squadronText(squadron))
      .join('  /  ');
  }

  private rowHeight(): number {
    return this.compact ? PanelDimens.rowCompH + 10 : PanelDimens.rowH + 12;
  }

  private badgeWidth(): number {
    return this.compact ? 38 : PanelDimens.avatarW;
  }

  private titleFontSize(): number {
    return this.compact ? PanelDimens.fontSm : PanelDimens.fontMd;
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
      Text(value)
        .fontSize(PanelDimens.fontSm)
        .fontWeight(FontWeight.Medium)
        .fontColor(PanelColors.stat)
        .margin({ left: 3 })
    }
    .alignItems(VerticalAlign.Center)
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
        }
        .width('100%')
        .alignItems(VerticalAlign.Center)

        Scroll() {
          Row({ space: this.compact ? 8 : 12 }) {
            this.Metric('半径', this.distanceText(base))
            this.Metric('出击制空', this.sortiePowerText(base))
            this.Metric('守家制空', this.defensePowerText(base))
          }
          .height(PanelDimens.statusBarH)
          .alignItems(VerticalAlign.Center)
        }
        .width('100%')
        .height(PanelDimens.statusBarH)
        .scrollable(ScrollDirection.Horizontal)
        .scrollBar(BarState.Off)
        .edgeEffect(EdgeEffect.None)

        Text(this.squadronsLine(base))
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.txtSub)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .width('100%')
      }
      .layoutWeight(1)
      .padding({ left: this.compact ? 6 : 8, right: this.compact ? 6 : 8 })
      .justifyContent(FlexAlign.Center)
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
