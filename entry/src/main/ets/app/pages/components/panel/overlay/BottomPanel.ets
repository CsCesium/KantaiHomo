import promptAction from '@ohos.promptAction';
import { MapGaugeInfo, ShipItem } from '../../../../../features/panel/type';
import { FLEET_TAB_COLORS, hpColor, equipLabel, isAircraftEquipType, PanelColors, PanelDimens } from '../../../../../features/panel/panelConfig';
import {
  subscribeGameState, getDeckShips, getMaterials, getDecks, getGameState,
  getShipGraphFilename, getGameServerUrl,
  MaterialsSnapshot, DeckSnapshot, ShipState,
  getMapGauges,
  MapGaugeSnapshot
} from '../../../../../features/state';
import { getShipBannerUrl } from '../../../../../features/game/shipGraph';
import { getPersistDeps } from '../../../../../infra/deps';
import {
  getFleetFighterPower,
  calcSingleFleetLoS,
  detectFleetSpecialAttack, getSpecialAttackShortLabel, SpecialAttackType,
} from '../../../../../features/calc';

const FLEET_TABS_LABEL: string[] = ['1', '2', '3', '4', '基地', '道具', '地図'];
const MAP_TAB_IDX = 6;

async function showEquipToast(slotUid: number): Promise<void> {
  try {
    const repo = getPersistDeps()?.repos?.slotitem;
    if (!repo) return;
    const row = await repo.getWithMaster(slotUid);
    if (!row?.mst_name) return;
    const stars = row.level ?? 0;
    const msg = stars > 0 ? `${row.mst_name} ★${stars}` : row.mst_name;
    promptAction.showToast({ message: msg, duration: 2000 });
  } catch (_e) { /* ignore */ }
}

function shipStateToItem(
  s: ShipState,
  slotItemIndex: Map<number, number>,
  slotItemEquipTypes: Map<number, number>,
  slotItemIconTypes: Map<number, number>
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
  let exSlotType = 0;
  let exSlotIconType = 0;
  if (s.exSlot > 0) {
    const mid = slotItemIndex.get(s.exSlot);
    if (mid !== undefined) {
      exSlotType = slotItemEquipTypes.get(mid) ?? 0;
      exSlotIconType = slotItemIconTypes.get(mid) ?? 0;
    }
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
    slots: activeSlots,
    slotTypes,
    slotIconTypes,
    slotAirs: activeOnslot,
    exSlot: s.exSlot,
    exSlotType,
    exSlotIconType,
  };
}

function condColor(cond: number): string {
  if (cond >= 50) return '#FFD700';
  if (cond >= 40) return PanelColors.txtSub;
  if (cond >= 30) return PanelColors.hpWarn;
  return PanelColors.hpCrit;
}

