import { repos } from '../../../../infra/storage/repo';
import { BattleRecordRow } from '../../../../infra/storage/types';
import {
  BattleRecord,
  rowToBattleRecord,
  AerialCombatInfo,
  AerialStageInfo,
  LbasWaveInfo,
} from '../../../../domain/models';
import { ShipItem } from '../../../../features/panel/type';
import { PanelColors, hpColor } from '../../../../features/panel/panelConfig';
import { airStateName, airStateColor } from '../../../../features/panel/airStateUi';
import ShipRow from '../panel/bottom/rows/ShipRow';
import {
  fleetShipItems,
  enemyMainViews,
  enemyEscortViews,
  buildEngagementSteps,
  buildPhaseSummaries,
  EnemyShipView,
  EngagementStep,
  PhaseSummary,
  mapCode,
  areaName,
  formatDdHhMm,
  cellLabel,
  rankColor,
  displayRank,
  battleResultLabel,
  isCompleteVictory,
} from './sortieLogModel';

// ==================== 调色板（沿用其它 info 页面） ====================

const COLOR_BG_PAGE = '#1a1d27';
const COLOR_BG_HEADER = '#0f1118';
const COLOR_BG_SECTION = '#14171f';
const COLOR_BG_TOOLBAR = '#14171f';
const COLOR_BG_CHIP = '#1c1f2a';
const COLOR_FG_CHIP = '#aab1bd';
const COLOR_BORDER = '#272a36';
const COLOR_FG = '#C8D0DA';
const COLOR_MUTED = '#5a6270';
const COLOR_SUB = '#9aa3b0';
const COLOR_ACCENT = '#56d8e0';
const COLOR_FRIEND = '#7ED957';
const COLOR_ENEMY = '#E57373';
const COLOR_BOSS = '#FFD54F';

const LIST_LIMIT = 200;

// ==================== 页面 ====================

@ComponentV2
export default struct SortieLogPage {
  @Event onClose: () => void;

  @Local private rows: BattleRecordRow[] = [];
  @Local private visibleRows: BattleRecordRow[] = [];
  @Local private loading: boolean = true;
  @Local private searchText: string = '';

  /** true 时显示详情；否则显示列表。 */
  @Local private detailOpen: boolean = false;

  // 详情头部（primitive，避免在 @Builder 中传递可空对象）
  @Local private dMapAreaId: number = 0;
  @Local private dMapInfoNo: number = 0;
  @Local private dCellId: number = 0;
  @Local private dIsBoss: boolean = false;
  @Local private dRank: string = '';
  @Local private dCompleteVictory: boolean = false;
  @Local private dStartedAt: number = 0;
  @Local private dDropName: string = '';

  // 详情派生数据（在 openDetail 时一次性算好）
  @Local private dFriendMain: ShipItem[] = [];
  @Local private dFriendEscort: ShipItem[] = [];
  @Local private dEnemyMain: EnemyShipView[] = [];
  @Local private dEnemyEscort: EnemyShipView[] = [];
  @Local private dSteps: EngagementStep[] = [];
  @Local private dSummaries: PhaseSummary[] = [];
  @Local private dAerial: AerialCombatInfo[] = [];
  @Local private dLbas: LbasWaveInfo[] = [];

  aboutToAppear(): void {
    void this.loadList();
  }

  private async loadList(): Promise<void> {
    this.loading = true;
    try {
      const list = await repos.battle.listRecent(LIST_LIMIT);
      this.rows = list.slice();
      this.recomputeRows();
    } catch (e) {
      console.info('[SortieLogPage] load failed:', String(e));
      this.rows = [];
      this.visibleRows = [];
    }
    this.loading = false;
  }

  private searchNeedle(): string {
    return this.searchText.trim().toLowerCase();
  }

  private textMatches(text: string, q: string): boolean {
    return q.length > 0 && text.toLowerCase().indexOf(q) >= 0;
  }

