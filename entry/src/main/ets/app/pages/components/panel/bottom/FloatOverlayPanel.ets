import { MapGaugeInfo, PanelPopupStateChangeEvent, ShipItem } from '../../../../../features/panel/type';
import { hpColor, equipLabel, isAircraftEquipType, kaisyuuIcon, airMasteryIcon, PanelColors, PanelDimens } from '../../../../../features/panel/panelConfig';
import {
  subscribeGameState, getDeckShips, getMaterials, getDecks, getGameState,
  MaterialsSnapshot, DeckSnapshot, ShipState,
  MapGaugeSnapshot,
  getGameServerUrl,
  getMapGauges,
  getShipGraphFilename
} from '../../../../../features/state';
import { getShipBannerUrl } from '../../../../../features/game/shipGraph';
import { getPersistDeps } from '../../../../../infra/deps';
import {
  getFleetFighterPower,
  calcSingleFleetLoS,
  detectFleetSpecialAttack, getSpecialAttackShortLabel, SpecialAttackType,
} from '../../../../../features/calc';
import { SlotItemJoinedRow } from '../../../../../infra/storage/types';
import { EquipDetailPanel } from '../EquipDetailPanel';
import { APP_STORAGE_PANEL_SHOW_KAISYUU, APP_STORAGE_PANEL_SHOW_PROFICIENCY } from '../../../../../ability/Entry';

const OVERLAY_MAP_TAB_IDX = 4;

