import util from '@ohos.util';
import { common } from '@kit.AbilityKit';
import {
  subscribeGameState,
  getGameState,
  getSlotItemMasterName,
  getSlotItemMasterIconType,
} from '../../../../features/state';
import { equipLabel } from '../../../../features/panel/panelConfig';

// ==================== 数据 schema ====================
//
// 改修情报由 rawfile/data/improvement.json 提供，数据源 akashi-list.me，
// 由 scripts/update-improvement-data.mjs 每月拉取更新。
//
// akashi-list 仅提供「改修资材(ネジ)」段階别消費 + 秘书艦的曜日别可否；
// 「開発资材 / 消費装备」需日文 wiki，akashi-list 未提供（展示为 —）。
// 秘书艦 akashi 仅有内部 sprite index、无艦名对应表，故以「曜日可否」呈现。

interface ImprovementSecretary {
  sprite: number;
  days: boolean[];     // 长度 7，顺序 日月火水木金土
}

interface ImprovementEntry {
  id: number;          // 装备 master id
  name: string;
  type: string;        // akashi 分类 key
  kit: (number | null)[];  // [★0-5, ★6-9, MAX] 改修资材(ネジ) 数，null = 该段不可
  days: boolean[];     // 长度 7，= 各秘书艦可否的并集（该曜日是否可改修）
  secretaries: ImprovementSecretary[];
}

interface ImprovementFile {
  source?: string;
  fetchedAt?: string;
  count?: number;
  equipment?: ImprovementEntry[];
}

// ==================== 视图模型 ====================

interface RemodelRow {
  id: number;
  name: string;
  type: string;
  iconType: number;
  kit: (number | null)[];
  days: boolean[];
  secretaries: ImprovementSecretary[];
  held: number;        // 实际持有数量
  availToday: boolean; // 当前日本时间是否可改修
}

// ==================== 常量 ====================

const REMODEL_RAWFILE = 'data/improvement.json';

const SCREW_ICON = 'resource://RAWFILE/icons/res/nail.png';

const WEEK: string[] = ['日', '月', '火', '水', '木', '金', '土'];

interface CatInfo { label: string; icon: number; }

/** akashi 分类 key → {短标签, 代表 icon(api_type[3])}。代表 icon 仅用于分类按钮与兜底。 */
const CAT_INFO: Map<string, CatInfo> = (() => {
  const m = new Map<string, CatInfo>();
  m.set('lightGun', { label: '小口径主砲', icon: 1 });
  m.set('mediumGun', { label: '中口径主砲', icon: 2 });
  m.set('heavyGun', { label: '大口径主砲', icon: 3 });
  m.set('secondaryGun', { label: '副砲', icon: 4 });
  m.set('antiAircraftGun', { label: '対空機銃・高射', icon: 15 });
  m.set('torpedo', { label: '魚雷', icon: 5 });
  m.set('asw', { label: '対潜', icon: 18 });
  m.set('shell', { label: '強化弾', icon: 13 });
  m.set('fighter', { label: '艦戦', icon: 6 });
  m.set('diveBomber', { label: '艦爆', icon: 7 });
  m.set('torpedoBomber', { label: '艦攻', icon: 8 });
  m.set('aircraft', { label: '攻撃機', icon: 8 });
  m.set('seaplane', { label: '水偵', icon: 10 });
  m.set('seaplaneBomber', { label: '水爆', icon: 10 });
  m.set('radar', { label: '電探', icon: 11 });
  m.set('landbasedAircraft', { label: '陸上機', icon: 37 });
  m.set('landingCraft', { label: '上陸用舟艇', icon: 20 });
  m.set('bulge', { label: '機関・バルジ', icon: 23 });
  m.set('searchlight', { label: '探照灯', icon: 24 });
  m.set('etc', { label: 'その他', icon: 0 });
  return m;
})();

