import {
  subscribeGameState,
  getGameState,
  getSlotItemMasterName,
  getSlotItemMasterEquipType,
  getSlotItemMasterLos,
  getSlotItemMasterAa,
  getSlotItemLevel,
  getSlotItemAlv,
} from '../../../../features/state';

// ==================== Types ====================

type EquipTypeGroup =
  | 'all'
  | 'gun_main' | 'gun_sub' | 'torpedo' | 'planes'
  | 'recon' | 'radar' | 'asw' | 'land' | 'jet' | 'other';

type EquipStatusFilter = 'all' | 'kaisyuu' | 'mastered' | 'equipped' | 'spare';

type EquipSortKey =
  | 'master_asc'
  | 'level_desc'
  | 'alv_desc'
  | 'uid_asc'
  | 'los_desc'
  | 'aa_desc'
  | 'asw_desc';

interface EquipInfoItem {
  uid: number;
  masterId: number;
  name: string;
  equipType: number;
  group: EquipTypeGroup;
  groupLabel: string;
  level: number;
  alv: number;
  los: number;
  aa: number;
  asw: number;
  /** UID of the ship holding this slot, 0 if not equipped (spare). */
  equipperUid: number;
  equipperName: string;
}

// ==================== Constants ====================

interface EquipGroupSpec {
  key: EquipTypeGroup;
  label: string;
  /** equip type IDs (api_type[2]) covered by this group. */
  types: number[];
}

/** 装备大类分组：每组对应若干 equipType。'other' 兜底剩余 ID。
 *  参考 KC api_type[2] 编码（小/中/大口径主砲=1/2/3、副砲=4、魚雷=5、艦戦=6 …）。 */
const EQUIP_GROUPS: EquipGroupSpec[] = [
  { key: 'gun_main', label: '主砲',   types: [1, 2, 3, 38] },
  { key: 'gun_sub',  label: '副対空', types: [4, 21, 36] },
  { key: 'torpedo',  label: '魚雷',   types: [5, 32] },
  { key: 'planes',   label: '艦載',   types: [6, 7, 8, 11, 25, 26, 45] },
  { key: 'recon',    label: '偵察',   types: [9, 10, 41, 49, 57] },
  { key: 'radar',    label: '電探',   types: [12, 13, 27, 28, 58] },
  { key: 'asw',      label: '対潜',   types: [14, 15, 40] },
  { key: 'land',     label: '陸上',   types: [47, 48, 52, 53] },
  { key: 'jet',      label: '噴式',   types: [54, 55, 56] },
];

/** equipType → group lookup, built once. */
const EQUIP_TYPE_TO_GROUP: Map<number, EquipTypeGroup> = (() => {
  const m = new Map<number, EquipTypeGroup>();
  for (const g of EQUIP_GROUPS) {
    for (const t of g.types) m.set(t, g.key);
  }
  return m;
})();

const EQUIP_GROUP_LABEL: Map<EquipTypeGroup, string> = (() => {
  const m = new Map<EquipTypeGroup, string>();
  for (const g of EQUIP_GROUPS) m.set(g.key, g.label);
  m.set('other', '他');
  m.set('all', '全');
  return m;
})();

interface EquipTypeChipDef { key: EquipTypeGroup; label: string; }
interface EquipStatusChipDef { key: EquipStatusFilter; label: string; }
interface EquipSortChipDef { key: EquipSortKey; label: string; }

const TYPE_CHIPS: EquipTypeChipDef[] = [
  { key: 'all',      label: '全' },
  { key: 'gun_main', label: '主砲' },
  { key: 'gun_sub',  label: '副対空' },
  { key: 'torpedo',  label: '魚雷' },
  { key: 'planes',   label: '艦載' },
  { key: 'recon',    label: '偵察' },
  { key: 'radar',    label: '電探' },
  { key: 'asw',      label: '対潜' },
  { key: 'land',     label: '陸上' },
  { key: 'jet',      label: '噴式' },
  { key: 'other',    label: '他' },
];

