import {
  subscribeGameState,
  getGameState,
  getSlotItemMasterName,
  getSlotItemMasterEquipType,
  getSlotItemMasterIconType,
  getSlotItemMasterLos,
  getSlotItemMasterAa,
  getSlotItemMasterArmor,
  getSlotItemMasterAsw,
  getSlotItemMasterFire,
  getSlotItemMasterTorp,
  getSlotItemMasterBomb,
  getSlotItemMasterHit,
  getSlotItemMasterEvasion,
  getSlotItemMasterSpeed,
  getSlotItemMasterRange,
  getSlotItemMasterRare,
  getSlotItemMasterCost,
  getSlotItemMasterDistance,
  getSlotItemLevel,
  getSlotItemAlv,
} from '../../../../features/state';
import { equipLabel } from '../../../../features/panel/panelConfig';

// ==================== Types ====================

type EquipTypeGroup = string;

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
  iconType: number;
  group: EquipTypeGroup;
  groupLabel: string;
  level: number;
  alv: number;
  armor: number;
  fire: number;
  torp: number;
  bomb: number;
  los: number;
  aa: number;
  asw: number;
  hit: number;
  evasion: number;
  speed: number;
  range: number;
  rare: number;
  cost: number;
  distance: number;
  statLine: string;
  detailLine: string;
  /** UID of the ship holding this slot, 0 if not equipped (spare). */
  equipperUid: number;
  equipperName: string;
}

// ==================== Constants ====================

interface EquipGroupSpec {
  key: EquipTypeGroup;
  label: string;
  /** ordinary slot item icon id (api_type[3]) represented by this group. */
  icon: number;
}

/** 装备分类按普通装备 icon(api_type[3]) 细分。特殊 icon 变体只用于装备本体显示，不参与分类。 */
const EQUIP_GROUPS: EquipGroupSpec[] = [
  { key: 'i-1', label: '小口径主炮', icon: 1 },
  { key: 'i-2', label: '中口径主炮', icon: 2 },
  { key: 'i-3', label: '大口径主炮', icon: 3 },
  { key: 'i-4', label: '副炮', icon: 4 },
  { key: 'i-5', label: '鱼雷', icon: 5 },
  { key: 'i-6', label: '舰载战斗机', icon: 6 },
  { key: 'i-7', label: '舰载轰炸机', icon: 7 },
  { key: 'i-8', label: '舰载攻击机', icon: 8 },
  { key: 'i-9', label: '舰载侦察机', icon: 9 },
  { key: 'i-10', label: '水上机', icon: 10 },
  { key: 'i-11', label: '电探', icon: 11 },
  { key: 'i-12', label: '对空强化弹', icon: 12 },
  { key: 'i-13', label: '对舰强化弹', icon: 13 },
  { key: 'i-14', label: '损害管制', icon: 14 },
  { key: 'i-15', label: '对空机枪', icon: 15 },
  { key: 'i-16', label: '高角炮', icon: 16 },
  { key: 'i-17', label: '爆雷', icon: 17 },
  { key: 'i-18', label: '声呐', icon: 18 },
  { key: 'i-19', label: '机关强化', icon: 19 },
  { key: 'i-20', label: '登陆艇', icon: 20 },
  { key: 'i-21', label: '旋翼机', icon: 21 },
  { key: 'i-22', label: '反潜巡逻机', icon: 22 },
  { key: 'i-23', label: '增设装甲', icon: 23 },
  { key: 'i-24', label: '探照灯', icon: 24 },
  { key: 'i-25', label: '运输桶', icon: 25 },
  { key: 'i-26', label: '修理设施', icon: 26 },
  { key: 'i-27', label: '照明弹', icon: 27 },
  { key: 'i-28', label: '司令部设施', icon: 28 },
  { key: 'i-29', label: '航空人员', icon: 29 },
  { key: 'i-30', label: '高射装置', icon: 30 },
  { key: 'i-31', label: '对陆装备', icon: 31 },
  { key: 'i-32', label: '水上舰人员', icon: 32 },
  { key: 'i-33', label: '大型飞行艇', icon: 33 },
  { key: 'i-34', label: '战斗粮食', icon: 34 },
  { key: 'i-35', label: '补给物资', icon: 35 },
  { key: 'i-36', label: '特型内火艇', icon: 36 },
  { key: 'i-37', label: '陆上攻击机', icon: 37 },
  { key: 'i-38', label: '局地战斗机', icon: 38 },
  { key: 'i-39', label: '喷气景云', icon: 39 },
  { key: 'i-40', label: '橘花改', icon: 40 },
  { key: 'i-41', label: '运输机材', icon: 41 },
  { key: 'i-42', label: '潜水舰装备', icon: 42 },
  { key: 'i-43', label: '水上战斗机', icon: 43 },
  { key: 'i-44', label: '陆军战斗机', icon: 44 },
  { key: 'i-45', label: '夜间战斗机', icon: 45 },
  { key: 'i-46', label: '夜间攻击机', icon: 46 },
  { key: 'i-47', label: '陆上反潜机', icon: 47 },
  { key: 'i-48', label: '袭击机', icon: 48 },
  { key: 'i-49', label: '大型陆上机', icon: 49 },
  { key: 'i-50', label: '水上侦察机', icon: 50 },
  { key: 'i-51', label: '水上侦察机二', icon: 51 },
  { key: 'i-52', label: 'DD战车', icon: 52 },
  { key: 'i-54', label: '油罐装备', icon: 54 },
  { key: 'i-55', label: '气球', icon: 55 },
  { key: 'i-56', label: '喷气战斗机', icon: 56 },
  { key: 'i-57', label: '震电系飞机', icon: 57 },
  { key: 'i-58', label: '飞机装备', icon: 58 },
  { key: 'i-59', label: '航空装备', icon: 59 },
  { key: 'i-60', label: '震电改', icon: 60 },
];

