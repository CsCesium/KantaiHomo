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

const FLEET_TABS: string[] = ['1', '2', '3', '4', '基地', '道具'];
const INFO_TABS: string[]  = ['[类型]信息1', '[类型]信息2'];
// ───────────────────────────────────────────────────────────────────────────

function hpColor(hp: number, hpMax: number): string {
  const ratio = hpMax > 0 ? hp / hpMax : 0;
  if (ratio > 0.5)  { return '#44cc88'; }
  if (ratio > 0.25) { return '#ddcc44'; }
  return '#dd4444';
}

/**
 * Bottom-docked info panel for EXPANDED mode (portrait / wide-split).
 * Occupies the space below the game viewport.
 *
 * Layout (top → bottom):
 *   TabBar   — fleet selector (1-4, 基地, 道具) + info type sub-tabs
 *   StatusBar — resource / sortie metrics
 *   ShipList  — scrollable ship rows
 */
@ComponentV2
export default struct BottomPanel {
  @Param panelHeight: number = 200;
  @Local activeFleet: number = 0;
  @Local activeInfo: number = 0;

  // ── builders ──────────────────────────────────────────────────────────────

  @Builder TabBar() {
    Row() {
      // Left: fleet tabs
      Row({ space: 2 }) {
        ForEach(FLEET_TABS, (tab: string, idx: number) => {
          Text(tab)
            .fontSize(12)
            .fontColor(this.activeFleet === idx ? '#ffffff' : '#666666')
            .backgroundColor(this.activeFleet === idx ? '#1c5050' : Color.Transparent)
            .padding({ left: 8, right: 8, top: 4, bottom: 4 })
            .borderRadius(3)
            .onClick(() => { this.activeFleet = idx; })
        }, (_tab: string, idx: number) => `fleet-${idx}`)
      }

      Blank().layoutWeight(1)

      // Right: info type tabs
      Row({ space: 0 }) {
        ForEach(INFO_TABS, (tab: string, idx: number) => {
          Text(tab)
            .fontSize(11)
            .fontColor(this.activeInfo === idx ? '#cccccc' : '#555555')
            .backgroundColor(this.activeInfo === idx ? '#252525' : Color.Transparent)
            .padding({ left: 6, right: 6, top: 4, bottom: 4 })
            .onClick(() => { this.activeInfo = idx; })
        }, (_tab: string, idx: number) => `info-${idx}`)
      }
    }
    .width('100%')
    .height(30)
    .backgroundColor('#141414')
    .padding({ left: 6, right: 6 })
    .alignItems(VerticalAlign.Center)
  }

  @Builder StatusBar() {
    Row() {
      Text('刷忍: --').fontSize(10).fontColor('#777777')
      Text(' | ').fontSize(10).fontColor('#333333')
      Text('数据: --:--').fontSize(10).fontColor('#777777')
      Text(' | ').fontSize(10).fontColor('#333333')
      Text('临储: --').fontSize(10).fontColor('#777777')
      Text(' | ').fontSize(10).fontColor('#333333')
      Text('品储: --/--TP').fontSize(10).fontColor('#777777')
      Blank().layoutWeight(1)
      Text('--代/--').fontSize(10).fontColor('#777777')
    }
    .width('100%')
    .height(22)
    .padding({ left: 8, right: 8 })
    .backgroundColor('#0e0e0e')
    .alignItems(VerticalAlign.Center)
  }

  @Builder ShipRow(ship: ShipItem) {
    Row({ space: 4 }) {
      // Ship type badge
      Text(ship.shipType)
        .fontSize(10)
        .fontColor('#777777')
        .width(18)
        .textAlign(TextAlign.Center)

      // Ship name (auto-truncated)
      Text(ship.name)
        .fontSize(12)
        .fontColor('#dddddd')
        .layoutWeight(1)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })

      // HP number + bar
      Row({ space: 3 }) {
        Text(`${ship.hp}`)
          .fontSize(11)
          .fontColor(hpColor(ship.hp, ship.hpMax))
          .width(28)
          .textAlign(TextAlign.End)
        Progress({ value: ship.hp, total: ship.hpMax, type: ProgressType.Linear })
          .width(40)
          .height(6)
          .color(hpColor(ship.hp, ship.hpMax))
          .backgroundColor('#222222')
      }

      // 4 stats
      Text(`${ship.s1}`).fontSize(10).fontColor('#44dddd').width(24).textAlign(TextAlign.End)
      Text(`${ship.s2}`).fontSize(10).fontColor('#44dddd').width(24).textAlign(TextAlign.End)
      Text(`${ship.s3}`).fontSize(10).fontColor('#44dddd').width(24).textAlign(TextAlign.End)
      Text(`${ship.s4}`).fontSize(10).fontColor('#44dddd').width(24).textAlign(TextAlign.End)

      // Action button
      Button('按钮', { type: ButtonType.Normal })
        .fontSize(11)
        .fontColor('#aaaaaa')
        .backgroundColor('#2a2a2a')
        .width(44)
        .height(26)
        .borderRadius(4)
    }
    .width('100%')
    .height(36)
    .padding({ left: 8, right: 8 })
    .backgroundColor('#0b0b0b')
    .borderWidth({ bottom: 0.5 })
    .borderColor('#1c1c1c')
    .alignItems(VerticalAlign.Center)
  }

  // ── build ─────────────────────────────────────────────────────────────────

  build() {
    Column() {
      this.TabBar()
      this.StatusBar()

      Scroll() {
        Column() {
          // List header
          Row() {
            Text('排名')
              .fontSize(11)
              .fontColor('#555555')
              .width(40)
              .textAlign(TextAlign.Center)
            Blank().layoutWeight(1)
          }
          .width('100%')
          .height(24)
          .padding({ left: 8, right: 8 })
          .backgroundColor('#111111')
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
    .height(this.panelHeight)
    .backgroundColor('#0b0b0b')
    .clip(true)
  }
}