function condIcon(cond: number): string {
  if (cond >= 50) return '★';
  if (cond >= 40) return '–';
  if (cond >= 30) return '△';
  return '！';
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
  @Local specialAttack: string = '';
  @Local mapGauges: MapGaugeSnapshot[] = [];

  private unsubscribe: (() => void) | null = null;

  aboutToAppear(): void {
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
        st.slotItemIconTypes
      ));
      const attackType: SpecialAttackType | null = detectFleetSpecialAttack(rawShips);
      this.specialAttack = attackType !== null ? getSpecialAttackShortLabel(attackType) : '';
    } else {
      this.ships = [];
      this.specialAttack = '';
    }
  }

  private async loadCalcStats(): Promise<void> {
    if (this.activeFleet >= 4 || this.activeFleet === MAP_TAB_IDX) {
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

  private tabLabel(idx: number): string {
    if (idx >= 4) return FLEET_TABS_LABEL[idx];
    const deck = this.decks.find(d => d.deckId === idx + 1);
    if (deck?.expeditionReturnTime && deck.expeditionReturnTime > Date.now()) {
      return `${idx + 1}↗`;
    }
    return `${idx + 1}`;
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
        Text('データ読み込み中...')
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

  /** Fleet-level calc stats: air power and LoS (branch ×3). Hidden on map tab. */
  @Builder FleetStatsBar() {
    if (this.activeFleet < 4) {
      Row() {
        Text('制空')
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.txtMuted)
        Text(this.airPower > 0 ? `${this.airPower}` : '--')
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.stat)
          .margin({ left: 3 })
        Blank().layoutWeight(1)
        Text('索敵')
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.txtMuted)
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
      .backgroundColor(PanelColors.bgTabs)
      .alignItems(VerticalAlign.Center)
      .borderWidth({ bottom: PanelDimens.borderW })
      .borderColor(PanelColors.rowBorder)
    }
  }

  /**
   * 2-line (+ optional special-attack label) ship row:
   *   [cond] | [⚡特殊攻撃名]  (flagship only, when eligible)
   *          | name              hp / hpMax
   *          | Lv.xxx  [====HP bar====]  ◆cond  [s1]…[ex]
   */
  @Builder ShipRow(ship: ShipItem, isFlag: boolean) {
    Row() {
      // Ship banner / avatar column
      Stack({ alignContent: Alignment.BottomEnd }) {
        if (getShipGraphFilename(ship.masterId) && getGameServerUrl()) {
          Image(getShipBannerUrl(ship.masterId, getShipGraphFilename(ship.masterId)!, getGameServerUrl()!))
            .width(PanelDimens.avatarW)
            .height('100%')
            .objectFit(ImageFit.Cover)
        } else {
          Column() {
            Text(condIcon(ship.s1))
              .fontSize(PanelDimens.fontLg)
              .fontWeight(FontWeight.Bold)
              .fontColor(condColor(ship.s1))
          }
          .width(PanelDimens.avatarW)
          .height('100%')
          .justifyContent(FlexAlign.Center)
          .alignItems(HorizontalAlign.Center)
        }
        // Cond badge (bottom-right corner overlay)
        Text(condIcon(ship.s1))
          .fontSize(8)
          .fontColor(condColor(ship.s1))
          .backgroundColor('#CC000000')
          .padding(1)
          .borderRadius(2)
          .margin({ right: 1, bottom: 1 })
      }
      .width(PanelDimens.avatarW)
      .height('100%')
      .backgroundColor(PanelColors.bgAvatar)
      .clip(true)

      // Info column
      Column({ space: 3 }) {
        // Special attack badge — only for flagship when eligible
        if (isFlag && this.specialAttack !== '') {
          Row() {
            Text(`⚡ ${this.specialAttack}`)
              .fontSize(9)
              .fontColor('#FFD700')
              .backgroundColor('#1a1525')
              .padding({ left: 5, right: 5, top: 1, bottom: 1 })
              .borderRadius(2)
          }
          .width('100%')
          .height(14)
        }

        // Line 1: name | HP fraction
        Row() {
          Text(ship.name)
            .fontSize(PanelDimens.fontMd)
            .fontWeight(FontWeight.Medium)
            .fontColor(ship.hp <= 0 ? PanelColors.txtMuted : PanelColors.txtPrimary)
            .layoutWeight(1)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
          Text(`${ship.hp} / ${ship.hpMax}`)
            .fontSize(PanelDimens.fontMd)
            .fontColor(hpColor(ship.hp, ship.hpMax))
            .margin({ left: 8 })
        }
        .width('100%')
        .alignItems(VerticalAlign.Center)

        // Line 2: Lv | HP bar | cond | equipment slot icons
        Row({ space: 3 }) {
          Text(`Lv.${ship.level}`)
            .fontSize(PanelDimens.fontSm)
            .fontColor(PanelColors.txtSub)
            .width(PanelDimens.levelW)
          Progress({ value: ship.hp, total: ship.hpMax > 0 ? ship.hpMax : 1, type: ProgressType.Linear })
            .layoutWeight(1)
            .height(PanelDimens.hpBarH)
            .color(hpColor(ship.hp, ship.hpMax))
            .backgroundColor(PanelColors.bgHpTrack)
          Text(`◆${ship.s1}`)
            .fontSize(PanelDimens.fontSm)
            .fontColor(condColor(ship.s1))
            .width(PanelDimens.statW)
            .textAlign(TextAlign.End)
          // Slot icons
          Row({ space: 1 }) {
            ForEach(ship.slots, (uid: number, idx: number) => {
              if (uid > 0) {
                Stack({ alignContent: Alignment.BottomEnd }) {
                  Image(equipLabel(ship.slotIconTypes[idx] ?? 0))
                    .width(14)
                    .height(14)
                    .padding(1)
                  if (isAircraftEquipType(ship.slotTypes[idx] ?? 0)) {
                    Text(`${ship.slotAirs[idx] ?? 0}`)
                      .fontSize(7)
                      .fontColor('#ffffff')
                      .backgroundColor('#cc000000')
                      .borderRadius(2)
                      .padding({ left: 1, right: 1 })
                  }
                }
                .width(14)
                .height(14)
                .borderRadius(2)
                .backgroundColor('#252940')
                .onClick(() => { showEquipToast(uid); })
              } else {
                Row()
                  .width(14)
                  .height(14)
                  .borderRadius(2)
                  .backgroundColor('#55c8cce0')
              }
            }, (uid: number, idx: number) => `sl-${idx}-${uid}`)
            if (ship.exSlot > 0) {
              Image(equipLabel(ship.exSlotIconType))
                .width(15)
                .height(14)
                .padding(1)
                .margin({ left: 2 })
                .borderRadius(2)
                .backgroundColor('#1a2855')
                .onClick(() => { showEquipToast(ship.exSlot); })
            }
          }
          .alignItems(VerticalAlign.Center)
        }
        .width('100%')
        .alignItems(VerticalAlign.Center)
      }
      .layoutWeight(1)
      .padding({ left: 10, right: 10 })
      .justifyContent(FlexAlign.Center)
    }
    .width('100%')
    .height(isFlag && this.specialAttack !== '' ? PanelDimens.rowH + 16 : PanelDimens.rowH)
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

  /** Single map gauge row: mapId label | HP bar | fraction */
  @Builder MapGaugeRow(gauge: MapGaugeSnapshot) {
    Row() {
      // Map label
      Column() {
        Text(this.getMapGaugeInfo(gauge).label)
          .fontSize(PanelDimens.fontLg)
          .fontWeight(FontWeight.Bold)
          .fontColor(gauge.cleared ? PanelColors.txtMuted : PanelColors.txtPrimary)
          .textAlign(TextAlign.Center)
        Text(gauge.cleared ? '通関' : this.getMapGaugeInfo(gauge).gaugeLabel)
          .fontSize(PanelDimens.fontSm)
          .fontColor(gauge.cleared ? PanelColors.stat : PanelColors.txtSub)
          .textAlign(TextAlign.Center)
      }
      .width(PanelDimens.avatarW)
      .height('100%')
      .backgroundColor(PanelColors.bgAvatar)
      .justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Center)

      // Info column
      Column({ space: 4 }) {
        // HP fraction
        Row() {
          if (gauge.hpMax !== null) {
            Text(`${this.getMapGaugeInfo(gauge).hpNow}`)
              .fontSize(PanelDimens.fontMd)
              .fontWeight(FontWeight.Medium)
              .fontColor(this.getMapGaugeInfo(gauge).barColor)
            Text(` / ${this.getMapGaugeInfo(gauge).hpMax}`)
              .fontSize(PanelDimens.fontMd)
              .fontColor(PanelColors.txtSub)
            Blank().layoutWeight(1)
            if (gauge.requiredDefeats !== null) {
              Text(`击破: ${gauge.defeatCount}/${gauge.requiredDefeats}`)
                .fontSize(PanelDimens.fontSm)
                .fontColor(PanelColors.txtMuted)
            } else {
              Text(`${Math.round(this.getMapGaugeInfo(gauge).ratio * 100)}%`)
                .fontSize(PanelDimens.fontSm)
                .fontColor(this.getMapGaugeInfo(gauge).barColor)
            }
          } else {
            Text(`撃破: ${gauge.defeatCount}`)
              .fontSize(PanelDimens.fontMd)
              .fontColor(PanelColors.stat)
            Blank().layoutWeight(1)
          }
        }
        .width('100%')
        .alignItems(VerticalAlign.Center)

        // HP bar (only when gauge has HP)
        if (gauge.hpMax !== null && gauge.hpMax > 0) {
          Progress({
            value: this.getMapGaugeInfo(gauge).hpNow,
            total: this.getMapGaugeInfo(gauge).hpMax,
            type: ProgressType.Linear
          })
            .width('100%')
            .height(PanelDimens.hpBarH)
            .color(this.getMapGaugeInfo(gauge).barColor)
            .backgroundColor(PanelColors.bgHpTrack)
        }
      }
      .layoutWeight(1)
      .padding({ left: 10, right: 10 })
      .justifyContent(FlexAlign.Center)
    }
    .width('100%')
    .height(PanelDimens.rowH)
    .backgroundColor(PanelColors.bgSection)
    .borderWidth({ bottom: PanelDimens.borderW })
    .borderColor(PanelColors.rowBorder)
    .alignItems(VerticalAlign.Center)
  }

  // ── build ─────────────────────────────────────────────────────────────────

  build() {
    Column() {
      this.TabBar()
      this.StatusBar()
      this.FleetStatsBar()

      Scroll() {
        Column() {
          if (this.activeFleet === MAP_TAB_IDX) {
            if (this.mapGauges.length > 0) {
              ForEach(this.mapGauges, (gauge: MapGaugeSnapshot) => {
                this.MapGaugeRow(gauge)
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
              this.ShipRow(ship, idx === 0)
            }, (ship: ShipItem) => `ship-${ship.id}`)
          } else {
            this.EmptyState()
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
    .backgroundColor(PanelColors.bg)
    .clip(true)
  }
}