  private rowFieldText(row: BattleRecordRow, field: string): string {
    switch (field) {
      case 'time':
        return formatDdHhMm(row.startedAt);
      case 'map':
        return `${mapCode(row.mapAreaId, row.mapInfoNo)} ${areaName(row.mapAreaId)}`;
      case 'cell':
        return cellLabel(row.cellId, row.isBoss === 1);
      case 'rank':
        return `${row.rank} ${displayRank(row.rank)} ${this.rowResultLabel(row)}`;
      case 'drop':
        return row.dropShipName ?? '';
      default:
        return '';
    }
  }

  private rowSearchText(row: BattleRecordRow): string {
    return [
      this.rowFieldText(row, 'time'),
      this.rowFieldText(row, 'map'),
      this.rowFieldText(row, 'cell'),
      this.rowFieldText(row, 'rank'),
      this.rowFieldText(row, 'drop'),
    ].join(' ').toLowerCase();
  }

  private recomputeRows(): void {
    const q = this.searchNeedle();
    if (q.length === 0) {
      this.visibleRows = this.rows.slice();
      return;
    }
    const out: BattleRecordRow[] = [];
    for (const row of this.rows) {
      if (this.rowSearchText(row).indexOf(q) >= 0) {
        out.push(row);
      }
    }
    this.visibleRows = out;
  }

  private setSearch(v: string): void {
    if (v === this.searchText) return;
    this.searchText = v;
    this.recomputeRows();
  }

  private openDetail(row: BattleRecordRow): void {
    const record: BattleRecord = rowToBattleRecord(row);
    this.dMapAreaId = record.mapAreaId;
    this.dMapInfoNo = record.mapInfoNo;
    this.dCellId = record.cellId;
    this.dIsBoss = record.isBoss;
    this.dRank = record.rank;
    this.dCompleteVictory = isCompleteVictory(record);
    this.dStartedAt = record.startedAt;
    this.dDropName = record.dropShipName ?? '';
    this.dFriendMain = fleetShipItems(record, false);
    this.dFriendEscort = fleetShipItems(record, true);
    this.dEnemyMain = enemyMainViews(record);
    this.dEnemyEscort = enemyEscortViews(record);
    this.dSteps = buildEngagementSteps(record);
    this.dSummaries = buildPhaseSummaries(record);
    this.dAerial = record.segment?.meta.aerialPhases ?? [];
    this.dLbas = record.segment?.meta.lbasWaves ?? [];
    this.detailOpen = true;
  }

  private closeDetail(): void {
    this.detailOpen = false;
  }

  private handleSwipeBack(): void {
    if (this.detailOpen) {
      this.closeDetail();
    } else {
      this.onClose?.();
    }
  }

  private rowResultLabel(row: BattleRecordRow): string {
    const record: BattleRecord = rowToBattleRecord(row);
    return battleResultLabel(record.rank, isCompleteVictory(record));
  }

  private matchCount(field: string): number {
    const q = this.searchNeedle();
    if (q.length === 0) return 0;
    let count = 0;
    for (const row of this.rows) {
      if (this.textMatches(this.rowFieldText(row, field), q)) {
        count++;
      }
    }
    return count;
  }

  private titleLabel(label: string, field: string): string {
    const count = this.matchCount(field);
    return count > 0 ? `${label}（${count}）` : label;
  }

  // ==================== 通用血条 ====================

  @Builder
  private HpBar(hpNow: number, hpMax: number) {
    Row() {
      if (hpNow > 0) {
        Column()
          .layoutWeight(hpNow)
          .height('100%')
          .backgroundColor(hpColor(hpNow, hpMax > 0 ? hpMax : 1))
      }
      if (hpMax - hpNow > 0) {
        Blank().layoutWeight(Math.max(0, hpMax - hpNow))
      }
    }
    .width('100%')
    .height(5)
    .backgroundColor(PanelColors.bgHpTrack)
    .borderRadius(2)
  }

  // ==================== 列表 ====================

