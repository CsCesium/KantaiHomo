import { ShipItem } from '../../../../../features/panel/type';

// ── placeholder data (replace with live game data) ─────────────────────────
const PLACEHOLDER_SHIPS: ShipItem[] = [
  { id: 1, name: '阳炎改二',               shipType: '駆', hp: 40, hpMax: 40, s1: 99,  s2: 99, s3: 87, s4: 45 },
  { id: 2, name: '阳炎改二甲',              shipType: '駆', hp: 40, hpMax: 40, s1: 99,  s2: 99, s3: 87, s4: 45 },
  { id: 3, name: '大舱改二',               shipType: '戦', hp: 84, hpMax: 84, s1: 109, s2: 0,  s3: 88, s4: 0  },
  { id: 4, name: 'Conte di Cavour nuovo',  shipType: '戦', hp: 80, hpMax: 80, s1: 85,  s2: 0,  s3: 86, s4: 0  },
  { id: 5, name: 'Октябрьская революция',  shipType: '戦', hp: 29, hpMax: 29, s1: 15,  s2: 0,  s3: 75, s4: 0  },
  { id: 6, name: '第二十二号海防舰改',       shipType: '海', hp: 10, hpMax: 10, s1: 17,  s2: 0,  s3: 62, s4: 35 },
  { id: 7, name: 'Samuel B.Roberts Mk.II', shipType: '護', hp: 31, hpMax: 31, s1: 99,  s2: 99, s3: 99, s4: 99 },
];
// ───────────────────────────────────────────────────────────────────────────

function hpColor(hp: number, hpMax: number): string {
  const ratio = hpMax > 0 ? hp / hpMax : 0;
  if (ratio > 0.5)  { return '#44cc88'; }
  if (ratio > 0.25) { return '#ddcc44'; }
  return '#dd4444';
}

/**
 * Semi-transparent floating panel for COMPACT mode (landscape / small window).
 * Rendered on top of the game viewport via Stack in the parent.
 *
 * Visual style: dark glass — ~75% opaque black + backdrop blur.
 * Width should be constrained by the parent (Stack alignment or fixed width).
 *
 * Layout (top → bottom):
 *   StatusLine — compact resource / sortie metrics
 *   ShipList   — scrollable condensed ship rows
 */
@ComponentV2
export default struct FloatOverlayPanel {

  @Builder ShipRow(ship: ShipItem) {
    Row({ space: 4 }) {
      // Ship name (takes most of the space)
      Text(ship.name)
        .fontSize(11)
        .fontColor('#dddddd')
        .layoutWeight(1)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })

      // HP number
      Text(`${ship.hp}`)
        .fontSize(11)
        .fontColor(hpColor(ship.hp, ship.hpMax))
        .width(26)
        .textAlign(TextAlign.End)

      // HP bar
      Progress({ value: ship.hp, total: ship.hpMax, type: ProgressType.Linear })
        .width(32)
        .height(5)
        .color(hpColor(ship.hp, ship.hpMax))
        .backgroundColor('#2a2a2a')

      // 2 key stats (condensed; s1/s2 = firepower/torpedo)
      Text(`${ship.s1}`).fontSize(10).fontColor('#44dddd').width(22).textAlign(TextAlign.End)
      Text(`${ship.s2}`).fontSize(10).fontColor('#44dddd').width(22).textAlign(TextAlign.End)

      // Action button
      Button('按钮', { type: ButtonType.Normal })
        .fontSize(10)
        .fontColor('#aaaaaa')
        .backgroundColor('#44444466')
        .width(40)
        .height(24)
        .borderRadius(4)
    }
    .width('100%')
    .height(32)
    .padding({ left: 8, right: 8 })
    .alignItems(VerticalAlign.Center)
    .borderWidth({ bottom: 0.5 })
    .borderColor('#2a2a2a')
  }

  build() {
    Column() {
      // Compact status line
      Row() {
        Text('--:-- | --/--TP')
          .fontSize(10)
          .fontColor('#888888')
          .layoutWeight(1)
        Text('--代/--')
          .fontSize(10)
          .fontColor('#888888')
      }
      .width('100%')
      .height(22)
      .padding({ left: 8, right: 8 })
      .alignItems(VerticalAlign.Center)
      .borderWidth({ bottom: 0.5 })
      .borderColor('#333333')

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
    .backgroundColor('#bf000000') // ~75% opaque black
    .backdropBlur(10)
    .clip(true)
  }
}
