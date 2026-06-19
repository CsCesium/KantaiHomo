import {
  subscribeGameState,
  getGameState,
  isShipEscaped,
  ShipState,
} from '../../../../features/state';

// ==================== Types ====================

type TypeGroup = string;
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
  fireCur: number;
  torpCur: number;
  aaCur: number;
  armorCur: number;
  evasionCur: number;
  luckCur: number;
  speed: number;
  range: number;
  slotCount: number;
  statLine1: string;
  statLine2: string;
  detailLine: string;
  escaped: boolean;
}

// ==================== Constants ====================

/** stype → 简短类别标签（用于行内徽章）。 */
const STYPE_LABELS: Map<number, string> = new Map([
  [1, '海防'], [2, '驱逐'], [3, '轻巡'], [4, '雷巡'],
  [5, '重巡'], [6, '航巡'], [7, '轻航'], [8, '巡战'],
  [9, '战舰'], [10, '航战'], [11, '正航'], [12, '超弩'],
  [13, '潜艇'], [14, '潜航'], [15, '补给'], [16, '水母'],
  [17, '扬陆'], [18, '装航'], [19, '工作'], [20, '潜母'],
  [21, '练巡'], [22, '补给'],
]);

interface TypeGroupSpec {
  key: TypeGroup;
  label: string;
  stypes: number[];
}

/** 类型筛选分组：每组对应一个 stype 集合。'other' 取剩余 stype。 */
const TYPE_GROUPS: TypeGroupSpec[] = [
  { key: 'de', label: '海防', stypes: [1] },
  { key: 'dd', label: '驱逐', stypes: [2] },
  { key: 'cl', label: '轻巡', stypes: [3, 4, 21] },
  { key: 'ca', label: '重巡', stypes: [5, 6] },
  { key: 'bb', label: '战舰', stypes: [8, 9, 10, 12] },
  { key: 'cv', label: '航母', stypes: [7, 11, 18] },
  { key: 'ss', label: '潜艇', stypes: [13, 14] },
  { key: 'aux', label: '辅助', stypes: [15, 16, 17, 19, 20, 22] },
];

const TYPE_GROUP_STYPES: Map<TypeGroup, number[]> = (() => {
  const m = new Map<TypeGroup, number[]>();
  for (const g of TYPE_GROUPS) m.set(g.key, g.stypes);
  return m;
})();

const TYPE_GROUP_LABELS: Map<TypeGroup, string> = (() => {
  const m = new Map<TypeGroup, string>();
  for (const g of TYPE_GROUPS) m.set(g.key, g.label);
  m.set('all', '全部');
  m.set('other', '其他');
  return m;
})();

const TYPE_GROUP_ORDER: string[] = (() => {
  const out: string[] = [];
  for (const g of TYPE_GROUPS) out.push(g.key);
  out.push('other');
  return out;
})();

const KNOWN_GROUPED_STYPES: Set<number> = (() => {
  const s = new Set<number>();
  for (const g of TYPE_GROUPS) {
    for (const v of g.stypes) s.add(v);
  }
  return s;
})();

interface StatusChipDef { key: StatusFilter; label: string; }
interface SortChipDef { key: SortKey; label: string; }

const STATUS_CHIPS: StatusChipDef[] = [
  { key: 'all', label: '全部' },
  { key: 'taiha', label: '大破' },
  { key: 'chuuha', label: '中破' },
  { key: 'resupply', label: '需补给' },
  { key: 'tired', label: '疲劳' },
  { key: 'married', label: '婚舰' },
];

