import { ShipItem } from '../../../../../features/panel/type';
import { PanelColors, PanelDimens } from '../../../../../features/panel/panelConfig';
import {
  subscribeGameState, getDeckShips, getMaterials, getDecks, getGameState,
  MaterialsSnapshot, DeckSnapshot, ShipState,
  MapGaugeSnapshot,
  getMapGauges,
  getNDocks,
  NDockSnapShot,
  getQuests,
  QuestSnapshot,
  getSortieResourceGains,
  SortieResourceGains,
  isShipEscaped,
} from '../../../../../features/state';
import type { LbasBase } from '../../../../../domain/models/struct/lbas';
import {
  getFleetFighterPower,
  calcSingleFleetLoS,
  getFleetTP,
} from '../../../../../features/calc';
import { APP_STORAGE_PANEL_SHOW_KAISYUU, APP_STORAGE_PANEL_SHOW_PROFICIENCY, APP_STORAGE_SIDEBAR_SHOW_AVATAR } from '../../../../../ability/Entry';
import { buildShipCapabilityTags } from '../../../../../features/panel/shipCapabilityTags';
import { detectSpecialAttackBadge } from '../../../../../features/panel/specialAttackBadge';
import { resourceIconPath } from '../../../../../features/resources/resourceMeta';
import ShipRow from './rows/ShipRow';
import MapGaugeRow from './rows/MapGaugeRow';
import ResourceAmount from '../common/ResourceAmount';
import QuestPanel from '../common/QuestPanel';
import NdockPanel from '../common/NdockPanel';
import LbasPanel from '../common/LbasPanel';
import { shouldDisplayMapGauge } from './rows/shipHelpers';
import { lengthToNumber } from '../../../../../infra/utils/trans';

const OVERLAY_LBAS_TAB_IDX = 4;
const OVERLAY_NDOCK_TAB_IDX = 5;
const OVERLAY_MAP_TAB_IDX = 6;
const OVERLAY_QUEST_TAB_IDX = 7;
const OVERLAY_TAB_MIN_CONTENT_WIDTH = 330;
const OVERLAY_FLEET_STATS_MIN_CONTENT_WIDTH = 360;
const RESOURCE_NARROW_WIDTH = 460;
const RESOURCE_BAR_H = 20;
const RESOURCE_BAR_NARROW_H = 36;

// ArkUI ForEach 在 key 不变时会复用旧子组件且不重新下发 @Param，所以仅
// 用 uid 作 key 时，HP/cond/补给/装备变化都不会触发 ShipRow 重渲（这
// 也是回港 / 战斗结算后面板信息偶发不刷新的根因）。把所有会影响显示
// 的动态字段拼进 key，配合 @Param 引用变化让行级强制重建，与 sidebar
// 的 shipEntryKey 思路一致。
function shipRowKey(ship: ShipItem): string {
  return [
    ship.id,
    ship.masterId,
    ship.level,
    ship.expToNext,
    ship.hp,
    ship.hpMax,
    isShipEscaped(ship.id) ? 1 : 0,
    ship.s1,
    ship.s2,
    ship.s3,
    ship.range,
    ship.tags.join(','),
    ship.exSlot,
    ship.exSlotMasterId,
    ship.exSlotType,
    ship.exSlotIconType,
    ship.exSlotLevel,
    ship.exSlotAlv,
    ship.slots.join(','),
    ship.slotMasterIds.join(','),
    ship.slotTypes.join(','),
    ship.slotIconTypes.join(','),
    ship.slotLevels.join(','),
    ship.slotAlvs.join(','),
    ship.slotAirs.join(','),
  ].join('_');
}