  @Builder
  private ListTitleBar() {
    Row({ space: 8 }) {
      Text('')
        .width(34)

      Text(this.titleLabel('时间', 'time'))
        .fontSize(11)
        .fontColor(COLOR_SUB)
        .fontWeight(FontWeight.Medium)
        .width(62)
        .textAlign(TextAlign.Center)

      Text(this.titleLabel('海域', 'map'))
        .fontSize(11)
        .fontColor(COLOR_SUB)
        .fontWeight(FontWeight.Medium)
        .layoutWeight(2)
        .textAlign(TextAlign.Center)

      Text(this.titleLabel('点位', 'cell'))
        .fontSize(11)
        .fontColor(COLOR_SUB)
        .fontWeight(FontWeight.Medium)
        .width(66)
        .textAlign(TextAlign.Center)

      Text(this.titleLabel('戦果', 'rank'))
        .fontSize(11)
        .fontColor(COLOR_SUB)
        .fontWeight(FontWeight.Medium)
        .width(84)
        .textAlign(TextAlign.Center)

      Text(this.titleLabel('掉落', 'drop'))
        .fontSize(11)
        .fontColor(COLOR_SUB)
        .fontWeight(FontWeight.Medium)
        .layoutWeight(2)
        .textAlign(TextAlign.Center)
    }
    .width('100%')
    .height(30)
    .padding({ left: 8, right: 12 })
    .backgroundColor(COLOR_BG_SECTION)
    .alignItems(VerticalAlign.Center)
    .border({ width: { bottom: 0.5 }, color: COLOR_BORDER })
  }

  @Builder
  private MatchBar() {
    Row() {
      TextInput({ text: this.searchText, placeholder: '匹配海域 / 点位 / 结果 / 掉落' })
        .fontSize(13)
        .fontColor(COLOR_FG)
        .caretColor(COLOR_ACCENT)
        .placeholderColor(COLOR_MUTED)
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
    .padding({ left: 12, right: 12, top: 8, bottom: 8 })
    .backgroundColor(COLOR_BG_TOOLBAR)
    .border({ width: { bottom: 0.5 }, color: COLOR_BORDER })
  }

  @Builder
  private ListRow(row: BattleRecordRow) {
    Row({ space: 8 }) {
      // 详情入口 icon（点击切换到详情页）
      Button({ type: ButtonType.Normal, stateEffect: true }) {
        SymbolGlyph($r('sys.symbol.exclamationmark_circle'))
          .fontSize(20)
          .fontColor([COLOR_ACCENT])
      }
      .width(34)
      .height(34)
      .backgroundColor(Color.Transparent)
      .border({ width: 0 })
      .onClick(() => this.openDetail(row))

      // 时间 dd/hh/mm
      Text(formatDdHhMm(row.startedAt))
        .fontSize(11)
        .fontColor(COLOR_SUB)
        .width(62)
        .textAlign(TextAlign.Center)

      // 海域名 + 代号
      Column({ space: 1 }) {
        Text(mapCode(row.mapAreaId, row.mapInfoNo))
          .fontSize(13)
          .fontWeight(FontWeight.Medium)
          .fontColor('#FFF')
        Text(areaName(row.mapAreaId))
          .fontSize(10)
          .fontColor(COLOR_MUTED)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .alignItems(HorizontalAlign.Center)
      .layoutWeight(2)

      // 地图点位（boss 括号标注）
      Text(cellLabel(row.cellId, row.isBoss === 1))
        .fontSize(12)
        .fontColor(row.isBoss === 1 ? COLOR_BOSS : COLOR_SUB)
        .fontWeight(row.isBoss === 1 ? FontWeight.Bold : FontWeight.Regular)
        .width(66)
        .textAlign(TextAlign.Center)

      // 战斗结果
      Text(this.rowResultLabel(row))
        .fontSize(12)
        .fontWeight(FontWeight.Bold)
        .fontColor(rankColor(row.rank))
        .width(84)
        .textAlign(TextAlign.Center)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })

      // 捞船
      Text(row.dropShipName && row.dropShipName.length > 0 ? row.dropShipName : '—')
        .fontSize(12)
        .fontColor(row.dropShipName && row.dropShipName.length > 0 ? COLOR_FRIEND : COLOR_MUTED)
        .layoutWeight(2)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .textAlign(TextAlign.Center)
    }
    .width('100%')
    .padding({ left: 8, right: 12, top: 8, bottom: 8 })
    .alignItems(VerticalAlign.Center)
    .border({ width: { bottom: 0.5 }, color: COLOR_BORDER })
  }