function shipStateToItem(
  s: ShipState,
  slotItemIndex: Map<number, number>,
  slotItemEquipTypes: Map<number, number>,
  slotItemIconTypes: Map<number, number>,
  slotItemLevels: Map<number, number>,
  slotItemAlvs: Map<number, number>
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

function condColor(cond: number): string {
  if (cond >= 50) return '#FFD700';
  if (cond >= 40) return PanelColors.txtSub;
  if (cond >= 30) return PanelColors.hpWarn;
  return PanelColors.hpCrit;
}

/**
 * Semi-transparent floating panel for COMPACT mode (landscape / small window).
 * Shows fleet air power, LoS(×3), and special attack eligibility.
 */
@ComponentV2
export default struct FloatOverlayPanel {
  @Local activeFleet: number = 0;
  @Local ships: ShipItem[] = [];
  @Local materials: MaterialsSnapshot | null = null;
  @Local decks: DeckSnapshot[] = [];
  @Local airPower: number = 0;
  @Local fleetLoS: number = 0;
  @Local specialAttack: string = '';
  @Local mapGauges: MapGaugeSnapshot[] = [];
  /** UID of slot whose detail popup is currently open; 0 = none. */
  @Local detailUid: number = 0;
  /** Loaded equipment row for the open detail popup. */
  @Local detailRow: SlotItemJoinedRow | null = null;
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
        st.slotItemAlvs
      ));
      const attackType: SpecialAttackType | null = detectFleetSpecialAttack(rawShips);
      this.specialAttack = attackType !== null ? getSpecialAttackShortLabel(attackType) : '';
    } else {
      this.ships = [];
      this.specialAttack = '';
    }
  }

  private async loadCalcStats(): Promise<void> {
    if (this.activeFleet >= 4 || this.activeFleet === OVERLAY_MAP_TAB_IDX) {
      this.airPower = 0;
      this.fleetLoS = 0;
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
      const losResult = await calcSingleFleetLoS(deckId, 3);
      this.fleetLoS = losResult?.losScore ?? 0;
    } catch (_e) {
      this.fleetLoS = 0;
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

  private getMapGaugeInfo(gauge: MapGaugeSnapshot): MapGaugeInfo {
    const areaNo = Math.floor(gauge.mapId / 10);
    const mapNo = gauge.mapId % 10;
    const hpNow = gauge.hpNow ?? 0;
    const hpMax = gauge.hpMax ?? 1;
    const ratio = hpMax > 0 ? hpNow / hpMax : 0;
    const info: MapGaugeInfo = {
      label: `${areaNo}-${mapNo}`,
      gaugeLabel: gauge.gaugeType === 2 ? 'TP' : 'HP',
      hpNow: hpNow,
      hpMax: hpMax,
      ratio: ratio,
      barColor: ratio > 0.5 ? PanelColors.hpOk : ratio > 0.25 ? PanelColors.hpWarn : PanelColors.hpCrit,
    };
    return info;
  }

  private async openEquipDetail(uid: number): Promise<void> {
    if (uid <= 0) return;
    this.detailUid = uid;
    this.detailRow = null;
    try {
      const repo = getPersistDeps()?.repos?.slotitem;
      if (!repo) return;
      const row = await repo.getWithMaster(uid);
      if (this.detailUid === uid) {
        this.detailRow = row;
      }
    } catch (_e) { /* ignore */ }
  }

  private toggleEquipDetail(uid: number): void {
    if (this.detailUid === uid) {
      this.detailUid = 0;
      this.detailRow = null;
    }
  }

  @Builder EquipPopup() {
    EquipDetailPanel({ row: this.detailRow })
  }

  /** Single equipment slot icon with kaisyuu / proficiency badges + long-press detail popup. */
  @Builder EquipSlot(
    uid: number,
    iconType: number,
    equipType: number,
    air: number,
    level: number,
    alv: number,
    size: number,
    isExSlot: boolean = false
  ) {
    Stack() {
      Image(equipLabel(iconType))
        .width(size)
        .height(size)
        .padding(1)
      if (this.showKaisyuu && level > 0 && kaisyuuIcon(level) !== null) {
        Image(kaisyuuIcon(level)!)
          .width(Math.floor(size * 0.6))
          .height(Math.floor(size * 0.6))
          .position({ top: 0, right: 0 })
      }
      if (this.showProficiency && alv > 0 && airMasteryIcon(alv) !== null) {
        Image(airMasteryIcon(alv)!)
          .width(Math.floor(size * 0.7))
          .height(Math.floor(size * 0.7))
          .position({ bottom: 0, left: 0 })
      }
      if (isAircraftEquipType(equipType) && air > 0) {
        Text(`${air}`)
          .fontSize(size >= 14 ? 7 : 6)
          .fontColor('#ffffff')
          .backgroundColor('#cc000000')
          .borderRadius(2)
          .padding({ left: 1, right: 1 })
          .position({ bottom: 0, right: 0 })
      }
    }
    .width(size)
    .height(size)
    .borderRadius(2)
    .backgroundColor(isExSlot ? '#1a2855' : '#252940')
    .gesture(
      LongPressGesture({ repeat: false, duration: 400 })
        .onAction(() => { void this.openEquipDetail(uid); })
    )
    .onClick(() => { this.toggleEquipDetail(uid); })
    .bindPopup(this.detailUid === uid, {
      builder: this.EquipPopup,
      placement: Placement.Top,
      enableArrow: true,
      onStateChange: (e: PanelPopupStateChangeEvent) => {
        if (!e.isVisible && this.detailUid === uid) {
          this.detailUid = 0;
          this.detailRow = null;
        }
      },
    })
  }

  // ── builders ──────────────────────────────────────────────────────────────

  /**
   * Compact 2-line (+ optional special-attack label) ship row:
   *
   *   [⚡特殊攻撃名]             (flagship only, when eligible)
   *   name (flex)   hp/hpMax
   *   Lv.  [HP bar]  ◆cond  [s1][s2]…[ex]
   */
  @Builder ShipRow(ship: ShipItem, isFlag: boolean) {
    Column({ space: 2 }) {
      // Special attack badge — flagship only
      if (isFlag && this.specialAttack !== '') {
        Row() {
          Text(`⚡ ${this.specialAttack}`)
            .fontSize(8)
            .fontColor('#FFD700')
            .backgroundColor('#1a1525')
            .padding({ left: 4, right: 4, top: 1, bottom: 1 })
            .borderRadius(2)
        }
        .width('100%')
        .height(12)
      }

      // Line 1: [avatar] name | HP fraction
      Row({ space: 4 }) {
        if (getShipGraphFilename(ship.masterId) && getGameServerUrl()) {
          Image(getShipBannerUrl(ship.masterId, getShipGraphFilename(ship.masterId)!, getGameServerUrl()!))
            .width(32)
            .height(18)
            .objectFit(ImageFit.Cover)
            .borderRadius(2)
        }
        Text(ship.name)
          .fontSize(PanelDimens.fontMd)
          .fontWeight(FontWeight.Medium)
          .fontColor(ship.hp <= 0 ? PanelColors.txtMuted : PanelColors.txtPrimary)
          .layoutWeight(1)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(`${ship.hp}/${ship.hpMax}`)
          .fontSize(PanelDimens.fontMd)
          .fontColor(hpColor(ship.hp, ship.hpMax))
          .margin({ left: 4 })
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)

      // Line 2: Lv | HP bar | cond | slot icons
      Row({ space: 2 }) {
        Text(`Lv.${ship.level}`)
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.txtSub)
          .width(PanelDimens.levelW)
        Progress({ value: ship.hp, total: ship.hpMax > 0 ? ship.hpMax : 1, type: ProgressType.Linear })
          .width(PanelDimens.hpBarCompW)
          .height(PanelDimens.hpBarCompH)
          .color(hpColor(ship.hp, ship.hpMax))
          .backgroundColor(PanelColors.overlayRow)
        Text(`◆${ship.s1}`)
          .fontSize(PanelDimens.fontSm)
          .fontColor(condColor(ship.s1))
          .width(PanelDimens.statCompW)
          .textAlign(TextAlign.End)
        Blank().layoutWeight(1)
        // Slot icons (compact)
        Row({ space: 1 }) {
          ForEach(ship.slots, (uid: number, idx: number) => {
            if (uid > 0) {
              this.EquipSlot(uid,
                ship.slotIconTypes[idx] ?? 0,
                ship.slotTypes[idx] ?? 0,
                ship.slotAirs[idx] ?? 0,
                ship.slotLevels[idx] ?? 0,
                ship.slotAlvs[idx] ?? 0,
                12)
            } else {
              Row()
                .width(12)
                .height(12)
                .borderRadius(2)
                .backgroundColor('#55c8cce0')
            }
          }, (uid: number, idx: number) => `sl-${idx}-${uid}`)
          if (ship.exSlot > 0) {
            this.EquipSlot(ship.exSlot,
              ship.exSlotIconType,
              ship.exSlotType,
              0,
              ship.exSlotLevel,
              ship.exSlotAlv,
              12,
              true)
          }
        }
        .alignItems(VerticalAlign.Center)
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)
    }
    .width('100%')
    .height(isFlag && this.specialAttack !== '' ? PanelDimens.rowCompH + 14 : PanelDimens.rowCompH)
    .padding({ left: 8, right: 6, top: 4, bottom: 4 })
    .justifyContent(FlexAlign.Center)
    .borderWidth({ bottom: PanelDimens.borderW })
    .borderColor(PanelColors.overlayRow)
  }

  /** Compact map gauge row for FloatOverlay mode */
  @Builder MapGaugeRow(gauge: MapGaugeSnapshot) {
    Column({ space: 3 }) {
      Row() {
        Text(this.getMapGaugeInfo(gauge).label)
          .fontSize(PanelDimens.fontMd)
          .fontWeight(FontWeight.Bold)
          .fontColor(gauge.cleared ? PanelColors.txtMuted : PanelColors.txtPrimary)
          .layoutWeight(1)
        if (gauge.hpMax !== null) {
          Text(`${this.getMapGaugeInfo(gauge).hpNow}/${this.getMapGaugeInfo(gauge).hpMax}`)
            .fontSize(PanelDimens.fontMd)
            .fontColor(this.getMapGaugeInfo(gauge).barColor)
        } else {
          Text(`x${gauge.defeatCount}`)
            .fontSize(PanelDimens.fontMd)
            .fontColor(PanelColors.stat)
        }
        Text(gauge.cleared ? ' ✓' : ` ${this.getMapGaugeInfo(gauge).gaugeLabel}`)
          .fontSize(PanelDimens.fontSm)
          .fontColor(gauge.cleared ? PanelColors.stat : PanelColors.txtSub)
          .margin({ left: 4 })
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)

      if (gauge.hpMax !== null && gauge.hpMax > 0) {
        Progress({
          value: this.getMapGaugeInfo(gauge).hpNow,
          total: this.getMapGaugeInfo(gauge).hpMax,
          type: ProgressType.Linear
        })
          .width('100%')
          .height(PanelDimens.hpBarCompH)
          .color(this.getMapGaugeInfo(gauge).barColor)
          .backgroundColor(PanelColors.overlayRow)
      }
    }
    .width('100%')
    .height(PanelDimens.rowCompH)
    .padding({ left: 8, right: 8, top: 4, bottom: 4 })
    .justifyContent(FlexAlign.Center)
    .borderWidth({ bottom: PanelDimens.borderW })
    .borderColor(PanelColors.overlayRow)
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

      // Air power + LoS stats line (hidden on map tab)
      if (this.activeFleet !== OVERLAY_MAP_TAB_IDX) {
        Row() {
          Text('制空')
            .fontSize(PanelDimens.fontSm)
            .fontColor(PanelColors.overlayTxt)
          Text(this.airPower > 0 ? `${this.airPower}` : '--')
            .fontSize(PanelDimens.fontSm)
            .fontColor(PanelColors.stat)
            .margin({ left: 3 })
          Blank().layoutWeight(1)
          Text('索敵')
            .fontSize(PanelDimens.fontSm)
            .fontColor(PanelColors.overlayTxt)
          Text(this.fleetLoS !== 0 ? this.fleetLoS.toFixed(1) : '--')
            .fontSize(PanelDimens.fontSm)
            .fontColor(PanelColors.stat)
            .margin({ left: 3 })
          Text('(×3)')
            .fontSize(PanelDimens.fontSm - 1)
            .fontColor(PanelColors.txtFainter)
            .margin({ left: 2 })
        }
        .width('100%')
        .height(PanelDimens.statusBarH)
        .padding({ left: 8, right: 8 })
        .alignItems(VerticalAlign.Center)
        .borderWidth({ bottom: PanelDimens.borderW })
        .borderColor(PanelColors.overlayHdr)
      }

      // Compact fleet selector row (fleets 1-4 + 地図 tab)
      Row({ space: 2 }) {
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

        Text('地図')
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.txtTabOn)
          .backgroundColor(this.activeFleet === OVERLAY_MAP_TAB_IDX ? '#1a3a5c' : PanelColors.bgTabInactive)
          .opacity(this.activeFleet === OVERLAY_MAP_TAB_IDX ? 1.0 : 0.55)
          .padding({ left: 7, right: 7, top: 3, bottom: 3 })
          .borderRadius(PanelDimens.radius)
          .onClick(() => { this.selectFleet(OVERLAY_MAP_TAB_IDX); })

        Blank().layoutWeight(1)
      }
      .width('100%')
      .height(PanelDimens.tabBarH - 4)
      .padding({ left: 8, right: 8 })
      .backgroundColor(PanelColors.bgTabs)
      .alignItems(VerticalAlign.Center)

      // Content area: map gauges or ship list
      Scroll() {
        Column() {
          if (this.activeFleet === OVERLAY_MAP_TAB_IDX) {
            if (this.mapGauges.length > 0) {
              ForEach(this.mapGauges, (gauge: MapGaugeSnapshot) => {
                this.MapGaugeRow(gauge)
              }, (gauge: MapGaugeSnapshot) => `gauge-${gauge.mapId}-${gauge.gaugeNum}`)
            } else {
              Text('データなし')
                .fontSize(PanelDimens.fontSm)
                .fontColor(PanelColors.txtMuted)
                .margin({ top: 16 })
                .alignSelf(ItemAlign.Center)
            }
          } else if (this.ships.length > 0) {
            ForEach(this.ships, (ship: ShipItem, idx: number) => {
              this.ShipRow(ship, idx === 0)
            }, (ship: ShipItem) => `ship-${ship.id}`)
          } else {
            Text('データなし')
              .fontSize(PanelDimens.fontSm)
              .fontColor(PanelColors.txtMuted)
              .margin({ top: 16 })
              .alignSelf(ItemAlign.Center)
          }
        }
        .width('100%')
      }
      .layoutWeight(1)
      .scrollBar(BarState.Off)
      .edgeEffect(EdgeEffect.None)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(PanelColors.overlayBg)
    .backdropBlur(PanelDimens.overlayBlur)
    .clip(true)
  }
}
