import {
  subscribeGameState,
  getGameState,
  isShipEscaped,
  ShipState,
} from '../../../../features/state';

// ==================== Types ====================

type TypeGroup = 'all' | 'dd' | 'cl' | 'ca' | 'bb' | 'cv' | 'ss' | 'other';
type StatusFilter = 'all' | 'taiha' | 'chuuha' | 'resupply' | 'tired' | 'married';
type SortKey =
  | 'level_desc'
  | 'level_asc'
  | 'hp_asc'
  | 'cond_asc'
  | 'uid_asc'
  | 'stype_asc';

interface ShipInfoItem {
  uid: number;
  masterId: number;
  name: string;
  stype: number;
  typeLabel: string;
  level: number;
  expToNext: number;
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
  scoutCur: number;
  aswCur: number;
  speed: number;
  escaped: boolean;
}

// ==================== Constants ====================

/** stype → 简短类别标签（用于行内徽章）。 */
const STYPE_LABELS: Map<number, string> = new Map([
  [1, '海防'], [2, '駆'], [3, '軽巡'], [4, '雷巡'],
  [5, '重巡'], [6, '航巡'], [7, '軽空'], [8, '高戦'],
  [9, '戦'], [10, '航戦'], [11, '正空'], [13, '潜'],
  [14, '潜空'], [16, '水母'], [17, '揚陸'], [18, '装空'],
  [19, '工作'], [20, '潜母'], [21, '練巡'], [22, '補給'],
]);

/** 类型筛选分组：每组对应一个 stype 集合。'other' 取剩余 stype。 */
const TYPE_GROUP_STYPES: Map<TypeGroup, number[]> = new Map([
  ['dd', [1, 2]],
  ['cl', [3, 4, 21]],
  ['ca', [5, 6]],
  ['bb', [8, 9, 10]],
  ['cv', [7, 11, 18]],
  ['ss', [13, 14]],
]);

const KNOWN_GROUPED_STYPES: Set<number> = (() => {
  const s = new Set<number>();
  TYPE_GROUP_STYPES.forEach((arr: number[]) => {
    for (const v of arr) s.add(v);
  });
  return s;
})();

interface TypeChipDef { key: TypeGroup; label: string; }
interface StatusChipDef { key: StatusFilter; label: string; }
interface SortChipDef { key: SortKey; label: string; }

const TYPE_CHIPS: TypeChipDef[] = [
  { key: 'all', label: '全' },
  { key: 'dd', label: '駆' },
  { key: 'cl', label: '軽' },
  { key: 'ca', label: '重' },
  { key: 'bb', label: '戦' },
  { key: 'cv', label: '空' },
  { key: 'ss', label: '潜' },
  { key: 'other', label: '他' },
];

const STATUS_CHIPS: StatusChipDef[] = [
  { key: 'all', label: '全' },
  { key: 'taiha', label: '大破' },
  { key: 'chuuha', label: '中破' },
  { key: 'resupply', label: '要補' },
  { key: 'tired', label: '疲労' },
  { key: 'married', label: 'ケッコン' },
];

const SORT_CHIPS: SortChipDef[] = [
  { key: 'level_desc', label: 'Lv↓' },
  { key: 'level_asc', label: 'Lv↑' },
  { key: 'hp_asc', label: 'HP↑' },
  { key: 'cond_asc', label: '気↑' },
  { key: 'uid_asc', label: 'UID' },
  { key: 'stype_asc', label: '種別' },
];

const COLOR_HP_TAIHA = '#E53935';
const COLOR_HP_CHUUHA = '#FFB74D';
const COLOR_HP_OK = '#81C784';
const COLOR_COND_SPARKLE = '#FFD54F';
const COLOR_COND_NORMAL = '#B0BEC5';
const COLOR_COND_LOW = '#FF8A65';
const COLOR_COND_RED = '#E53935';
const COLOR_RESUPPLY = '#FFB74D';
const COLOR_LOW = '#999';
const COLOR_BG_PAGE = '#1a1d27';
const COLOR_BG_HEADER = '#0f1118';
const COLOR_BG_TOOLBAR = '#14171f';
const COLOR_BG_CHIP_ACTIVE = '#1c3535';
const COLOR_FG_CHIP_ACTIVE = '#56d8e0';
const COLOR_BG_CHIP = '#1c1f2a';
const COLOR_FG_CHIP = '#aab1bd';
const COLOR_BORDER = '#272a36';

// ==================== Pure helpers ====================

function typeLabel(stype: number): string {
  return STYPE_LABELS.get(stype) ?? '?';
}

