import util from '@ohos.util';
import { common } from '@kit.AbilityKit';
import {
  subscribeGameState,
  getGameState,
  getSlotItemMasterName,
  getSlotItemMasterIconType,
  getUseItemMasterName,
  getShipMasterName,
} from '../../../../features/state';
import { equipLabel } from '../../../../features/panel/panelConfig';
import { kvGetString, kvSet } from '../../../../infra/storage/kv';

// ==================== 数据 schema ====================
//
// 改修情报由 rawfile/data/improvement.json 提供，由
// scripts/update-improvement-data.mjs 每月从 ElectronicObserver 数据库
// (wiki 改修表由来、持续更新) 拉取生成。每个阶段含完整配方：
//   开发资材(普通 dev / 确保 devGS) / 改修资材(普通 screw / 确保 screwGS) /
//   消耗装备(consumed) / 基础消耗(base) / 秘书舰(reqs.ships) / MAX 更新目标(convertTo)。
// 装备名、分类、图标按 master id 在 App 内解析。

interface ConsumedItem {
  id: number;
  count: number;
  use: boolean;   // true=道具(useitem)，false=装备(slotitem)
}

interface ReqGroup {
  days: boolean[];   // 长度 7，日月火水木金土
  ships: number[];   // 秘书舰 master id
}

interface Stage {
  dev: number;       // 开发资材（普通）
  devGS: number;     // 开发资材（确保）
  screw: number;     // 改修资材（普通）
  screwGS: number;   // 改修资材（确保）
  consumed: ConsumedItem[];
}

interface ImprovementEntry {
  id: number;
  base: number[];               // [燃,弹,钢,铝]
  stages: (Stage | null)[];     // [★0-5, ★6-9, MAX]
  convertTo: number;            // MAX 改修更新先 master id（0=无）
  reqs: ReqGroup[];
  days: boolean[];
  secretaryCount: number;
}

interface ImprovementFile {
  source?: string;
  fetchedAt?: string;
  count?: number;
  equipment?: ImprovementEntry[];
}

// ==================== 视图模型 ====================

interface NamedShip { id: number; name: string; }

interface RemodelRow {
  id: number;
  name: string;
  group: string;    // 装备图标分类 key
  iconType: number;
  base: number[];
  stages: (Stage | null)[];
  convertTo: number;
  convertToName: string;
  reqs: ReqGroup[];
  days: boolean[];
  secretaries: NamedShip[];
  held: number;
  availToday: boolean;
}

// ==================== 常量 ====================

const REMODEL_RAWFILE = 'data/improvement.json';

/** 收藏的装备 id 列表（JSON 数组）持久化到 KV。 */
const FAV_KEY = 'remodel.favorites';

const RES_ICON_DIR = 'resource://RAWFILE/icons/res/';
const DEV_ICON = `${RES_ICON_DIR}dev.png`;
const SCREW_ICON = `${RES_ICON_DIR}nail.png`;
const BASE_ICONS: string[] = [
  `${RES_ICON_DIR}fuel.png`,
  `${RES_ICON_DIR}ammo.png`,
  `${RES_ICON_DIR}iron.png`,
  `${RES_ICON_DIR}bauxite.png`,
];

const WEEK: string[] = ['日', '一', '二', '三', '四', '五', '六'];

// 装备类型按普通装备 icon(api_type[3]) 细分。特殊图标变体（例如 10-11、17-2）不参与分类。
interface GroupSpec { key: string; label: string; icon: number; }

const ICON_GROUPS: GroupSpec[] = [
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

const GROUP_LABEL: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const g of ICON_GROUPS) m.set(g.key, g.label);
  m.set('other', '其他');
  return m;
})();

const GROUP_ICON: Map<string, number> = (() => {
  const m = new Map<string, number>();
  for (const g of ICON_GROUPS) m.set(g.key, g.icon);
  m.set('other', 0);
  return m;
})();

const CAT_ORDER: string[] = (() => {
  const out: string[] = [];
  for (const g of ICON_GROUPS) out.push(g.key);
  out.push('other');
  return out;
})();

const STAGE_LABELS: string[] = ['★0 ～ 5', '★6 ～ 9', 'MAX'];

