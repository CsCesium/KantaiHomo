import { ShipItem } from '../../../../../features/panel/type';
import { FLEET_TAB_COLORS, hpColor, PanelColors, PanelDimens } from '../../../../../features/panel/panelConfig';

// ── placeholder data (replace with live game data) ─────────────────────────
const PLACEHOLDER_SHIPS: ShipItem[] = [
  { id: 1, name: '阳炎改二',               shipType: '駆', level: 175, hp: 40, hpMax: 40, s1: 99,  s2: 99, s3: 87, s4: 45 },
  { id: 2, name: '阳炎改二甲',              shipType: '駆', level: 153, hp: 40, hpMax: 40, s1: 99,  s2: 99, s3: 87, s4: 45 },
  { id: 3, name: '大舱改二',               shipType: '戦', level:  84, hp: 84, hpMax: 84, s1: 109, s2: 0,  s3: 88, s4: 0  },
  { id: 4, name: 'Conte di Cavour nuovo',  shipType: '戦', level:  80, hp: 80, hpMax: 80, s1: 85,  s2: 0,  s3: 86, s4: 0  },
  { id: 5, name: 'Октябрьская революция',  shipType: '戦', level:  29, hp: 29, hpMax: 29, s1: 15,  s2: 0,  s3: 75, s4: 0  },
  { id: 6, name: '第二十二号海防舰改',       shipType: '海', level:  47, hp:  7, hpMax: 10, s1: 17,  s2: 0,  s3: 62, s4: 35 },
  { id: 7, name: 'Samuel B.Roberts Mk.II', shipType: '護', level:  31, hp: 31, hpMax: 31, s1: 99,  s2: 99, s3: 99, s4: 99 },
];

const FLEET_TABS: string[] = ['1', '2', '3', '4', '基地', '道具'];
const INFO_TABS: string[]  = ['[类型]信息1', '[类型]信息2'];
// ───────────────────────────────────────────────────────────────────────────

/**
 * Bottom-docked info panel for EXPANDED mode (portrait / wide-split).
 * Occupies the remaining space below the game viewport.
 *
 * Visual style references KC3Kai: dark navy background, per-fleet tab colors,
 * 2-line ship rows with avatar placeholder, HP shown as "current / max".
 *
 * Layout (top → bottom):
 *   TabBar    — fleet selector (1-4, 基地, 道具) + info type sub-tabs
 *   StatusBar — resource / sortie metrics
 *   ShipList  — scrollable 2-line ship rows
 */
@ComponentV2
export default struct BottomPanel {
  @Param panelHeight: number = 200;
  @Local activeFleet: number = 0;
  @Local activeInfo: number = 0;

  // ── builders ──────────────────────────────────────────────────────────────

  @Builder TabBar() {
    Row({ space: 3 }) {
      // Fleet tabs — each with its own KC3-style color
      ForEach(FLEET_TABS, (tab: string, idx: number) => {
        Text(tab)
          .fontSize(PanelDimens.fontLg)
          .fontWeight(this.activeFleet === idx ? FontWeight.Bold : FontWeight.Normal)
          .fontColor(PanelColors.txtTabOn)
          .backgroundColor(FLEET_TAB_COLORS[idx] ?? PanelColors.bgTabInactive)
          .opacity(this.activeFleet === idx ? 1.0 : 0.38)
          .padding({ left: 10, right: 10, top: 5, bottom: 5 })
          .borderRadius(PanelDimens.radius)
          .onClick(() => { this.activeFleet = idx; })
      }, (_tab: string, idx: number) => `fleet-${idx}`)

      Blank().layoutWeight(1)

      // Info type sub-tabs
      Row({ space: 0 }) {
        ForEach(INFO_TABS, (tab: string, idx: number) => {
          Text(tab)
            .fontSize(PanelDimens.fontSm)
            .fontColor(this.activeInfo === idx ? PanelColors.txtInfoOn : PanelColors.txtInfoOff)
            .backgroundColor(this.activeInfo === idx ? PanelColors.bgInfoOn : Color.Transparent)
            .padding({ left: 6, right: 6, top: 5, bottom: 5 })
            .borderRadius(PanelDimens.radius)
            .onClick(() => { this.activeInfo = idx; })
        }, (_tab: string, idx: number) => `info-${idx}`)
      }
    }
    .width('100%')
    .height(PanelDimens.tabBarH)
    .backgroundColor(PanelColors.bgTabs)
    .padding({ left: 8, right: 8 })
    .alignItems(VerticalAlign.Center)
  }