  @Builder
  private ListView() {
    if (this.loading) {
      Column() {
        Text('加载中…').fontSize(13).fontColor(COLOR_MUTED)
      }
      .width('100%').layoutWeight(1).justifyContent(FlexAlign.Center)
    } else if (this.rows.length === 0) {
      Column() {
        Text('暂无出击战斗记录').fontSize(13).fontColor(COLOR_MUTED)
      }
      .width('100%').layoutWeight(1).justifyContent(FlexAlign.Center)
    } else if (this.visibleRows.length === 0) {
      Column() {
        Text('当前匹配下无出击战斗记录').fontSize(13).fontColor(COLOR_MUTED)
      }
      .width('100%').layoutWeight(1).justifyContent(FlexAlign.Center)
    } else {
      List() {
        ForEach(this.visibleRows, (row: BattleRecordRow) => {
          ListItem() {
            this.ListRow(row)
          }
        }, (row: BattleRecordRow) => row.id)
      }
      .width('100%')
      .layoutWeight(1)
      .backgroundColor(COLOR_BG_PAGE)
    }
  }

  // ==================== 详情 ====================

  @Builder
  private SectionTitle(text: string) {
    Row() {
      Text(text)
        .fontSize(13)
        .fontWeight(FontWeight.Medium)
        .fontColor(COLOR_ACCENT)
    }
    .width('100%')
    .padding({ left: 12, right: 12, top: 8, bottom: 6 })
    .backgroundColor(COLOR_BG_SECTION)
    .border({ width: { top: 0.5, bottom: 0.5 }, color: COLOR_BORDER })
  }

  @Builder
  private EnemyRow(e: EnemyShipView) {
    Column({ space: 3 }) {
      Row({ space: 6 }) {
        Text(e.name)
          .fontSize(13)
          .fontColor(e.hpEnd <= 0 ? COLOR_MUTED : COLOR_FG)
          .layoutWeight(1)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .decoration({ type: e.hpEnd <= 0 ? TextDecorationType.LineThrough : TextDecorationType.None })
        if (e.level > 0) {
          Text(`Lv.${e.level}`).fontSize(11).fontColor(COLOR_MUTED)
        }
        Text(`${e.hpStart}→${e.hpEnd}/${e.hpMax}`)
          .fontSize(11)
          .fontColor(hpColor(e.hpEnd, e.hpMax > 0 ? e.hpMax : 1))
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)

      this.HpBar(e.hpEnd, e.hpMax)
    }
    .width('100%')
    .padding({ left: 12, right: 12, top: 5, bottom: 5 })
    .border({ width: { bottom: 0.5 }, color: COLOR_BORDER })
  }

  /** 单阶段机数行：我方(绿) / 敌方(红)。 */
  @Builder
  private AerialStage(label: string, stage: AerialStageInfo | undefined) {
    if (stage) {
      Row({ space: 8 }) {
        Text(label).fontSize(11).fontColor(COLOR_MUTED).width(24)
        Text(`我 ${Math.max(0, stage.friendCount - stage.friendLost)}/${stage.friendCount}`)
          .fontSize(11).fontColor(COLOR_FRIEND).layoutWeight(1)
        Text(`敌 ${Math.max(0, stage.enemyCount - stage.enemyLost)}/${stage.enemyCount}`)
          .fontSize(11).fontColor(COLOR_ENEMY).layoutWeight(1)
      }
      .width('100%')
    }
  }

