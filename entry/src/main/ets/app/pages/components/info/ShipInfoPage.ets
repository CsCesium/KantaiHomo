import {
  subscribeGameState,
  getGameState,
  ShipState,
} from '../../../../features/state';

interface ShipRowItem {
  uid: number;
  name: string;
  level: number;
  hpNow: number;
  hpMax: number;
  hpPercent: number;
  isTaiha: boolean;
  isChuuha: boolean;
  cond: number;
  fuel: number;
  fuelMax: number;
  ammo: number;
  ammoMax: number;
  needsResupply: boolean;
}

type SortKey = 'level' | 'hp' | 'cond';

function toRow(s: ShipState): ShipRowItem {
  return {
    uid: s.uid,
    name: s.name,
    level: s.level,
    hpNow: s.hpNow,
    hpMax: s.hpMax,
    hpPercent: s.hpPercent,
    isTaiha: s.isTaiha,
    isChuuha: s.isChuuha,
    cond: s.cond,
    fuel: s.fuel,
    fuelMax: s.fuelMax,
    ammo: s.ammo,
    ammoMax: s.ammoMax,
    needsResupply: s.needsResupply,
  };
}

function hpColor(item: ShipRowItem): string {
  if (item.isTaiha) return '#E53935';
  if (item.isChuuha) return '#FFB74D';
  return '#81C784';
}

function condColor(cond: number): string {
  if (cond >= 50) return '#FFD54F';
  if (cond >= 30) return '#B0BEC5';
  if (cond >= 20) return '#FF8A65';
  return '#E53935';
}

@ComponentV2
export default struct ShipInfoPage {
  @Event onClose: () => void;

  @Local private ships: ShipRowItem[] = [];
  @Local private sortKey: SortKey = 'level';
  private unsubscribe: (() => void) | null = null;

  aboutToAppear() {
    this.loadShips();
    this.unsubscribe = subscribeGameState((changeType, _state) => {
      if (changeType === 'all' || changeType === 'ships') {
        this.loadShips();
      }
    });
  }

  aboutToDisappear() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  private loadShips(): void {
    const state = getGameState().getState();
    const rows: ShipRowItem[] = [];
    state.ships.forEach((s) => rows.push(toRow(s)));
    this.ships = this.sortRows(rows, this.sortKey);
  }

  private sortRows(rows: ShipRowItem[], key: SortKey): ShipRowItem[] {
    const arr = rows.slice();
    if (key === 'level') {
      arr.sort((a, b) => b.level - a.level || a.uid - b.uid);
    } else if (key === 'hp') {
      arr.sort((a, b) => a.hpPercent - b.hpPercent || a.uid - b.uid);
    } else {
      arr.sort((a, b) => a.cond - b.cond || a.uid - b.uid);
    }
    return arr;
  }

  private setSortKey(key: SortKey): void {
    if (this.sortKey === key) return;
    this.sortKey = key;
    this.ships = this.sortRows(this.ships, key);
  }

  @Builder
  private SortTab(key: SortKey, label: string) {
    Text(label)
      .fontSize(13)
      .fontColor(this.sortKey === key ? '#56d8e0' : '#999')
      .fontWeight(this.sortKey === key ? FontWeight.Medium : FontWeight.Regular)
      .padding({ left: 10, right: 10, top: 6, bottom: 6 })
      .backgroundColor(this.sortKey === key ? '#1c3535' : Color.Transparent)
      .borderRadius(4)
      .onClick(() => this.setSortKey(key))
  }

  @Builder
  private ShipRowView(item: ShipRowItem) {
    Column({ space: 4 }) {
      Row() {
        Text(item.name)
          .fontSize(15)
          .fontColor('#FFF')
          .fontWeight(FontWeight.Medium)
          .layoutWeight(1)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(`Lv.${item.level}`)
          .fontSize(13)
          .fontColor('#C8B99A')
          .margin({ left: 8 })
      }
      .width('100%')

      Row({ space: 12 }) {
        Text(`HP ${item.hpNow}/${item.hpMax}`)
          .fontSize(12)
          .fontColor(hpColor(item))
        Text(`気 ${item.cond}`)
          .fontSize(12)
          .fontColor(condColor(item.cond))
        Text(`燃 ${item.fuel}/${item.fuelMax}`)
          .fontSize(12)
          .fontColor(item.needsResupply ? '#FFB74D' : '#999')
        Text(`弾 ${item.ammo}/${item.ammoMax}`)
          .fontSize(12)
          .fontColor(item.needsResupply ? '#FFB74D' : '#999')
      }
      .width('100%')
    }
    .width('100%')
    .padding({ left: 14, right: 14, top: 10, bottom: 10 })
    .backgroundColor('#1a1d27')
    .border({ width: { bottom: 0.5 }, color: '#272a36' })
  }

  build() {
    Column() {
      // Header
      Row() {
        Text('舰娘信息')
          .fontSize(17)
          .fontWeight(FontWeight.Medium)
          .fontColor('#FFF')
          .layoutWeight(1)
        Text(`${this.ships.length}`)
          .fontSize(13)
          .fontColor('#888')
          .margin({ right: 12 })
        Button({ type: ButtonType.Normal, stateEffect: true }) {
          Text('×').fontSize(22).fontColor('#999')
        }
        .width(40)
        .height(40)
        .backgroundColor(Color.Transparent)
        .border({ width: 0 })
        .onClick(() => this.onClose?.())
      }
      .width('100%')
      .height(48)
      .padding({ left: 16, right: 6 })
      .backgroundColor('#0f1118')
      .alignItems(VerticalAlign.Center)

      // Sort tabs
      Row({ space: 6 }) {
        this.SortTab('level', '等级')
        this.SortTab('hp', 'HP')
        this.SortTab('cond', '疲劳')
      }
      .width('100%')
      .padding({ left: 12, right: 12, top: 8, bottom: 8 })
      .backgroundColor('#14171f')

      // Ship list
      if (this.ships.length === 0) {
        Column() {
          Text('暂无舰娘数据')
            .fontSize(14)
            .fontColor('#666')
        }
        .width('100%')
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
        .backgroundColor('#1a1d27')
      } else {
        List() {
          ForEach(this.ships, (item: ShipRowItem) => {
            ListItem() {
              this.ShipRowView(item)
            }
          }, (item: ShipRowItem) => `${item.uid}`)
        }
        .width('100%')
        .layoutWeight(1)
        .backgroundColor('#1a1d27')
      }

      // Hint
      Text('右滑返回游戏')
        .fontSize(11)
        .fontColor('#555')
        .width('100%')
        .height(24)
        .textAlign(TextAlign.Center)
        .backgroundColor('#0f1118')
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#1a1d27')
    // Right-swipe closes the page, returning to the (preserved) game WebView underneath.
    .gesture(
      PanGesture({ direction: PanDirection.Right, distance: 60 })
        .onActionEnd(() => this.onClose?.())
    )
    // Absorb clicks so they don't fall through to underlying game.
    .onClick(() => {})
  }
}