/** 分类按钮显示顺序（与 akashi-list 大致一致）。 */
const CAT_ORDER: string[] = [
  'lightGun', 'mediumGun', 'heavyGun', 'secondaryGun', 'antiAircraftGun',
  'torpedo', 'asw', 'shell',
  'fighter', 'diveBomber', 'torpedoBomber', 'aircraft',
  'seaplane', 'seaplaneBomber', 'radar', 'landbasedAircraft',
  'landingCraft', 'bulge', 'searchlight', 'etc',
];

const STAGE_LABELS: string[] = ['★0 ～ 5', '★6 ～ 9', 'MAX進化'];

const COLOR_BG_PAGE = '#1a1d27';
const COLOR_BG_HEADER = '#0f1118';
const COLOR_BG_TOOLBAR = '#14171f';
const COLOR_BG_CHIP_ACTIVE = '#1c3535';
const COLOR_FG_CHIP_ACTIVE = '#56d8e0';
const COLOR_BG_CHIP = '#1c1f2a';
const COLOR_FG_CHIP = '#aab1bd';
const COLOR_BORDER = '#272a36';
const COLOR_SCREW = '#FFD54F';
const COLOR_HELD = '#A5D6A7';
const COLOR_DAY_ON = '#56d8e0';
const COLOR_DAY_OFF = '#3a3f4c';
const COLOR_TODAY = '#FFD54F';
const COLOR_MUTED = '#5a6270';

// ==================== 工具函数 ====================

/** 当前日本时间（UTC+9）的星期，0=日 … 6=土。 */
function jstWeekday(): number {
  return new Date(Date.now() + 9 * 3600 * 1000).getUTCDay();
}

function catLabel(type: string): string {
  const info = CAT_INFO.get(type);
  return info !== undefined ? info.label : type;
}

function catIcon(type: string): number {
  const info = CAT_INFO.get(type);
  return info !== undefined ? info.icon : 0;
}

