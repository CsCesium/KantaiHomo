import { getRepositoryHub } from '../../../../infra/storage/repo';
import type { BattleRecordRow } from '../../../../infra/storage/types';

// ==================== Types ====================

type MapFilter = 'all' | 'a1' | 'a2' | 'a3' | 'a4' | 'a5' | 'a7' | 'practice' | 'other';
type RankFilter = 'all' | 's' | 'a' | 'b' | 'fail';
type KindFilter = 'all' | 'normal' | 'combined' | 'practice' | 'air_raid';
type TimeFilter = 'all' | 'today' | 'week';
type SortKey = 'time_desc' | 'time_asc' | 'rank_desc' | 'map_asc';

interface BattleView {
  id: string;
  sortieId: string;
  mapLabel: string;          // '1-1' | '演習' | '?'
  mapAreaId: number;
  mapInfoNo: number;
  cellId: number;
  isBoss: boolean;
  battleType: string;        // raw
  kindLabel: string;         // 显示的战斗类型短标
  isPractice: boolean;
  rank: string;
  mvp: number;
  mvpCombined: number;
  formationLabel: string;
  engagementLabel: string;
  airStateLabel: string;
  dropShipName: string;
  dropItemId: number;
  baseExp: number;
  startedAt: number;
  endedAt: number;
}

// ==================== Constants ====================

interface MapChipDef { key: MapFilter; label: string; }
interface RankChipDef { key: RankFilter; label: string; }
interface KindChipDef { key: KindFilter; label: string; }
interface TimeChipDef { key: TimeFilter; label: string; }
interface SortChipDef { key: SortKey; label: string; }

const TIME_CHIPS: TimeChipDef[] = [
  { key: 'all',   label: '全部' },
  { key: 'today', label: '今日' },
  { key: 'week',  label: '本周' },
];

const MAP_CHIPS: MapChipDef[] = [
  { key: 'all',      label: '全' },
  { key: 'a1',       label: '1' },
  { key: 'a2',       label: '2' },
  { key: 'a3',       label: '3' },
  { key: 'a4',       label: '4' },
  { key: 'a5',       label: '5' },
  { key: 'a7',       label: '7' },
  { key: 'practice', label: '演習' },
  { key: 'other',    label: '他' },
];

const KNOWN_AREAS: Set<number> = new Set<number>([1, 2, 3, 4, 5, 7]);

const RANK_CHIPS: RankChipDef[] = [
  { key: 'all',  label: '全' },
  { key: 's',    label: 'S' },
  { key: 'a',    label: 'A' },
  { key: 'b',    label: 'B' },
  { key: 'fail', label: 'C-E' },
];

const KIND_CHIPS: KindChipDef[] = [
  { key: 'all',      label: '全' },
  { key: 'normal',   label: '通常' },
  { key: 'combined', label: '連合' },
  { key: 'practice', label: '演習' },
  { key: 'air_raid', label: '空襲' },
];

const SORT_CHIPS: SortChipDef[] = [
  { key: 'time_desc', label: '時↓' },
  { key: 'time_asc',  label: '時↑' },
  { key: 'rank_desc', label: 'Rank' },
  { key: 'map_asc',   label: '海域' },
];

/** 最近多少条战斗加载到内存做筛选。超过这个数的更旧数据需要更明确的查询。 */
const RECENT_LIMIT = 300;

const FORMATION_LABELS: Map<number, string> = new Map([
  [1, '単縦'], [2, '複縦'], [3, '輪形'], [4, '梯形'], [5, '単横'], [6, '警戒'],
  [11, '第一'], [12, '第二'], [13, '第三'], [14, '第四'],
]);

const ENGAGEMENT_LABELS: Map<number, string> = new Map([
  [1, '同航'], [2, '反航'], [3, 'T有利'], [4, 'T不利'],
]);

const AIR_STATE_LABELS: Map<number, string> = new Map([
  [1, '確保'], [2, '優勢'], [3, '均衡'], [4, '劣勢'], [5, '喪失'],
]);

const BATTLE_TYPE_LABELS: Map<string, string> = new Map([
  ['normal',       '通常'],
  ['combined_ctf', '連合機動'],
  ['combined_stf', '連合水上'],
  ['combined_tcf', '連合輸送'],
  ['practice',     '演習'],
  ['air_raid',     '空襲'],
]);

