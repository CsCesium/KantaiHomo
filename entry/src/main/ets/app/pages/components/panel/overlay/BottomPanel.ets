import { PanelPopupStateChangeEvent, ShipItem } from '../../../../../features/panel/type';
import { FLEET_TAB_COLORS, PanelColors, PanelDimens, fleetIconPath } from '../../../../../features/panel/panelConfig';
import type { FleetIconState } from '../../../../../features/panel/panelConfig';
import {
  subscribeGameState, getDeckShips, getMaterials, getDecks, getGameState,
  getCombinedFleetType,
  MaterialsSnapshot, DeckSnapshot, ShipState,
  getMapGauges,
  MapGaugeSnapshot,
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
  getLoSDisplayResult,
  getFleetTP,
} from '../../../../../features/calc';
import { APP_STORAGE_PANEL_SHOW_KAISYUU, APP_STORAGE_PANEL_SHOW_PROFICIENCY, APP_STORAGE_SIDEBAR_SHOW_AVATAR } from '../../../../../ability/Entry';
import { getSortieContext } from '../../../../../domain/service/sortie';
import { buildShipCapabilityTags } from '../../../../../features/panel/shipCapabilityTags';
import { detectSpecialAttackBadges } from '../../../../../features/panel/specialAttackBadge';
import { resourceIconPath } from '../../../../../features/resources/resourceMeta';
import ShipRow from '../bottom/rows/ShipRow';
import MapGaugeRow from '../bottom/rows/MapGaugeRow';
import ResourceAmount from '../common/ResourceAmount';
import QuestPanel from '../common/QuestPanel';
import NdockPanel from '../common/NdockPanel';
import LbasPanel from '../common/LbasPanel';
import { shouldDisplayMapGauge } from '../bottom/rows/shipHelpers';
import { lengthToNumber } from '../../../../../infra/utils/trans';

const FLEET_TABS_LABEL: string[] = ['1', '2', '3', '4', '陆航', '道具', '入渠', '地図', '任务'];
const LBAS_TAB_IDX = 4;
const NDOCK_TAB_IDX = 6;
const MAP_TAB_IDX = 7;
const QUEST_TAB_IDX = 8;
const TAB_BAR_MIN_CONTENT_WIDTH = FLEET_TABS_LABEL.length * 46 + (FLEET_TABS_LABEL.length - 1) * 3 + 16;
const FLEET_STATS_MIN_CONTENT_WIDTH = 360;
const RESOURCE_NARROW_WIDTH = 460;
const RESOURCE_BAR_H = 20;
const RESOURCE_BAR_NARROW_H = 36;

interface FleetTpCalcValues {
  s: number;
  a: number;
}

interface FleetLoSCalcValues {
  score: number;
  total: number;
  coeff1: number;
  coeff2: number;
  coeff3: number;
  coeff4: number;
}

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
    fuelMax:s.fuelMax,
    ammoMax:s.ammoMax,
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
 * Bottom-docked info panel for EXPANDED mode (portrait / wide-split).
 * Shows fleet air power, LoS(×3), and special attack eligibility
 * in addition to the per-ship rows.
 */
@ComponentV2
export default struct BottomPanel {
  @Param panelHeight: number = 200;
  @Local activeFleet: number = 0;
  @Local ships: ShipItem[] = [];
  @Local materials: MaterialsSnapshot | null = null;
  @Local sortieGains: SortieResourceGains | null = null;
  @Local decks: DeckSnapshot[] = [];
  @Local airPower: number = 0;
  @Local fleetLoS: number = 0;
  @Local fleetLoSTotal: number = 0;
  @Local fleetLoS33x1: number = 0;
  @Local fleetLoS33x2: number = 0;
  @Local fleetLoS33x3: number = 0;
  @Local fleetLoS33x4: number = 0;
  @Local fleetTpS: number = 0;
  @Local fleetTpA: number = 0;
  @Local fleetSpeed: number = -1;
  @Local specialAttacks: string[] = [];
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
  @Local panelWidth: number = 9999;
  /** UID of slot whose detail popup is currently open; 0 = none. EquipDetailPanel 自加载行。 */
  @Local detailUid: number = 0;
  @Local showLoSDetail: boolean = false;
  /** Show kaisyuu (improvement) star badge; mirrors AppStorage setting. */
  @Local showKaisyuu: boolean = true;
  /** Show aircraft proficiency badge; mirrors AppStorage setting. */
  @Local showProficiency: boolean = true;
  /** Show ship avatar/remodel banner; mirrors AppStorage setting. */
  @Local showAvatar: boolean = true;