const EQUIP_GROUP_LABEL: Map<EquipTypeGroup, string> = (() => {
  const m = new Map<EquipTypeGroup, string>();
  for (const g of EQUIP_GROUPS) m.set(g.key, g.label);
  m.set('other', '其他');
  m.set('all', '全部');
  return m;
})();

const EQUIP_GROUP_ICON: Map<EquipTypeGroup, number> = (() => {
  const m = new Map<EquipTypeGroup, number>();
  for (const g of EQUIP_GROUPS) m.set(g.key, g.icon);
  m.set('other', 0);
  m.set('all', 0);
  return m;
})();

const TYPE_ORDER: string[] = (() => {
  const out: string[] = [];
  for (const g of EQUIP_GROUPS) out.push(g.key);
  out.push('other');
  return out;
})();

interface EquipStatusChipDef { key: EquipStatusFilter; label: string; }
interface EquipSortChipDef { key: EquipSortKey; label: string; }

const STATUS_CHIPS: EquipStatusChipDef[] = [
  { key: 'all',      label: '全部' },
  { key: 'kaisyuu',  label: '已改修' },
  { key: 'mastered', label: '有熟练' },
  { key: 'equipped', label: '装备中' },
  { key: 'spare',    label: '未装备' },
];

const SORT_CHIPS: EquipSortChipDef[] = [
  { key: 'master_asc', label: 'MID' },
  { key: 'level_desc', label: '★↓' },
  { key: 'alv_desc',   label: '熟练↓' },
  { key: 'uid_asc',    label: 'UID' },
  { key: 'los_desc',   label: '索敌↓' },
  { key: 'aa_desc',    label: '对空↓' },
  { key: 'asw_desc',   label: '对潜↓' },
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

function groupForIcon(iconType: number): EquipTypeGroup {
  return iconType > 0 ? `i-${iconType}` : 'other';
}

function iconIdFromGroup(group: string): number {
  if (group.indexOf('i-') !== 0) return 0;
  const id = Number(group.substring(2));
  return id > 0 ? Math.floor(id) : 0;
}

function groupLabel(group: EquipTypeGroup): string {
  const label = EQUIP_GROUP_LABEL.get(group);
  if (label !== undefined) return label;
  const icon = iconIdFromGroup(group);
  return icon > 0 ? `图标${icon}` : '其他';
}

function groupIcon(group: EquipTypeGroup): number {
  const icon = EQUIP_GROUP_ICON.get(group);
  if (icon !== undefined) return icon;
  return iconIdFromGroup(group);
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

function signedStat(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
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

function buildStatLine(item: EquipInfoItem): string {
  const parts: string[] = [];
  if (item.armor !== 0) parts.push(`装甲 ${signedStat(item.armor)}`);
  if (item.fire !== 0) parts.push(`火力 ${signedStat(item.fire)}`);
  if (item.torp !== 0) parts.push(`雷装 ${signedStat(item.torp)}`);
  if (item.bomb !== 0) parts.push(`爆装 ${signedStat(item.bomb)}`);
  if (item.aa !== 0) parts.push(`对空 ${signedStat(item.aa)}`);
  if (item.asw !== 0) parts.push(`对潜 ${signedStat(item.asw)}`);
  if (item.los !== 0) parts.push(`索敌 ${signedStat(item.los)}`);
  if (item.hit !== 0) parts.push(`命中 ${signedStat(item.hit)}`);
  if (item.evasion !== 0) parts.push(`回避 ${signedStat(item.evasion)}`);
  if (item.speed !== 0) parts.push(`速力 ${signedStat(item.speed)}`);
  return parts.length > 0 ? parts.join('  ') : '属性 无';
}

function buildDetailLine(item: EquipInfoItem): string {
  const parts: string[] = [];
  if (item.range > 0) parts.push(`射程 ${rangeLabel(item.range)}`);
  if (item.distance > 0) parts.push(`航程 ${item.distance}`);
  if (item.cost > 0) parts.push(`铝耗 ${item.cost}`);
  if (item.rare > 0) parts.push(`稀有 ${item.rare}`);
  parts.push(`类型 ${item.equipType}`);
  parts.push(`图标 ${item.iconType}`);
  return parts.join('  ');
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

interface TmpEntry {
  uid: number;
  name: string;
}

/** Build slot uid → ship-name map by scanning every ship's slots + exSlot. */
function buildEquipperIndex(): Map<number, TmpEntry> {
  const out = new Map<number, TmpEntry>();
  const state = getGameState().getState();
  state.ships.forEach((ship) => {
    const entry: TmpEntry = { uid: ship.uid, name: ship.name };
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
  @Local private presentTypes: string[] = [];

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
      const iconType = getSlotItemMasterIconType(masterId);
      const group = groupForIcon(iconType);
      const equipper = equipperIndex.get(uid);
      const item: EquipInfoItem = {
        uid,
        masterId,
        name: getSlotItemMasterName(masterId),
        equipType,
        iconType,
        group,
        groupLabel: groupLabel(group),
        level: getSlotItemLevel(uid),
        alv: getSlotItemAlv(uid),
        armor: getSlotItemMasterArmor(masterId),
        fire: getSlotItemMasterFire(masterId),
        torp: getSlotItemMasterTorp(masterId),
        bomb: getSlotItemMasterBomb(masterId),
        los: getSlotItemMasterLos(masterId),
        aa: getSlotItemMasterAa(masterId),
        asw: getSlotItemMasterAsw(masterId),
        hit: getSlotItemMasterHit(masterId),
        evasion: getSlotItemMasterEvasion(masterId),
        speed: getSlotItemMasterSpeed(masterId),
        range: getSlotItemMasterRange(masterId),
        rare: getSlotItemMasterRare(masterId),
        cost: getSlotItemMasterCost(masterId),
        distance: getSlotItemMasterDistance(masterId),
        statLine: '',
        detailLine: '',
        equipperUid: equipper !== undefined ? equipper.uid : 0,
        equipperName: equipper !== undefined ? equipper.name : '',
      };
      item.statLine = buildStatLine(item);
      item.detailLine = buildDetailLine(item);
      rows.push(item);
    });
    this.allEquips = rows;
    this.recompute();
  }

  private rebuildPresentTypes(): void {
    const q = this.searchText.trim().toLowerCase();
    const groups = new Set<string>();
    for (const it of this.allEquips) {
      if (q.length > 0 && it.name.toLowerCase().indexOf(q) < 0) continue;
      if (!matchEquipStatus(it, this.statusFilter)) continue;
      groups.add(it.group);
    }
    const ordered = TYPE_ORDER.filter((c) => groups.has(c));
    const extra: string[] = [];
    groups.forEach((c: string) => {
      if (TYPE_ORDER.indexOf(c) < 0) extra.push(c);
    });
    extra.sort((a: string, b: string) => groupIcon(a) - groupIcon(b));
    this.presentTypes = ordered.concat(extra);
    if (this.typeFilter !== 'all' && this.presentTypes.indexOf(this.typeFilter) < 0) {
      this.typeFilter = 'all';
    }
  }

  /** 重算可见列表：依次应用 搜索 / 大类 / 状态 过滤，再按 sortKey 排序。 */
  private recompute(): void {
    this.rebuildPresentTypes();
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
  private TypeChip(type: EquipTypeGroup) {
    Row({ space: 3 }) {
      if (type !== 'all' && groupIcon(type) > 0) {
        Image(equipLabel(groupIcon(type)))
          .width(15)
          .height(15)
      }
      Text(type === 'all' ? '全部' : groupLabel(type))
        .fontSize(12)
        .fontColor(this.typeFilter === type ? COLOR_FG_CHIP_ACTIVE : COLOR_FG_CHIP)
        .fontWeight(this.typeFilter === type ? FontWeight.Medium : FontWeight.Regular)
    }
    .padding({ left: 9, right: 9, top: 5, bottom: 5 })
    .backgroundColor(this.typeFilter === type ? COLOR_BG_CHIP_ACTIVE : COLOR_BG_CHIP)
    .borderRadius(12)
    .onClick(() => this.setTypeFilter(type))
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
          Text('序')
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

  /** 单条装备记录行：UID + 装备图标 + 分类徽章 + 名称 + ★/熟练 + 装备者 + 属性。 */
  @Builder
  private EquipInfoRow(item: EquipInfoItem) {
    Column({ space: 4 }) {
      Row({ space: 6 }) {
        Text(`#${item.uid}`)
          .fontSize(11)
          .fontColor('#6A7280')
          .fontWeight(FontWeight.Medium)
          .width(54)
        if (item.iconType > 0) {
          Image(equipLabel(item.iconType, item.equipType, item.masterId))
            .width(24)
            .height(24)
        }
        Row({ space: 3 }) {
          if (groupIcon(item.group) > 0) {
            Image(equipLabel(groupIcon(item.group)))
              .width(13)
              .height(13)
          }
          Text(item.groupLabel)
            .fontSize(11)
            .fontColor('#C8B99A')
        }
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
          Text(`装备中:${item.equipperName}`)
            .fontSize(12)
            .fontColor(COLOR_EQUIPPED)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .layoutWeight(1)
        } else {
          Text('未装备')
            .fontSize(12)
            .fontColor(COLOR_SPARE)
            .layoutWeight(1)
        }
        Text(`MID:${item.masterId}`)
          .fontSize(10)
          .fontColor('#4a5260')
      }
      .width('100%')

      Text(item.statLine)
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