const COLOR_BG_PAGE = '#1a1d27';
const COLOR_BG_HEADER = '#0f1118';
const COLOR_BG_TOOLBAR = '#14171f';
const COLOR_BG_CHIP_ACTIVE = '#1c3535';
const COLOR_FG_CHIP_ACTIVE = '#56d8e0';
const COLOR_BG_CHIP = '#1c1f2a';
const COLOR_FG_CHIP = '#aab1bd';
const COLOR_BORDER = '#272a36';

const RANK_COLORS: Map<string, string> = new Map([
  ['SS', '#FFD54F'],
  ['S',  '#FFD54F'],
  ['A',  '#81C784'],
  ['B',  '#64B5F6'],
  ['C',  '#FFB74D'],
  ['D',  '#E57373'],
  ['E',  '#B0635A'],
]);

// ==================== Helpers ====================

function rankColor(rank: string): string {
  return RANK_COLORS.get(rank.toUpperCase()) ?? '#888';
}

function formationLabel(n: number | null): string {
  if (n === null) return '';
  return FORMATION_LABELS.get(n) ?? `陣${n}`;
}

function engagementLabel(n: number | null): string {
  if (n === null) return '';
  return ENGAGEMENT_LABELS.get(n) ?? '';
}

function airStateLabel(n: number | null): string {
  if (n === null) return '';
  return AIR_STATE_LABELS.get(n) ?? '';
}

function battleKindLabel(type: string, isPractice: boolean): string {
  if (isPractice) return '演習';
  return BATTLE_TYPE_LABELS.get(type) ?? type;
}

function kindFilterMatch(view: BattleView, key: KindFilter): boolean {
  switch (key) {
    case 'all':      return true;
    case 'normal':   return view.battleType === 'normal' && !view.isPractice;
    case 'combined': return view.battleType.startsWith('combined_');
    case 'practice': return view.isPractice || view.battleType === 'practice';
    case 'air_raid': return view.battleType === 'air_raid';
    default:         return true;
  }
}

function rankFilterMatch(rank: string, key: RankFilter): boolean {
  const r = rank.toUpperCase();
  switch (key) {
    case 'all':  return true;
    case 's':    return r === 'S' || r === 'SS';
    case 'a':    return r === 'A';
    case 'b':    return r === 'B';
    case 'fail': return r === 'C' || r === 'D' || r === 'E';
    default:     return true;
  }
}

function mapFilterMatch(view: BattleView, key: MapFilter): boolean {
  switch (key) {
    case 'all':      return true;
    case 'a1':       return view.mapAreaId === 1;
    case 'a2':       return view.mapAreaId === 2;
    case 'a3':       return view.mapAreaId === 3;
    case 'a4':       return view.mapAreaId === 4;
    case 'a5':       return view.mapAreaId === 5;
    case 'a7':       return view.mapAreaId === 7;
    case 'practice': return view.isPractice || view.mapAreaId === 0;
    case 'other':    return !view.isPractice && view.mapAreaId !== 0 && !KNOWN_AREAS.has(view.mapAreaId);
    default:         return true;
  }
}

function timeFilterMatch(view: BattleView, key: TimeFilter, nowMs: number): boolean {
  switch (key) {
    case 'all':   return true;
    case 'today': return nowMs - view.startedAt < 24 * 60 * 60 * 1000;
    case 'week':  return nowMs - view.startedAt < 7 * 24 * 60 * 60 * 1000;
    default:      return true;
  }
}

function rankScore(rank: string): number {
  switch (rank.toUpperCase()) {
    case 'SS': return 7;
    case 'S':  return 6;
    case 'A':  return 5;
    case 'B':  return 4;
    case 'C':  return 3;
    case 'D':  return 2;
    case 'E':  return 1;
    default:   return 0;
  }
}