function matchTypeGroup(stype: number, group: TypeGroup): boolean {
  if (group === 'all') return true;
  if (group === 'other') return !KNOWN_GROUPED_STYPES.has(stype);
  const list = TYPE_GROUP_STYPES.get(group);
  return list !== undefined && list.indexOf(stype) >= 0;
}

function matchStatus(item: ShipInfoItem, status: StatusFilter): boolean {
  switch (status) {
    case 'all':      return true;
    case 'taiha':    return item.isTaiha;
    case 'chuuha':   return item.isChuuha && !item.isTaiha;
    case 'resupply': return item.needsResupply;
    case 'tired':    return item.cond < 30;
    case 'married':  return item.level >= 100;
    default:         return true;
  }
}

function compareShips(a: ShipInfoItem, b: ShipInfoItem, key: SortKey): number {
  switch (key) {
    case 'level_desc': return b.level - a.level || a.uid - b.uid;
    case 'level_asc':  return a.level - b.level || a.uid - b.uid;
    case 'hp_asc':     return a.hpPercent - b.hpPercent || a.uid - b.uid;
    case 'cond_asc':   return a.cond - b.cond || a.uid - b.uid;
    case 'uid_asc':    return a.uid - b.uid;
    case 'stype_asc':  return a.stype - b.stype || b.level - a.level || a.uid - b.uid;
    default:           return a.uid - b.uid;
  }
}

function hpColor(item: ShipInfoItem): string {
  if (item.isTaiha) return COLOR_HP_TAIHA;
  if (item.isChuuha) return COLOR_HP_CHUUHA;
  return COLOR_HP_OK;
}

function condColor(cond: number): string {
  if (cond >= 50) return COLOR_COND_SPARKLE;
  if (cond >= 30) return COLOR_COND_NORMAL;
  if (cond >= 20) return COLOR_COND_LOW;
  return COLOR_COND_RED;
}

function speedLabel(speed: number): string {
  if (speed >= 20) return '最速';
  if (speed >= 15) return '高速+';
  if (speed >= 10) return '高速';
  if (speed >= 5) return '低速';
  if (speed === 0) return '陸上';
  return '--';
}

function toItem(s: ShipState): ShipInfoItem {
  const stype = getGameState().getShipMasterStype(s.masterId);
  return {
    uid: s.uid,
    masterId: s.masterId,
    name: s.name,
    stype,
    typeLabel: typeLabel(stype),
    level: s.level,
    expToNext: s.expToNext,
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
    scoutCur: s.scoutCur,
    aswCur: s.aswCur,
    speed: s.speed,
    escaped: isShipEscaped(s.uid),
  };
}

// ==================== Page Component ====================

@ComponentV2
export default struct ShipInfoPage {
  @Event onClose: () => void;

  /** 完整持有舰娘集合，由 GameState 派生；filter/sort 仅作用于该集合。 */
  @Local private allShips: ShipInfoItem[] = [];
  /** 经 filter + sort 后的可见集合，喂给 List。 */
  @Local private visibleShips: ShipInfoItem[] = [];

  @Local private searchText: string = '';
  @Local private typeFilter: TypeGroup = 'all';
  @Local private statusFilter: StatusFilter = 'all';
  @Local private sortKey: SortKey = 'level_desc';

  private unsubscribe: (() => void) | null = null;

  aboutToAppear(): void {
    this.reloadAll();
    this.unsubscribe = subscribeGameState((changeType, _state) => {
      if (changeType === 'all' || changeType === 'ships') {
        this.reloadAll();
      }
    });
  }