  private unsubscribe: (() => void) | null = null;
  private calcStatsSeq: number = 0;

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
    this.mapGauges = getMapGauges().filter(g => shouldDisplayMapGauge(g));
    this.lbases = [...st.lbases];
    this.currentLbasAreaId = st.currentLbasAreaId;
    this.ndocks = [...getNDocks()];
    this.quests = [...getQuests()];
    this.admiralName = admiral?.nickname || '--';
    this.admiralRank = formatAdmiralRank(admiral?.rank);
    this.admiralExperience = admiral ? `${admiral.experience}` : '--';
    this.todaySenka = senka ? `${senka.estimatedTodaySenka}` : '--';
    this.shipCapacity = formatLimitCount(st.ships.size, admiral?.maxShips);
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
      this.specialAttacks = detectSpecialAttackBadges(rawShips, this.activeFleet);
      this.fleetSpeed = rawShips.length > 0
        ? rawShips.reduce((min, s) => Math.min(min, s.speed), Number.POSITIVE_INFINITY)
        : -1;
    } else {
      this.ships = [];
      this.specialAttacks = [];
      this.fleetSpeed = -1;
    }
  }

  private resetCalcStats(): void {
    this.airPower = 0;
    this.fleetLoS = 0;
    this.fleetLoSTotal = 0;
    this.fleetLoS33x1 = 0;
    this.fleetLoS33x2 = 0;
    this.fleetLoS33x3 = 0;
    this.fleetLoS33x4 = 0;
    this.fleetTpS = 0;
    this.fleetTpA = 0;
    this.showLoSDetail = false;
  }

  private async calcAirPowerValue(deckId: number): Promise<number> {
    try {
      const fpResult = await getFleetFighterPower(deckId);
      return fpResult?.totalFighterPower ?? 0;
    } catch (_e) {
      return 0;
    }
  }

  private calcFleetLoSTotal(deckId: number): number {
    const ships = getDeckShips(deckId);
    return ships.reduce((sum: number, ship: ShipState): number => {
      return sum + Math.max(0, ship.scoutCur || 0);
    }, 0);
  }

  private async calcFleetLoSValues(deckId: number): Promise<FleetLoSCalcValues> {
    const total = this.calcFleetLoSTotal(deckId);
    try {
      const losResult = await getLoSDisplayResult(deckId);
      return {
        score: losResult?.coeff1 ?? 0,
        total,
        coeff1: losResult?.coeff1 ?? 0,
        coeff2: losResult?.coeff2 ?? 0,
        coeff3: losResult?.coeff3 ?? 0,
        coeff4: losResult?.coeff4 ?? 0,
      };
    } catch (_e) {
      return { score: 0, total, coeff1: 0, coeff2: 0, coeff3: 0, coeff4: 0 };
    }
  }

  private async calcFleetTpValues(deckId: number): Promise<FleetTpCalcValues> {
    try {
      const tpResult = await getFleetTP(deckId);
      return {
        s: tpResult?.baseTP ?? 0,
        a: tpResult?.aVictoryTP ?? 0,
      };
    } catch (_e) {
      return { s: 0, a: 0 };
    }
  }

  private async loadCalcStats(): Promise<void> {
    const seq = ++this.calcStatsSeq;
    if (this.activeFleet >= 4) {
      this.resetCalcStats();
      return;
    }

    const deckId = this.activeFleet + 1;
    const airPowerPromise = this.calcAirPowerValue(deckId);
    const fleetLoSPromise = this.calcFleetLoSValues(deckId);
    const fleetTpPromise = this.calcFleetTpValues(deckId);

    const nextAirPower = await airPowerPromise;
    const nextFleetLoS = await fleetLoSPromise;
    const nextFleetTp = await fleetTpPromise;

    if (seq !== this.calcStatsSeq || this.activeFleet >= 4 || this.activeFleet + 1 !== deckId) {
      return;
    }
    this.airPower = nextAirPower;
    this.fleetLoS = nextFleetLoS.score;
    this.fleetLoSTotal = nextFleetLoS.total;
    this.fleetLoS33x1 = nextFleetLoS.coeff1;
    this.fleetLoS33x2 = nextFleetLoS.coeff2;
    this.fleetLoS33x3 = nextFleetLoS.coeff3;
    this.fleetLoS33x4 = nextFleetLoS.coeff4;
    this.fleetTpS = nextFleetTp.s;
    this.fleetTpA = nextFleetTp.a;
  }

  private selectFleet(idx: number): void {
    if (idx < 4 && this.isFleetUnavailable(idx)) {
      return;
    }
    this.activeFleet = idx;
    this.refreshShips();
    this.loadCalcStats();
  }

  private fleetDeck(idx: number): DeckSnapshot | undefined {
    return this.decks.find(d => d.deckId === idx + 1);
  }

  private isFleetUnavailable(idx: number): boolean {
    return idx < 4 && this.fleetDeck(idx) === undefined;
  }

  private isFleetOnExpedition(idx: number): boolean {
    const deck = this.fleetDeck(idx);
    return !!(deck?.expeditionReturnTime && deck.expeditionReturnTime > Date.now());
  }

  private fleetTabState(idx: number): FleetIconState {
    if (this.isFleetUnavailable(idx)) return 'unavaliable';
    if (this.activeFleet === idx) return 'selected';
    if (this.isFleetOnExpedition(idx)) return 'exped';
    return 'idle';
  }

  private fleetTabIcon(idx: number): string {
    const sortieContext = getSortieContext();
    const combinedType = sortieContext?.combinedType ?? getCombinedFleetType();
    const combined = idx === 0 && combinedType > 0;
    const sortie = sortieContext !== null && sortieContext.combinedType > 0;
    return fleetIconPath(idx + 1, this.fleetTabState(idx), combined, sortie);
  }

  // ── builders ──────────────────────────────────────────────────────────────

  @Builder FleetTabIcon(idx: number) {
    Row() {
      Image(this.fleetTabIcon(idx))
        .width(30)
        .height(22)
        .objectFit(ImageFit.Contain)
    }
    .width(40)
    .height(PanelDimens.tabBarH)
    .justifyContent(FlexAlign.Center)
    .alignItems(VerticalAlign.Center)
    .opacity(this.isFleetUnavailable(idx) ? 0.52 : 1.0)
    .onClick(() => { this.selectFleet(idx); })
  }

  @Builder TabBar() {
    Scroll() {
      Row({ space: 3 }) {
        ForEach(FLEET_TABS_LABEL, (_tab: string, idx: number) => {
          if (idx < 4) {
            this.FleetTabIcon(idx)
          } else {
            Text(FLEET_TABS_LABEL[idx])
              .fontSize(PanelDimens.fontLg)
              .fontWeight(this.activeFleet === idx ? FontWeight.Bold : FontWeight.Normal)
              .fontColor(PanelColors.txtTabOn)
              .backgroundColor(FLEET_TAB_COLORS[idx] ?? PanelColors.bgTabInactive)
              .opacity(this.activeFleet === idx ? 1.0 : 0.38)
              .padding({ left: 10, right: 10, top: 5, bottom: 5 })
              .borderRadius(PanelDimens.radius)
              .onClick(() => { this.selectFleet(idx); })
          }
        }, (_tab: string, idx: number) => `fleet-${idx}`)
      }
      .width('100%')
      .constraintSize({ minWidth: TAB_BAR_MIN_CONTENT_WIDTH })
      .height(PanelDimens.tabBarH)
      .padding({ left: 8, right: 8 })
      .alignItems(VerticalAlign.Center)
    }
    .width('100%')
    .height(PanelDimens.tabBarH)
    .backgroundColor(PanelColors.bgTabs)
    .scrollable(ScrollDirection.Horizontal)
    .scrollBar(BarState.Off)
    .edgeEffect(EdgeEffect.None)
  }

  // @Builder 按值传递的参数不是响应式的：组件只会用首次构建时的快照渲染，
  // 之后 @Local 变化不会刷新（这是「进港后面板数值一直是 '--'、切舰队不刷新」
  // 的根因）。改为传入闭包，让 Text 在求值时直接读取 @Local，从而建立依赖。
  @Builder AdmiralTag(text: () => string) {
    Text(text())
      .fontSize(PanelDimens.fontSm)
      .fontColor(PanelColors.txtMuted)
      .maxLines(1)
      .textOverflow({ overflow: TextOverflow.Ellipsis })
      .padding({ left: 6, right: 6, top: 2, bottom: 2 })
      .backgroundColor(PanelColors.bgSection)
      .borderRadius(PanelDimens.radius)
      .borderWidth(PanelDimens.borderW)
      .borderColor(PanelColors.rowBorder)
  }

  @Builder AdmiralHeader() {
    Scroll() {
      Row({ space: 4 }) {
        this.AdmiralTag((): string => this.admiralName)
        this.AdmiralTag((): string => this.admiralRank)
        this.AdmiralTag((): string => `提督经验 ${this.admiralExperience}`)
        this.AdmiralTag((): string => `今日: ${this.todaySenka}`)
        this.AdmiralTag((): string => `舰娘: ${this.shipCapacity}`)
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
    .backgroundColor(PanelColors.bg)
    .align(Alignment.TopStart)
    .borderWidth({ bottom: PanelDimens.borderW })
    .borderColor(PanelColors.rowBorder)
  }

  private useNarrowResourceLayout(): boolean {
    return this.panelWidth < RESOURCE_NARROW_WIDTH;
  }

  private resourceBarHeight(): number {
    return this.useNarrowResourceLayout() ? RESOURCE_BAR_NARROW_H : RESOURCE_BAR_H;
  }

  @Builder ResourceWideRow() {
    Row({ space: 7 }) {
      if (this.materials) {
        ResourceAmount({ icon: resourceIconPath('fuel'), value: this.materials.fuel, gain: this.sortieGains?.fuel ?? 0, textColor: PanelColors.txtMuted })
        ResourceAmount({ icon: resourceIconPath('ammo'), value: this.materials.ammo, gain: this.sortieGains?.ammo ?? 0, textColor: PanelColors.txtMuted })
        ResourceAmount({ icon: resourceIconPath('steel'), value: this.materials.steel, gain: this.sortieGains?.steel ?? 0, textColor: PanelColors.txtMuted })
        ResourceAmount({ icon: resourceIconPath('bauxite'), value: this.materials.bauxite, gain: this.sortieGains?.bauxite ?? 0, textColor: PanelColors.txtMuted })
        Blank().layoutWeight(1)
        ResourceAmount({ icon: resourceIconPath('instantBuild'), value: this.materials.instantBuild, gain: this.sortieGains?.instantBuild ?? 0, textColor: PanelColors.txtMuted })
        ResourceAmount({ icon: resourceIconPath('instantRepair'), value: this.materials.instantRepair, gain: this.sortieGains?.instantRepair ?? 0, textColor: PanelColors.txtMuted })
        ResourceAmount({ icon: resourceIconPath('devMaterial'), value: this.materials.devMaterial, gain: this.sortieGains?.devMaterial ?? 0, textColor: PanelColors.txtMuted })
        ResourceAmount({ icon: resourceIconPath('screw'), value: this.materials.screw, gain: this.sortieGains?.screw ?? 0, textColor: PanelColors.txtMuted })
      } else {
        Text('Loading Data...')
          .fontSize(PanelDimens.fontSm).fontColor(PanelColors.txtMuted)
      }
    }
    .width('100%')
    .height(RESOURCE_BAR_H)
    .alignItems(VerticalAlign.Center)
  }

  @Builder ResourceNarrowRows() {
    Column() {
      if (this.materials) {
        Row() {
          Row({ space: 7 }) {
            ResourceAmount({ icon: resourceIconPath('fuel'), value: this.materials.fuel, gain: this.sortieGains?.fuel ?? 0, textColor: PanelColors.txtMuted })
            ResourceAmount({ icon: resourceIconPath('steel'), value: this.materials.steel, gain: this.sortieGains?.steel ?? 0, textColor: PanelColors.txtMuted })
          }
          .alignItems(VerticalAlign.Center)

          Blank().layoutWeight(1)

          Row({ space: 7 }) {
            ResourceAmount({ icon: resourceIconPath('instantRepair'), value: this.materials.instantRepair, gain: this.sortieGains?.instantRepair ?? 0, textColor: PanelColors.txtMuted })
            ResourceAmount({ icon: resourceIconPath('devMaterial'), value: this.materials.devMaterial, gain: this.sortieGains?.devMaterial ?? 0, textColor: PanelColors.txtMuted })
          }
          .alignItems(VerticalAlign.Center)
        }
        .width('100%')
        .layoutWeight(1)
        .alignItems(VerticalAlign.Center)

        Row() {
          Row({ space: 7 }) {
            ResourceAmount({ icon: resourceIconPath('ammo'), value: this.materials.ammo, gain: this.sortieGains?.ammo ?? 0, textColor: PanelColors.txtMuted })
            ResourceAmount({ icon: resourceIconPath('bauxite'), value: this.materials.bauxite, gain: this.sortieGains?.bauxite ?? 0, textColor: PanelColors.txtMuted })
          }
          .alignItems(VerticalAlign.Center)

          Blank().layoutWeight(1)

          Row({ space: 7 }) {
            ResourceAmount({ icon: resourceIconPath('instantBuild'), value: this.materials.instantBuild, gain: this.sortieGains?.instantBuild ?? 0, textColor: PanelColors.txtMuted })
            ResourceAmount({ icon: resourceIconPath('screw'), value: this.materials.screw, gain: this.sortieGains?.screw ?? 0, textColor: PanelColors.txtMuted })
          }
          .alignItems(VerticalAlign.Center)
        }
        .width('100%')
        .layoutWeight(1)
        .alignItems(VerticalAlign.Center)
      } else {
        Row() {
          Text('Loading Data...')
            .fontSize(PanelDimens.fontSm).fontColor(PanelColors.txtMuted)
        }
        .width('100%')
        .layoutWeight(1)
        .alignItems(VerticalAlign.Center)
      }
    }
    .width('100%')
    .height(RESOURCE_BAR_NARROW_H)
  }

  @Builder StatusBar() {
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
    .backgroundColor(PanelColors.bg)
    .borderWidth({ bottom: PanelDimens.borderW })
    .borderColor(PanelColors.rowBorder)
  }

  // value 必须是闭包（参见 AdmiralTag 的说明），否则切换舰队 / 异步算完
  // 制空索敌后 UI 不刷新。
  @Builder FleetStat(label: string, value: () => string) {
    Row() {
      Text(label)
        .fontSize(PanelDimens.fontSm)
        .fontColor(PanelColors.txtMuted)
      Text(value())
        .fontSize(PanelDimens.fontSm)
        .fontWeight(FontWeight.Medium)
        .fontColor(PanelColors.stat)
        .margin({ left: 3 })
    }
    .height(15)
    .padding({ left: 6, right: 6 })
    .backgroundColor('#66252940')
    .borderRadius(2)
    .alignItems(VerticalAlign.Center)
  }

  private formatLoSScore(value: number): string {
    if (value === 0 || !Number.isFinite(value)) return '--';
    return value.toFixed(1);
  }

  private formatLoSTotal(): string {
    if (this.fleetLoSTotal <= 0 || !Number.isFinite(this.fleetLoSTotal)) return '--';
    return `${Math.floor(this.fleetLoSTotal)}`;
  }

  @Builder LoSDetailValue(label: string, value: number, color: string) {
    Row() {
      Text(label)
        .fontSize(PanelDimens.fontSm)
        .fontColor(PanelColors.txtMuted)
      Text(this.formatLoSScore(value))
        .fontSize(PanelDimens.fontSm)
        .fontWeight(FontWeight.Medium)
        .fontColor(color)
        .margin({ left: 3 })
    }
    .alignItems(VerticalAlign.Center)
  }

  @Builder LoSDetailPopup() {
    Column({ space: 5 }) {
      Row() {
        Text('索敌总和:')
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.txtMuted)
        Text(this.formatLoSTotal())
          .fontSize(PanelDimens.fontSm)
          .fontWeight(FontWeight.Medium)
          .fontColor('#ffd86b')
          .margin({ left: 4 })
      }
      .alignItems(VerticalAlign.Center)

      Text('33式')
        .fontSize(PanelDimens.fontSm)
        .fontColor(PanelColors.txtPrimary)

      Row({ space: 12 }) {
        this.LoSDetailValue('x1', this.fleetLoS33x1, '#56d8e0')
        this.LoSDetailValue('x2', this.fleetLoS33x2, '#b7f7c8')
      }
      Row({ space: 12 }) {
        this.LoSDetailValue('x3', this.fleetLoS33x3, '#ffd86b')
        this.LoSDetailValue('x4', this.fleetLoS33x4, '#ff9f7a')
      }
    }
    .padding({ left: 10, right: 10, top: 8, bottom: 8 })
    .backgroundColor('#f01a1d2e')
    .borderRadius(4)
    .border({ width: PanelDimens.borderW, color: PanelColors.rowBorder })
  }

  @Builder FleetLoSStat() {
    Row() {
      Text('索敌')
        .fontSize(PanelDimens.fontSm)
        .fontColor(PanelColors.txtMuted)
      Text(this.fleetLoS !== 0 ? this.fleetLoS.toFixed(1) : '--')
        .fontSize(PanelDimens.fontSm)
        .fontWeight(FontWeight.Medium)
        .fontColor(PanelColors.stat)
        .margin({ left: 3 })
    }
    .height(15)
    .padding({ left: 6, right: 6 })
    .backgroundColor('#66252940')
    .borderRadius(2)
    .alignItems(VerticalAlign.Center)
    .gesture(
      LongPressGesture({ repeat: false, duration: 400 })
        .onAction(() => { this.showLoSDetail = true; })
        .onActionEnd(() => { this.showLoSDetail = false; })
        .onActionCancel(() => { this.showLoSDetail = false; })
    )
    .bindPopup(this.showLoSDetail, {
      builder: this.LoSDetailPopup,
      placement: Placement.Top,
      enableArrow: true,
      onStateChange: (e: PanelPopupStateChangeEvent) => {
        if (!e.isVisible) {
          this.showLoSDetail = false;
        }
      },
    })
  }

  /** Fleet-level calc stats in one horizontal row. */
  @Builder FleetStatsBar() {
    if (this.activeFleet < 4) {
      Scroll() {
        Row({ space: 8 }) {
          this.FleetStat('制空', (): string => this.airPower > 0 ? `${this.airPower}` : '--')
          this.FleetStat('速度', (): string => formatFleetSpeed(this.fleetSpeed))
          this.FleetStat('输送', (): string => this.fleetTpS > 0 ? `S${Math.floor(this.fleetTpS)}/A${Math.floor(this.fleetTpA)}` : '--')
          this.FleetLoSStat()
        }
        .width('100%')
        .constraintSize({ minWidth: FLEET_STATS_MIN_CONTENT_WIDTH })
        .height(PanelDimens.statusBarH)
        .padding({ left: 8, right: 8 })
        .alignItems(VerticalAlign.Center)
      }
      .width('100%')
      .height(PanelDimens.statusBarH)
      .backgroundColor(PanelColors.bgTabs)
      .scrollable(ScrollDirection.Horizontal)
      .scrollBar(BarState.Off)
      .edgeEffect(EdgeEffect.None)
      .borderWidth({ bottom: PanelDimens.borderW })
      .borderColor(PanelColors.rowBorder)
    }
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

  @Builder EmptyState() {
    Column() {
      Text(this.activeFleet >= 4 && this.activeFleet < MAP_TAB_IDX ? '未実装' : 'NO Fleet info')
        .fontSize(PanelDimens.fontMd)
        .fontColor(PanelColors.txtMuted)
        .margin({ top: 24 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Center)
  }

  // ── build ─────────────────────────────────────────────────────────────────

  build() {
    Column() {
      this.TabBar()
      this.AdmiralHeader()
      this.StatusBar()
      this.FleetStatsBar()

      Scroll() {
        Column() {
          if (this.activeFleet === QUEST_TAB_IDX) {
            QuestPanel({ quests: this.quests, compact: false })
          } else if (this.activeFleet === LBAS_TAB_IDX) {
            LbasPanel({
              bases: this.lbases,
              currentAreaId: this.currentLbasAreaId,
              compact: false,
              showKaisyuu: this.showKaisyuu,
              showProficiency: this.showProficiency,
            })
          } else if (this.activeFleet === NDOCK_TAB_IDX) {
            NdockPanel({ ndocks: this.ndocks, compact: false })
          } else if (this.activeFleet === MAP_TAB_IDX) {
            if (this.mapGauges.length > 0) {
              ForEach(this.mapGauges, (gauge: MapGaugeSnapshot) => {
                MapGaugeRow({ gauge })
              }, (gauge: MapGaugeSnapshot) => `gauge-${gauge.mapId}-${gauge.gaugeNum}`)
            } else {
              Column() {
                Text('无数据')
                  .fontSize(PanelDimens.fontMd)
                  .fontColor(PanelColors.txtMuted)
                  .margin({ top: 24 })
                Text('进入海域选择以获得数据')
                  .fontSize(PanelDimens.fontSm)
                  .fontColor(PanelColors.txtFainter)
                  .margin({ top: 6 })
              }
              .width('100%')
              .alignItems(HorizontalAlign.Center)
            }
          } else if (this.ships.length > 0) {
            ForEach(this.ships, (ship: ShipItem, idx: number) => {
              ShipRow({
                ship,
                isFlag: idx === 0,
                specialAttacks: this.specialAttacks,
                showAvatar: this.showAvatar,
                showKaisyuu: this.showKaisyuu,
                showProficiency: this.showProficiency,
                detailUid: this.detailUid,
                onOpenDetail: (uid: number) => { this.openEquipDetail(uid); },
                onCloseDetail: (uid: number) => { this.closeEquipDetail(uid); },
              })
            }, (ship: ShipItem) => `${shipRowKey(ship)}_${this.specialAttacks.join('|')}`)
          } else {
            this.EmptyState()
          }
        }
        .width('100%')
      }
      .layoutWeight(1)
      .align(Alignment.TopStart)
      .scrollBar(BarState.Off)
      .edgeEffect(EdgeEffect.None)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(PanelColors.bg)
    .clip(true)
    .onAreaChange((_oldArea: Area, area: Area) => {
      const width = lengthToNumber(area.width);
      if (width > 0) {
        this.panelWidth = width;
      }
    })
  }
}