function compareBattles(a: BattleView, b: BattleView, key: SortKey): number {
  switch (key) {
    case 'time_desc': return b.startedAt - a.startedAt;
    case 'time_asc':  return a.startedAt - b.startedAt;
    case 'rank_desc': return rankScore(b.rank) - rankScore(a.rank) || b.startedAt - a.startedAt;
    case 'map_asc':
      return a.mapAreaId - b.mapAreaId
        || a.mapInfoNo - b.mapInfoNo
        || b.startedAt - a.startedAt;
    default: return b.startedAt - a.startedAt;
  }
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatTime(ts: number, nowMs: number): string {
  if (!ts) return '--';
  const d = new Date(ts);
  const sameDay = new Date(nowMs).toDateString() === d.toDateString();
  const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  if (sameDay) return hm;
  return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${hm}`;
}

function buildMapLabel(areaId: number, infoNo: number, isPractice: boolean): string {
  if (isPractice || areaId === 0) return '演習';
  return `${areaId}-${infoNo}`;
}

function toView(row: BattleRecordRow): BattleView {
  const isPractice = row.isPractice === 1;
  const isBoss = row.isBoss === 1;
  return {
    id: row.id,
    sortieId: row.sortieId,
    mapLabel: buildMapLabel(row.mapAreaId, row.mapInfoNo, isPractice),
    mapAreaId: row.mapAreaId,
    mapInfoNo: row.mapInfoNo,
    cellId: row.cellId,
    isBoss,
    battleType: row.battleType,
    kindLabel: battleKindLabel(row.battleType, isPractice),
    isPractice,
    rank: row.rank,
    mvp: row.mvp ?? 0,
    mvpCombined: row.mvpCombined ?? 0,
    formationLabel: formationLabel(row.friendFormation),
    engagementLabel: engagementLabel(row.engagement),
    airStateLabel: airStateLabel(row.airState),
    dropShipName: row.dropShipName ?? '',
    dropItemId: row.dropItemId ?? 0,
    baseExp: row.baseExp ?? 0,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
  };
}

// ==================== Page Component ====================

@ComponentV2
export default struct BattleHistoryPage {
  @Event onClose: () => void;

  @Local private allBattles: BattleView[] = [];
  @Local private visibleBattles: BattleView[] = [];
  @Local private loading: boolean = false;
  @Local private loadError: string = '';
  @Local private now: number = Date.now();

  @Local private searchText: string = '';
  @Local private timeFilter: TimeFilter = 'all';
  @Local private mapFilter: MapFilter = 'all';
  @Local private rankFilter: RankFilter = 'all';
  @Local private kindFilter: KindFilter = 'all';
  @Local private sortKey: SortKey = 'time_desc';

  aboutToAppear(): void {
    this.now = Date.now();
    void this.loadAll();
  }

  private async loadAll(): Promise<void> {
    this.loading = true;
    this.loadError = '';
    try {
      const repos = getRepositoryHub();
      const rows = await repos.battle.listRecent(RECENT_LIMIT);
      this.allBattles = rows.map((r) => toView(r));
      this.recompute();
    } catch (e) {
      this.loadError = `加载失败: ${String(e)}`;
      this.allBattles = [];
      this.visibleBattles = [];
    } finally {
      this.loading = false;
    }
  }

  private recompute(): void {
    const q = this.searchText.trim().toLowerCase();
    const out: BattleView[] = [];
    for (const v of this.allBattles) {
      if (q.length > 0) {
        const inMap = v.mapLabel.toLowerCase().indexOf(q) >= 0;
        const inDrop = v.dropShipName.toLowerCase().indexOf(q) >= 0;
        const inRank = v.rank.toLowerCase().indexOf(q) >= 0;
        if (!inMap && !inDrop && !inRank) continue;
      }
      if (!timeFilterMatch(v, this.timeFilter, this.now)) continue;
      if (!mapFilterMatch(v, this.mapFilter)) continue;
      if (!rankFilterMatch(v.rank, this.rankFilter)) continue;
      if (!kindFilterMatch(v, this.kindFilter)) continue;
      out.push(v);
    }
    out.sort((a, b) => compareBattles(a, b, this.sortKey));
    this.visibleBattles = out;
  }

  private setSearch(v: string): void {
    if (v === this.searchText) return;
    this.searchText = v;
    this.recompute();
  }

  private setTimeFilter(k: TimeFilter): void {
    if (k === this.timeFilter) return;
    this.timeFilter = k;
    this.recompute();
  }

  private setMapFilter(k: MapFilter): void {
    if (k === this.mapFilter) return;
    this.mapFilter = k;
    this.recompute();
  }

  private setRankFilter(k: RankFilter): void {
    if (k === this.rankFilter) return;
    this.rankFilter = k;
    this.recompute();
  }

  private setKindFilter(k: KindFilter): void {
    if (k === this.kindFilter) return;
    this.kindFilter = k;
    this.recompute();
  }

  private setSortKey(k: SortKey): void {
    if (k === this.sortKey) return;
    this.sortKey = k;
    this.recompute();
  }

  // ==================== Builders ====================

  @Builder
  private TimeChip(def: TimeChipDef) {
    Text(def.label)
      .fontSize(12)
      .fontColor(this.timeFilter === def.key ? COLOR_FG_CHIP_ACTIVE : COLOR_FG_CHIP)
      .fontWeight(this.timeFilter === def.key ? FontWeight.Medium : FontWeight.Regular)
      .padding({ left: 10, right: 10, top: 5, bottom: 5 })
      .backgroundColor(this.timeFilter === def.key ? COLOR_BG_CHIP_ACTIVE : COLOR_BG_CHIP)
      .borderRadius(12)
      .onClick(() => this.setTimeFilter(def.key))
  }

  @Builder
  private MapChip(def: MapChipDef) {
    Text(def.label)
      .fontSize(12)
      .fontColor(this.mapFilter === def.key ? COLOR_FG_CHIP_ACTIVE : COLOR_FG_CHIP)
      .fontWeight(this.mapFilter === def.key ? FontWeight.Medium : FontWeight.Regular)
      .padding({ left: 10, right: 10, top: 5, bottom: 5 })
      .backgroundColor(this.mapFilter === def.key ? COLOR_BG_CHIP_ACTIVE : COLOR_BG_CHIP)
      .borderRadius(12)
      .onClick(() => this.setMapFilter(def.key))
  }

  @Builder
  private RankChip(def: RankChipDef) {
    Text(def.label)
      .fontSize(12)
      .fontColor(this.rankFilter === def.key ? COLOR_FG_CHIP_ACTIVE : COLOR_FG_CHIP)
      .fontWeight(this.rankFilter === def.key ? FontWeight.Medium : FontWeight.Regular)
      .padding({ left: 10, right: 10, top: 5, bottom: 5 })
      .backgroundColor(this.rankFilter === def.key ? COLOR_BG_CHIP_ACTIVE : COLOR_BG_CHIP)
      .borderRadius(12)
      .onClick(() => this.setRankFilter(def.key))
  }

  @Builder
  private KindChip(def: KindChipDef) {
    Text(def.label)
      .fontSize(12)
      .fontColor(this.kindFilter === def.key ? COLOR_FG_CHIP_ACTIVE : COLOR_FG_CHIP)
      .fontWeight(this.kindFilter === def.key ? FontWeight.Medium : FontWeight.Regular)
      .padding({ left: 10, right: 10, top: 5, bottom: 5 })
      .backgroundColor(this.kindFilter === def.key ? COLOR_BG_CHIP_ACTIVE : COLOR_BG_CHIP)
      .borderRadius(12)
      .onClick(() => this.setKindFilter(def.key))
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
      Row() {
        TextInput({ text: this.searchText, placeholder: '按海域/Rank/掉落舰名搜索' })
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

      Row({ space: 6 }) {
        Text('期')
          .fontSize(11)
          .fontColor('#666')
          .width(20)
        ForEach(TIME_CHIPS, (c: TimeChipDef) => {
          this.TimeChip(c)
        }, (c: TimeChipDef) => `t-${c.key}`)
      }
      .width('100%')

      Row({ space: 6 }) {
        Text('海')
          .fontSize(11)
          .fontColor('#666')
          .width(20)
        ForEach(MAP_CHIPS, (c: MapChipDef) => {
          this.MapChip(c)
        }, (c: MapChipDef) => `m-${c.key}`)
      }
      .width('100%')

      Row({ space: 6 }) {
        Text('R')
          .fontSize(11)
          .fontColor('#666')
          .width(20)
        ForEach(RANK_CHIPS, (c: RankChipDef) => {
          this.RankChip(c)
        }, (c: RankChipDef) => `r-${c.key}`)
      }
      .width('100%')

      Row({ space: 6 }) {
        Text('種')
          .fontSize(11)
          .fontColor('#666')
          .width(20)
        ForEach(KIND_CHIPS, (c: KindChipDef) => {
          this.KindChip(c)
        }, (c: KindChipDef) => `k-${c.key}`)
      }
      .width('100%')

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

  @Builder
  private BattleRowView(item: BattleView) {
    Column({ space: 4 }) {
      // Header: rank · map · boss · kind · time
      Row({ space: 8 }) {
        Text(item.rank.length > 0 ? item.rank : '?')
          .fontSize(18)
          .fontWeight(FontWeight.Bold)
          .fontColor(rankColor(item.rank))
          .width(28)
          .textAlign(TextAlign.Center)
        Text(item.mapLabel)
          .fontSize(13)
          .fontColor('#FFF')
          .fontWeight(FontWeight.Medium)
        if (item.isBoss) {
          Text('Boss')
            .fontSize(10)
            .fontColor('#E57373')
            .padding({ left: 5, right: 5, top: 1, bottom: 1 })
            .backgroundColor('#3a1a1a')
            .borderRadius(3)
        }
        Text(item.kindLabel)
          .fontSize(11)
          .fontColor('#C8B99A')
          .padding({ left: 5, right: 5, top: 1, bottom: 1 })
          .backgroundColor('#2a2a20')
          .borderRadius(3)
        Blank().layoutWeight(1)
        Text(formatTime(item.startedAt, this.now))
          .fontSize(11)
          .fontColor('#90A0B0')
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)

      // Meta: cell · formation · engagement · airState · MVP
      Row({ space: 12 }) {
        if (item.cellId > 0) {
          Text(`cell ${item.cellId}`)
            .fontSize(11)
            .fontColor('#90A0B0')
        }
        if (item.formationLabel.length > 0) {
          Text(`陣 ${item.formationLabel}`)
            .fontSize(11)
            .fontColor('#90A0B0')
        }
        if (item.engagementLabel.length > 0) {
          Text(item.engagementLabel)
            .fontSize(11)
            .fontColor('#90A0B0')
        }
        if (item.airStateLabel.length > 0) {
          Text(`制空${item.airStateLabel}`)
            .fontSize(11)
            .fontColor('#90A0B0')
        }
        if (item.mvp > 0) {
          Text(`MVP${item.mvp}`)
            .fontSize(11)
            .fontColor('#FFD54F')
        }
        if (item.mvpCombined > 0) {
          Text(`MVP2:${item.mvpCombined}`)
            .fontSize(11)
            .fontColor('#FFD54F')
        }
        Blank().layoutWeight(1)
      }
      .width('100%')

      // Drops + exp
      Row({ space: 12 }) {
        if (item.dropShipName.length > 0) {
          Text(`掉:${item.dropShipName}`)
            .fontSize(11)
            .fontColor('#A5D6A7')
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .layoutWeight(1)
        } else if (item.dropItemId > 0) {
          Text(`掉:item#${item.dropItemId}`)
            .fontSize(11)
            .fontColor('#A5D6A7')
            .layoutWeight(1)
        } else {
          Text('掉落 - ')
            .fontSize(11)
            .fontColor('#5a6270')
            .layoutWeight(1)
        }
        if (item.baseExp > 0) {
          Text(`基礎経験${item.baseExp}`)
            .fontSize(11)
            .fontColor('#90A0B0')
        }
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
      Row() {
        Text('战斗记录')
          .fontSize(17)
          .fontWeight(FontWeight.Medium)
          .fontColor('#FFF')
          .layoutWeight(1)
        Text(`${this.visibleBattles.length}/${this.allBattles.length}`)
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

      if (this.loading) {
        Column() {
          Text('载入中…')
            .fontSize(13)
            .fontColor('#666')
        }
        .width('100%')
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
        .backgroundColor(COLOR_BG_PAGE)
      } else if (this.loadError.length > 0) {
        Column() {
          Text(this.loadError)
            .fontSize(13)
            .fontColor('#E57373')
        }
        .width('100%')
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
        .backgroundColor(COLOR_BG_PAGE)
      } else if (this.visibleBattles.length === 0) {
        Column() {
          Text(this.allBattles.length === 0 ? '尚无战斗记录' : '当前筛选下无匹配记录')
            .fontSize(13)
            .fontColor('#666')
        }
        .width('100%')
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
        .backgroundColor(COLOR_BG_PAGE)
      } else {
        List() {
          ForEach(this.visibleBattles, (item: BattleView) => {
            ListItem() {
              this.BattleRowView(item)
            }
          }, (item: BattleView) => item.id)
        }
        .width('100%')
        .layoutWeight(1)
        .backgroundColor(COLOR_BG_PAGE)
      }

      Text(`仅展示最近 ${RECENT_LIMIT} 条 · 右滑返回游戏`)
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
