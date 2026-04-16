import { ShipItem } from '../../../../../features/panel/type';
import { FLEET_TAB_COLORS, hpColor, PanelColors, PanelDimens } from '../../../../../features/panel/panelConfig';
import {
  subscribeGameState, getDeckShips, getMaterials, getDecks,
  MaterialsSnapshot, DeckSnapshot, ShipState
} from '../../../../../features/state';

const FLEET_TABS_LABEL: string[] = ['1', '2', '3', '4', '基地', '道具'];

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
  if (cond >= 50) return '#FFD700';   // sparkle — gold
  if (cond >= 40) return PanelColors.txtSub; // normal
  if (cond >= 30) return PanelColors.hpWarn; // tired — yellow
  return PanelColors.hpCrit;               // exhausted — red
}

function condIcon(cond: number): string {
  if (cond >= 50) return '★';
  if (cond >= 40) return '–';
  if (cond >= 30) return '△';
  return '！';
}

/**
 * Bottom-docked info panel for EXPANDED mode (portrait / wide-split).
 * Occupies the remaining space below the game viewport.
 *
 * Displays the currently-selected fleet's ships from live GameState,
 * with resource counts in the status bar.
 */
@ComponentV2
export default struct BottomPanel {
  @Param panelHeight: number = 200;
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

  /**
   * 2-line ship row:
   *   [cond] | name              hp / hpMax  |
   *          | Lv.xxx  [====HP bar====]  ◆cond |
   */
  @Builder ShipRow(ship: ShipItem) {
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
      Column({ space: 4 }) {
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

        // Line 2: Lv | HP bar | cond
        Row({ space: 4 }) {
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
            .width(PanelDimens.statW + 8)
            .textAlign(TextAlign.End)
        }
        .width('100%')
        .alignItems(VerticalAlign.Center)
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

      Scroll() {
        Column() {
          if (this.ships.length > 0) {
            ForEach(this.ships, (ship: ShipItem) => {
              this.ShipRow(ship)
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
