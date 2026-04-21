import promptAction from '@ohos.promptAction';
import { ShipItem } from '../../../../../features/panel/type';
import { hpColor, equipLabel, isAircraftEquipType, PanelColors, PanelDimens } from '../../../../../features/panel/panelConfig';
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

  private isOnExpedition(idx: number): boolean {
    if (idx >= 4) return false;
    const deck = this.decks.find(d => d.deckId === idx + 1);
    return !!(deck?.expeditionReturnTime && deck.expeditionReturnTime > Date.now());
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

      // Line 1: name | HP fraction
      Row() {
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
          .layoutWeight(1)
          .height(PanelDimens.hpBarCompH)
          .color(hpColor(ship.hp, ship.hpMax))
          .backgroundColor(PanelColors.overlayRow)
        Text(`◆${ship.s1}`)
          .fontSize(PanelDimens.fontSm)
          .fontColor(condColor(ship.s1))
          .width(PanelDimens.statCompW)
          .textAlign(TextAlign.End)
        // Slot icons (compact)
        Row({ space: 1 }) {
          ForEach(ship.slots, (uid: number, idx: number) => {
            if (uid > 0) {
              Stack({ alignContent: Alignment.BottomEnd }) {
                Image(equipLabel(ship.slotIconTypes[idx] ?? 0))
                  .width(12)
                  .height(12)
                  .padding(1)
                if (isAircraftEquipType(ship.slotTypes[idx] ?? 0)) {
                  Text(`${ship.slotAirs[idx] ?? 0}`)
                    .fontSize(6)
                    .fontColor('#ffffff')
                    .backgroundColor('#cc000000')
                    .borderRadius(2)
                    .padding({ left: 1, right: 1 })
                }
              }
              .width(12)
              .height(12)
              .borderRadius(2)
              .backgroundColor('#252940')
              .onClick(() => { showEquipToast(uid); })
            } else {
              Row()
                .width(12)
                .height(12)
                .borderRadius(2)
                .backgroundColor('#55c8cce0')
            }
          }, (uid: number, idx: number) => `sl-${idx}-${uid}`)
          if (ship.exSlot > 0) {
            Image(equipLabel(ship.exSlotIconType))
              .width(13)
              .height(12)
              .padding(1)
              .margin({ left: 1 })
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
    .width('100%')
    .height(isFlag && this.specialAttack !== '' ? PanelDimens.rowCompH + 14 : PanelDimens.rowCompH)
    .padding({ left: 8, right: 6, top: 4, bottom: 4 })
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

      // Air power + LoS stats line
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

      // Compact fleet selector row
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

        Blank().layoutWeight(1)
      }
      .width('100%')
      .height(PanelDimens.tabBarH - 4)
      .padding({ left: 8, right: 8 })
      .backgroundColor(PanelColors.bgTabs)
      .alignItems(VerticalAlign.Center)

      // Ship list
      Scroll() {
        Column() {
          if (this.ships.length > 0) {
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
