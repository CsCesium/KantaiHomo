import util from '@ohos.util';
import { common } from '@kit.AbilityKit';
import { getRepositoryHub } from '../../../../infra/storage/repo';
import type { MissionRow } from '../../../../infra/storage/types';

// ==================== Condition schema ====================
//
// 远征「判断条件」由 rawfile/data/expedition_conditions.json 提供。
// 该 JSON 的 conditions 字段是 missionId(string) → ExpeditionCondition 映射。
// 任何字段都是可选的；空缺即按"未知"展示。

interface CompositionRule { type: string; min?: number; max?: number; }

interface ExpeditionCondition {
  fleetDesc?: string;
  flagshipReq?: string;
  flagshipLevelMin?: number;
  fleetLevelMin?: number;
  composition?: CompositionRule[];
  losMin?: number;
  firepowerMin?: number;
  aaMin?: number;
  aswMin?: number;
  speedReq?: string;
  equipReq?: string;
  notes?: string;
}

interface ConditionFile {
  version?: number;
  conditions?: Record<string, ExpeditionCondition>;
}

const CONDITIONS_RAWFILE = 'data/expedition_conditions.json';

// ==================== Types ====================

type AreaFilter = 'all' | 'a1' | 'a2' | 'a3' | 'a4' | 'a5' | 'a7' | 'other';
type FlagFilter = 'all' | 'normal' | 'monthly' | 'has_cond' | 'no_cond';
type SortKey = 'id_asc' | 'area_asc' | 'time_desc' | 'time_asc' | 'difficulty_desc';

interface MissionView {
  id: number;
  code: string;
  mapAreaId: number;
  name: string;
  details: string;
  resetType: string;        // 'normal' | 'monthly' | ''
  damageType: number;
  timeMin: number;
  requireShips: number;
  difficulty: number;
  fuelPct: number;
  ammoPct: number;
  reward1: { id: number; count: number } | null;
  reward2: { id: number; count: number } | null;
  matLevels: [number, number, number, number];
  returnCancelable: boolean;
  /** 来自 conditions JSON 的判断条件；null 表示未提供。 */
  cond: ExpeditionCondition | null;
}

// ==================== Constants ====================

interface AreaChipDef { key: AreaFilter; label: string; areaId: number; }
interface FlagChipDef { key: FlagFilter; label: string; }
interface SortChipDef { key: SortKey; label: string; }

const AREA_CHIPS: AreaChipDef[] = [
  { key: 'all',   label: '全',   areaId: -1 },
  { key: 'a1',    label: '1',    areaId: 1 },
  { key: 'a2',    label: '2',    areaId: 2 },
  { key: 'a3',    label: '3',    areaId: 3 },
  { key: 'a4',    label: '4',    areaId: 4 },
  { key: 'a5',    label: '5',    areaId: 5 },
  { key: 'a7',    label: '7',    areaId: 7 },
  { key: 'other', label: '他',   areaId: -2 },
];

const KNOWN_AREAS: Set<number> = new Set<number>([1, 2, 3, 4, 5, 7]);

const FLAG_CHIPS: FlagChipDef[] = [
  { key: 'all',      label: '全' },
  { key: 'normal',   label: '常驻' },
  { key: 'monthly',  label: '月间' },
  { key: 'has_cond', label: '有条件' },
  { key: 'no_cond',  label: '无条件' },
];

const SORT_CHIPS: SortChipDef[] = [
  { key: 'id_asc',          label: 'ID' },
  { key: 'area_asc',        label: '海域' },
  { key: 'time_desc',       label: '時↓' },
  { key: 'time_asc',        label: '時↑' },
  { key: 'difficulty_desc', label: '難↓' },
];

const COLOR_BG_PAGE = '#1a1d27';
const COLOR_BG_HEADER = '#0f1118';
const COLOR_BG_TOOLBAR = '#14171f';
const COLOR_BG_CHIP_ACTIVE = '#1c3535';
const COLOR_FG_CHIP_ACTIVE = '#56d8e0';
const COLOR_BG_CHIP = '#1c1f2a';
const COLOR_FG_CHIP = '#aab1bd';
const COLOR_BORDER = '#272a36';
const COLOR_BG_REWARD = '#2a2418';
const COLOR_FG_REWARD = '#FFD54F';
const COLOR_BG_MONTHLY = '#3a1a3a';
const COLOR_FG_MONTHLY = '#E1BEE7';