function shipStateToItem(
  s: ShipState,
  slotItemIndex: Map<number, number>,
  slotItemEquipTypes: Map<number, number>,
  slotItemIconTypes: Map<number, number>,
  slotItemLevels: Map<number, number>,
  slotItemAlvs: Map<number, number>,
  slotItemLos: Map<number, number>,
  slotItemAa: Map<number, number>,
  slotItemAsw: Map<number, number>,
  slotItemNames: Map<number, string>,
  shipMasterStype: Map<number, number>,
  shipMasterCtype: Map<number, number>
): ShipItem {
  const activeSlots = s.slots.slice(0, s.slotCount);
  const activeOnslot = s.onslot.slice(0, s.slotCount);
  const slotMasterIds = activeSlots.map(uid => uid > 0 ? (slotItemIndex.get(uid) ?? 0) : 0);
  const slotTypes = slotMasterIds.map(mid => {
    return mid > 0 ? (slotItemEquipTypes.get(mid) ?? 0) : 0;
  });
  const slotIconTypes = slotMasterIds.map(mid => {
    return mid > 0 ? (slotItemIconTypes.get(mid) ?? 0) : 0;
  });
  const slotLevels = activeSlots.map(uid => uid > 0 ? (slotItemLevels.get(uid) ?? 0) : 0);
  const slotAlvs = activeSlots.map(uid => uid > 0 ? (slotItemAlvs.get(uid) ?? 0) : 0);
  let exSlotMasterId = 0;
  let exSlotType = 0;
  let exSlotIconType = 0;
  let exSlotLevel = 0;
  let exSlotAlv = 0;
  if (s.exSlot > 0) {
    const mid = slotItemIndex.get(s.exSlot);
    if (mid !== undefined) {
      exSlotMasterId = mid;
      exSlotType = slotItemEquipTypes.get(mid) ?? 0;
      exSlotIconType = slotItemIconTypes.get(mid) ?? 0;
    }
    exSlotLevel = slotItemLevels.get(s.exSlot) ?? 0;
    exSlotAlv = slotItemAlvs.get(s.exSlot) ?? 0;
  }
  return {
    id: s.uid,
    masterId: s.masterId,
    name: s.name,
    shipType: '',
    level: s.level,
    expToNext: s.expToNext,
    tags: buildShipCapabilityTags({
      shipMasterId: s.masterId,
      stype: shipMasterStype.get(s.masterId) ?? 0,
      ctype: shipMasterCtype.get(s.masterId) ?? 0,
      aswCur: s.aswCur,
      slots: activeSlots,
      onslot: activeOnslot,
      exSlot: s.exSlot,
      slotItemIndex,
      slotItemEquipTypes,
      slotItemIconTypes,
      slotItemLos,
      slotItemAa,
      slotItemAsw,
      slotItemNames,
    }),
    hp: s.hpNow,
    hpMax: s.hpMax,
    s1: s.cond,
    s2: s.fuel,
    s3: s.ammo,
    s4: 0,
    range: s.range,
    fuelMax: s.fuelMax,
    ammoMax: s.ammoMax,
    slots: activeSlots,
    slotMasterIds,
    slotTypes,
    slotIconTypes,
    slotAirs: activeOnslot,
    slotLevels,
    slotAlvs,
    exSlot: s.exSlot,
    exSlotMasterId,
    exSlotType,
    exSlotIconType,
    exSlotLevel,
    exSlotAlv,
  };
}

/** Fleet unified speed (min of all ship speeds): 0=陸上, 5=低速, 10=高速, 15=高速+, 20=最速. */
function formatFleetSpeed(speed: number): string {
  if (speed < 0 || !Number.isFinite(speed)) return '--';
  if (speed >= 20) return '最速';
  if (speed >= 15) return '高速+';
  if (speed >= 10) return '高速';
  if (speed >= 5) return '低速';
  return '陸上';
}

function formatAdmiralRank(rank: number | undefined): string {
  switch (rank) {
    case 1: return '元帥';
    case 2: return '大将';
    case 3: return '中将';
    case 4: return '少将';
    case 5: return '大佐';
    case 6: return '中佐';
    case 7: return '新米中佐';
    case 8: return '少佐';
    case 9: return '中堅少佐';
    case 10: return '新米少佐';
    default: return '--';
  }
}

function formatLimitCount(current: number, limit: number | undefined): string {
  return `${current}/${limit && limit > 0 ? limit : '--'}`;
}

/**
 * Semi-transparent floating panel for COMPACT mode (landscape / small window).
 * Shows fleet air power, unified speed, LoS, and transport TP.
 */
