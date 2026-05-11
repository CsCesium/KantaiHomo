import { ShipItem } from '../../../../../features/panel/type';
import { FLEET_TAB_COLORS, PanelColors, PanelDimens, questCategoryStyle, questResetTypeLabel, questProgressLabel } from '../../../../../features/panel/panelConfig';
import {
  subscribeGameState, getDeckShips, getMaterials, getDecks, getGameState,
  MaterialsSnapshot, DeckSnapshot, ShipState,
  getMapGauges,
  MapGaugeSnapshot,
  getQuests,
  QuestSnapshot
} from '../../../../../features/state';
import {
  getFleetFighterPower,
  calcSingleFleetLoS,
  getFleetTP,
  detectFleetSpecialAttack, getSpecialAttackShortLabel, SpecialAttackType,
} from '../../../../../features/calc';
import { APP_STORAGE_PANEL_SHOW_KAISYUU, APP_STORAGE_PANEL_SHOW_PROFICIENCY } from '../../../../../ability/Entry';
import { buildShipCapabilityTags } from '../../../../../features/panel/shipCapabilityTags';
import ShipRow from '../bottom/rows/ShipRow';
import MapGaugeRow from '../bottom/rows/MapGaugeRow';

const FLEET_TABS_LABEL: string[] = ['1', '2', '3', '4', '基地', '道具', '地図', '任務'];
const MAP_TAB_IDX = 6;
const QUEST_TAB_IDX = 7;
/** QuestState.ACTIVE — duplicated to keep this UI file decoupled from domain enum import. */
const QUEST_STATE_ACTIVE = 2;

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
  const slotTypes = activeSlots.map(uid => {
    if (uid <= 0) return 0;
    const mid = slotItemIndex.get(uid);
    return mid !== undefined ? (slotItemEquipTypes.get(mid) ?? 0) : 0;
  });
  const slotIconTypes = activeSlots.map(uid => {
    if (uid <= 0) return 0;
    const mid = slotItemIndex.get(uid);
    return mid !== undefined ? (slotItemIconTypes.get(mid) ?? 0) : 0;
  });
  const slotLevels = activeSlots.map(uid => uid > 0 ? (slotItemLevels.get(uid) ?? 0) : 0);
  const slotAlvs = activeSlots.map(uid => uid > 0 ? (slotItemAlvs.get(uid) ?? 0) : 0);
  let exSlotType = 0;
  let exSlotIconType = 0;
  let exSlotLevel = 0;
  let exSlotAlv = 0;
  if (s.exSlot > 0) {
    const mid = slotItemIndex.get(s.exSlot);
    if (mid !== undefined) {
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
      shipName: s.name,
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
    fuelMax:s.fuelMax,
    ammoMax:s.ammoMax,
    slots: activeSlots,
    slotTypes,
    slotIconTypes,
    slotAirs: activeOnslot,
    slotLevels,
    slotAlvs,
    exSlot: s.exSlot,
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
  @Local decks: DeckSnapshot[] = [];
  @Local airPower: number = 0;
  @Local fleetLoS: number = 0;
  @Local fleetTpS: number = 0;
  @Local fleetTpA: number = 0;
  @Local fleetSpeed: number = -1;
  @Local specialAttack: string = '';
  @Local mapGauges: MapGaugeSnapshot[] = [];
  @Local activeQuests: QuestSnapshot[] = [];
  /** UID of slot whose detail popup is currently open; 0 = none. EquipDetailPanel 自加载行。 */
  @Local detailUid: number = 0;
  /** Show kaisyuu (improvement) star badge; mirrors AppStorage setting. */
  @Local showKaisyuu: boolean = true;
  /** Show aircraft proficiency badge; mirrors AppStorage setting. */
  @Local showProficiency: boolean = true;

  private unsubscribe: (() => void) | null = null;

  aboutToAppear(): void {
    this.refreshSettings();
    this.loadState();
    this.unsubscribe = subscribeGameState((changeType, _state) => {
      if (changeType === 'all' || changeType === 'ships' ||
          changeType === 'decks' || changeType === 'materials' ||
          changeType === 'admiral' || changeType === 'quests' ||
          changeType === 'mapinfo') {
        this.loadState();
      }
    });
  }

  private refreshSettings(): void {
    const k = AppStorage.get<boolean>(APP_STORAGE_PANEL_SHOW_KAISYUU);
    const p = AppStorage.get<boolean>(APP_STORAGE_PANEL_SHOW_PROFICIENCY);
    this.showKaisyuu = k !== undefined ? k : true;
    this.showProficiency = p !== undefined ? p : true;
  }

  aboutToDisappear(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  private loadState(): void {
    this.materials = getMaterials();
    this.decks = [...getDecks()];
    this.mapGauges = [...getMapGauges()];
    this.activeQuests = getQuests().filter(q => q.state === QUEST_STATE_ACTIVE);
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
      const attackType: SpecialAttackType | null = detectFleetSpecialAttack(rawShips);
      this.specialAttack = attackType !== null ? getSpecialAttackShortLabel(attackType) : '';
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

  private tabLabel(idx: number): string {
    if (idx >= 4) return FLEET_TABS_LABEL[idx];
    const deck = this.decks.find(d => d.deckId === idx + 1);
    if (deck?.expeditionReturnTime && deck.expeditionReturnTime > Date.now()) {
      return `${idx + 1}↗`;
    }
    return `${idx + 1}`;
  }

  // ── builders ──────────────────────────────────────────────────────────────

  @Builder TabBar() {
    Row({ space: 3 }) {
      ForEach(FLEET_TABS_LABEL, (_tab: string, idx: number) => {
        Text(this.tabLabel(idx))
          .fontSize(PanelDimens.fontLg)
          .fontWeight(this.activeFleet === idx ? FontWeight.Bold : FontWeight.Normal)
          .fontColor(PanelColors.txtTabOn)
          .backgroundColor(FLEET_TAB_COLORS[idx] ?? PanelColors.bgTabInactive)
          .opacity(this.activeFleet === idx ? 1.0 : 0.38)
          .padding({ left: 10, right: 10, top: 5, bottom: 5 })
          .borderRadius(PanelDimens.radius)
          .onClick(() => { this.selectFleet(idx); })
      }, (_tab: string, idx: number) => `fleet-${idx}`)

      Blank().layoutWeight(1)
    }
    .width('100%')
    .height(PanelDimens.tabBarH)
    .backgroundColor(PanelColors.bgTabs)
    .padding({ left: 8, right: 8 })
    .alignItems(VerticalAlign.Center)
  }

  @Builder StatusBar() {
    Row() {
      if (this.materials) {
        Text(`燃${this.materials.fuel}`)
          .fontSize(PanelDimens.fontSm).fontColor(PanelColors.txtMuted)
        Text(' ').fontSize(PanelDimens.fontSm).fontColor(PanelColors.txtSep)
        Text(`弾${this.materials.ammo}`)
          .fontSize(PanelDimens.fontSm).fontColor(PanelColors.txtMuted)
        Text(' ').fontSize(PanelDimens.fontSm).fontColor(PanelColors.txtSep)
        Text(`鋼${this.materials.steel}`)
          .fontSize(PanelDimens.fontSm).fontColor(PanelColors.txtMuted)
        Text(' ').fontSize(PanelDimens.fontSm).fontColor(PanelColors.txtSep)
        Text(`ボ${this.materials.bauxite}`)
          .fontSize(PanelDimens.fontSm).fontColor(PanelColors.txtMuted)
        Blank().layoutWeight(1)
        Text(`速修${this.materials.instantRepair}`)
          .fontSize(PanelDimens.fontSm).fontColor(PanelColors.txtMuted)
        Text(' ').fontSize(PanelDimens.fontSm).fontColor(PanelColors.txtSep)
        Text(`速建${this.materials.instantBuild}`)
          .fontSize(PanelDimens.fontSm).fontColor(PanelColors.txtMuted)
      } else {
        Text('Loading Data...')
          .fontSize(PanelDimens.fontSm).fontColor(PanelColors.txtMuted)
      }
    }
    .width('100%')
    .height(PanelDimens.statusBarH)
    .padding({ left: 8, right: 8 })
    .backgroundColor(PanelColors.bg)
    .alignItems(VerticalAlign.Center)
    .borderWidth({ bottom: PanelDimens.borderW })
    .borderColor(PanelColors.rowBorder)
  }

  /** Fleet-level calc stats: 制空 + 速度 stacked left, 輸送 + 索敵 stacked right. */
  @Builder FleetStatsBar() {
    if (this.activeFleet < 4) {
      Row() {
        Column() {
          Row() {
            Text('制空')
              .fontSize(PanelDimens.fontSm)
              .fontColor(PanelColors.txtMuted)
            Text(this.airPower > 0 ? `${this.airPower}` : '--')
              .fontSize(PanelDimens.fontSm)
              .fontColor(PanelColors.stat)
              .margin({ left: 3 })
          }
          Text(formatFleetSpeed(this.fleetSpeed))
            .fontSize(PanelDimens.fontSm)
            .fontColor(PanelColors.stat)
            .margin({ top: 1 })
        }
        .alignItems(HorizontalAlign.Start)

        Blank().layoutWeight(1)

        Column() {
          Row() {
            Text('🚚 輸送')
              .fontSize(PanelDimens.fontSm)
              .fontColor(PanelColors.txtMuted)
            Text(this.fleetTpS > 0
              ? `S${Math.floor(this.fleetTpS)}/A${Math.floor(this.fleetTpA)}`
              : '--')
              .fontSize(PanelDimens.fontSm)
              .fontColor(PanelColors.stat)
              .margin({ left: 3 })
          }
          Row() {
            Text('👁 索敵')
              .fontSize(PanelDimens.fontSm)
              .fontColor(PanelColors.txtMuted)
            Text(this.fleetLoS !== 0 ? this.fleetLoS.toFixed(1) : '--')
              .fontSize(PanelDimens.fontSm)
              .fontColor(PanelColors.stat)
              .margin({ left: 3 })
          }
          .margin({ top: 1 })
        }
        .alignItems(HorizontalAlign.End)
      }
      .width('100%')
      .height(PanelDimens.statusBarH * 2)
      .padding({ left: 8, right: 8, top: 2, bottom: 2 })
      .backgroundColor(PanelColors.bgTabs)
      .alignItems(VerticalAlign.Center)
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

  /**
   * Single quest row:
   *   [category icon] | [period chip] | [title] | [progress]
   */
  @Builder QuestRow(quest: QuestSnapshot) {
    Row() {
      // Column 1: category icon (colored text placeholder)
      Column() {
        Text(questCategoryStyle(quest.category).label)
          .fontSize(PanelDimens.fontMd)
          .fontWeight(FontWeight.Bold)
          .fontColor('#ffffff')
      }
      .width(PanelDimens.avatarW)
      .height('100%')
      .backgroundColor(questCategoryStyle(quest.category).color)
      .justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Center)

      // Column 2: period chip
      Text(questResetTypeLabel(quest.type))
        .fontSize(PanelDimens.fontSm)
        .fontColor(PanelColors.txtSub)
        .width(72)
        .textAlign(TextAlign.Center)

      // Column 3: title (description)
      Text(quest.title)
        .fontSize(PanelDimens.fontMd)
        .fontColor(PanelColors.txtPrimary)
        .layoutWeight(1)
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .padding({ left: 8, right: 8 })

      // Column 4: progress
      Text(questProgressLabel(quest.progress, quest.state))
        .fontSize(PanelDimens.fontMd)
        .fontWeight(FontWeight.Medium)
        .fontColor(PanelColors.stat)
        .width(56)
        .textAlign(TextAlign.End)
        .padding({ right: 8 })
    }
    .width('100%')
    .height(PanelDimens.rowH)
    .backgroundColor(PanelColors.bgSection)
    .borderWidth({ bottom: PanelDimens.borderW })
    .borderColor(PanelColors.rowBorder)
    .alignItems(VerticalAlign.Center)
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
      this.StatusBar()
      this.FleetStatsBar()

      Scroll() {
        Column() {
          if (this.activeFleet === QUEST_TAB_IDX) {
            if (this.activeQuests.length > 0) {
              ForEach(this.activeQuests, (quest: QuestSnapshot) => {
                this.QuestRow(quest)
              }, (quest: QuestSnapshot) => `quest-${quest.questId}`)
            } else {
              Column() {
                Text('未接受的任务')
                  .fontSize(PanelDimens.fontMd)
                  .fontColor(PanelColors.txtMuted)
                  .margin({ top: 24 })
                Text('打开任务列表以获得数据')
                  .fontSize(PanelDimens.fontSm)
                  .fontColor(PanelColors.txtFainter)
                  .margin({ top: 6 })
              }
              .width('100%')
              .alignItems(HorizontalAlign.Center)
            }
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
                specialAttack: this.specialAttack,
                showKaisyuu: this.showKaisyuu,
                showProficiency: this.showProficiency,
                detailUid: this.detailUid,
                onOpenDetail: (uid: number) => { this.openEquipDetail(uid); },
                onCloseDetail: (uid: number) => { this.closeEquipDetail(uid); },
              })
            }, (ship: ShipItem) => `ship-${ship.id}`)
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
  }
}