function screwText(v: number | null): string {
  return v === null ? '—' : `${v}`;
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

  /** 解析后的原始数据（非响应式，状态变化时据此重建行）。 */
  private entries: ImprovementEntry[] = [];
  private loaded: boolean = false;
  private unsubscribe: (() => void) | null = null;

  aboutToAppear(): void {
    void this.loadData();
    // 持有数量随 port / slot_item 全量刷新变化；订阅 ships / all 重建行。
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

  /** 统计每个 master id 的实际持有数量。 */
  private buildHeldIndex(): Map<number, number> {
    const out = new Map<number, number>();
    const state = getGameState().getState();
    state.slotItemIndex.forEach((masterId: number) => {
      out.set(masterId, (out.get(masterId) ?? 0) + 1);
    });
    return out;
  }

  private rebuildRows(): void {
    if (!this.loaded) return;
    const held = this.buildHeldIndex();
    const today = jstWeekday();
    const rows: RemodelRow[] = [];
    const cats = new Set<string>();
    for (const e of this.entries) {
      const iconType = getSlotItemMasterIconType(e.id) || catIcon(e.type);
      const masterName = getSlotItemMasterName(e.id);
      cats.add(e.type);
      rows.push({
        id: e.id,
        name: masterName.length > 0 ? masterName : e.name,
        type: e.type,
        iconType,
        kit: e.kit,
        days: e.days,
        secretaries: e.secretaries,
        held: held.get(e.id) ?? 0,
        availToday: e.days.length === 7 ? e.days[today] : true,
      });
    }
    this.allRows = rows;
    this.presentCats = CAT_ORDER.filter((c) => cats.has(c));
    this.recompute();
  }

  /** 依次应用 本日 / 搜索 / 分类 过滤，按 持有降序 + master id 排序。 */
  private recompute(): void {
    const q = this.searchText.trim().toLowerCase();
    const out: RemodelRow[] = [];
    for (const r of this.allRows) {
      if (this.todayOnly && !r.availToday) continue;
      if (q.length > 0 && r.name.toLowerCase().indexOf(q) < 0) continue;
      if (this.typeFilter !== 'all' && r.type !== this.typeFilter) continue;
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

  /** 7 格曜日条：可改修高亮，今日加边框。 */
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

      // 分类按钮（带 icon）
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

  /** 展开区：段階消費表 + 秘书艦曜日明细。 */
  @Builder
  private DetailPanel(row: RemodelRow, today: number) {
    Column({ space: 8 }) {
      // 标题栏：★ / 開発资材 / 改修资材 / 消費装备
      Row() {
        Text('★').fontSize(11).fontColor('#9aa3b0').width(64)
        Text('開発資材').fontSize(11).fontColor('#9aa3b0').layoutWeight(1).textAlign(TextAlign.Center)
        Text('改修資材').fontSize(11).fontColor('#9aa3b0').layoutWeight(1).textAlign(TextAlign.Center)
        Text('消費装備').fontSize(11).fontColor('#9aa3b0').layoutWeight(1).textAlign(TextAlign.Center)
      }
      .width('100%')
      .padding({ bottom: 4 })
      .border({ width: { bottom: 0.5 }, color: COLOR_BORDER })

      ForEach(STAGE_LABELS, (label: string, idx: number) => {
        Row() {
          Text(label)
            .fontSize(12)
            .fontColor('#C8D0DA')
            .width(64)
          // 開発資材（akashi 未提供）
          Text('—')
            .fontSize(12)
            .fontColor(COLOR_MUTED)
            .layoutWeight(1)
            .textAlign(TextAlign.Center)
          // 改修資材（ネジ）
          Row({ space: 3 }) {
            if (row.kit[idx] !== null && row.kit[idx] !== undefined) {
              Image(SCREW_ICON)
                .width(15)
                .height(15)
              Text(`×${screwText(row.kit[idx])}`)
                .fontSize(13)
                .fontColor(COLOR_SCREW)
                .fontWeight(FontWeight.Medium)
            } else {
              Text('不可')
                .fontSize(11)
                .fontColor(COLOR_MUTED)
            }
          }
          .layoutWeight(1)
          .justifyContent(FlexAlign.Center)
          // 消費装備（akashi 未提供）
          Text('—')
            .fontSize(12)
            .fontColor(COLOR_MUTED)
            .layoutWeight(1)
            .textAlign(TextAlign.Center)
        }
        .width('100%')
        .height(28)
        .alignItems(VerticalAlign.Center)
      }, (label: string, idx: number) => `st-${idx}`)

      // 秘书艦曜日明细
      Column({ space: 4 }) {
        Row() {
          Text(`改修可能曜日（秘书艦候補 ${row.secretaries.length} 隻）`)
            .fontSize(11)
            .fontColor('#9aa3b0')
            .layoutWeight(1)
          this.DayStrip(row.days, today)
        }
        .width('100%')
        .alignItems(VerticalAlign.Center)
      }
      .width('100%')
      .padding({ top: 6 })
      .border({ width: { top: 0.5 }, color: COLOR_BORDER })

      Text('※ 開発資材・消費装備は akashi-list に含まれないため未表示。')
        .fontSize(10)
        .fontColor(COLOR_MUTED)
        .width('100%')
    }
    .width('100%')
    .padding({ left: 14, right: 14, top: 10, bottom: 12 })
    .backgroundColor('#11141c')
  }

  @Builder
  private RemodelRowView(row: RemodelRow, today: number) {
    Column() {
      // 未展开栏：[icon][名称] [×持有] [曜日可否]
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
        Text(row.name.length > 0 ? row.name : `#${row.id}`)
          .fontSize(14)
          .fontWeight(FontWeight.Medium)
          .fontColor('#FFF')
          .layoutWeight(1)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(`×${row.held}`)
          .fontSize(13)
          .fontColor(row.held > 0 ? COLOR_HELD : COLOR_MUTED)
          .fontWeight(FontWeight.Medium)
          .width(38)
          .textAlign(TextAlign.End)
        this.DayStrip(row.days, today)
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