const STATUS_CHIPS: EquipStatusChipDef[] = [
  { key: 'all',      label: '全' },
  { key: 'kaisyuu',  label: '改修済' },
  { key: 'mastered', label: '熟練済' },
  { key: 'equipped', label: '装備中' },
  { key: 'spare',    label: '未装備' },
];

const SORT_CHIPS: EquipSortChipDef[] = [
  { key: 'master_asc', label: 'MID' },
  { key: 'level_desc', label: '★↓' },
  { key: 'alv_desc',   label: '熟↓' },
  { key: 'uid_asc',    label: 'UID' },
  { key: 'los_desc',   label: '索↓' },
  { key: 'aa_desc',    label: '対空↓' },
  { key: 'asw_desc',   label: '対潜↓' },
];

const COLOR_BG_PAGE = '#1a1d27';
const COLOR_BG_HEADER = '#0f1118';
const COLOR_BG_TOOLBAR = '#14171f';
const COLOR_BG_CHIP_ACTIVE = '#1c3535';
const COLOR_FG_CHIP_ACTIVE = '#56d8e0';
const COLOR_BG_CHIP = '#1c1f2a';
const COLOR_FG_CHIP = '#aab1bd';
const COLOR_BORDER = '#272a36';
const COLOR_LEVEL = '#FFD54F';
const COLOR_ALV = '#A5D6A7';
const COLOR_SPARE = '#6A7280';
const COLOR_EQUIPPED = '#90A0B0';

// ==================== Helpers ====================

function groupForType(equipType: number): EquipTypeGroup {
  return EQUIP_TYPE_TO_GROUP.get(equipType) ?? 'other';
}

function groupLabel(group: EquipTypeGroup): string {
  return EQUIP_GROUP_LABEL.get(group) ?? '他';
}

function levelStars(level: number): string {
  if (level <= 0) return '';
  if (level >= 10) return '★MAX';
  return `★${level}`;
}

function alvLabel(alv: number): string {
  if (alv <= 0) return '';
  if (alv >= 7) return '熟MAX';
  return `熟${alv}`;
}

function matchEquipStatus(item: EquipInfoItem, status: EquipStatusFilter): boolean {
  switch (status) {
    case 'all':      return true;
    case 'kaisyuu':  return item.level > 0;
    case 'mastered': return item.alv > 0;
    case 'equipped': return item.equipperUid > 0;
    case 'spare':    return item.equipperUid === 0;
    default:         return true;
  }
}

function compareEquips(a: EquipInfoItem, b: EquipInfoItem, key: EquipSortKey): number {
  switch (key) {
    case 'master_asc': return a.masterId - b.masterId || a.uid - b.uid;
    case 'level_desc': return b.level - a.level || a.masterId - b.masterId || a.uid - b.uid;
    case 'alv_desc':   return b.alv - a.alv || a.masterId - b.masterId || a.uid - b.uid;
    case 'uid_asc':    return a.uid - b.uid;
    case 'los_desc':   return b.los - a.los || a.masterId - b.masterId || a.uid - b.uid;
    case 'aa_desc':    return b.aa - a.aa || a.masterId - b.masterId || a.uid - b.uid;
    case 'asw_desc':   return b.asw - a.asw || a.masterId - b.masterId || a.uid - b.uid;
    default:           return a.uid - b.uid;
  }
}

/** Build slot uid → ship-name map by scanning every ship's slots + exSlot. */
function buildEquipperIndex(): Map<number, { uid: number; name: string }> {
  const out = new Map<number, { uid: number; name: string }>();
  const state = getGameState().getState();
  state.ships.forEach((ship) => {
    const entry = { uid: ship.uid, name: ship.name };
    for (const slotUid of ship.slots) {
      if (slotUid > 0) out.set(slotUid, entry);
    }
    if (ship.exSlot > 0) out.set(ship.exSlot, entry);
  });
  return out;
}

// ==================== Page Component ====================

@ComponentV2
export default struct EquipInfoPage {
  @Event onClose: () => void;

