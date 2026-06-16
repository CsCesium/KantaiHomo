import util from '@ohos.util';
import { common } from '@kit.AbilityKit';
import {
  subscribeGameState,
  getGameState,
  getSlotItemMasterName,
  getSlotItemMasterEquipType,
  getSlotItemMasterIconType,
  getUseItemMasterName,
  getShipMasterName,
} from '../../../../features/state';
import { equipLabel } from '../../../../features/panel/panelConfig';

// ==================== 数据 schema ====================
//
// 改修情报由 rawfile/data/improvement.json 提供，由
// scripts/update-improvement-data.mjs 每月从 ElectronicObserver 数据库
// (wiki「改修表」由来、持续更新) 拉取生成。每个段階含完整配方：
//   開発資材(通常 dev / 確保 devGS) / 改修資材ネジ(通常 screw / 確保 screwGS) /
//   消費装備(consumed) / 基礎消費(base) / 秘书艦(reqs.ships) / MAX 改修更新先(convertTo)。
// 装备名・分类・图标按 master id 在 App 内解析。

interface ConsumedItem {
  id: number;
  count: number;
  use: boolean;   // true=道具(useitem)，false=装备(slotitem)
}

interface ReqGroup {
  days: boolean[];   // 长度 7，日月火水木金土
  ships: number[];   // 秘书艦 master id
}

interface Stage {
  dev: number;       // 開発資材（通常）
  devGS: number;     // 開発資材（確保）
  screw: number;     // 改修資材ネジ（通常）
  screwGS: number;   // 改修資材ネジ（確保）
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
  group: string;    // 装备大类 key（与装备一览一致）
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

const RES_ICON_DIR = 'resource://RAWFILE/icons/res/';
const DEV_ICON = `${RES_ICON_DIR}dev.png`;
const SCREW_ICON = `${RES_ICON_DIR}nail.png`;
const BASE_ICONS: string[] = [
  `${RES_ICON_DIR}fuel.png`,
  `${RES_ICON_DIR}ammo.png`,
  `${RES_ICON_DIR}iron.png`,
  `${RES_ICON_DIR}bauxite.png`,
];

const WEEK: string[] = ['日', '月', '火', '水', '木', '金', '土'];

// 装备大类分组：与「装备一览」(EquipInfoPage) 保持一致，按 equipType(api_type[2])
// 归类，分类按钮用对应的代表 icon。
interface GroupSpec { key: string; label: string; icon: number; types: number[]; }

const EQUIP_GROUPS: GroupSpec[] = [
  { key: 'gun_main', label: '主砲',   icon: 3,  types: [1, 2, 3, 38] },
  { key: 'gun_sub',  label: '副対空', icon: 4,  types: [4, 21, 36] },
  { key: 'torpedo',  label: '魚雷',   icon: 5,  types: [5, 32] },
  { key: 'planes',   label: '艦載',   icon: 6,  types: [6, 7, 8, 11, 25, 26, 45] },
  { key: 'recon',    label: '偵察',   icon: 9,  types: [9, 10, 41, 49, 57] },
  { key: 'radar',    label: '電探',   icon: 11, types: [12, 13, 27, 28, 58] },
  { key: 'asw',      label: '対潜',   icon: 18, types: [14, 15, 40] },
  { key: 'land',     label: '陸上',   icon: 37, types: [47, 48, 52, 53] },
  { key: 'jet',      label: '噴式',   icon: 56, types: [54, 55, 56] },
];

const EQUIP_TYPE_TO_GROUP: Map<number, string> = (() => {
  const m = new Map<number, string>();
  for (const g of EQUIP_GROUPS) for (const t of g.types) m.set(t, g.key);
  return m;
})();

const GROUP_LABEL: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const g of EQUIP_GROUPS) m.set(g.key, g.label);
  m.set('other', '他');
  return m;
})();

const GROUP_ICON: Map<string, number> = (() => {
  const m = new Map<string, number>();
  for (const g of EQUIP_GROUPS) m.set(g.key, g.icon);
  m.set('other', 0);
  return m;
})();

const CAT_ORDER: string[] = [
  'gun_main', 'gun_sub', 'torpedo', 'planes', 'recon', 'radar', 'asw', 'land', 'jet', 'other',
];

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

// ==================== 工具函数 ====================

/** 当前日本时间（UTC+9）的星期，0=日 … 6=土。 */
function jstWeekday(): number {
  return new Date(Date.now() + 9 * 3600 * 1000).getUTCDay();
}

function groupForType(equipType: number): string {
  return EQUIP_TYPE_TO_GROUP.get(equipType) ?? 'other';
}

