import { ShipItem } from '../../../../../features/panel/type';
import { hpColor, PanelColors, PanelDimens } from '../../../../../features/panel/panelConfig';

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
// ───────────────────────────────────────────────────────────────────────────

/**
 * Semi-transparent floating panel for COMPACT mode (landscape / small window).
 * Rendered on top of the game viewport via Stack in the parent.
 *
 * Visual style: dark glass (overlayBg + backdropBlur), KC3-inspired palette.
 * Width is constrained by the parent; height fills its container.
 *
 * Layout (top → bottom):
 *   StatusLine — compact resource / sortie metrics
 *   ShipList   — 2-line compact rows (no avatar; name + Lv + HP bar + 2 stats)
 */
@ComponentV2
export default struct FloatOverlayPanel {

  /**
   * Compact 2-line ship row without avatar (space-efficient for overlay):
   *
   *   name (flex)        hp / hpMax
   *   Lv.xxx  [=====HP bar=====]  s1  s2  [btn]
   */
  @Builder ShipRow(ship: ShipItem) {
    Column({ space: 3 }) {
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
          .margin({ left: 6 })
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)

      // Line 2: Lv | HP bar | 2 stats | button
      Row({ space: 4 }) {
        Text(`Lv. ${ship.level}`)
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.txtSub)
          .width(PanelDimens.levelW)
        Progress({ value: ship.hp, total: ship.hpMax, type: ProgressType.Linear })
          .layoutWeight(1)
          .height(PanelDimens.hpBarCompH)
          .color(hpColor(ship.hp, ship.hpMax))
          .backgroundColor(PanelColors.overlayRow)
        Text(`${ship.s1}`).fontSize(PanelDimens.fontSm).fontColor(PanelColors.stat).width(PanelDimens.statCompW).textAlign(TextAlign.End)
        Text(`${ship.s2}`).fontSize(PanelDimens.fontSm).fontColor(PanelColors.stat).width(PanelDimens.statCompW).textAlign(TextAlign.End)
        Button('按钮', { type: ButtonType.Normal })
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.txtSub)
          .backgroundColor(PanelColors.overlayBtn)
          .width(PanelDimens.btnCompW)
          .height(PanelDimens.btnCompH)
          .borderRadius(PanelDimens.btnRadius)
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)
    }
    .width('100%')
    .height(PanelDimens.rowCompH)
    .padding({ left: 10, right: 8, top: 5, bottom: 5 })
    .justifyContent(FlexAlign.Center)
    .borderWidth({ bottom: PanelDimens.borderW })
    .borderColor(PanelColors.overlayRow)
  }

  build() {
    Column() {
      // Compact status line
      Row() {
        Text('--:-- | --/--TP')
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.overlayTxt)
          .layoutWeight(1)
        Text('--代/--')
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.overlayTxt)
      }
      .width('100%')
      .height(PanelDimens.statusBarH)
      .padding({ left: 10, right: 10 })
      .alignItems(VerticalAlign.Center)
      .borderWidth({ bottom: PanelDimens.borderW })
      .borderColor(PanelColors.overlayHdr)

      // Ship list
      Scroll() {
        Column() {
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
    .backgroundColor(PanelColors.overlayBg)
    .backdropBlur(PanelDimens.overlayBlur)
    .clip(true)
  }
}