  @Local private allEquips: EquipInfoItem[] = [];
  @Local private visibleEquips: EquipInfoItem[] = [];

  @Local private searchText: string = '';
  @Local private typeFilter: EquipTypeGroup = 'all';
  @Local private statusFilter: EquipStatusFilter = 'all';
  @Local private sortKey: EquipSortKey = 'master_asc';

  private unsubscribe: (() => void) | null = null;

  aboutToAppear(): void {
    this.reloadAll();
    // Slot item index is refreshed alongside ship-bearing API responses; subscribe
    // to 'ships' / 'all' to pick up changes (updateSlotItemIndex itself doesn't
    // emit a notification).
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
    const equipperIndex = buildEquipperIndex();
    const rows: EquipInfoItem[] = [];
    state.slotItemIndex.forEach((masterId: number, uid: number) => {
      const equipType = getSlotItemMasterEquipType(masterId);
      const group = groupForType(equipType);
      const equipper = equipperIndex.get(uid);
      const aswVal = state.slotItemAsw.get(masterId) ?? 0;
      rows.push({
        uid,
        masterId,
        name: getSlotItemMasterName(masterId),
        equipType,
        group,
        groupLabel: groupLabel(group),
        level: getSlotItemLevel(uid),
        alv: getSlotItemAlv(uid),
        los: getSlotItemMasterLos(masterId),
        aa: getSlotItemMasterAa(masterId),
        asw: aswVal,
        equipperUid: equipper !== undefined ? equipper.uid : 0,
        equipperName: equipper !== undefined ? equipper.name : '',
      });
    });
    this.allEquips = rows;
    this.recompute();
  }

  /** 重算可见列表：依次应用 搜索 / 大类 / 状态 过滤，再按 sortKey 排序。 */
  private recompute(): void {
    const q = this.searchText.trim().toLowerCase();
    const out: EquipInfoItem[] = [];
    for (const it of this.allEquips) {
      if (q.length > 0 && it.name.toLowerCase().indexOf(q) < 0) continue;
      if (this.typeFilter !== 'all' && it.group !== this.typeFilter) continue;
      if (!matchEquipStatus(it, this.statusFilter)) continue;
      out.push(it);
    }
    out.sort((a, b) => compareEquips(a, b, this.sortKey));
    this.visibleEquips = out;
  }

  private setSearch(v: string): void {
    if (v === this.searchText) return;
    this.searchText = v;
    this.recompute();
  }

  private setTypeFilter(k: EquipTypeGroup): void {
    if (k === this.typeFilter) return;
    this.typeFilter = k;
    this.recompute();
  }

  private setStatusFilter(k: EquipStatusFilter): void {
    if (k === this.statusFilter) return;
    this.statusFilter = k;
    this.recompute();
  }

  private setSortKey(k: EquipSortKey): void {
    if (k === this.sortKey) return;
    this.sortKey = k;
    this.recompute();
  }

  // ==================== Builders ====================