const COLOR_BG_PAGE = '#1a1d27';
const COLOR_BG_HEADER = '#0f1118';
const COLOR_BG_TOOLBAR = '#14171f';
const COLOR_BG_CHIP_ACTIVE = '#1c3535';
const COLOR_FG_CHIP_ACTIVE = '#56d8e0';
const COLOR_BG_CHIP = '#1c1f2a';
const COLOR_FG_CHIP = '#aab1bd';
const COLOR_BORDER = '#272a36';
const COLOR_SCREW = '#FFD54F';
const COLOR_DEV = '#80CBC4';
const COLOR_HELD = '#A5D6A7';
const COLOR_DAY_ON = '#56d8e0';
const COLOR_DAY_OFF = '#3a3f4c';
const COLOR_TODAY = '#FFD54F';
const COLOR_MUTED = '#5a6270';
const COLOR_SECRETARY = '#B0BEC5';
const COLOR_FAV = '#FFB300';   // 收藏（star_fill）警示色

// ==================== 工具函数 ====================

/** 当前日本时间（UTC+9）的星期，0=日 … 6=土。 */
function jstWeekday(): number {
  return new Date(Date.now() + 9 * 3600 * 1000).getUTCDay();
}

function iconGroupForIcon(iconType: number): string {
  return iconType > 0 ? `i-${iconType}` : 'other';
}

function iconIdFromGroup(group: string): number {
  if (group.indexOf('i-') !== 0) return 0;
  const id = Number(group.substring(2));
  return id > 0 ? Math.floor(id) : 0;
}

function catLabel(group: string): string {
  const label = GROUP_LABEL.get(group);
  if (label !== undefined) return label;
  const icon = iconIdFromGroup(group);
  return icon > 0 ? `图标${icon}` : '其他';
}

function catIcon(group: string): number {
  const icon = GROUP_ICON.get(group);
  if (icon !== undefined) return icon;
  return iconIdFromGroup(group);
}

/** "普通 (确保)" 文本：确保值无效(<=0)或与普通相同时只显示普通值。 */
function amountText(normal: number, ensure: number): string {
  if (normal < 0) return '?';
  return ensure > 0 && ensure !== normal ? `${normal} (${ensure})` : `${normal}`;
}

function consumedName(c: ConsumedItem): string {
  const n = c.use ? getUseItemMasterName(c.id) : getSlotItemMasterName(c.id);
  if (n.length > 0) return n;
  return c.use ? `道具#${c.id}` : `装备#${c.id}`;
}

// ==================== 页面组件 ====================

@ComponentV2
export default struct RemodelInfoPage {
  @Event onClose: () => void;

  @Local private fetchedAt: string = '';
  @Local private allRows: RemodelRow[] = [];
  @Local private visibleRows: RemodelRow[] = [];
  @Local private presentCats: string[] = [];

  @Local private searchText: string = '';
  @Local private typeFilter: string = 'all';
  @Local private todayOnly: boolean = true;
  @Local private expandedId: number = -1;
  @Local private favorites: Set<number> = new Set<number>();
  @Local private unimprovedMaterialHeld: Map<number, number> = new Map<number, number>();

  private entries: ImprovementEntry[] = [];
  private loaded: boolean = false;
  private unsubscribe: (() => void) | null = null;

  aboutToAppear(): void {
    void this.loadFavorites();
    void this.loadData();
    this.unsubscribe = subscribeGameState((changeType, _state) => {
      if (changeType === 'all' || changeType === 'ships') {
        this.rebuildRows();
      }
    });
  }