// ==================== Helpers ====================

function damageTypeLabel(t: number): string {
  switch (t) {
    case 1: return '消耗+';
    case 2: return '撃沈有';
    default: return '';
  }
}

function matchArea(area: number, key: AreaFilter): boolean {
  if (key === 'all') return true;
  if (key === 'other') return !KNOWN_AREAS.has(area);
  for (const c of AREA_CHIPS) {
    if (c.key === key) return area === c.areaId;
  }
  return true;
}

function matchFlag(view: MissionView, key: FlagFilter): boolean {
  switch (key) {
    case 'all':      return true;
    case 'normal':   return view.resetType !== 'monthly';
    case 'monthly':  return view.resetType === 'monthly';
    case 'has_cond': return view.cond !== null;
    case 'no_cond':  return view.cond === null;
    default:         return true;
  }
}

function compareMissions(a: MissionView, b: MissionView, key: SortKey): number {
  switch (key) {
    case 'id_asc':          return a.id - b.id;
    case 'area_asc':        return a.mapAreaId - b.mapAreaId || a.id - b.id;
    case 'time_desc':       return b.timeMin - a.timeMin || a.id - b.id;
    case 'time_asc':        return a.timeMin - b.timeMin || a.id - b.id;
    case 'difficulty_desc': return b.difficulty - a.difficulty || a.id - b.id;
    default:                return a.id - b.id;
  }
}