  @Builder
  private TypeChip(def: EquipTypeChipDef) {
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
  private StatusChip(def: EquipStatusChipDef) {
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
  private SortChip(def: EquipSortChipDef) {
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
      // Search
      Row() {
        TextInput({ text: this.searchText, placeholder: '按装备名搜索' })
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
          Text('種')
            .fontSize(11)
            .fontColor('#666')
            .width(20)
          ForEach(TYPE_CHIPS, (c: EquipTypeChipDef) => {
            this.TypeChip(c)
          }, (c: EquipTypeChipDef) => `t-${c.key}`)
        }
      }
      .scrollable(ScrollDirection.Horizontal)
      .scrollBar(BarState.Off)
      .width('100%')

      // Status chips
      Row({ space: 6 }) {
        Text('状')
          .fontSize(11)
          .fontColor('#666')
          .width(20)
        ForEach(STATUS_CHIPS, (c: EquipStatusChipDef) => {
          this.StatusChip(c)
        }, (c: EquipStatusChipDef) => `s-${c.key}`)
      }
      .width('100%')

      // Sort chips
      Scroll() {
        Row({ space: 6 }) {
          Text('順')
            .fontSize(11)
            .fontColor('#666')
            .width(20)
          ForEach(SORT_CHIPS, (c: EquipSortChipDef) => {
            this.SortChip(c)
          }, (c: EquipSortChipDef) => `o-${c.key}`)
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

  /** 单条装备记录行：UID + 类别徽章 + 名称 + ★/熟 + 装備者 + 索/対空/対潜/MID。 */
  @Builder
  private EquipInfoRow(item: EquipInfoItem) {
    Column({ space: 4 }) {
      Row({ space: 6 }) {
        Text(`#${item.uid}`)
          .fontSize(11)
          .fontColor('#6A7280')
          .fontWeight(FontWeight.Medium)
          .width(54)
        Text(item.groupLabel)
          .fontSize(11)
          .fontColor('#C8B99A')
          .padding({ left: 5, right: 5, top: 1, bottom: 1 })
          .backgroundColor('#2a2a20')
          .borderRadius(3)
        Text(item.name.length > 0 ? item.name : `#${item.masterId}`)
          .fontSize(14)
          .fontWeight(FontWeight.Medium)
          .fontColor('#FFF')
          .layoutWeight(1)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        if (item.level > 0) {
          Text(levelStars(item.level))
            .fontSize(11)
            .fontColor(COLOR_LEVEL)
            .padding({ left: 5, right: 5, top: 1, bottom: 1 })
            .backgroundColor('#2a2418')
            .borderRadius(3)
        }
        if (item.alv > 0) {
          Text(alvLabel(item.alv))
            .fontSize(11)
            .fontColor(COLOR_ALV)
            .padding({ left: 5, right: 5, top: 1, bottom: 1 })
            .backgroundColor('#1a2818')
            .borderRadius(3)
        }
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)

      Row({ space: 12 }) {
        // Equipper or spare label
        if (item.equipperUid > 0) {
          Text(`装備:${item.equipperName}`)
            .fontSize(12)
            .fontColor(COLOR_EQUIPPED)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .layoutWeight(1)
        } else {
          Text('未装備')
            .fontSize(12)
            .fontColor(COLOR_SPARE)
            .layoutWeight(1)
        }
        Text(`MID:${item.masterId}`)
          .fontSize(10)
          .fontColor('#4a5260')
      }
      .width('100%')

      Row({ space: 12 }) {
        Text(`索 ${item.los}`)
          .fontSize(11)
          .fontColor('#90A0B0')
        Text(`対空 ${item.aa}`)
          .fontSize(11)
          .fontColor('#90A0B0')
        Text(`対潜 ${item.asw}`)
          .fontSize(11)
          .fontColor('#90A0B0')
        Blank().layoutWeight(1)
        Text(`type:${item.equipType}`)
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
        Text('装备信息')
          .fontSize(17)
          .fontWeight(FontWeight.Medium)
          .fontColor('#FFF')
          .layoutWeight(1)
        Text(`${this.visibleEquips.length}/${this.allEquips.length}`)
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

      this.FilterBar()

      if (this.visibleEquips.length === 0) {
        Column() {
          Text(this.allEquips.length === 0 ? '暂无装备数据' : '当前筛选下无匹配装备')
            .fontSize(13)
            .fontColor('#666')
        }
        .width('100%')
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
        .backgroundColor(COLOR_BG_PAGE)
      } else {
        List() {
          ForEach(this.visibleEquips, (item: EquipInfoItem) => {
            ListItem() {
              this.EquipInfoRow(item)
            }
          }, (item: EquipInfoItem) => `${item.uid}`)
        }
        .width('100%')
        .layoutWeight(1)
        .backgroundColor(COLOR_BG_PAGE)
      }

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
    .gesture(
      PanGesture({ direction: PanDirection.Right, distance: 60 })
        .onActionEnd(() => this.onClose?.())
    )
    .onClick(() => {})
  }
}
