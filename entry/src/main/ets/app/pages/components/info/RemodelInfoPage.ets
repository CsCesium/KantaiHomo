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

// ==================== 数据 schema ====================
//
// 改修情报由 rawfile/data/improvement.json 提供，
// 由 scripts/update-improvement-data.mjs 每月拉取更新，合并两源：
//   - akashi-list.me：当前可改修装备一览 / 改修资材(ネジ)段階値 / 秘书艦曜日
//   - WhoCallsTheFleet(KC3Kai 镜像)：完整配方（開発資材+確保 / 改修資材+確保 /
//     消費装備）+ 秘书艦 master id。WCTF ~2018 停更，故新装备 full=false，
//     開発資材/消費装備未知(-1)，仅有 akashi 的 ネジ 数。

interface ConsumedItem {
  id: number;
  count: number;
  use: boolean;   // true=道具(useitem)，false=装备(slotitem)
}

interface ReqGroup {
  days: boolean[];   // 长度 7，日月火水木金土
  ships: number[];   // 秘书艦 master id（akashi-only 时为空）
}

interface Stage {
  dev: number;       // 開発資材（通常），-1=未知
  devGS: number;     // 開発資材（確保），-1=未知
  screw: number;     // 改修資材ネジ（通常）
  screwGS: number;   // 改修資材ネジ（確保），-1=未知
  consumed: ConsumedItem[];
}

interface ImprovementEntry {
  id: number;
  name: string;
  type: string;
  full: boolean;
  base: number[] | null;        // [燃,弹,钢,铝] or null
  stages: (Stage | null)[];     // [★0-5, ★6-9, MAX]
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
  type: string;
  iconType: number;
  full: boolean;
  base: number[];   // [燃,弹,钢,铝]，长度不足视为无
  stages: (Stage | null)[];
  reqs: ReqGroup[];
  days: boolean[];
  secretaries: NamedShip[];   // 已解析的秘书艦（去重，保序）
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

interface CatInfo { label: string; icon: number; }

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

const CAT_ORDER: string[] = [
  'lightGun', 'mediumGun', 'heavyGun', 'secondaryGun', 'antiAircraftGun',
  'torpedo', 'asw', 'shell',
  'fighter', 'diveBomber', 'torpedoBomber', 'aircraft',
  'seaplane', 'seaplaneBomber', 'radar', 'landbasedAircraft',
  'landingCraft', 'bulge', 'searchlight', 'etc',
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

function catLabel(type: string): string {
  const info = CAT_INFO.get(type);
  return info !== undefined ? info.label : type;
}

function catIcon(type: string): number {
  const info = CAT_INFO.get(type);
  return info !== undefined ? info.icon : 0;
}

/** "通常 (確保)" 文本：确保值未知(-1)时只显示通常值。 */
function amountText(normal: number, ensure: number): string {
  if (normal < 0) return '?';
  return ensure >= 0 && ensure !== normal ? `${normal} (${ensure})` : `${normal}`;
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
      const iconType = getSlotItemMasterIconType(e.id) || catIcon(e.type);
      const masterName = getSlotItemMasterName(e.id);
      cats.add(e.type);
      rows.push({
        id: e.id,
        name: masterName.length > 0 ? masterName : e.name,
        type: e.type,
        iconType,
        full: e.full,
        base: e.base ?? [],
        stages: e.stages,
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
          Text('（秘书艦データなし — akashi-list の曜日のみ）')
            .fontSize(10)
            .fontColor(COLOR_MUTED)
            .width('100%')
        }
      }
      .width('100%')
      .padding({ top: 6 })
      .border({ width: { top: 0.5 }, color: COLOR_BORDER })

      if (!row.full) {
        Text('※ この装备は WhoCallsTheFleet 未収録（新装备）。開発資材・消費装備・確保量は不明。')
          .fontSize(10)
          .fontColor(COLOR_MUTED)
          .width('100%')
      } else {
        Text('※ ( )内は確保時の消費量。配方は WhoCallsTheFleet 由来。')
          .fontSize(10)
          .fontColor(COLOR_MUTED)
          .width('100%')
      }
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