@ComponentV2
export default struct FloatOverlayPanel {
  @Local activeFleet: number = 0;
  @Local ships: ShipItem[] = [];
  @Local materials: MaterialsSnapshot | null = null;
  @Local sortieGains: SortieResourceGains | null = null;
  @Local decks: DeckSnapshot[] = [];
  @Local airPower: number = 0;
  @Local fleetLoS: number = 0;
  @Local fleetTpS: number = 0;
  @Local fleetTpA: number = 0;
  @Local fleetSpeed: number = -1;
  @Local specialAttack: string = '';
  @Local mapGauges: MapGaugeSnapshot[] = [];
  @Local lbases: LbasBase[] = [];
  @Local currentLbasAreaId: number = 0;
  @Local ndocks: NDockSnapShot[] = [];
  @Local quests: QuestSnapshot[] = [];
  @Local admiralName: string = '--';
  @Local admiralRank: string = '--';
  @Local admiralExperience: string = '--';
  @Local todaySenka: string = '--';
  @Local shipCapacity: string = '--/--';
  @Local panelWidth: number = PanelDimens.overlayPanelW;
  /** UID of slot whose detail popup is currently open; 0 = none. EquipSlot 自己加载详情。 */
  @Local detailUid: number = 0;
  /** Show kaisyuu (improvement) star badge; mirrors AppStorage setting. */
  @Local showKaisyuu: boolean = true;
  /** Show aircraft proficiency badge; mirrors AppStorage setting. */
  @Local showProficiency: boolean = true;
  /** Show ship avatar/remodel banner; mirrors AppStorage setting. */
  @Local showAvatar: boolean = true;

  private unsubscribe: (() => void) | null = null;

  aboutToAppear(): void {
    this.refreshSettings();
    this.loadState();
    this.unsubscribe = subscribeGameState((changeType, _state) => {
      if (changeType === 'all' || changeType === 'ships' ||
          changeType === 'decks' || changeType === 'materials' ||
          changeType === 'ndocks' ||
          changeType === 'admiral' || changeType === 'quests' ||
          changeType === 'mapinfo' || changeType === 'sortieGains' ||
          changeType === 'lbas' || changeType === 'battle') {
        this.loadState();
      }
    });
  }

  private refreshSettings(): void {
    const k = AppStorage.get<boolean>(APP_STORAGE_PANEL_SHOW_KAISYUU);
    const p = AppStorage.get<boolean>(APP_STORAGE_PANEL_SHOW_PROFICIENCY);
    const a = AppStorage.get<boolean>(APP_STORAGE_SIDEBAR_SHOW_AVATAR);
    this.showKaisyuu = k !== undefined ? k : true;
    this.showProficiency = p !== undefined ? p : true;
    this.showAvatar = a !== undefined ? a : true;
  }