function formatDuration(min: number): string {
  if (min <= 0) return '--';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

function toView(row: MissionRow, conds: Map<number, ExpeditionCondition>): MissionView {
  return {
    id: row.id,
    code: row.code ?? '',
    mapAreaId: row.mapAreaId ?? 0,
    name: row.name,
    details: row.details ?? '',
    resetType: row.resetType ?? '',
    damageType: row.damageType ?? 0,
    timeMin: row.timeMin ?? 0,
    requireShips: row.requireShips ?? 0,
    difficulty: row.difficulty ?? 0,
    fuelPct: row.fuelPct ?? 0,
    ammoPct: row.ammoPct ?? 0,
    reward1: (row.reward_item1_id !== null && row.reward_item1_id !== undefined && row.reward_item1_id > 0)
      ? { id: row.reward_item1_id, count: row.reward_item1_count ?? 0 }
      : null,
    reward2: (row.reward_item2_id !== null && row.reward_item2_id !== undefined && row.reward_item2_id > 0)
      ? { id: row.reward_item2_id, count: row.reward_item2_count ?? 0 }
      : null,
    matLevels: [row.mat0 ?? 0, row.mat1 ?? 0, row.mat2 ?? 0, row.mat3 ?? 0],
    returnCancelable: (row.returnCancelable ?? 0) === 1,
    cond: conds.get(row.id) ?? null,
  };
}

// ==================== Page Component ====================

@ComponentV2
export default struct ExpeditionInfoPage {
  @Event onClose: () => void;

  @Local private allMissions: MissionView[] = [];
  @Local private visibleMissions: MissionView[] = [];
  @Local private loading: boolean = false;
  @Local private loadError: string = '';

  @Local private searchText: string = '';
  @Local private areaFilter: AreaFilter = 'all';
  @Local private flagFilter: FlagFilter = 'all';
  @Local private sortKey: SortKey = 'id_asc';

  /** 已加载的判断条件，按 missionId → ExpeditionCondition。 */
  private conditions: Map<number, ExpeditionCondition> = new Map();

  aboutToAppear(): void {
    void this.loadAll();
  }

  private async loadAll(): Promise<void> {
    this.loading = true;
    this.loadError = '';
    try {
      // 并行加载：DB 的 mission 目录 + rawfile 中的条件 JSON。
      const [rows, conds] = await Promise.all([
        this.loadMissions(),
        this.loadConditions(),
      ]);
      this.conditions = conds;
      const views = rows.map((r) => toView(r, conds));
      this.allMissions = views;
      this.recompute();
    } catch (e) {
      this.loadError = `加载失败: ${String(e)}`;
      this.allMissions = [];
      this.visibleMissions = [];
    } finally {
      this.loading = false;
    }
  }

  private async loadMissions(): Promise<MissionRow[]> {
    try {
      const repos = getRepositoryHub();
      return await repos.mission.listAll();
    } catch (e) {
      console.warn('[ExpeditionInfoPage] loadMissions failed:', String(e));
      return [];
    }
  }

  /** 从 rawfile 加载 expedition_conditions.json；缺失/解析错误返回空 Map。 */
  private async loadConditions(): Promise<Map<number, ExpeditionCondition>> {
    const result = new Map<number, ExpeditionCondition>();
    try {
      const ctx = getContext(this) as common.UIAbilityContext;
      const rm = ctx.resourceManager;
      const buf = await rm.getRawFileContent(CONDITIONS_RAWFILE);
      const text = new util.TextDecoder('utf-8').decode(buf);
      const obj = JSON.parse(text) as ConditionFile;
      const dict = obj.conditions;
      if (dict) {
        for (const k of Object.keys(dict)) {
          const id = Number(k);
          if (Number.isFinite(id)) {
            result.set(id, dict[k]);
          }
        }
      }
    } catch (e) {
      console.info('[ExpeditionInfoPage] conditions JSON not loaded:', String(e));
    }
    return result;
  }

  private recompute(): void {
    const q = this.searchText.trim().toLowerCase();
    const out: MissionView[] = [];
    for (const m of this.allMissions) {
      if (q.length > 0) {
        const inName = m.name.toLowerCase().indexOf(q) >= 0;
        const inCode = m.code.toLowerCase().indexOf(q) >= 0;
        if (!inName && !inCode) continue;
      }
      if (!matchArea(m.mapAreaId, this.areaFilter)) continue;
      if (!matchFlag(m, this.flagFilter)) continue;
      out.push(m);
    }
    out.sort((a, b) => compareMissions(a, b, this.sortKey));
    this.visibleMissions = out;
  }

  private setSearch(v: string): void {
    if (v === this.searchText) return;
    this.searchText = v;
    this.recompute();
  }

  private setAreaFilter(k: AreaFilter): void {
    if (k === this.areaFilter) return;
    this.areaFilter = k;
    this.recompute();
  }

  private setFlagFilter(k: FlagFilter): void {
    if (k === this.flagFilter) return;
    this.flagFilter = k;
    this.recompute();
  }

  private setSortKey(k: SortKey): void {
    if (k === this.sortKey) return;
    this.sortKey = k;
    this.recompute();
  }

  // ==================== Builders ====================

  @Builder
  private AreaChip(def: AreaChipDef) {
    Text(def.label)
      .fontSize(12)
      .fontColor(this.areaFilter === def.key ? COLOR_FG_CHIP_ACTIVE : COLOR_FG_CHIP)
      .fontWeight(this.areaFilter === def.key ? FontWeight.Medium : FontWeight.Regular)
      .padding({ left: 10, right: 10, top: 5, bottom: 5 })
      .backgroundColor(this.areaFilter === def.key ? COLOR_BG_CHIP_ACTIVE : COLOR_BG_CHIP)
      .borderRadius(12)
      .onClick(() => this.setAreaFilter(def.key))
  }

  @Builder
  private FlagChip(def: FlagChipDef) {
    Text(def.label)
      .fontSize(12)
      .fontColor(this.flagFilter === def.key ? COLOR_FG_CHIP_ACTIVE : COLOR_FG_CHIP)
      .fontWeight(this.flagFilter === def.key ? FontWeight.Medium : FontWeight.Regular)
      .padding({ left: 10, right: 10, top: 5, bottom: 5 })
      .backgroundColor(this.flagFilter === def.key ? COLOR_BG_CHIP_ACTIVE : COLOR_BG_CHIP)
      .borderRadius(12)
      .onClick(() => this.setFlagFilter(def.key))
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
        TextInput({ text: this.searchText, placeholder: '按名称/编号搜索' })
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
        Text('海')
          .fontSize(11)
          .fontColor('#666')
          .width(20)
        ForEach(AREA_CHIPS, (c: AreaChipDef) => {
          this.AreaChip(c)
        }, (c: AreaChipDef) => `a-${c.key}`)
      }
      .width('100%')

      Row({ space: 6 }) {
        Text('種')
          .fontSize(11)
          .fontColor('#666')
          .width(20)
        ForEach(FLAG_CHIPS, (c: FlagChipDef) => {
          this.FlagChip(c)
        }, (c: FlagChipDef) => `f-${c.key}`)
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

  /** 报酬段：道具 / 资源等级 / 中止可否 / 消耗。 */
  @Builder
  private RewardLine(m: MissionView) {
    Row({ space: 8 }) {
      if (m.reward1 !== null) {
        Text(`item#${m.reward1.id}×${m.reward1.count}`)
          .fontSize(11)
          .fontColor(COLOR_FG_REWARD)
          .padding({ left: 5, right: 5, top: 1, bottom: 1 })
          .backgroundColor(COLOR_BG_REWARD)
          .borderRadius(3)
      }
      if (m.reward2 !== null) {
        Text(`+item#${m.reward2.id}×${m.reward2.count}`)
          .fontSize(11)
          .fontColor(COLOR_FG_REWARD)
          .padding({ left: 5, right: 5, top: 1, bottom: 1 })
          .backgroundColor(COLOR_BG_REWARD)
          .borderRadius(3)
      }
      Text(`資 ${m.matLevels[0]}/${m.matLevels[1]}/${m.matLevels[2]}/${m.matLevels[3]}`)
        .fontSize(11)
        .fontColor('#90A0B0')
      Blank().layoutWeight(1)
      if (m.returnCancelable) {
        Text('中止可')
          .fontSize(10)
          .fontColor('#90A0B0')
      }
    }
    .width('100%')
  }

  /** 条件段：来自 conditions JSON；未提供时显示占位。 */
  @Builder
  private ConditionBlock(cond: ExpeditionCondition | null) {
    if (cond === null) {
      Text('判断条件: 待补充')
        .fontSize(11)
        .fontColor('#5a6270')
        .padding({ top: 2 })
    } else {
      Column({ space: 2 }) {
        if (cond.fleetDesc !== undefined && cond.fleetDesc.length > 0) {
          Text(`編成: ${cond.fleetDesc}`)
            .fontSize(12)
            .fontColor('#C8D0DA')
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        if (cond.flagshipReq !== undefined && cond.flagshipReq.length > 0) {
          Text(`旗艦: ${cond.flagshipReq}`)
            .fontSize(11)
            .fontColor('#A5B0BD')
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        // 数值要求合并成一行节省空间
        if (this.hasNumericReq(cond)) {
          Text(this.numericReqText(cond))
            .fontSize(11)
            .fontColor('#90A0B0')
        }
        if (cond.speedReq !== undefined && cond.speedReq.length > 0) {
          Text(`速力: ${cond.speedReq}`)
            .fontSize(11)
            .fontColor('#90A0B0')
        }
        if (cond.equipReq !== undefined && cond.equipReq.length > 0) {
          Text(`装備: ${cond.equipReq}`)
            .fontSize(11)
            .fontColor('#90A0B0')
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        if (cond.notes !== undefined && cond.notes.length > 0) {
          Text(`備考: ${cond.notes}`)
            .fontSize(11)
            .fontColor('#7A8090')
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
      }
      .width('100%')
      .padding({ left: 8, top: 4, bottom: 2 })
      .border({ width: { left: 2 }, color: COLOR_FG_CHIP_ACTIVE })
    }
  }

  private hasNumericReq(cond: ExpeditionCondition): boolean {
    return cond.flagshipLevelMin !== undefined
      || cond.fleetLevelMin !== undefined
      || cond.losMin !== undefined
      || cond.firepowerMin !== undefined
      || cond.aaMin !== undefined
      || cond.aswMin !== undefined;
  }

  private numericReqText(cond: ExpeditionCondition): string {
    const parts: string[] = [];
    if (cond.flagshipLevelMin !== undefined) parts.push(`旗Lv≥${cond.flagshipLevelMin}`);
    if (cond.fleetLevelMin !== undefined)    parts.push(`総Lv≥${cond.fleetLevelMin}`);
    if (cond.losMin !== undefined)           parts.push(`索≥${cond.losMin}`);
    if (cond.firepowerMin !== undefined)     parts.push(`火≥${cond.firepowerMin}`);
    if (cond.aaMin !== undefined)            parts.push(`対空≥${cond.aaMin}`);
    if (cond.aswMin !== undefined)           parts.push(`対潜≥${cond.aswMin}`);
    return parts.join('  ');
  }

  @Builder
  private MissionRowView(m: MissionView) {
    Column({ space: 4 }) {
      // Header line: code + name + monthly badge + danger badge + time
      Row({ space: 6 }) {
        Text(m.code.length > 0 ? m.code : `#${m.id}`)
          .fontSize(12)
          .fontColor('#FFD54F')
          .fontWeight(FontWeight.Medium)
          .padding({ left: 5, right: 5, top: 1, bottom: 1 })
          .backgroundColor('#2a2418')
          .borderRadius(3)
        Text(m.name)
          .fontSize(14)
          .fontWeight(FontWeight.Medium)
          .fontColor('#FFF')
          .layoutWeight(1)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        if (m.resetType === 'monthly') {
          Text('月')
            .fontSize(10)
            .fontColor(COLOR_FG_MONTHLY)
            .padding({ left: 5, right: 5, top: 1, bottom: 1 })
            .backgroundColor(COLOR_BG_MONTHLY)
            .borderRadius(3)
        }
        if (m.damageType > 0) {
          Text(damageTypeLabel(m.damageType))
            .fontSize(10)
            .fontColor('#E57373')
            .padding({ left: 5, right: 5, top: 1, bottom: 1 })
            .backgroundColor('#3a1a1a')
            .borderRadius(3)
        }
        Text(formatDuration(m.timeMin))
          .fontSize(11)
          .fontColor('#C8D0DA')
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)

      // Meta line: area / fleet size / difficulty / cost
      Row({ space: 12 }) {
        Text(`海域 ${m.mapAreaId}`)
          .fontSize(11)
          .fontColor('#90A0B0')
        Text(`${m.requireShips}隻`)
          .fontSize(11)
          .fontColor('#90A0B0')
        Text(`難 ${m.difficulty}`)
          .fontSize(11)
          .fontColor('#90A0B0')
        Text(`燃 ${m.fuelPct}%`)
          .fontSize(11)
          .fontColor('#90A0B0')
        Text(`弾 ${m.ammoPct}%`)
          .fontSize(11)
          .fontColor('#90A0B0')
        Blank().layoutWeight(1)
        Text(`#${m.id}`)
          .fontSize(10)
          .fontColor('#4a5260')
      }
      .width('100%')

      // Rewards line
      this.RewardLine(m)

      // Conditions block
      this.ConditionBlock(m.cond)
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
        Text('远征信息')
          .fontSize(17)
          .fontWeight(FontWeight.Medium)
          .fontColor('#FFF')
          .layoutWeight(1)
        Text(`${this.visibleMissions.length}/${this.allMissions.length}`)
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
      } else if (this.visibleMissions.length === 0) {
        Column() {
          Text(this.allMissions.length === 0 ? '尚未获取远征目录' : '当前筛选下无匹配远征')
            .fontSize(13)
            .fontColor('#666')
        }
        .width('100%')
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
        .backgroundColor(COLOR_BG_PAGE)
      } else {
        List() {
          ForEach(this.visibleMissions, (item: MissionView) => {
            ListItem() {
              this.MissionRowView(item)
            }
          }, (item: MissionView) => `${item.id}`)
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
