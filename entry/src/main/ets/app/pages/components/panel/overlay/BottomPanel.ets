import promptAction from '@ohos.promptAction';
import { ShipItem } from '../../../../../features/panel/type';
import { FLEET_TAB_COLORS, hpColor, equipLabel, isAircraftCategory, PanelColors, PanelDimens } from '../../../../../features/panel/panelConfig';
import {
  subscribeGameState, getDeckShips, getMaterials, getDecks, getGameState,
  MaterialsSnapshot, DeckSnapshot, ShipState
} from '../../../../../features/state';
import { getPersistDeps } from '../../../../../infra/deps';
import {
  getFleetFighterPower,
  calcSingleFleetLoS,
  detectFleetSpecialAttack, getSpecialAttackShortLabel, SpecialAttackType,
} from '../../../../../features/calc';

const FLEET_TABS_LABEL: string[] = ['1', '2', '3', '4', '基地', '道具'];

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
  slotItemIconTypes: Map<number, number>,
  slotItemAircraftCategories: Map<number, number>
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
  const slotAircraftCats = activeSlots.map(uid => {
    if (uid <= 0) return 0;
    const mid = slotItemIndex.get(uid);
    return mid !== undefined ? (slotItemAircraftCategories.get(mid) ?? 0) : 0;
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
    slotAircraftCategories: slotAircraftCats,
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

  private unsubscribe: (() => void) | null = null;

  aboutToAppear(): void {
    this.loadState();
    this.unsubscribe = subscribeGameState((changeType, _state) => {
      if (changeType === 'all' || changeType === 'ships' ||
          changeType === 'decks' || changeType === 'materials' ||
          changeType === 'admiral' || changeType === 'quests') {
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
        st.slotItemAircraftCategories
      ));
      const attackType: SpecialAttackType | null = detectFleetSpecialAttack(rawShips);
      this.specialAttack = attackType !== null ? getSpecialAttackShortLabel(attackType) : '';
    } else {
      this.ships = [];
      this.specialAttack = '';
    }
  }

  private async loadCalcStats(): Promise<void> {
    if (this.activeFleet >= 4) {
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

  /** Fleet-level calc stats: air power and LoS (branch ×3). */
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
      // Cond (morale) indicator column
      Column() {
        Text(condIcon(ship.s1))
          .fontSize(PanelDimens.fontLg)
          .fontWeight(FontWeight.Bold)
          .fontColor(condColor(ship.s1))
      }
      .width(PanelDimens.avatarW)
      .height('100%')
      .backgroundColor(PanelColors.bgAvatar)
      .justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Center)

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
                  if (isAircraftCategory(ship.slotAircraftCategories[idx] ?? 0)) {
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
      Text(this.activeFleet >= 4 ? '未実装' : '舰队データなし')
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
          if (this.ships.length > 0) {
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