  aboutToDisappear(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  private async loadData(): Promise<void> {
    try {
      const ctx = getContext(this) as common.UIAbilityContext;
      const rm = ctx.resourceManager;
      const buf = await rm.getRawFileContent(REMODEL_RAWFILE);
      const text = new util.TextDecoder('utf-8').decode(buf);
      const obj = JSON.parse(text) as ImprovementFile;
      this.entries = obj.equipment ?? [];
      this.fetchedAt = obj.fetchedAt ?? '';
    } catch (e) {
      console.info('[RemodelInfoPage] improvement.json not loaded:', String(e));
      this.entries = [];
    }
    this.loaded = true;
    this.rebuildRows();
  }

  /** 从 KV 读取收藏的装备 id 列表。 */
  private async loadFavorites(): Promise<void> {
    try {
      const raw = await kvGetString(FAV_KEY, '[]');
      const arr = JSON.parse(raw) as number[];
      const set = new Set<number>();
      if (Array.isArray(arr)) {
        for (const v of arr) if (typeof v === 'number' && v > 0) set.add(v);
      }
      this.favorites = set;
      this.recompute();
    } catch (e) {
      console.info('[RemodelInfoPage] favorites not loaded:', String(e));
    }
  }

  /** 切换收藏并持久化；收藏后该装备优先显示。 */
  private toggleFavorite(id: number): void {
    const next = new Set<number>(this.favorites);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.favorites = next;
    void kvSet(FAV_KEY, JSON.stringify(Array.from(next)));
    this.recompute();
  }

  private buildHeldIndex(): Map<number, number> {
    const out = new Map<number, number>();
    const state = getGameState().getState();
    state.slotItemIndex.forEach((masterId: number) => {
      out.set(masterId, (out.get(masterId) ?? 0) + 1);
    });
    return out;
  }

  private buildUnimprovedMaterialHeldIndex(): Map<number, number> {
    const out = new Map<number, number>();
    const state = getGameState().getState();
    state.slotItemIndex.forEach((masterId: number, uid: number) => {
      const level = state.slotItemLevels.get(uid) ?? 0;
      if (level <= 0) {
        out.set(masterId, (out.get(masterId) ?? 0) + 1);
      }
    });
    return out;
  }

  /** 解析秘书舰：合并各 req 组的 ship id，去重保序，解析舰名。 */
  private resolveSecretaries(reqs: ReqGroup[]): NamedShip[] {
    const seen = new Set<number>();
    const out: NamedShip[] = [];
    for (const r of reqs) {
      for (const sid of r.ships) {
        if (seen.has(sid)) continue;
        seen.add(sid);
        const nm = getShipMasterName(sid);
        out.push({ id: sid, name: nm !== undefined && nm.length > 0 ? nm : `#${sid}` });
      }
    }
    return out;
  }

  private rebuildRows(): void {
    if (!this.loaded) return;
    const held = this.buildHeldIndex();
    this.unimprovedMaterialHeld = this.buildUnimprovedMaterialHeldIndex();
    const today = jstWeekday();
    const rows: RemodelRow[] = [];
    const cats = new Set<string>();
    for (const e of this.entries) {
      const iconType = getSlotItemMasterIconType(e.id);
      const group = iconGroupForIcon(iconType);
      const masterName = getSlotItemMasterName(e.id);
      const convName = e.convertTo > 0 ? getSlotItemMasterName(e.convertTo) : '';
      cats.add(group);
      rows.push({
        id: e.id,
        name: masterName.length > 0 ? masterName : `#${e.id}`,
        group,
        iconType,
        base: e.base ?? [],
        stages: e.stages,
        convertTo: e.convertTo,
        convertToName: convName.length > 0 ? convName : (e.convertTo > 0 ? `#${e.convertTo}` : ''),
        reqs: e.reqs,
        days: e.days,
        secretaries: this.resolveSecretaries(e.reqs),
        held: held.get(e.id) ?? 0,
        availToday: e.days.length === 7 ? e.days[today] : true,
      });
    }
    this.allRows = rows;
    const orderedCats = CAT_ORDER.filter((c) => cats.has(c));
    const extraCats: string[] = [];
    cats.forEach((c: string) => {
      if (CAT_ORDER.indexOf(c) < 0) extraCats.push(c);
    });
    extraCats.sort((a: string, b: string) => catIcon(a) - catIcon(b));
    this.presentCats = orderedCats.concat(extraCats);
    this.recompute();
  }

  private recompute(): void {
    const q = this.searchText.trim().toLowerCase();
    const out: RemodelRow[] = [];
    for (const r of this.allRows) {
      if (this.todayOnly && !r.availToday) continue;
      if (q.length > 0 && r.name.toLowerCase().indexOf(q) < 0) continue;
      if (this.typeFilter !== 'all' && r.group !== this.typeFilter) continue;
      out.push(r);
    }
    out.sort((a, b) => {
      const fa = this.favorites.has(a.id) ? 1 : 0;
      const fb = this.favorites.has(b.id) ? 1 : 0;
      return (fb - fa) || (b.held - a.held) || (a.id - b.id);
    });
    this.visibleRows = out;
  }

  private setSearch(v: string): void {
    if (v === this.searchText) return;
    this.searchText = v;
    this.recompute();
  }

  private setTypeFilter(k: string): void {
    if (k === this.typeFilter) return;
    this.typeFilter = k;
    this.recompute();
  }

  private toggleToday(): void {
    this.todayOnly = !this.todayOnly;
    this.recompute();
  }

  private toggleExpand(id: number): void {
    this.expandedId = this.expandedId === id ? -1 : id;
  }

  // ==================== Builders ====================

  @Builder
  private DayStrip(days: boolean[], today: number) {
    Row({ space: 2 }) {
      ForEach(WEEK, (w: string, idx: number) => {
        Text(w)
          .fontSize(10)
          .fontColor(days.length === 7 && days[idx] ? COLOR_DAY_ON : COLOR_DAY_OFF)
          .fontWeight(idx === today ? FontWeight.Bold : FontWeight.Regular)
          .width(15)
          .height(15)
          .textAlign(TextAlign.Center)
          .borderRadius(3)
          .border({ width: idx === today ? 1 : 0, color: COLOR_TODAY })
      }, (w: string, idx: number) => `d-${idx}`)
    }
  }

  @Builder
  private CatChip(type: string) {
    Row({ space: 3 }) {
      if (type !== 'all' && catIcon(type) > 0) {
        Image(equipLabel(catIcon(type)))
          .width(15)
          .height(15)
      }
      Text(type === 'all' ? '全部' : catLabel(type))
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
  private FilterBar() {
    Column({ space: 6 }) {
      Row({ space: 6 }) {
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
        Text(this.todayOnly ? '仅今日' : '全部日期')
          .fontSize(12)
          .fontColor(this.todayOnly ? COLOR_FG_CHIP_ACTIVE : COLOR_FG_CHIP)
          .fontWeight(this.todayOnly ? FontWeight.Medium : FontWeight.Regular)
          .padding({ left: 10, right: 10, top: 8, bottom: 8 })
          .backgroundColor(this.todayOnly ? COLOR_BG_CHIP_ACTIVE : COLOR_BG_CHIP)
          .borderRadius(8)
          .onClick(() => this.toggleToday())
      }
      .width('100%')

      Scroll() {
        Row({ space: 6 }) {
          this.CatChip('all')
          ForEach(this.presentCats, (c: string) => {
            this.CatChip(c)
          }, (c: string) => `c-${c}`)
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

  /** 单个消费装备 chip：[icon][名称]×N。 */
  @Builder
  private ConsumedChip(c: ConsumedItem) {
    Row({ space: 2 }) {
      if (!c.use && getSlotItemMasterIconType(c.id) > 0) {
        Image(equipLabel(getSlotItemMasterIconType(c.id), 0, c.id))
          .width(16)
          .height(16)
      } else {
        Text(c.use ? '道' : '装')
          .fontSize(9)
          .fontColor(COLOR_MUTED)
          .width(16)
          .height(16)
          .textAlign(TextAlign.Center)
          .backgroundColor('#222633')
          .borderRadius(3)
      }
      Text(consumedName(c))
        .fontSize(11)
        .fontColor('#C8D0DA')
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
      Text(`×${c.count}`)
        .fontSize(11)
        .fontColor('#9aa3b0')
      if (!c.use) {
        Text(`（${this.unimprovedMaterialHeld.get(c.id) ?? 0}）`)
          .fontSize(11)
          .fontColor(COLOR_HELD)
      }
    }
  }

  /** 阶段消耗表的一行。screw<=0 且无消费视为该段不存在。 */
  @Builder
  private StageRow(label: string, st: Stage | null) {
    Row() {
      Text(label)
        .fontSize(12)
        .fontColor('#C8D0DA')
        .width(58)
      if (st === null || (st.screw <= 0 && st.dev <= 0 && st.consumed.length === 0)) {
        Text('—').fontSize(12).fontColor(COLOR_MUTED).layoutWeight(1).textAlign(TextAlign.Center)
      } else {
        // 开发资材
        Row({ space: 2 }) {
          if (st.dev < 0) {
            Text('?').fontSize(12).fontColor(COLOR_MUTED)
          } else if (st.dev === 0 && st.devGS <= 0) {
            Text('0').fontSize(12).fontColor(COLOR_MUTED)
          } else {
            Image(DEV_ICON).width(14).height(14)
            Text(amountText(st.dev, st.devGS)).fontSize(12).fontColor(COLOR_DEV)
          }
        }
        .width(78)
        .justifyContent(FlexAlign.Center)
        // 改修资材
        Row({ space: 2 }) {
          Image(SCREW_ICON).width(14).height(14)
          Text(amountText(st.screw, st.screwGS)).fontSize(12).fontColor(COLOR_SCREW)
        }
        .width(72)
        .justifyContent(FlexAlign.Center)
        // 消耗装备
        Column({ space: 2 }) {
          if (st.consumed.length === 0) {
            Text('—').fontSize(12).fontColor(COLOR_MUTED)
          } else {
            ForEach(st.consumed, (c: ConsumedItem) => {
              this.ConsumedChip(c)
            }, (c: ConsumedItem) => `cs-${c.use ? 'u' : 's'}-${c.id}`)
          }
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start)
      }
    }
    .width('100%')
    .padding({ top: 5, bottom: 5 })
    .alignItems(VerticalAlign.Center)
    .border({ width: { top: 0.5 }, color: '#20232e' })
  }

  /** 展开区：阶段消耗表 + 基础资源 + 秘书舰明细。 */
  @Builder
  private DetailPanel(row: RemodelRow, today: number) {
    Column({ space: 6 }) {
      // 标题栏：★ / 开发资材 / 改修资材 / 消耗装备
      Row() {
        Text('★').fontSize(11).fontColor('#9aa3b0').width(58)
        Text('开发资材').fontSize(11).fontColor('#9aa3b0').width(78).textAlign(TextAlign.Center)
        Text('改修资材').fontSize(11).fontColor('#9aa3b0').width(72).textAlign(TextAlign.Center)
        Text('消耗装备').fontSize(11).fontColor('#9aa3b0').layoutWeight(1)
      }
      .width('100%')

      this.StageRow(STAGE_LABELS[0], row.stages.length > 0 ? row.stages[0] : null)
      this.StageRow(STAGE_LABELS[1], row.stages.length > 1 ? row.stages[1] : null)
      this.StageRow(STAGE_LABELS[2], row.stages.length > 2 ? row.stages[2] : null)

      // MAX 改修更新先
      if (row.convertTo > 0) {
        Row({ space: 4 }) {
          Text('更新目标').fontSize(11).fontColor('#9aa3b0').width(58)
          if (getSlotItemMasterIconType(row.convertTo) > 0) {
            Image(equipLabel(getSlotItemMasterIconType(row.convertTo), 0, row.convertTo))
              .width(16).height(16)
          }
          Text(`→ ${row.convertToName}`)
            .fontSize(12)
            .fontColor('#C8B99A')
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .layoutWeight(1)
        }
        .width('100%')
        .padding({ top: 4 })
        .alignItems(VerticalAlign.Center)
      }

      // 基础资源（燃弹钢铝）
      if (row.base.length >= 4) {
        Row({ space: 10 }) {
          Text('基础').fontSize(11).fontColor('#9aa3b0').width(58)
          ForEach(row.base, (v: number, idx: number) => {
            Row({ space: 2 }) {
              Image(BASE_ICONS[idx]).width(13).height(13)
              Text(`${v}`).fontSize(11).fontColor('#9aa3b0')
            }
          }, (v: number, idx: number) => `b-${idx}`)
        }
        .width('100%')
        .padding({ top: 4 })
      }

      // 秘书舰
      Column({ space: 4 }) {
        Row() {
          Text('秘书舰').fontSize(11).fontColor('#9aa3b0').layoutWeight(1)
          this.DayStrip(row.days, today)
        }
        .width('100%')
        .alignItems(VerticalAlign.Center)

        if (row.secretaries.length > 0) {
          Flex({ wrap: FlexWrap.Wrap }) {
            ForEach(row.secretaries, (s: NamedShip) => {
              Text(s.name)
                .fontSize(11)
                .fontColor(COLOR_SECRETARY)
                .padding({ left: 6, right: 6, top: 2, bottom: 2 })
                .margin({ right: 4, bottom: 4 })
                .backgroundColor('#202634')
                .borderRadius(4)
            }, (s: NamedShip) => `sec-${s.id}`)
          }
          .width('100%')
        } else {
          Text('（无秘书舰数据）')
            .fontSize(10)
            .fontColor(COLOR_MUTED)
            .width('100%')
        }
      }
      .width('100%')
      .padding({ top: 6 })
      .border({ width: { top: 0.5 }, color: COLOR_BORDER })

      Text('※ 括号内为确保成功时的消耗量。')
        .fontSize(10)
        .fontColor(COLOR_MUTED)
        .width('100%')
    }
    .width('100%')
    .padding({ left: 14, right: 14, top: 8, bottom: 12 })
    .backgroundColor('#11141c')
  }

  /** 折叠行的秘书舰摘要：最多 3 个舰名 + 余量；无名时回退到日期条。 */
  @Builder
  private SecretarySummary(row: RemodelRow, today: number) {
    if (row.secretaries.length > 0) {
      Row({ space: 3 }) {
        ForEach(row.secretaries.slice(0, 3), (s: NamedShip) => {
          Text(s.name)
            .fontSize(10)
            .fontColor(COLOR_SECRETARY)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .constraintSize({ maxWidth: 64 })
        }, (s: NamedShip) => `ss-${s.id}`)
        if (row.secretaries.length > 3) {
          Text(`另${row.secretaries.length - 3}`)
            .fontSize(10)
            .fontColor(COLOR_MUTED)
        }
      }
    } else {
      this.DayStrip(row.days, today)
    }
  }

  @Builder
  private RemodelRowView(row: RemodelRow, today: number) {
    Column() {
      Row({ space: 8 }) {
        // 可点击区：展开/收起详情
        Row({ space: 8 }) {
          if (row.iconType > 0) {
            Image(equipLabel(row.iconType, 0, row.id))
              .width(28)
              .height(28)
          } else {
            Text('改')
              .fontSize(12)
              .fontColor(COLOR_MUTED)
              .width(28)
              .height(28)
              .textAlign(TextAlign.Center)
              .backgroundColor('#222633')
              .borderRadius(4)
          }
          Column({ space: 2 }) {
            Text(row.name.length > 0 ? row.name : `#${row.id}`)
              .fontSize(14)
              .fontWeight(FontWeight.Medium)
              .fontColor('#FFF')
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
              .width('100%')
            this.SecretarySummary(row, today)
          }
          .layoutWeight(1)
          .alignItems(HorizontalAlign.Start)

          Text(`×${row.held}`)
            .fontSize(13)
            .fontColor(row.held > 0 ? COLOR_HELD : COLOR_MUTED)
            .fontWeight(FontWeight.Medium)
            .width(38)
            .textAlign(TextAlign.End)
        }
        .layoutWeight(1)
        .alignItems(VerticalAlign.Center)
        .onClick(() => this.toggleExpand(row.id))

        // 收藏按钮：sys.symbol.star / star_fill（警示色）
        Button({ type: ButtonType.Normal, stateEffect: true }) {
          SymbolGlyph(this.favorites.has(row.id) ? $r('sys.symbol.star_fill') : $r('sys.symbol.star'))
            .fontSize(20)
            .fontColor([this.favorites.has(row.id) ? COLOR_FAV : '#566070'])
        }
        .width(36)
        .height(36)
        .backgroundColor(Color.Transparent)
        .border({ width: 0 })
        .onClick(() => this.toggleFavorite(row.id))
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)
      .padding({ left: 14, right: 6, top: 10, bottom: 10 })

      if (this.expandedId === row.id) {
        this.DetailPanel(row, today)
      }
    }
    .width('100%')
    .backgroundColor(this.expandedId === row.id ? '#161922' : COLOR_BG_PAGE)
    .border({ width: { bottom: 0.5 }, color: COLOR_BORDER })
  }

  build() {
    Column() {
      // Header
      Row() {
        Row({ space: 8 }) {
          Text('改修信息')
            .fontSize(17)
            .fontWeight(FontWeight.Medium)
            .fontColor('#FFF')
          if (this.fetchedAt.length > 0) {
            Text(this.fetchedAt)
              .fontSize(10)
              .fontColor('#5a6270')
          }
        }
        .layoutWeight(1)
        .alignItems(VerticalAlign.Center)
        Text(`${this.visibleRows.length}/${this.allRows.length}`)
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

      if (this.visibleRows.length === 0) {
        Column() {
          Text(this.allRows.length === 0 ? '暂无改修数据' : '当前筛选下无可改修装备')
            .fontSize(13)
            .fontColor('#666')
        }
        .width('100%')
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
        .backgroundColor(COLOR_BG_PAGE)
      } else {
        List() {
          ForEach(this.visibleRows, (row: RemodelRow) => {
            ListItem() {
              this.RemodelRowView(row, jstWeekday())
            }
          }, (row: RemodelRow) => `${row.id}-${this.favorites.has(row.id) ? 1 : 0}-${this.expandedId === row.id ? 1 : 0}`)
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