  @Builder
  private AerialBlock(p: AerialCombatInfo, idx: number) {
    Column({ space: 3 }) {
      Row({ space: 6 }) {
        Text(this.dAerial.length > 1 ? `航空战 第${idx + 1}次` : '航空战')
          .fontSize(12).fontColor(COLOR_SUB).fontWeight(FontWeight.Medium)
        if (p.airState) {
          Text(airStateName(p.airState)).fontSize(11).fontColor(airStateColor(p.airState)).fontWeight(FontWeight.Medium)
        }
        if (p.airFire) {
          Text('对空CI').fontSize(11).fontColor(COLOR_BOSS).fontWeight(FontWeight.Bold)
        }
      }
      .width('100%').alignItems(VerticalAlign.Center)

      this.AerialStage('S1', p.stage1)
      this.AerialStage('S2', p.stage2)
    }
    .width('100%')
    .padding(8)
    .backgroundColor(COLOR_BG_SECTION)
    .borderRadius(4)
    .alignItems(HorizontalAlign.Start)
  }

  @Builder
  private LbasBlock(w: LbasWaveInfo, idx: number) {
    Column({ space: 3 }) {
      Row({ space: 6 }) {
        Text(`第${idx + 1}波`).fontSize(12).fontColor(COLOR_FG).fontWeight(FontWeight.Medium)
        Text(`基地${w.baseId}`).fontSize(11).fontColor(COLOR_SUB)
        if (w.squadronCounts.length > 0) {
          Text(`派出 ${w.squadronCounts.join('/')}机`).fontSize(11).fontColor(COLOR_MUTED)
        }
        Blank().layoutWeight(1)
        if (w.airState) {
          Text(airStateName(w.airState)).fontSize(11).fontColor(airStateColor(w.airState)).fontWeight(FontWeight.Medium)
        }
      }
      .width('100%').alignItems(VerticalAlign.Center)

      this.AerialStage('S1', w.stage1)
      this.AerialStage('S2', w.stage2)
    }
    .width('100%')
    .padding(8)
    .backgroundColor(COLOR_BG_SECTION)
    .borderRadius(4)
    .alignItems(HorizontalAlign.Start)
  }

  @Builder
  private SummaryRow(s: PhaseSummary) {
    Row({ space: 8 }) {
      Text(s.label).fontSize(12).fontColor(COLOR_FG).layoutWeight(1)
      if (s.enemyDamage > 0) {
        Text(`敌 -${s.enemyDamage}`).fontSize(11).fontColor(COLOR_ENEMY)
      }
      if (s.friendDamage > 0) {
        Text(`我 -${s.friendDamage}`).fontSize(11).fontColor(COLOR_BOSS)
      }
      Text(`${s.attacks}次`).fontSize(11).fontColor(COLOR_MUTED).width(40).textAlign(TextAlign.End)
    }
    .width('100%')
    .padding({ left: 12, right: 12, top: 5, bottom: 5 })
    .border({ width: { bottom: 0.5 }, color: COLOR_BORDER })
  }

