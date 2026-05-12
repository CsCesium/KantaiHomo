import { ShipItem } from '../../../../../features/panel/type';
import { PanelColors, PanelDimens } from '../../../../../features/panel/panelConfig';
import {
  subscribeGameState, getDeckShips, getMaterials, getDecks, getGameState,
  MaterialsSnapshot, DeckSnapshot, ShipState,
  MapGaugeSnapshot,
  getMapGauges,
  getCurrentBattle,
} from '../../../../../features/state';
import {
  applyBattleHp,
  buildHpOverrideMap,
  pickSourceFleet,
} from '../../../../../features/state/battleHpOverride';
import {
  getFleetFighterPower,
  calcSingleFleetLoS,
  getFleetTP,
  detectFleetSpecialAttack, getSpecialAttackShortLabel, SpecialAttackType,
} from '../../../../../features/calc';
import { APP_STORAGE_PANEL_SHOW_KAISYUU, APP_STORAGE_PANEL_SHOW_PROFICIENCY } from '../../../../../ability/Entry';
import { buildShipCapabilityTags } from '../../../../../features/panel/shipCapabilityTags';
import ShipRow from './rows/ShipRow';
import MapGaugeRow from './rows/MapGaugeRow';
import { isPeriodicMapGauge } from './rows/shipHelpers';

const OVERLAY_MAP_TAB_IDX = 4;

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
    ship.s1,
    ship.s2,
    ship.s3,
    ship.exSlot,
    ship.exSlotLevel,
    ship.exSlotAlv,
    ship.slots.join(','),
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
      stype: shipMasterStype.get(s.masterId) ?? 0,
      ctype: shipMasterCtype.get(s.masterId) ?? 0,
      aswCur: s.aswCur,
      slots: activeSlots,
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
    fuelMax: s.fuelMax,
    ammoMax: s.ammoMax,
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
 * Semi-transparent floating panel for COMPACT mode (landscape / small window).
 * Shows fleet air power, unified speed, LoS, and transport TP.
 */
@ComponentV2
export default struct FloatOverlayPanel {
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
  /** UID of slot whose detail popup is currently open; 0 = none. EquipSlot 自己加载详情。 */
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
          changeType === 'mapinfo' || changeType === 'battle') {
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
    // 已通关的海图直接隐藏；活动海图例外，即使 cleared 也保留显示。
    this.mapGauges = getMapGauges().filter(g => !g.cleared || !isPeriodicMapGauge(g));
    this.refreshShips();
    this.loadCalcStats();
  }

  private refreshShips(): void {
    if (this.activeFleet < 4) {
      const st = getGameState().getState();
      const deckId = this.activeFleet + 1;
      const rawShips = getDeckShips(deckId);
      const overrides = buildHpOverrideMap(pickSourceFleet(deckId, getCurrentBattle()));
      this.ships = rawShips.map(s => shipStateToItem(
        applyBattleHp(s, overrides),
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
    if (this.activeFleet >= 4 || this.activeFleet === OVERLAY_MAP_TAB_IDX) {
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

  build() {
    Column() {
      // Compact resource status line
      Row() {
        if (this.materials) {
          Text(`燃${this.materials.fuel}`)
            .fontSize(PanelDimens.fontSm).fontColor(PanelColors.overlayTxt)
          Text(' ').fontSize(PanelDimens.fontSm).fontColor(PanelColors.txtSep)
          Text(`弾${this.materials.ammo}`)
            .fontSize(PanelDimens.fontSm).fontColor(PanelColors.overlayTxt)
          Text(' ').fontSize(PanelDimens.fontSm).fontColor(PanelColors.txtSep)
          Text(`鋼${this.materials.steel}`)
            .fontSize(PanelDimens.fontSm).fontColor(PanelColors.overlayTxt)
          Text(' ').fontSize(PanelDimens.fontSm).fontColor(PanelColors.txtSep)
          Text(`ボ${this.materials.bauxite}`)
            .fontSize(PanelDimens.fontSm).fontColor(PanelColors.overlayTxt)
          Blank().layoutWeight(1)
          Text(`修${this.materials.instantRepair}`)
            .fontSize(PanelDimens.fontSm).fontColor(PanelColors.overlayTxt)
        } else {
          Text('--').fontSize(PanelDimens.fontSm).fontColor(PanelColors.overlayTxt)
        }
      }
      .width('100%')
      .height(PanelDimens.statusBarH)
      .padding({ left: 8, right: 8 })
      .alignItems(VerticalAlign.Center)
      .borderWidth({ bottom: PanelDimens.borderW })
      .borderColor(PanelColors.overlayHdr)

      // 制空 + 速度 stacked (left) | 輸送 + 索敵 stacked (right). Hidden on map tab.
      if (this.activeFleet !== OVERLAY_MAP_TAB_IDX) {
        Row() {
          Column() {
            Row() {
              Text('制空')
                .fontSize(PanelDimens.fontSm)
                .fontColor(PanelColors.overlayTxt)
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
                .fontColor(PanelColors.overlayTxt)
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
                .fontColor(PanelColors.overlayTxt)
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
        .alignItems(VerticalAlign.Center)
        .borderWidth({ bottom: PanelDimens.borderW })
        .borderColor(PanelColors.overlayHdr)
      }

      // Compact fleet selector row — fleets 1-4 grouped on the left, 地図 on the right
      Row() {
        Row({ space: 8 }) {
          ForEach([0, 1, 2, 3], (idx: number) => {
            Text(this.isOnExpedition(idx) ? `${idx + 1}↗` : `${idx + 1}`)
              .fontSize(PanelDimens.fontSm)
              .fontColor(PanelColors.txtTabOn)
              .backgroundColor(this.activeFleet === idx ? '#0d47a1' : PanelColors.bgTabInactive)
              .opacity(this.activeFleet === idx ? 1.0 : 0.55)
              .padding({ left: 9, right: 9, top: 3, bottom: 3 })
              .borderRadius(PanelDimens.radius)
              .onClick(() => { this.selectFleet(idx); })
          }, (idx: number) => `ftab-${idx}`)
        }
        .alignItems(VerticalAlign.Center)

        Blank().layoutWeight(1)

        Text('地図')
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.txtTabOn)
          .backgroundColor(this.activeFleet === OVERLAY_MAP_TAB_IDX ? '#1a3a5c' : PanelColors.bgTabInactive)
          .opacity(this.activeFleet === OVERLAY_MAP_TAB_IDX ? 1.0 : 0.55)
          .padding({ left: 9, right: 9, top: 3, bottom: 3 })
          .borderRadius(PanelDimens.radius)
          .onClick(() => { this.selectFleet(OVERLAY_MAP_TAB_IDX); })

        Blank().layoutWeight(1)
      }
      .width('100%')
      .height(PanelDimens.tabBarH - 4)
      .padding({ left: 8, right: 8 })
      .backgroundColor(PanelColors.bgTabs)
      .alignItems(VerticalAlign.Center)

      // Content area: map gauges or ship list — must stack from top, not center
      Scroll() {
        Column() {
          if (this.activeFleet === OVERLAY_MAP_TAB_IDX) {
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
                showKaisyuu: this.showKaisyuu,
                showProficiency: this.showProficiency,
                detailUid: this.detailUid,
                onOpenDetail: (uid: number) => { this.openEquipDetail(uid); },
                onCloseDetail: (uid: number) => { this.closeEquipDetail(uid); },
              })
            }, shipRowKey)
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
  }
}