  @Builder StatusBar() {
    Row() {
      Text('刷忍: --').fontSize(PanelDimens.fontSm).fontColor(PanelColors.txtMuted)
      Text(' | ').fontSize(PanelDimens.fontSm).fontColor(PanelColors.txtSep)
      Text('数据: --:--').fontSize(PanelDimens.fontSm).fontColor(PanelColors.txtMuted)
      Text(' | ').fontSize(PanelDimens.fontSm).fontColor(PanelColors.txtSep)
      Text('临储: --').fontSize(PanelDimens.fontSm).fontColor(PanelColors.txtMuted)
      Text(' | ').fontSize(PanelDimens.fontSm).fontColor(PanelColors.txtSep)
      Text('品储: --/--TP').fontSize(PanelDimens.fontSm).fontColor(PanelColors.txtMuted)
      Blank().layoutWeight(1)
      Text('--代/--').fontSize(PanelDimens.fontSm).fontColor(PanelColors.txtMuted)
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
   * 2-line ship row, KC3-style:
   *
   *   [avatar] | name              hp / hpMax  |
   *            | Lv.xxx  [====HP bar====]  s1  | [btn]
   */
  @Builder ShipRow(ship: ShipItem) {
    Row() {
      // Avatar placeholder — shows ship type abbreviation until real CG is available
      Column() {
        Text(ship.shipType)
          .fontSize(PanelDimens.fontLg)
          .fontWeight(FontWeight.Bold)
          .fontColor(PanelColors.txtSub)
      }
      .width(PanelDimens.avatarW)
      .backgroundColor(PanelColors.bgAvatar)
      .justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Center)

      // Info column (name + level + HP)
      Column({ space: 4 }) {
        // Line 1: name | HP fraction
        Row() {
          Text(ship.name)
            .fontSize(PanelDimens.fontMd)
            .fontWeight(FontWeight.Medium)
            .fontColor(PanelColors.txtPrimary)
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

        // Line 2: Lv | HP bar | stat
        Row({ space: 4 }) {
          Text(`Lv. ${ship.level}`)
            .fontSize(PanelDimens.fontSm)
            .fontColor(PanelColors.txtSub)
            .width(PanelDimens.levelW)
          Progress({ value: ship.hp, total: ship.hpMax, type: ProgressType.Linear })
            .layoutWeight(1)
            .height(PanelDimens.hpBarH)
            .color(hpColor(ship.hp, ship.hpMax))
            .backgroundColor(PanelColors.bgHpTrack)
          Text(`${ship.s1}`)
            .fontSize(PanelDimens.fontSm)
            .fontColor(PanelColors.stat)
            .width(PanelDimens.statW)
            .textAlign(TextAlign.End)
        }
        .width('100%')
        .alignItems(VerticalAlign.Center)
      }
      .layoutWeight(1)
      .padding({ left: 10, right: 6 })
      .justifyContent(FlexAlign.Center)

      // Action button
      Button('按钮', { type: ButtonType.Normal })
        .fontSize(PanelDimens.fontSm)
        .fontColor(PanelColors.txtSub)
        .backgroundColor(PanelColors.bgBtn)
        .width(PanelDimens.btnW)
        .height(PanelDimens.btnH)
        .borderRadius(PanelDimens.btnRadius)
        .margin({ right: 8 })
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

      Scroll() {
        Column() {
          // List column header
          Row() {
            Text('')
              .width(PanelDimens.avatarW)
            Text('排名')
              .fontSize(PanelDimens.fontSm)
              .fontColor(PanelColors.txtFainter)
              .padding({ left: 10 })
            Blank().layoutWeight(1)
          }
          .width('100%')
          .height(PanelDimens.listHdrH)
          .backgroundColor(PanelColors.bgHeader)
          .alignItems(VerticalAlign.Center)

          // Ship rows
          ForEach(PLACEHOLDER_SHIPS, (ship: ShipItem) => {
            this.ShipRow(ship)
          }, (ship: ShipItem) => `ship-${ship.id}`)
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