const SORT_CHIPS: SortChipDef[] = [
  { key: 'level_desc', label: 'Lv↓' },
  { key: 'level_asc', label: 'Lv↑' },
  { key: 'hp_asc', label: 'HP↑' },
  { key: 'cond_asc', label: '士气↑' },
  { key: 'uid_asc', label: 'UID' },
  { key: 'stype_asc', label: '舰种' },
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
const SHIP_RENDER_BATCH_SIZE = 40;

// ==================== Pure helpers ====================

function typeLabel(stype: number): string {
  return STYPE_LABELS.get(stype) ?? `舰种${stype}`;
}

function typeGroupLabel(group: TypeGroup): string {
  return TYPE_GROUP_LABELS.get(group) ?? '其他';
}

function matchTypeGroup(stype: number, group: TypeGroup): boolean {
  if (group === 'all') return true;
  if (group === 'other') return !KNOWN_GROUPED_STYPES.has(stype);
  const list = TYPE_GROUP_STYPES.get(group);
  return list !== undefined && list.indexOf(stype) >= 0;
}

function typeGroupForStype(stype: number): TypeGroup {
  for (const g of TYPE_GROUPS) {
    if (g.stypes.indexOf(stype) >= 0) return g.key;
  }
  return 'other';
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
  if (speed === 0) return '陆上';
  return '--';
}

function rangeLabel(range: number): string {
  switch (range) {
    case 0: return '无';
    case 1: return '短';
    case 2: return '中';
    case 3: return '长';
    case 4: return '超长';
    case 5: return '超长+';
    default: return `${range}`;
  }
}

function buildStatLine1(item: ShipInfoItem): string {
  return `火力 ${item.fireCur}  雷装 ${item.torpCur}  对空 ${item.aaCur}  装甲 ${item.armorCur}`;
}

function buildStatLine2(item: ShipInfoItem): string {
  return `回避 ${item.evasionCur}  对潜 ${item.aswCur}  索敌 ${item.scoutCur}  运 ${item.luckCur}`;
}

function buildDetailLine(item: ShipInfoItem): string {
  return `速力 ${speedLabel(item.speed)}  射程 ${rangeLabel(item.range)}  槽 ${item.slotCount}  MID:${item.masterId}`;
}

function toItem(s: ShipState): ShipInfoItem {
  const stype = getGameState().getShipMasterStype(s.masterId);
  const item: ShipInfoItem = {
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
    fireCur: s.fireCur,
    torpCur: s.torpCur,
    aaCur: s.aaCur,
    armorCur: s.armorCur,
    evasionCur: s.evasionCur,
    luckCur: s.luckCur,
    speed: s.speed,
    range: s.range,
    slotCount: s.slotCount,
    statLine1: '',
    statLine2: '',
    detailLine: '',
    escaped: isShipEscaped(s.uid),
  };
  item.statLine1 = buildStatLine1(item);
  item.statLine2 = buildStatLine2(item);
  item.detailLine = buildDetailLine(item);
  return item;
}

// ==================== Page Component ====================

@ComponentV2
export default struct ShipInfoPage {
  @Event onClose: () => void;

  /** 完整持有舰娘集合，由 GameState 派生；filter/sort 仅作用于该集合。 */
  @Local private allShips: ShipInfoItem[] = [];
  /** 经 filter + sort 后的完整可见集合。List 实际渲染 renderedShips。 */
  @Local private visibleShips: ShipInfoItem[] = [];
  @Local private renderedShips: ShipInfoItem[] = [];
  @Local private renderedShipCount: number = 0;
  @Local private presentTypes: string[] = [];

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
    this.rebuildPresentTypes();
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
    this.resetRenderedShips();
  }

  private resetRenderedShips(): void {
    this.renderedShipCount = Math.min(SHIP_RENDER_BATCH_SIZE, this.visibleShips.length);
    this.renderedShips = this.visibleShips.slice(0, this.renderedShipCount);
  }

  private loadMoreShips(): void {
    if (this.renderedShipCount >= this.visibleShips.length) {
      return;
    }
    this.renderedShipCount = Math.min(this.renderedShipCount + SHIP_RENDER_BATCH_SIZE, this.visibleShips.length);
    this.renderedShips = this.visibleShips.slice(0, this.renderedShipCount);
  }

  private rebuildPresentTypes(): void {
    const q = this.searchText.trim().toLowerCase();
    const groups = new Set<string>();
    for (const it of this.allShips) {
      if (q.length > 0 && it.name.toLowerCase().indexOf(q) < 0) continue;
      if (!matchStatus(it, this.statusFilter)) continue;
      groups.add(typeGroupForStype(it.stype));
    }
    const ordered = TYPE_GROUP_ORDER.filter((c) => groups.has(c));
    const extra: string[] = [];
    groups.forEach((c: string) => {
      if (TYPE_GROUP_ORDER.indexOf(c) < 0) extra.push(c);
    });
    extra.sort();
    this.presentTypes = ordered.concat(extra);
    if (this.typeFilter !== 'all' && this.presentTypes.indexOf(this.typeFilter) < 0) {
      this.typeFilter = 'all';
    }
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
  private TypeChip(type: TypeGroup) {
    Text(type === 'all' ? '全部' : typeGroupLabel(type))
      .fontSize(12)
      .fontColor(this.typeFilter === type ? COLOR_FG_CHIP_ACTIVE : COLOR_FG_CHIP)
      .fontWeight(this.typeFilter === type ? FontWeight.Medium : FontWeight.Regular)
      .padding({ left: 10, right: 10, top: 5, bottom: 5 })
      .backgroundColor(this.typeFilter === type ? COLOR_BG_CHIP_ACTIVE : COLOR_BG_CHIP)
      .borderRadius(12)
      .onClick(() => this.setTypeFilter(type))
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
      Scroll() {
        Row({ space: 6 }) {
          Text('类')
            .fontSize(11)
            .fontColor('#666')
            .width(20)
          this.TypeChip('all')
          ForEach(this.presentTypes, (c: string) => {
            this.TypeChip(c)
          }, (c: string) => `t-${c}`)
        }
      }
      .scrollable(ScrollDirection.Horizontal)
      .scrollBar(BarState.Off)
      .width('100%')

      // Status chips
      Scroll() {
        Row({ space: 6 }) {
          Text('状')
            .fontSize(11)
            .fontColor('#666')
            .width(20)
          ForEach(STATUS_CHIPS, (c: StatusChipDef) => {
            this.StatusChip(c)
          }, (c: StatusChipDef) => `s-${c.key}`)
        }
      }
      .scrollable(ScrollDirection.Horizontal)
      .scrollBar(BarState.Off)
      .width('100%')

      // Sort chips
      Scroll() {
        Row({ space: 6 }) {
          Text('序')
            .fontSize(11)
            .fontColor('#666')
            .width(20)
          ForEach(SORT_CHIPS, (c: SortChipDef) => {
            this.SortChip(c)
          }, (c: SortChipDef) => `o-${c.key}`)
        }
      }
      .scrollable(ScrollDirection.Horizontal)
      .scrollBar(BarState.Off)
      .width('100%')
    }
    .width('100%')
    .padding({ left: 12, right: 12, top: 10, bottom: 10 })
    .backgroundColor(COLOR_BG_TOOLBAR)
    .border({ width: { bottom: 0.5 }, color: COLOR_BORDER })
  }

  /**
   * 单条舰娘记录行：参考 ShipRow 的纵向 banner+status+equip 划分，但去掉装备列，
   * 转而展示更完整的纯文本字段（uid / masterId / stype / 属性 / 速力 / 射程 / 退避）。
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
        Text(`下级 ${item.expToNext}`)
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
        Text(`士气 ${item.cond}`)
          .fontSize(12)
          .fontColor(condColor(item.cond))
        Text(`燃 ${item.fuel}/${item.fuelMax}`)
          .fontSize(12)
          .fontColor(item.needsResupply ? COLOR_RESUPPLY : COLOR_LOW)
        Text(`弹 ${item.ammo}/${item.ammoMax}`)
          .fontSize(12)
          .fontColor(item.needsResupply ? COLOR_RESUPPLY : COLOR_LOW)
      }
      .width('100%')

      Text(item.statLine1)
        .fontSize(11)
        .fontColor('#90A0B0')
        .width('100%')

      Text(item.statLine2)
        .fontSize(11)
        .fontColor('#90A0B0')
        .width('100%')

      Text(item.detailLine)
        .fontSize(10)
        .fontColor('#4a5260')
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
          ForEach(this.renderedShips, (item: ShipInfoItem) => {
            ListItem() {
              this.ShipInfoRow(item)
            }
          }, (item: ShipInfoItem) => `${item.uid}`)
        }
        .width('100%')
        .layoutWeight(1)
        .backgroundColor(COLOR_BG_PAGE)
        .onReachEnd(() => {
          this.loadMoreShips();
        })
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