function catLabel(group: string): string {
  return GROUP_LABEL.get(group) ?? '他';
}

function catIcon(group: string): number {
  return GROUP_ICON.get(group) ?? 0;
}

/** "通常 (確保)" 文本：确保值无效(<=0)或与通常相同时只显示通常值。 */
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

  private entries: ImprovementEntry[] = [];
  private loaded: boolean = false;
  private unsubscribe: (() => void) | null = null;

  aboutToAppear(): void {
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

  private buildHeldIndex(): Map<number, number> {
    const out = new Map<number, number>();
    const state = getGameState().getState();
    state.slotItemIndex.forEach((masterId: number) => {
      out.set(masterId, (out.get(masterId) ?? 0) + 1);
    });
    return out;
  }

  /** 解析秘书艦：合并各 req 组的 ship id，去重保序，解析艦名。 */
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
    const today = jstWeekday();
    const rows: RemodelRow[] = [];
    const cats = new Set<string>();
    for (const e of this.entries) {
      const group = groupForType(getSlotItemMasterEquipType(e.id));
      const iconType = getSlotItemMasterIconType(e.id) || catIcon(group);
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
    this.presentCats = CAT_ORDER.filter((c) => cats.has(c));
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
    out.sort((a, b) => (b.held - a.held) || (a.id - b.id));
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
      Text(type === 'all' ? '全' : catLabel(type))
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
        Text(this.todayOnly ? '本日のみ' : '全曜日')
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
        Text(c.use ? '資' : '装')
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
    }
  }

  /** 段階消費表的一行。screw<=0 且无消费 视为「该段不存在」。 */
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
        // 開発資材
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
        // 改修資材
        Row({ space: 2 }) {
          Image(SCREW_ICON).width(14).height(14)
          Text(amountText(st.screw, st.screwGS)).fontSize(12).fontColor(COLOR_SCREW)
        }
        .width(72)
        .justifyContent(FlexAlign.Center)
        // 消費装備
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

  /** 展开区：段階消費表 + 基础资源 + 秘书艦明细。 */
  @Builder
  private DetailPanel(row: RemodelRow, today: number) {
    Column({ space: 6 }) {
      // 标题栏：★ / 開発資材 / 改修資材 / 消費装備
      Row() {
        Text('★').fontSize(11).fontColor('#9aa3b0').width(58)
        Text('開発資材').fontSize(11).fontColor('#9aa3b0').width(78).textAlign(TextAlign.Center)
        Text('改修資材').fontSize(11).fontColor('#9aa3b0').width(72).textAlign(TextAlign.Center)
        Text('消費装備').fontSize(11).fontColor('#9aa3b0').layoutWeight(1)
      }
      .width('100%')

      this.StageRow(STAGE_LABELS[0], row.stages.length > 0 ? row.stages[0] : null)
      this.StageRow(STAGE_LABELS[1], row.stages.length > 1 ? row.stages[1] : null)
      this.StageRow(STAGE_LABELS[2], row.stages.length > 2 ? row.stages[2] : null)

      // MAX 改修更新先
      if (row.convertTo > 0) {
        Row({ space: 4 }) {
          Text('改修更新').fontSize(11).fontColor('#9aa3b0').width(58)
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
          Text('基礎').fontSize(11).fontColor('#9aa3b0').width(58)
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

      // 秘书艦
      Column({ space: 4 }) {
        Row() {
          Text('秘书艦').fontSize(11).fontColor('#9aa3b0').layoutWeight(1)
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
          Text('（秘书艦データなし）')
            .fontSize(10)
            .fontColor(COLOR_MUTED)
            .width('100%')
        }
      }
      .width('100%')
      .padding({ top: 6 })
      .border({ width: { top: 0.5 }, color: COLOR_BORDER })

      Text('※ ( )内は確保時の消費量。')
        .fontSize(10)
        .fontColor(COLOR_MUTED)
        .width('100%')
    }
    .width('100%')
    .padding({ left: 14, right: 14, top: 8, bottom: 12 })
    .backgroundColor('#11141c')
  }

  /** 折叠行的秘书艦摘要：最多 3 个艦名 + 余量；无名时回退到曜日条。 */
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
          Text(`他${row.secretaries.length - 3}`)
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
      .width('100%')
      .alignItems(VerticalAlign.Center)
      .padding({ left: 14, right: 14, top: 10, bottom: 10 })
      .onClick(() => this.toggleExpand(row.id))

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
          Text('改修情报')
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
          }, (row: RemodelRow) => `${row.id}`)
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