  aboutToDisappear(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  private reloadAll(): void {
    const state = getGameState().getState();
    const rows: ShipInfoItem[] = [];
    state.ships.forEach((s: ShipState) => rows.push(toItem(s)));
    this.allShips = rows;
    this.recompute();
  }

  /** 重新计算可见列表：依次应用搜索 / 舰种 / 状态过滤，再按 sortKey 排序。 */
  private recompute(): void {
    const q = this.searchText.trim().toLowerCase();
    const out: ShipInfoItem[] = [];
    for (const it of this.allShips) {
      if (q.length > 0 && it.name.toLowerCase().indexOf(q) < 0) continue;
      if (!matchTypeGroup(it.stype, this.typeFilter)) continue;
      if (!matchStatus(it, this.statusFilter)) continue;
      out.push(it);
    }
    out.sort((a, b) => compareShips(a, b, this.sortKey));
    this.visibleShips = out;
  }

  private setSearch(v: string): void {
    if (v === this.searchText) return;
    this.searchText = v;
    this.recompute();
  }

  private setTypeFilter(k: TypeGroup): void {
    if (k === this.typeFilter) return;
    this.typeFilter = k;
    this.recompute();
  }

  private setStatusFilter(k: StatusFilter): void {
    if (k === this.statusFilter) return;
    this.statusFilter = k;
    this.recompute();
  }

  private setSortKey(k: SortKey): void {
    if (k === this.sortKey) return;
    this.sortKey = k;
    this.recompute();
  }

  // ==================== Builders ====================

  @Builder
  private TypeChip(def: TypeChipDef) {
    Text(def.label)
      .fontSize(12)
      .fontColor(this.typeFilter === def.key ? COLOR_FG_CHIP_ACTIVE : COLOR_FG_CHIP)
      .fontWeight(this.typeFilter === def.key ? FontWeight.Medium : FontWeight.Regular)
      .padding({ left: 10, right: 10, top: 5, bottom: 5 })
      .backgroundColor(this.typeFilter === def.key ? COLOR_BG_CHIP_ACTIVE : COLOR_BG_CHIP)
      .borderRadius(12)
      .onClick(() => this.setTypeFilter(def.key))
  }

  @Builder
  private StatusChip(def: StatusChipDef) {
    Text(def.label)
      .fontSize(12)
      .fontColor(this.statusFilter === def.key ? COLOR_FG_CHIP_ACTIVE : COLOR_FG_CHIP)
      .fontWeight(this.statusFilter === def.key ? FontWeight.Medium : FontWeight.Regular)
      .padding({ left: 10, right: 10, top: 5, bottom: 5 })
      .backgroundColor(this.statusFilter === def.key ? COLOR_BG_CHIP_ACTIVE : COLOR_BG_CHIP)
      .borderRadius(12)
      .onClick(() => this.setStatusFilter(def.key))
  }

  @Builder
  private SortChip(def: SortChipDef) {
    Text(def.label)
      .fontSize(12)
      .fontColor(this.sortKey === def.key ? COLOR_FG_CHIP_ACTIVE : COLOR_FG_CHIP)
      .fontWeight(this.sortKey === def.key ? FontWeight.Medium : FontWeight.Regular)
      .padding({ left: 10, right: 10, top: 5, bottom: 5 })
      .backgroundColor(this.sortKey === def.key ? COLOR_BG_CHIP_ACTIVE : COLOR_BG_CHIP)
      .borderRadius(12)
      .onClick(() => this.setSortKey(def.key))
  }

  @Builder
  private FilterBar() {
    Column({ space: 6 }) {
      // Search input
      Row() {
        TextInput({ text: this.searchText, placeholder: '按舰名搜索' })
          .fontSize(13)
          .fontColor('#C8D0DA')
          .caretColor(COLOR_FG_CHIP_ACTIVE)
          .placeholderColor('#5a6270')
          .placeholderFont({ size: 13 })
          .backgroundColor('#0C1018')
          .border({ width: 1, color: COLOR_BORDER })
          .borderRadius(8)
          .height(36)
          .layoutWeight(1)
          .onChange((v: string) => this.setSearch(v))
        if (this.searchText.length > 0) {
          Text('清')
            .fontSize(12)
            .fontColor(COLOR_FG_CHIP)
            .padding({ left: 10, right: 10, top: 8, bottom: 8 })
            .margin({ left: 6 })
            .backgroundColor(COLOR_BG_CHIP)
            .borderRadius(8)
            .onClick(() => this.setSearch(''))
        }
      }
      .width('100%')

      // Type chips
      Row({ space: 6 }) {
        Text('種')
          .fontSize(11)
          .fontColor('#666')
          .width(20)
        ForEach(TYPE_CHIPS, (c: TypeChipDef) => {
          this.TypeChip(c)
        }, (c: TypeChipDef) => `t-${c.key}`)
      }
      .width('100%')

      // Status chips
      Row({ space: 6 }) {
        Text('状')
          .fontSize(11)
          .fontColor('#666')
          .width(20)
        ForEach(STATUS_CHIPS, (c: StatusChipDef) => {
          this.StatusChip(c)
        }, (c: StatusChipDef) => `s-${c.key}`)
      }
      .width('100%')

      // Sort chips
      Row({ space: 6 }) {
        Text('順')
          .fontSize(11)
          .fontColor('#666')
          .width(20)
        ForEach(SORT_CHIPS, (c: SortChipDef) => {
          this.SortChip(c)
        }, (c: SortChipDef) => `o-${c.key}`)
      }
      .width('100%')
    }
    .width('100%')
    .padding({ left: 12, right: 12, top: 10, bottom: 10 })
    .backgroundColor(COLOR_BG_TOOLBAR)
    .border({ width: { bottom: 0.5 }, color: COLOR_BORDER })
  }

  /**
   * 单条舰娘记录行：参考 ShipRow 的纵向 banner+status+equip 划分，但去掉装备列，
   * 转而展示更完整的纯文本字段（uid / masterId / stype / 索敌 / 对潜 / 速力 / 退避）。
   */
  @Builder
  private ShipInfoRow(item: ShipInfoItem) {
    Column({ space: 4 }) {
      // Header row: id + name + type badge + level + next exp
      Row({ space: 6 }) {
        Text(`#${item.uid}`)
          .fontSize(11)
          .fontColor('#6A7280')
          .fontWeight(FontWeight.Medium)
          .width(54)
        Text(item.typeLabel)
          .fontSize(11)
          .fontColor('#C8B99A')
          .padding({ left: 5, right: 5, top: 1, bottom: 1 })
          .backgroundColor('#2a2a20')
          .borderRadius(3)
        Text(item.name)
          .fontSize(15)
          .fontWeight(FontWeight.Medium)
          .fontColor('#FFF')
          .layoutWeight(1)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        if (item.escaped) {
          Text('退避')
            .fontSize(11)
            .fontColor('#FFFFFF')
            .padding({ left: 5, right: 5, top: 1, bottom: 1 })
            .backgroundColor('#1a4a7f')
            .borderRadius(3)
        }
        Text(`Lv.${item.level}`)
          .fontSize(13)
          .fontColor(item.level >= 100 ? '#FFD54F' : '#C8B99A')
          .fontWeight(FontWeight.Medium)
        Text(`/${item.expToNext}`)
          .fontSize(11)
          .fontColor('#6A7280')
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)

      // Stats row 1: HP / cond / fuel / ammo
      Row({ space: 12 }) {
        Text(`HP ${item.hpNow}/${item.hpMax}`)
          .fontSize(12)
          .fontColor(hpColor(item))
          .fontWeight(FontWeight.Medium)
        Text(`気 ${item.cond}`)
          .fontSize(12)
          .fontColor(condColor(item.cond))
        Text(`燃 ${item.fuel}/${item.fuelMax}`)
          .fontSize(12)
          .fontColor(item.needsResupply ? COLOR_RESUPPLY : COLOR_LOW)
        Text(`弾 ${item.ammo}/${item.ammoMax}`)
          .fontSize(12)
          .fontColor(item.needsResupply ? COLOR_RESUPPLY : COLOR_LOW)
      }
      .width('100%')

      // Stats row 2: scout / asw / speed / master id
      Row({ space: 12 }) {
        Text(`索 ${item.scoutCur}`)
          .fontSize(11)
          .fontColor('#90A0B0')
        Text(`対潜 ${item.aswCur}`)
          .fontSize(11)
          .fontColor('#90A0B0')
        Text(`速 ${speedLabel(item.speed)}`)
          .fontSize(11)
          .fontColor('#90A0B0')
        Blank().layoutWeight(1)
        Text(`MID:${item.masterId}`)
          .fontSize(10)
          .fontColor('#4a5260')
      }
      .width('100%')
    }
    .width('100%')
    .padding({ left: 14, right: 14, top: 10, bottom: 10 })
    .backgroundColor(COLOR_BG_PAGE)
    .border({ width: { bottom: 0.5 }, color: COLOR_BORDER })
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
        Text(`${this.visibleShips.length}/${this.allShips.length}`)
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
      .backgroundColor(COLOR_BG_HEADER)
      .alignItems(VerticalAlign.Center)

      // Filter / sort toolbar
      this.FilterBar()

      // Ship list
      if (this.visibleShips.length === 0) {
        Column() {
          Text(this.allShips.length === 0 ? '暂无舰娘数据' : '当前筛选下无匹配舰娘')
            .fontSize(13)
            .fontColor('#666')
        }
        .width('100%')
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
        .backgroundColor(COLOR_BG_PAGE)
      } else {
        List() {
          ForEach(this.visibleShips, (item: ShipInfoItem) => {
            ListItem() {
              this.ShipInfoRow(item)
            }
          }, (item: ShipInfoItem) => `${item.uid}`)
        }
        .width('100%')
        .layoutWeight(1)
        .backgroundColor(COLOR_BG_PAGE)
      }

      // Footer hint
      Text('右滑返回游戏')
        .fontSize(11)
        .fontColor('#555')
        .width('100%')
        .height(24)
        .textAlign(TextAlign.Center)
        .backgroundColor(COLOR_BG_HEADER)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(COLOR_BG_PAGE)
    // Right-swipe closes the page; PanDirection.Right ensures the inner List
    // vertical scroll is unaffected.
    .gesture(
      PanGesture({ direction: PanDirection.Right, distance: 60 })
        .onActionEnd(() => this.onClose?.())
    )
    // Absorb taps to prevent fall-through to the underlying game WebView.
    .onClick(() => {})
  }
}