  @Builder
  private StepRow(step: EngagementStep) {
    Column({ space: 0 }) {
      if (step.phaseHead) {
        Row() {
          Text(step.phaseLabel)
            .fontSize(12)
            .fontWeight(FontWeight.Medium)
            .fontColor(COLOR_SUB)
        }
        .width('100%')
        .padding({ left: 12, right: 12, top: 8, bottom: 4 })
        .backgroundColor('#11141c')
      }

      Column({ space: 2 }) {
        // line 1: attacker → target  -dmg [暴击] [撃沈]
        Row({ space: 5 }) {
          Text(step.attackerName.length > 0 ? step.attackerName : '—')
            .fontSize(12)
            .fontColor(step.attackerSide === 'friend' ? COLOR_FRIEND : COLOR_ENEMY)
            .constraintSize({ maxWidth: '34%' })
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
          Text('→').fontSize(11).fontColor(COLOR_MUTED)
          Text(step.targetName)
            .fontSize(12)
            .fontColor(step.targetSide === 'friend' ? COLOR_FRIEND : COLOR_ENEMY)
            .layoutWeight(1)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
          if (step.critical === 2) {
            Text('暴击').fontSize(10).fontColor(COLOR_BOSS).fontWeight(FontWeight.Bold)
          }
          Text(`-${step.damage}`)
            .fontSize(12)
            .fontWeight(FontWeight.Medium)
            .fontColor(COLOR_ENEMY)
          if (step.sunk) {
            Text(step.targetSide === 'friend' ? '轰沈' : '撃沈')
              .fontSize(10)
              .fontColor(COLOR_MUTED)
              .fontWeight(FontWeight.Bold)
          }
        }
        .width('100%')
        .alignItems(VerticalAlign.Center)

        // line 2: target HP bar after the hit
        Row({ space: 6 }) {
          Column() {
            this.HpBar(step.hpAfter, step.hpMax)
          }
          .layoutWeight(1)
          Text(`${step.hpAfter}/${step.hpMax}`)
            .fontSize(10)
            .fontColor(COLOR_MUTED)
            .width(58)
            .textAlign(TextAlign.End)
        }
        .width('100%')
        .alignItems(VerticalAlign.Center)
      }
      .width('100%')
      .padding({ left: 12, right: 12, top: 5, bottom: 5 })
      .border({ width: { bottom: 0.5 }, color: COLOR_BORDER })
    }
    .width('100%')
  }

  @Builder
  private FriendFleetSection() {
    this.SectionTitle('我方舰队')
    ForEach(this.dFriendMain, (ship: ShipItem, idx: number) => {
      ShipRow({ ship: ship, isFlag: idx === 0 })
    }, (ship: ShipItem) => `fm-${ship.id}`)
    if (this.dFriendEscort.length > 0) {
      this.SectionTitle('我方舰队 · 护卫')
      ForEach(this.dFriendEscort, (ship: ShipItem, idx: number) => {
        ShipRow({ ship: ship, isFlag: idx === 0 })
      }, (ship: ShipItem) => `fe-${ship.id}`)
    }
  }

  @Builder
  private EnemyFleetSection() {
    this.SectionTitle('敌方舰队')
    ForEach(this.dEnemyMain, (e: EnemyShipView) => {
      this.EnemyRow(e)
    }, (e: EnemyShipView) => `em-${e.idx}`)
    if (this.dEnemyEscort.length > 0) {
      this.SectionTitle('敌方舰队 · 护卫')
      ForEach(this.dEnemyEscort, (e: EnemyShipView) => {
        this.EnemyRow(e)
      }, (e: EnemyShipView) => `ee-${e.idx}`)
    }
  }

  @Builder
  private BattleDetailSection() {
    if (this.dAerial.length > 0 || this.dLbas.length > 0) {
      this.SectionTitle('航空站详情')
      Column({ space: 6 }) {
        ForEach(this.dAerial, (p: AerialCombatInfo, idx: number) => {
          this.AerialBlock(p, idx)
        }, (_p: AerialCombatInfo, idx: number) => `air-${idx}`)
        ForEach(this.dLbas, (w: LbasWaveInfo, idx: number) => {
          this.LbasBlock(w, idx)
        }, (_w: LbasWaveInfo, idx: number) => `lbas-${idx}`)
      }
      .width('100%')
      .padding({ left: 12, right: 12, top: 6, bottom: 6 })
    }

    if (this.dSummaries.length > 0) {
      this.SectionTitle('战斗经过')
      ForEach(this.dSummaries, (s: PhaseSummary) => {
        this.SummaryRow(s)
      }, (s: PhaseSummary) => s.key)
    }
  }