  aboutToDisappear(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  private loadState(): void {
    const manager = getGameState();
    const st = manager.getState();
    const admiral = st.admiral;
    const senka = manager.getSenkaInfo();
    this.materials = getMaterials();
    this.sortieGains = getSortieResourceGains();
    this.decks = [...getDecks()];
    this.admiralName = admiral?.nickname || '--';
    this.admiralRank = formatAdmiralRank(admiral?.rank);
    this.admiralExperience = admiral ? `${admiral.experience}` : '--';
    this.todaySenka = senka ? `${senka.estimatedTodaySenka}` : '--';
    this.shipCapacity = formatLimitCount(st.ships.size, admiral?.maxShips);
    this.mapGauges = getMapGauges().filter(g => shouldDisplayMapGauge(g));
    this.lbases = [...st.lbases];
    this.currentLbasAreaId = st.currentLbasAreaId;
    this.ndocks = [...getNDocks()];
    this.quests = [...getQuests()];
    this.refreshShips();
    this.loadCalcStats();
  }

  private refreshShips(): void {
    if (this.activeFleet < 4) {
      const st = getGameState().getState();
      const rawShips = getDeckShips(this.activeFleet + 1);
      this.ships = rawShips.map(s => shipStateToItem(
        s,
        st.slotItemIndex,
        st.slotItemEquipTypes,
        st.slotItemIconTypes,
        st.slotItemLevels,
        st.slotItemAlvs,
        st.slotItemLos,
        st.slotItemAa,
        st.slotItemAsw,
        st.slotItemNames,
        st.shipMasterStype,
        st.shipMasterCtype
      ));
      this.specialAttack = detectSpecialAttackBadge(rawShips, this.activeFleet);
      this.fleetSpeed = rawShips.length > 0
        ? rawShips.reduce((min, s) => Math.min(min, s.speed), Number.POSITIVE_INFINITY)
        : -1;
    } else {
      this.ships = [];
      this.specialAttack = '';
      this.fleetSpeed = -1;
    }
  }

  private async loadCalcStats(): Promise<void> {
    if (this.activeFleet >= 4) {
      this.airPower = 0;
      this.fleetLoS = 0;
      this.fleetTpS = 0;
      this.fleetTpA = 0;
      return;
    }
    const deckId = this.activeFleet + 1;
    try {
      const fpResult = await getFleetFighterPower(deckId);
      this.airPower = fpResult?.totalFighterPower ?? 0;
    } catch (_e) {
      this.airPower = 0;
    }
    try {
      const losResult = await calcSingleFleetLoS(deckId, 1);
      this.fleetLoS = losResult?.losScore ?? 0;
    } catch (_e) {
      this.fleetLoS = 0;
    }
    try {
      const tpResult = await getFleetTP(deckId);
      this.fleetTpS = tpResult?.baseTP ?? 0;
      this.fleetTpA = tpResult?.aVictoryTP ?? 0;
    } catch (_e) {
      this.fleetTpS = 0;
      this.fleetTpA = 0;
    }
  }

  private selectFleet(idx: number): void {
    this.activeFleet = idx;
    this.refreshShips();
    this.loadCalcStats();
  }

  private isOnExpedition(idx: number): boolean {
    if (idx >= 4) return false;
    const deck = this.decks.find(d => d.deckId === idx + 1);
    return !!(deck?.expeditionReturnTime && deck.expeditionReturnTime > Date.now());
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

  private useNarrowResourceLayout(): boolean {
    return this.panelWidth < RESOURCE_NARROW_WIDTH;
  }

  private resourceBarHeight(): number {
    return this.useNarrowResourceLayout() ? RESOURCE_BAR_NARROW_H : RESOURCE_BAR_H;
  }

  @Builder private AdmiralTag(text: string): void {
    Text(text)
      .fontSize(PanelDimens.fontSm)
      .fontColor(PanelColors.overlayTxt)
      .maxLines(1)
      .textOverflow({ overflow: TextOverflow.Ellipsis })
      .padding({ left: 6, right: 6, top: 2, bottom: 2 })
      .backgroundColor('#33000000')
      .borderRadius(PanelDimens.radius)
      .borderWidth(PanelDimens.borderW)
      .borderColor(PanelColors.overlayHdr)
  }

  @Builder private AdmiralHeader(): void {
    Scroll() {
      Row({ space: 4 }) {
        this.AdmiralTag(`${this.admiralName}`)
        this.AdmiralTag(`${this.admiralRank}`)
        this.AdmiralTag(`提督经验: ${this.admiralExperience}`)
        this.AdmiralTag(`今日: ${this.todaySenka}`)
        this.AdmiralTag(`舰娘: ${this.shipCapacity}`)
      }
      .height(PanelDimens.statusBarH)
      .alignItems(VerticalAlign.Center)
      .justifyContent(FlexAlign.Start)
      .alignSelf(ItemAlign.Start)
    }
    .width('100%')
    .height(PanelDimens.statusBarH)
    .scrollable(ScrollDirection.Horizontal)
    .scrollBar(BarState.Off)
    .edgeEffect(EdgeEffect.None)
    .padding({ left: 8, right: 8 })
    .align(Alignment.TopStart)
    .borderWidth({ bottom: PanelDimens.borderW })
    .borderColor(PanelColors.overlayHdr)
  }

  @Builder private ResourceWideRow(): void {
    Row({ space: 7 }) {
      if (this.materials) {
        ResourceAmount({ icon: resourceIconPath('fuel'), value: this.materials.fuel, gain: this.sortieGains?.fuel ?? 0, textColor: PanelColors.overlayTxt })
        ResourceAmount({ icon: resourceIconPath('ammo'), value: this.materials.ammo, gain: this.sortieGains?.ammo ?? 0, textColor: PanelColors.overlayTxt })
        ResourceAmount({ icon: resourceIconPath('steel'), value: this.materials.steel, gain: this.sortieGains?.steel ?? 0, textColor: PanelColors.overlayTxt })
        ResourceAmount({ icon: resourceIconPath('bauxite'), value: this.materials.bauxite, gain: this.sortieGains?.bauxite ?? 0, textColor: PanelColors.overlayTxt })
        Blank().layoutWeight(1)
        ResourceAmount({ icon: resourceIconPath('instantBuild'), value: this.materials.instantBuild, gain: this.sortieGains?.instantBuild ?? 0, textColor: PanelColors.overlayTxt })
        ResourceAmount({ icon: resourceIconPath('instantRepair'), value: this.materials.instantRepair, gain: this.sortieGains?.instantRepair ?? 0, textColor: PanelColors.overlayTxt })
        ResourceAmount({ icon: resourceIconPath('devMaterial'), value: this.materials.devMaterial, gain: this.sortieGains?.devMaterial ?? 0, textColor: PanelColors.overlayTxt })
        ResourceAmount({ icon: resourceIconPath('screw'), value: this.materials.screw, gain: this.sortieGains?.screw ?? 0, textColor: PanelColors.overlayTxt })
      } else {
        Text('--').fontSize(PanelDimens.fontSm).fontColor(PanelColors.overlayTxt)
      }
    }
    .width('100%')
    .height(RESOURCE_BAR_H)
    .alignItems(VerticalAlign.Center)
  }

  @Builder private ResourceNarrowRows(): void {
    Column() {
      if (this.materials) {
        Row() {
          Row({ space: 7 }) {
            ResourceAmount({ icon: resourceIconPath('fuel'), value: this.materials.fuel, gain: this.sortieGains?.fuel ?? 0, textColor: PanelColors.overlayTxt })
            ResourceAmount({ icon: resourceIconPath('steel'), value: this.materials.steel, gain: this.sortieGains?.steel ?? 0, textColor: PanelColors.overlayTxt })
          }
          .alignItems(VerticalAlign.Center)

          Blank().layoutWeight(1)

          Row({ space: 7 }) {
            ResourceAmount({ icon: resourceIconPath('instantRepair'), value: this.materials.instantRepair, gain: this.sortieGains?.instantRepair ?? 0, textColor: PanelColors.overlayTxt })
            ResourceAmount({ icon: resourceIconPath('devMaterial'), value: this.materials.devMaterial, gain: this.sortieGains?.devMaterial ?? 0, textColor: PanelColors.overlayTxt })
          }
          .alignItems(VerticalAlign.Center)
        }
        .width('100%')
        .layoutWeight(1)
        .alignItems(VerticalAlign.Center)

        Row() {
          Row({ space: 7 }) {
            ResourceAmount({ icon: resourceIconPath('ammo'), value: this.materials.ammo, gain: this.sortieGains?.ammo ?? 0, textColor: PanelColors.overlayTxt })
            ResourceAmount({ icon: resourceIconPath('bauxite'), value: this.materials.bauxite, gain: this.sortieGains?.bauxite ?? 0, textColor: PanelColors.overlayTxt })
          }
          .alignItems(VerticalAlign.Center)

          Blank().layoutWeight(1)

          Row({ space: 7 }) {
            ResourceAmount({ icon: resourceIconPath('instantBuild'), value: this.materials.instantBuild, gain: this.sortieGains?.instantBuild ?? 0, textColor: PanelColors.overlayTxt })
            ResourceAmount({ icon: resourceIconPath('screw'), value: this.materials.screw, gain: this.sortieGains?.screw ?? 0, textColor: PanelColors.overlayTxt })
          }
          .alignItems(VerticalAlign.Center)
        }
        .width('100%')
        .layoutWeight(1)
        .alignItems(VerticalAlign.Center)
      } else {
        Row() {
          Text('--').fontSize(PanelDimens.fontSm).fontColor(PanelColors.overlayTxt)
        }
        .width('100%')
        .layoutWeight(1)
        .alignItems(VerticalAlign.Center)
      }
    }
    .width('100%')
    .height(RESOURCE_BAR_NARROW_H)
  }

  @Builder private ResourceStatusBar(): void {
    Column() {
      if (this.useNarrowResourceLayout()) {
        this.ResourceNarrowRows()
      } else {
        this.ResourceWideRow()
      }
    }
    .width('100%')
    .height(this.resourceBarHeight())
    .padding({ left: 8, right: 8 })
    .borderWidth({ bottom: PanelDimens.borderW })
    .borderColor(PanelColors.overlayHdr)
  }

  @Builder private FleetStat(label: string, value: string): void {
    Row() {
      Text(label)
        .fontSize(PanelDimens.fontSm)
        .fontColor(PanelColors.overlayTxt)
      Text(value)
        .fontSize(PanelDimens.fontSm)
        .fontColor(PanelColors.stat)
        .margin({ left: 3 })
    }
    .height(PanelDimens.statusBarH)
    .alignItems(VerticalAlign.Center)
  }

  build() {
    Column() {
      this.AdmiralHeader()
      this.ResourceStatusBar()

      // Single-line fleet stats. Hidden on non-fleet tabs.
      if (this.activeFleet < 4) {
        Scroll() {
          Row({ space: 10 }) {
            this.FleetStat('制空', this.airPower > 0 ? `${this.airPower}` : '--')
            this.FleetStat('速度', formatFleetSpeed(this.fleetSpeed))
            this.FleetStat('🚚 輸送', this.fleetTpS > 0 ? `S${Math.floor(this.fleetTpS)}/A${Math.floor(this.fleetTpA)}` : '--')
            this.FleetStat('👁 索敵', this.fleetLoS !== 0 ? this.fleetLoS.toFixed(1) : '--')
          }
          .width('100%')
          .constraintSize({ minWidth: OVERLAY_FLEET_STATS_MIN_CONTENT_WIDTH })
          .height(PanelDimens.statusBarH)
          .padding({ left: 8, right: 8 })
          .alignItems(VerticalAlign.Center)
        }
        .width('100%')
        .height(PanelDimens.statusBarH)
        .scrollable(ScrollDirection.Horizontal)
        .scrollBar(BarState.Off)
        .edgeEffect(EdgeEffect.None)
        .borderWidth({ bottom: PanelDimens.borderW })
        .borderColor(PanelColors.overlayHdr)
      }

      // Compact fleet selector row — scrollable on narrow panels.
      Scroll() {
        Row() {
          Row({ space: 4 }) {
            ForEach([0, 1, 2, 3], (idx: number) => {
              Text(this.isOnExpedition(idx) ? `${idx + 1}↗` : `${idx + 1}`)
                .fontSize(PanelDimens.fontSm)
                .fontColor(PanelColors.txtTabOn)
                .backgroundColor(this.activeFleet === idx ? '#0d47a1' : PanelColors.bgTabInactive)
                .opacity(this.activeFleet === idx ? 1.0 : 0.55)
                .padding({ left: 7, right: 7, top: 3, bottom: 3 })
                .borderRadius(PanelDimens.radius)
                .onClick(() => { this.selectFleet(idx); })
            }, (idx: number) => `ftab-${idx}`)
          }
          .alignItems(VerticalAlign.Center)

          Blank().layoutWeight(1)

          Row({ space: 4 }) {
            Text('陆航')
              .fontSize(PanelDimens.fontSm)
              .fontColor(PanelColors.txtTabOn)
              .backgroundColor(this.activeFleet === OVERLAY_LBAS_TAB_IDX ? '#4e342e' : PanelColors.bgTabInactive)
              .opacity(this.activeFleet === OVERLAY_LBAS_TAB_IDX ? 1.0 : 0.55)
              .padding({ left: 7, right: 7, top: 3, bottom: 3 })
              .borderRadius(PanelDimens.radius)
              .onClick(() => { this.selectFleet(OVERLAY_LBAS_TAB_IDX); })

            Text('入渠')
              .fontSize(PanelDimens.fontSm)
              .fontColor(PanelColors.txtTabOn)
              .backgroundColor(this.activeFleet === OVERLAY_NDOCK_TAB_IDX ? '#006064' : PanelColors.bgTabInactive)
              .opacity(this.activeFleet === OVERLAY_NDOCK_TAB_IDX ? 1.0 : 0.55)
              .padding({ left: 7, right: 7, top: 3, bottom: 3 })
              .borderRadius(PanelDimens.radius)
              .onClick(() => { this.selectFleet(OVERLAY_NDOCK_TAB_IDX); })

            Text('地図')
              .fontSize(PanelDimens.fontSm)
              .fontColor(PanelColors.txtTabOn)
              .backgroundColor(this.activeFleet === OVERLAY_MAP_TAB_IDX ? '#1a3a5c' : PanelColors.bgTabInactive)
              .opacity(this.activeFleet === OVERLAY_MAP_TAB_IDX ? 1.0 : 0.55)
              .padding({ left: 7, right: 7, top: 3, bottom: 3 })
              .borderRadius(PanelDimens.radius)
              .onClick(() => { this.selectFleet(OVERLAY_MAP_TAB_IDX); })

            Text('任务')
              .fontSize(PanelDimens.fontSm)
              .fontColor(PanelColors.txtTabOn)
              .backgroundColor(this.activeFleet === OVERLAY_QUEST_TAB_IDX ? '#37474f' : PanelColors.bgTabInactive)
              .opacity(this.activeFleet === OVERLAY_QUEST_TAB_IDX ? 1.0 : 0.55)
              .padding({ left: 7, right: 7, top: 3, bottom: 3 })
              .borderRadius(PanelDimens.radius)
              .onClick(() => { this.selectFleet(OVERLAY_QUEST_TAB_IDX); })
          }
          .alignItems(VerticalAlign.Center)
        }
        .width('100%')
        .constraintSize({ minWidth: OVERLAY_TAB_MIN_CONTENT_WIDTH })
        .height(PanelDimens.tabBarH - 4)
        .padding({ left: 8, right: 8 })
        .alignItems(VerticalAlign.Center)
      }
      .width('100%')
      .height(PanelDimens.tabBarH - 4)
      .backgroundColor(PanelColors.bgTabs)
      .scrollable(ScrollDirection.Horizontal)
      .scrollBar(BarState.Auto)
      .edgeEffect(EdgeEffect.None)

      // Content area: map gauges, quests, or ship list — must stack from top, not center
      Scroll() {
        Column() {
          if (this.activeFleet === OVERLAY_QUEST_TAB_IDX) {
            QuestPanel({ quests: this.quests, compact: true })
          } else if (this.activeFleet === OVERLAY_LBAS_TAB_IDX) {
            LbasPanel({
              bases: this.lbases,
              currentAreaId: this.currentLbasAreaId,
              compact: true,
              showKaisyuu: this.showKaisyuu,
              showProficiency: this.showProficiency,
            })
          } else if (this.activeFleet === OVERLAY_NDOCK_TAB_IDX) {
            NdockPanel({ ndocks: this.ndocks, compact: true })
          } else if (this.activeFleet === OVERLAY_MAP_TAB_IDX) {
            if (this.mapGauges.length > 0) {
              ForEach(this.mapGauges, (gauge: MapGaugeSnapshot) => {
                MapGaugeRow({ gauge })
              }, (gauge: MapGaugeSnapshot) => `gauge-${gauge.mapId}-${gauge.gaugeNum}`)
            } else {
              Text('NO DATA')
                .fontSize(PanelDimens.fontSm)
                .fontColor(PanelColors.txtMuted)
                .margin({ top: 16 })
                .alignSelf(ItemAlign.Center)
            }
          } else if (this.ships.length > 0) {
            ForEach(this.ships, (ship: ShipItem, idx: number) => {
              ShipRow({
                ship,
                isFlag: idx === 0,
                specialAttack: this.specialAttack,
                showAvatar: this.showAvatar,
                showKaisyuu: this.showKaisyuu,
                showProficiency: this.showProficiency,
                detailUid: this.detailUid,
                onOpenDetail: (uid: number) => { this.openEquipDetail(uid); },
                onCloseDetail: (uid: number) => { this.closeEquipDetail(uid); },
              })
            }, (ship: ShipItem) => `${shipRowKey(ship)}_${this.specialAttack}`)
          } else {
            Text('NO DATA')
              .fontSize(PanelDimens.fontSm)
              .fontColor(PanelColors.txtMuted)
              .margin({ top: 16 })
              .alignSelf(ItemAlign.Center)
          }
        }
        .width('100%')
        .alignItems(HorizontalAlign.Start)
        .justifyContent(FlexAlign.Start)
      }
      .layoutWeight(1)
      .width('100%')
      .align(Alignment.TopStart)
      .scrollBar(BarState.Off)
      .edgeEffect(EdgeEffect.None)
    }
    .width('100%')
    .height('100%')
    .alignItems(HorizontalAlign.Start)
    .justifyContent(FlexAlign.Start)
    .backgroundColor(PanelColors.overlayBg)
    .backdropBlur(PanelDimens.overlayBlur)
    .clip(true)
    .onAreaChange((_oldArea: Area, area: Area) => {
      const width = lengthToNumber(area.width);
      if (width > 0) {
        this.panelWidth = width;
      }
    })
  }
}
