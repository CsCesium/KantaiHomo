import { ShipItem } from '../../../../../features/panel/type';
import { hpColor, PanelColors, PanelDimens } from '../../../../../features/panel/panelConfig';
import {
  subscribeGameState, getDeckShips, getMaterials, getDecks,
  MaterialsSnapshot, DeckSnapshot, ShipState
} from '../../../../../features/state';

function shipStateToItem(s: ShipState): ShipItem {
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
 * Rendered on top of the game viewport via Stack in the parent.
 *
 * Displays the selected fleet's ships from live GameState.
 * Fleet selector is a compact row of numbered buttons at the top.
 */
@ComponentV2
export default struct FloatOverlayPanel {
  @Local activeFleet: number = 0;
  @Local ships: ShipItem[] = [];
  @Local materials: MaterialsSnapshot | null = null;
  @Local decks: DeckSnapshot[] = [];

  private unsubscribe: (() => void) | null = null;

  aboutToAppear(): void {
    this.loadState();
    this.unsubscribe = subscribeGameState((changeType, _state) => {
      if (changeType === 'all' || changeType === 'ships' ||
          changeType === 'decks' || changeType === 'materials') {
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
  }

  private refreshShips(): void {
    if (this.activeFleet < 4) {
      this.ships = getDeckShips(this.activeFleet + 1).map(shipStateToItem);
    } else {
      this.ships = [];
    }
  }

  private selectFleet(idx: number): void {
    this.activeFleet = idx;
    this.refreshShips();
  }

  private isOnExpedition(idx: number): boolean {
    if (idx >= 4) return false;
    const deck = this.decks.find(d => d.deckId === idx + 1);
    return !!(deck?.expeditionReturnTime && deck.expeditionReturnTime > Date.now());
  }

  // ── builders ──────────────────────────────────────────────────────────────

  /**
   * Compact 2-line ship row:
   *
   *   name (flex)               hp / hpMax
   *   Lv.xxx  [=====HP bar=====]  ◆cond  燃s2
   */
  @Builder ShipRow(ship: ShipItem) {
    Column({ space: 3 }) {
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

      // Line 2: Lv | HP bar | cond | fuel
      Row({ space: 3 }) {
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
          .width(PanelDimens.statCompW + 4)
          .textAlign(TextAlign.End)
        Text(`燃${ship.s2}`)
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.stat)
          .width(PanelDimens.statCompW + 6)
          .textAlign(TextAlign.End)
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)
    }
    .width('100%')
    .height(PanelDimens.rowCompH)
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
            ForEach(this.ships, (ship: ShipItem) => {
              this.ShipRow(ship)
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