  @Builder
  private EngagementSection() {
    this.SectionTitle('交战详情（逐次攻击）')
    if (this.dSteps.length === 0) {
      Row() {
        Text('本场战斗无逐次交战数据（升级前的旧记录）')
          .fontSize(12)
          .fontColor(COLOR_MUTED)
      }
      .width('100%')
      .padding({ left: 12, right: 12, top: 10, bottom: 10 })
    } else {
      ForEach(this.dSteps, (step: EngagementStep) => {
        this.StepRow(step)
      }, (step: EngagementStep) => step.key)
    }
  }

  @Builder
  private DetailHeader() {
    Column({ space: 2 }) {
      Row({ space: 8 }) {
        Text(mapCode(this.dMapAreaId, this.dMapInfoNo))
          .fontSize(17)
          .fontWeight(FontWeight.Bold)
          .fontColor('#FFF')
        Text(areaName(this.dMapAreaId))
          .fontSize(12)
          .fontColor(COLOR_SUB)
        Text(cellLabel(this.dCellId, this.dIsBoss))
          .fontSize(12)
          .fontColor(this.dIsBoss ? COLOR_BOSS : COLOR_SUB)
          .fontWeight(this.dIsBoss ? FontWeight.Bold : FontWeight.Regular)
        Blank().layoutWeight(1)
        Text(battleResultLabel(this.dRank, this.dCompleteVictory))
          .fontSize(18)
          .fontWeight(FontWeight.Bold)
          .fontColor(rankColor(this.dRank))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)

      Row({ space: 12 }) {
        Text(formatDdHhMm(this.dStartedAt)).fontSize(11).fontColor(COLOR_MUTED)
        Text(this.dDropName.length > 0 ? `捞船：${this.dDropName}` : '捞船：无')
          .fontSize(11)
          .fontColor(this.dDropName.length > 0 ? COLOR_FRIEND : COLOR_MUTED)
          .layoutWeight(1)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)
    }
    .width('100%')
    .padding({ left: 12, right: 12, top: 8, bottom: 8 })
    .backgroundColor(COLOR_BG_SECTION)
    .border({ width: { bottom: 0.5 }, color: COLOR_BORDER })
  }

  @Builder
  private DetailView() {
    Scroll() {
      Column() {
        this.DetailHeader()
        this.FriendFleetSection()
        this.EnemyFleetSection()
        this.BattleDetailSection()
        this.EngagementSection()
        Row().width('100%').height(16)
      }
      .width('100%')
    }
    .layoutWeight(1)
    .align(Alignment.TopStart)
    .scrollBar(BarState.Off)
    .edgeEffect(EdgeEffect.Spring)
  }

  // ==================== build ====================

  build() {
    Column() {
      // Header
      Row() {
        if (this.detailOpen) {
          Button({ type: ButtonType.Normal, stateEffect: true }) {
            SymbolGlyph($r('sys.symbol.chevron_left')).fontSize(20).fontColor(['#999'])
          }
          .width(40).height(40)
          .backgroundColor(Color.Transparent)
          .border({ width: 0 })
          .onClick(() => this.closeDetail())
        }
        Text(this.detailOpen ? '战斗详情' : '出击日志')
          .fontSize(17)
          .fontWeight(FontWeight.Medium)
          .fontColor('#FFF')
          .layoutWeight(1)
        if (!this.detailOpen) {
          Text(`${this.visibleRows.length}/${this.rows.length}`)
            .fontSize(13)
            .fontColor('#888')
            .margin({ right: 12 })
        }
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
      .padding({ left: this.detailOpen ? 4 : 16, right: 6 })
      .backgroundColor(COLOR_BG_HEADER)
      .alignItems(VerticalAlign.Center)

      if (this.detailOpen) {
        this.DetailView()
      } else {
        this.ListTitleBar()
        this.MatchBar()
        this.ListView()
      }

      Text('右滑返回')
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
        .onActionEnd(() => this.handleSwipeBack())
    )
    .onClick(() => {})
  }
}
