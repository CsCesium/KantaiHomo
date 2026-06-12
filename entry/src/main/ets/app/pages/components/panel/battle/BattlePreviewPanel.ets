import { PanelColors, PanelDimens, hpColor } from '../../../../../features/panel/panelConfig';
import { airStateName, airStateColor } from '../../../../../features/panel/airStateUi';
import { PanelPopupStateChangeEvent } from '../../../../../features/panel/type';
import {
  subscribeGameState, getBattleStatus, getBattleResult, getShipMasterName, isShipMasterLandBased,
  BattleStatusSnapshot, BattleResultSnapshot, ShipBattleStatus, FleetBattleStatus,
  EnemyBattleStatus
} from '../../../../../features/state';
import { FormationNameJP, EngagementNameJP, Formation, Engagement } from '../../../../../domain/models';
import AerialCombatPanel from './AerialCombatPanel';

// ── pure helpers (no ArkUI APIs) ──────────────────────────────────────────

const BATTLE_SHIP_ROW_H = 32;

function rankColor(rank: string): string {
  if (displayRank(rank) === 'S') return '#FFD700';
  if (rank === 'A') return '#ffdd1212';
  if (rank === 'B') return '#ffcb6d22';
  if (rank === 'C') return '#ff917c25';
  if (rank === 'D') return '#ff198311';
  return PanelColors.hpCrit;
}

function displayRank(rank: string): string {
  return rank === 'SS' ? 'S' : rank;
}

function formationName(f: number | undefined): string {
  if (!f) return '?';
  return FormationNameJP[f as Formation] ?? `陣${f}`;
}

function engagementName(e: number | undefined): string {
  if (!e) return '';
  return EngagementNameJP[e as Engagement] ?? `${e}`;
}

function engagementColor(e: number | undefined): string {
  if (e === 3) return '#43a047';   // T字有利 — green
  if (e === 4) return PanelColors.hpCrit;  // T字不利 — red
  if (e === 2) return PanelColors.hpWarn;  // 反航戦 — yellow
  return PanelColors.txtSub;
}

function phaseName(phase: 'day' | 'night' | 'day_to_night'): string {
  if (phase === 'night') return '开幕夜戦';
  if (phase === 'day_to_night') return '夜戦';
  return '昼戦';
}

function shipBadgeText(ship: ShipBattleStatus, landBased: boolean = false): string {
  if (ship.isSunk) return landBased ? '破壊' : '轰沈';
  if (ship.isTaiha) return landBased ? '损壊' : '大破';
  if (ship.isChuuha) return landBased ? '损害' : '中破';
  if (ship.isShouha) return landBased ? '混乱' : '小破';
  return '';
}

function shipBadgeColor(ship: ShipBattleStatus): string {
  if (ship.isSunk) return PanelColors.txtMuted;
  if (ship.isTaiha) return ship.hasSinkRisk ? PanelColors.hpSinkRisk : PanelColors.hpCrit;
  if (ship.isChuuha) return PanelColors.hpMid;
  if (ship.isShouha) return PanelColors.hpShouha;
  return PanelColors.hpOk;
}

function enemyBadgeText(hpNow: number, hpMax: number, landBased: boolean = false): string {
  if (hpNow <= 0) return landBased ? '破壊' : '轰沈';
  const r = hpMax > 0 ? hpNow / hpMax : 1;
  if (r <= 0.25) return landBased ? '损壊' : '大破';
  if (r <= 0.5)  return landBased ? '损害' : '中破';
  if (r <= 0.75) return landBased ? '混乱' : '小破';
  return '';
}

function enemyBadgeColor(hpNow: number, hpMax: number): string {
  if (hpNow <= 0) return PanelColors.txtMuted;
  return hpColor(hpNow, hpMax);
}

function cloneShipBattleStatus(ship: ShipBattleStatus): ShipBattleStatus {
  const cloned: ShipBattleStatus = {
    uid: ship.uid,
    name: ship.name,
    hpBefore: ship.hpBefore,
    hpAfter: ship.hpAfter,
    hpMax: ship.hpMax,
    damageReceived: ship.damageReceived,
    hpPercent: ship.hpPercent,
    isSunk: ship.isSunk,
    isTaiha: ship.isTaiha,
    isChuuha: ship.isChuuha,
    isShouha: ship.isShouha,
    hasSinkRisk: ship.hasSinkRisk,
  };
  return cloned;
}

function cloneFleetBattleStatus(fleet: FleetBattleStatus): FleetBattleStatus {
  const ships: ShipBattleStatus[] = fleet.ships.map((ship: ShipBattleStatus): ShipBattleStatus => {
    return cloneShipBattleStatus(ship);
  });
  const cloned: FleetBattleStatus = {
    deckId: fleet.deckId,
    name: fleet.name,
    ships: ships,
    taihaCount: fleet.taihaCount,
    sunkCount: fleet.sunkCount,
  };
  return cloned;
}

function cloneEnemyBattleStatus(enemy: EnemyBattleStatus): EnemyBattleStatus {
  const cloned: EnemyBattleStatus = {
    shipIds: enemy.shipIds.slice(),
    hpBefore: enemy.hpBefore.slice(),
    hpNow: enemy.hpNow.slice(),
    hpMax: enemy.hpMax.slice(),
    sunkCount: enemy.sunkCount,
  };
  return cloned;
}

function cloneOptionalFleetBattleStatus(fleet: FleetBattleStatus | undefined): FleetBattleStatus | null {
  if (!fleet) {
    return null;
  }
  return cloneFleetBattleStatus(fleet);
}

function cloneOptionalEnemyBattleStatus(enemy: EnemyBattleStatus | undefined): EnemyBattleStatus | null {
  if (!enemy) {
    return null;
  }
  return cloneEnemyBattleStatus(enemy);
}

function hasFriendFleet(fleet: FleetBattleStatus | null | undefined): boolean {
  return !!fleet && fleet.ships.some(ship => ship.hpMax > 0);
}

function hasEnemyFleet(fleet: EnemyBattleStatus | null | undefined): boolean {
  return !!fleet && fleet.hpMax.some(hpMax => hpMax > 0);
}

// ── BattlePreviewPanel ────────────────────────────────────────────────────

@ComponentV2
export default struct BattlePreviewPanel {
  @Local statusSnap: BattleStatusSnapshot | null = null;
  @Local resultSnap: BattleResultSnapshot | null = null;
  @Local battleRenderKey: string = 'empty';
  @Local viewFriendMain: FleetBattleStatus | null = null;
  @Local viewFriendEscort: FleetBattleStatus | null = null;
  @Local viewEnemyMain: EnemyBattleStatus | null = null;
  @Local viewEnemyEscort: EnemyBattleStatus | null = null;
  @Local viewIsAirRaid: boolean = false;
  /** 航空战详情弹窗是否展开（双击制空 tag 切换）。 */
  @Local aerialDetailOpen: boolean = false;

  private unsubscribe: (() => void) | null = null;

  aboutToAppear(): void {
    this.refreshBattleSnapshots();
    this.unsubscribe = subscribeGameState((changeType, _state) => {
      if (changeType === 'battle' || changeType === 'all') {
        this.refreshBattleSnapshots();
      }
    });
  }

  aboutToDisappear(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  private refreshBattleSnapshots(): void {
    const status = getBattleStatus();
    const result = getBattleResult();
    this.statusSnap = status;
    this.resultSnap = result;

    if (result) {
      this.battleRenderKey = `result-${result.battleId}-${result.endedAt}`;
      this.viewFriendMain = cloneFleetBattleStatus(result.friendMain);
      this.viewFriendEscort = cloneOptionalFleetBattleStatus(result.friendEscort);
      this.viewEnemyMain = cloneEnemyBattleStatus(result.enemyMain);
      this.viewEnemyEscort = cloneOptionalEnemyBattleStatus(result.enemyEscort);
      this.viewIsAirRaid = result.isAirRaid;
      return;
    }

    if (status) {
      this.battleRenderKey = `status-${status.battleId}-${status.battlePhase}-${status.calculatedAt}`;
      this.viewFriendMain = cloneFleetBattleStatus(status.friendMain);
      this.viewFriendEscort = cloneOptionalFleetBattleStatus(status.friendEscort);
      this.viewEnemyMain = cloneEnemyBattleStatus(status.enemyMain);
      this.viewEnemyEscort = cloneOptionalEnemyBattleStatus(status.enemyEscort);
      this.viewIsAirRaid = status.isAirRaid;
      return;
    }

    this.battleRenderKey = 'empty';
    this.viewFriendMain = null;
    this.viewFriendEscort = null;
    this.viewEnemyMain = null;
    this.viewEnemyEscort = null;
    this.viewIsAirRaid = false;
  }

  // ── HP bar with damage indicator and threshold ticks ──────────────────────

  /**
   * HP bar with:
   *   - damage value on the left (fixed width)
   *   - tick marks at 25% and 50% thresholds
   *   - color: green >50%, orange 25-50%, red ≤25%, empty if sunk
   */
  @Builder HpBarRow(hpAfter: number, hpMax: number, damage: number) {
    Row({ space: 4 }) {
      // Damage indicator (left, fixed width)
      if (damage > 0) {
        Text(`-${damage}`)
          .fontSize(9)
          .fontColor(PanelColors.hpCrit)
          .width(26)
          .textAlign(TextAlign.End)
      } else {
        Blank().width(26)
      }

      // HP bar with threshold tick marks at 25% and 50%
      Stack() {
        Row() {
          if (hpAfter > 0) {
            Column()
              .layoutWeight(hpAfter)
              .height('100%')
              .backgroundColor(hpColor(hpAfter, hpMax))
          }
          if (damage > 0) {
            Column()
              .layoutWeight(damage)
              .height('100%')
              .backgroundColor(PanelColors.hpDamage)
          }
          if (hpMax - Math.max(hpAfter, 0) - Math.max(damage, 0) > 0) {
            Blank().layoutWeight(hpMax - Math.max(hpAfter, 0) - Math.max(damage, 0))
          }
        }
        .width('100%')
        .height(PanelDimens.hpBarH)
        .backgroundColor(PanelColors.bgHpTrack)
        // Tick marks: weights 1 | tick | 1 | tick | 2 → ticks at 25% and 50%
        Row() {
          Blank().layoutWeight(1)
          Column().width(1).height('100%').backgroundColor('#ffffff44')
          Blank().layoutWeight(1)
          Column().width(1).height('100%').backgroundColor('#ffffff44')
          Blank().layoutWeight(2)
        }
        .width('100%')
        .height(PanelDimens.hpBarH)
      }
      .layoutWeight(1)
      .height(PanelDimens.hpBarH)
    }
    .width('100%')
    .alignItems(VerticalAlign.Center)
  }

  // ── Friendly ship row ─────────────────────────────────────────────────────

  /**
   * Compact 2-line friendly ship row.
   *
   *   name (flex)   beforeHP→afterHP   [badge]
   *   [-dmg fixed]  [====HP bar with ticks====]
   */
  @Builder BattleShipRow(ship: ShipBattleStatus, landBased: boolean = false) {
    Column({ space: 2 }) {
      // Line 1: name | HP transition | status badge
      Row({ space: 3 }) {
        Text(ship.name)
          .fontSize(PanelDimens.fontMd)
          .fontColor(ship.isSunk
            ? PanelColors.txtMuted
            : (ship.hasSinkRisk ? PanelColors.hpSinkRisk : PanelColors.txtPrimary))
          .fontWeight(ship.hasSinkRisk ? FontWeight.Bold : FontWeight.Normal)
          .layoutWeight(1)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .decoration({
            type: ship.isSunk ? TextDecorationType.LineThrough : TextDecorationType.None
          })

        Text(`${ship.hpBefore}→${ship.hpAfter}`)
          .fontSize(PanelDimens.fontSm)
          .fontColor(hpColor(ship.hpAfter, ship.hpMax))

        Text(shipBadgeText(ship, landBased))
          .fontSize(PanelDimens.fontSm)
          .fontColor(shipBadgeColor(ship))
          .fontWeight(FontWeight.Bold)
          .width(28)
          .textAlign(TextAlign.End)
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)

      // Line 2: damage on left + HP bar with threshold ticks
      this.HpBarRow(ship.hpAfter, ship.hpMax, ship.damageReceived)
    }
    .width('100%')
    .height(BATTLE_SHIP_ROW_H)
    .padding({ left: 10, right: 10, top: 5, bottom: 5 })
    .borderWidth({ bottom: PanelDimens.borderW })
    .borderColor(PanelColors.rowBorder)
  }

  // ── Enemy ship row ────────────────────────────────────────────────────────

  /**
   * Compact 2-line enemy ship row.
   *
   *   <name>   beforeHP→afterHP   [badge]
   *   [-dmg]   [====HP bar====]
   *
   * 敵舰 master id 在图鉴缓存中通常含日文舰名，未命中时回退为 `敵N`。
   */
  @Builder EnemyShipRow(idx: number, masterId: number, hpBefore: number, hpAfter: number, hpMax: number, landBased: boolean = false) {
    // 单舰陆基判定：来源于 master.api_soku === 0 的「陆上型」敌人（栖姬/集積地等）；
    // 整列空袭时由 landBased=true 强制覆盖。
    Column({ space: 2 }) {
      Row({ space: 3 }) {
        Text(getShipMasterName(masterId) || (landBased ? `敵編隊${idx + 1}` : `敵${idx + 1}`))
          .fontSize(PanelDimens.fontMd)
          .fontColor(hpAfter <= 0 ? PanelColors.txtMuted : PanelColors.txtSub)
          .layoutWeight(1)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .decoration({
            type: hpAfter <= 0 ? TextDecorationType.LineThrough : TextDecorationType.None
          })

        Text(`${hpBefore}→${hpAfter > 0 ? hpAfter : 0}`)
          .fontSize(PanelDimens.fontSm)
          .fontColor(hpColor(hpAfter, hpMax))

        Text(enemyBadgeText(hpAfter, hpMax, landBased))
          .fontSize(PanelDimens.fontSm)
          .fontColor(enemyBadgeColor(hpAfter, hpMax))
          .fontWeight(FontWeight.Bold)
          .width(28)
          .textAlign(TextAlign.End)
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)

      this.HpBarRow(hpAfter > 0 ? hpAfter : 0, hpMax, Math.max(0, hpBefore - hpAfter))
    }
    .width('100%')
    .height(BATTLE_SHIP_ROW_H)
    .padding({ left: 10, right: 10, top: 5, bottom: 5 })
    .borderWidth({ bottom: PanelDimens.borderW })
    .borderColor(PanelColors.rowBorder)
  }

  // ── prediction view builders ───────────────────────────────────────────────

  /** 友方舰名（主力+护卫顺序），用于航空战详情面板解析对空CI发动舰。 */
  private aaciShipNames(): string[] {
    const names: string[] = [];
    const snap = this.statusSnap;
    if (snap) {
      for (const ship of snap.friendMain.ships) {
        names.push(ship.name);
      }
      if (snap.friendEscort) {
        for (const ship of snap.friendEscort.ships) {
          names.push(ship.name);
        }
      }
    }
    return names;
  }

  /** 航空战 / 对空状态详情弹窗（双击制空 tag 弹出）。 */
  @Builder AerialDetailPopup() {
    AerialCombatPanel({
      phases: this.statusSnap?.aerialPhases ?? [],
      lbasWaves: this.statusSnap?.lbasWaves ?? [],
      shipNames: this.aaciShipNames(),
    })
  }

  /**
   * Header: two rows.
   *
   *   Row 1: [map+cell+phase (left)] [rank+engagement (center)] [air state tag+CI (right)]
   *   Row 2: [friend formation vs enemy formation] [friend/enemy plane counts (right)]
   */
  @Builder PredictHeader(snap: BattleStatusSnapshot) {
    Column({ space: 0 }) {
      // Row 1: three-column layout for centering
      Row() {
        // Left: map location + cell + phase
        Row({ space: 4 }) {
          Text(`${snap.mapAreaId}-${snap.mapInfoNo}`)
            .fontSize(PanelDimens.fontLg)
            .fontWeight(FontWeight.Bold)
            .fontColor(PanelColors.txtPrimary)

          Text(snap.isBoss ? 'Boss' : `${snap.cellId}`)
            .fontSize(PanelDimens.fontSm)
            .fontColor(snap.isBoss ? '#FFD700' : PanelColors.txtSub)
            .padding({ left: 3, right: 3, top: 1, bottom: 1 })
            .backgroundColor(snap.isBoss ? '#3d2e00' : PanelColors.bgTabInactive)
            .borderRadius(2)

          Text(snap.isAirRaid ? '基地空襲' : phaseName(snap.battlePhase))
            .fontSize(PanelDimens.fontSm)
            .fontColor(snap.isAirRaid ? '#fb8c00' : PanelColors.txtSub)
            .fontWeight(snap.isAirRaid ? FontWeight.Bold : FontWeight.Normal)
        }
        .layoutWeight(1)
        .alignItems(VerticalAlign.Center)

        // Center: predicted rank + engagement (航向)
        Row({ space: 6 }) {
          // Text('预测')
          //   .fontSize(PanelDimens.fontSm)
          //   .fontColor(PanelColors.txtMuted)
          Text(displayRank(snap.predictedRank))
            .fontSize(22)
            .fontWeight(FontWeight.Bold)
            .fontColor(rankColor(snap.predictedRank))

          if (snap.engagement) {
            Text(engagementName(snap.engagement))
              .fontSize(PanelDimens.fontSm)
              .fontColor(engagementColor(snap.engagement))
              .fontWeight(FontWeight.Medium)
          }
        }
        .justifyContent(FlexAlign.Center)
        .alignItems(VerticalAlign.Center)

        // Right: air state tag (双击弹出航空战详情) + AACI
        Row({ space: 4 }) {
          if (snap.airState) {
            Text(airStateName(snap.airState))
              .fontSize(PanelDimens.fontSm)
              .fontColor(airStateColor(snap.airState))
              .fontWeight(FontWeight.Medium)
              .padding({ left: 4, right: 4, top: 1, bottom: 1 })
              .backgroundColor(PanelColors.bgTabInactive)
              .borderRadius(2)
              .gesture(
                TapGesture({ count: 2 })
                  .onAction(() => { this.aerialDetailOpen = !this.aerialDetailOpen; })
              )
              .bindPopup(this.aerialDetailOpen, {
                builder: this.AerialDetailPopup,
                placement: Placement.Bottom,
                enableArrow: true,
                onStateChange: (e: PanelPopupStateChangeEvent) => {
                  if (!e.isVisible && this.aerialDetailOpen) {
                    this.aerialDetailOpen = false;
                  }
                },
              })
          }

          if (snap.aaciTriggered) {
            Text('CI')
              .fontSize(PanelDimens.fontSm)
              .fontColor('#FFD700')
              .fontWeight(FontWeight.Bold)
              .padding({ left: 3, right: 3, top: 1, bottom: 1 })
              .backgroundColor('#3d2e00')
              .borderRadius(2)
          }
        }
        .layoutWeight(1)
        .justifyContent(FlexAlign.End)
        .alignItems(VerticalAlign.Center)
      }
      .width('100%')
      .height(34)
      .padding({ left: 10, right: 10 })
      .alignItems(VerticalAlign.Center)

      // Row 2: formation info + 残機数（我方绿 / 敌方红）
      Row({ space: 6 }) {
        Text(formationName(snap.friendFormation))
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.txtSub)
        Text('vs')
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.txtFainter)
        Text(formationName(snap.enemyFormation))
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.txtSub)

        Blank().layoutWeight(1)

        if (snap.friendPlaneMax !== undefined && snap.friendPlaneMax > 0) {
          Text(`自 ${snap.friendPlaneNow ?? 0}/${snap.friendPlaneMax}`)
            .fontSize(PanelDimens.fontSm)
            .fontColor(PanelColors.hpOk)
        }
        if (snap.enemyPlaneMax !== undefined && snap.enemyPlaneMax > 0) {
          Text(`敵 ${snap.enemyPlaneNow ?? 0}/${snap.enemyPlaneMax}`)
            .fontSize(PanelDimens.fontSm)
            .fontColor(PanelColors.hpCrit)
        }
      }
      .width('100%')
      .height(20)
      .padding({ left: 10, right: 10 })
      .alignItems(VerticalAlign.Center)
    }
    .width('100%')
    .backgroundColor(PanelColors.bgHeader)
    .borderWidth({ bottom: PanelDimens.borderW })
    .borderColor(PanelColors.rowBorder)
  }

  /** Taiha (critical damage) warning banner. */
  @Builder TaihaWarning(snap: BattleStatusSnapshot) {
    if (snap.hasTaihaRisk) {
      Row({ space: 4 }) {
        Text('⚠')
          .fontSize(PanelDimens.fontMd)
          .fontColor(PanelColors.hpCrit)
        Text('大破:')
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.hpCrit)
          .fontWeight(FontWeight.Bold)
        Text(snap.taihaShips.map(s => s.name).join('、'))
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.hpMid)
          .layoutWeight(1)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .width('100%')
      .height(22)
      .padding({ left: 10, right: 10 })
      .backgroundColor('#2d0e0e')
      .borderWidth({ bottom: PanelDimens.borderW })
      .borderColor(PanelColors.hpCrit)
      .alignItems(VerticalAlign.Center)
    }
  }

  /** Non-flagship sunk-risk warning banner. */
  @Builder SunkWarning(hasSunkRisk: boolean) {
    if (hasSunkRisk) {
      Row() {
        Text('⚠ 非旗艦撃沈风险：')
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.hpCrit)
      }
      .width('100%')
      .height(20)
      .padding({ left: 10, right: 8 })
      .backgroundColor('#1a0808')
      .alignItems(VerticalAlign.Center)
    }
  }

  /** A fleet's ship list (shared between prediction and result views). */
  @Builder FleetShipList(fleet: FleetBattleStatus, label: string, landBased: boolean = false, renderKey: string = '') {
    if (label) {
      Row() {
        Text(label)
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.txtFainter)
          .padding({ left: 10 })
      }
      .width('100%')
      .height(PanelDimens.listHdrH)
      .backgroundColor(PanelColors.bgHeader)
      .alignItems(VerticalAlign.Center)
      .borderWidth({ top: PanelDimens.borderW })
      .borderColor(PanelColors.rowBorder)
    }

      ForEach(fleet.ships, (ship: ShipBattleStatus) => {
        if (ship.hpMax > 0) {
          this.BattleShipRow(ship, landBased)
        }
    }, (ship: ShipBattleStatus) => `${renderKey}-bship-${ship.uid}-${ship.hpBefore}-${ship.hpAfter}-${ship.damageReceived}`)
  }

  /** Enemy fleet ship list with HP bars. */
  @Builder EnemyFleetList(enemy: EnemyBattleStatus, label: string, landBased: boolean = false, renderKey: string = '') {
    Row() {
      Text(label || '敵方')
        .fontSize(PanelDimens.fontSm)
        .fontColor(PanelColors.txtFainter)
        .padding({ left: 10 })
      Text(`${landBased ? '破壊' : '撃沈'} ${enemy.sunkCount}/${enemy.shipIds.length}`)
        .fontSize(PanelDimens.fontSm)
        .fontColor(PanelColors.txtMuted)
        .padding({ right: 10 })
        .layoutWeight(1)
        .textAlign(TextAlign.End)
    }
    .width('100%')
    .height(PanelDimens.listHdrH)
    .backgroundColor(PanelColors.bgHeader)
    .alignItems(VerticalAlign.Center)
    .borderWidth({ top: PanelDimens.borderW })
    .borderColor(PanelColors.rowBorder)

    ForEach(enemy.hpNow, (_: number, idx: number) => {
      if (enemy.hpMax[idx] > 0) {
        this.EnemyShipRow(
          idx,
          enemy.shipIds[idx] ?? 0,
          enemy.hpBefore[idx] ?? enemy.hpMax[idx],
          enemy.hpNow[idx] ?? 0,
          enemy.hpMax[idx],
          landBased
        )
      }
    }, (_: number, idx: number) => `${renderKey}-erow-${idx}-${enemy.hpBefore[idx] ?? 0}-${enemy.hpNow[idx] ?? 0}`)
  }

  // ── result view builders ───────────────────────────────────────────────────

  /**
   * Result header: actual rank (large, game-style), MVP, drop, base exp.
   *
   *   Row 1: [map+cell (left)] [rank letter (center, large+bold)] [air state (right)]
   *   Row 2: [MVP]  [drop]  [exp (right)]
   */
  @Builder ResultHeader(snap: BattleResultSnapshot) {
    Column({ space: 0 }) {
      // Row 1: three-column centering for rank
      Row() {
        // Left: map + cell
        Row({ space: 4 }) {
          Text(`${snap.mapAreaId}-${snap.mapInfoNo}`)
            .fontSize(PanelDimens.fontLg)
            .fontWeight(FontWeight.Bold)
            .fontColor(PanelColors.txtPrimary)

          Text(snap.isBoss ? 'Boss' : `${snap.cellId}`)
            .fontSize(PanelDimens.fontSm)
            .fontColor(snap.isBoss ? '#FFD700' : PanelColors.txtSub)
            .padding({ left: 3, right: 3, top: 1, bottom: 1 })
            .backgroundColor(snap.isBoss ? '#3d2e00' : PanelColors.bgTabInactive)
            .borderRadius(2)
        }
        .layoutWeight(1)
        .alignItems(VerticalAlign.Center)

        // Center: actual rank — large, game-style letter
        Row({ space: 3 }) {
          Text('戦果')
            .fontSize(PanelDimens.fontSm)
            .fontColor(PanelColors.txtMuted)
          Text(displayRank(snap.rank))
            .fontSize(32)
            .fontWeight(FontWeight.Bold)
            .fontColor(rankColor(snap.rank))
        }
        .justifyContent(FlexAlign.Center)
        .alignItems(VerticalAlign.Center)

        Blank().layoutWeight(1)
      }
      .width('100%')
      .height(44)
      .padding({ left: 10, right: 10 })
      .alignItems(VerticalAlign.Center)

      // Row 2: MVP + drop + base exp
      Row({ space: 8 }) {
        if (snap.mvp !== undefined) {
          Text(`MVP: ${snap.mvp}番艦`)
            .fontSize(PanelDimens.fontSm)
            .fontColor('#FFD700')
        }
        Text(snap.dropShipName ? `掉落: ${snap.dropShipName}` : '掉落: 无')
          .fontSize(PanelDimens.fontSm)
          .fontColor(snap.dropShipName ? PanelColors.hpOk : PanelColors.txtMuted)
        Blank().layoutWeight(1)
        if (snap.baseExp !== undefined) {
          Text(`経験+${snap.baseExp}`)
            .fontSize(PanelDimens.fontSm)
            .fontColor(PanelColors.stat)
        }
      }
      .width('100%')
      .height(22)
      .padding({ left: 10, right: 10 })
      .alignItems(VerticalAlign.Center)
    }
    .width('100%')
    .backgroundColor(PanelColors.bgHeader)
    .borderWidth({ bottom: PanelDimens.borderW })
    .borderColor(PanelColors.rowBorder)
  }

  // ── matchup layouts ────────────────────────────────────────────────────────
  //
  // Each layout is a single root component so it can be invoked from a
  // conditional branch as `this.LayoutXxx(...)`. Inlining these `Row`s
  // directly in `build()` confused the ArkTS preprocessor when a branch
  // contained multiple sibling components followed by chained modifiers,
  // producing many "Cannot find name 'width'" errors.

  /** Air raid: friend = land bases, enemy = aerial squadrons (both 陆基 terminology). */
  @Builder
  AirRaidLayout(friendMain: FleetBattleStatus, enemyMain: EnemyBattleStatus, renderKey: string) {
    Row() {
      Column() {
        this.FleetShipList(friendMain, '基地', true, renderKey)
      }
      .layoutWeight(1)
      .borderWidth({ right: PanelDimens.borderW })
      .borderColor(PanelColors.rowBorder)

      Column() {
        this.EnemyFleetList(enemyMain, '敵編隊', true, renderKey)
      }
      .layoutWeight(1)
    }
    .width('100%')
    .alignItems(VerticalAlign.Top)
  }

  /** Combined vs combined: 2 rows × 2 columns (friend main | escort, enemy escort | main). */
  @Builder
  CombinedVsCombinedLayout(
    friendMain: FleetBattleStatus,
    friendEscort: FleetBattleStatus,
    enemyMain: EnemyBattleStatus,
    enemyEscort: EnemyBattleStatus,
    renderKey: string,
  ) {
    Column() {
      Row() {
        Column() {
          this.FleetShipList(friendMain, '主力', false, renderKey)
        }
        .layoutWeight(1)
        .borderWidth({ right: PanelDimens.borderW })
        .borderColor(PanelColors.rowBorder)

        Column() {
          this.FleetShipList(friendEscort, '護衛', false, renderKey)
        }
        .layoutWeight(1)
      }
      .width('100%')
      .alignItems(VerticalAlign.Top)

      Row() {
        Column() {
          this.EnemyFleetList(enemyEscort, '敵護衛', false, renderKey)
        }
        .layoutWeight(1)
        .borderWidth({ right: PanelDimens.borderW })
        .borderColor(PanelColors.rowBorder)

        Column() {
          this.EnemyFleetList(enemyMain, '敵主力', false, renderKey)
        }
        .layoutWeight(1)
      }
      .width('100%')
      .alignItems(VerticalAlign.Top)
      .borderWidth({ top: 2 })
      .borderColor(PanelColors.rowBorder)
    }
    .width('100%')
  }

  /** Friend combined vs enemy single: 3 columns (friend main | friend escort | enemy). */
  @Builder
  FriendCombinedLayout(
    friendMain: FleetBattleStatus,
    friendEscort: FleetBattleStatus,
    enemyMain: EnemyBattleStatus,
    renderKey: string,
  ) {
    Row() {
      Column() {
        this.FleetShipList(friendMain, '主力', false, renderKey)
      }
      .layoutWeight(1)
      .borderWidth({ right: PanelDimens.borderW })
      .borderColor(PanelColors.rowBorder)

      Column() {
        this.FleetShipList(friendEscort, '護衛', false, renderKey)
      }
      .layoutWeight(1)
      .borderWidth({ right: PanelDimens.borderW })
      .borderColor(PanelColors.rowBorder)

      Column() {
        this.EnemyFleetList(enemyMain, '敵方', false, renderKey)
      }
      .layoutWeight(1)
    }
    .width('100%')
    .alignItems(VerticalAlign.Top)
  }

  /** Friend single vs enemy combined: 3 columns (friend | enemy escort | enemy main). */
  @Builder
  EnemyCombinedLayout(
    friendMain: FleetBattleStatus,
    enemyMain: EnemyBattleStatus,
    enemyEscort: EnemyBattleStatus,
    renderKey: string,
  ) {
    Row() {
      Column() {
        this.FleetShipList(friendMain, '我方', false, renderKey)
      }
      .layoutWeight(1)
      .borderWidth({ right: PanelDimens.borderW })
      .borderColor(PanelColors.rowBorder)

      Column() {
        this.EnemyFleetList(enemyEscort, '敵護衛', false, renderKey)
      }
      .layoutWeight(1)
      .borderWidth({ right: PanelDimens.borderW })
      .borderColor(PanelColors.rowBorder)

      Column() {
        this.EnemyFleetList(enemyMain, '敵主力', false, renderKey)
      }
      .layoutWeight(1)
    }
    .width('100%')
    .alignItems(VerticalAlign.Top)
  }

  /** Single vs single: 2 columns (friend | enemy). */
  @Builder
  SingleVsSingleLayout(friendMain: FleetBattleStatus, enemyMain: EnemyBattleStatus, renderKey: string) {
    Row() {
      Column() {
        this.FleetShipList(friendMain, '我方', false, renderKey)
      }
      .layoutWeight(1)
      .borderWidth({ right: PanelDimens.borderW })
      .borderColor(PanelColors.rowBorder)

      Column() {
        this.EnemyFleetList(enemyMain, '敵方', false, renderKey)
      }
      .layoutWeight(1)
    }
    .width('100%')
    .alignItems(VerticalAlign.Top)
  }

  /** Dispatcher: picks the right layout based on fleet composition / air-raid flag. */
  @Builder
  MatchupBody(
    friendMain: FleetBattleStatus,
    friendEscort: FleetBattleStatus | null,
    enemyMain: EnemyBattleStatus,
    enemyEscort: EnemyBattleStatus | null,
    isAirRaid: boolean,
    renderKey: string,
  ) {
    if (isAirRaid) {
      this.AirRaidLayout(friendMain, enemyMain, renderKey)
    } else if (friendEscort && hasFriendFleet(friendEscort) && enemyEscort && hasEnemyFleet(enemyEscort)) {
      this.CombinedVsCombinedLayout(friendMain, friendEscort, enemyMain, enemyEscort, renderKey)
    } else if (friendEscort && hasFriendFleet(friendEscort)) {
      this.FriendCombinedLayout(friendMain, friendEscort, enemyMain, renderKey)
    } else if (enemyEscort && hasEnemyFleet(enemyEscort)) {
      this.EnemyCombinedLayout(friendMain, enemyMain, enemyEscort, renderKey)
    } else {
      this.SingleVsSingleLayout(friendMain, enemyMain, renderKey)
    }
  }

  @Builder
  ResultContent() {
    if (this.resultSnap) {
      this.ResultHeader(this.resultSnap)

      Scroll() {
        Column() {
          if (this.viewFriendMain && this.viewEnemyMain) {
            this.MatchupBody(
              this.viewFriendMain,
              this.viewFriendEscort,
              this.viewEnemyMain,
              this.viewEnemyEscort,
              this.viewIsAirRaid,
              this.battleRenderKey,
            )
          }
        }
        .width('100%')
      }
      .layoutWeight(1)
      .align(Alignment.TopStart)
      .scrollBar(BarState.Off)
      .edgeEffect(EdgeEffect.None)
    }
  }

  @Builder
  StatusContent() {
    if (this.statusSnap) {
      this.PredictHeader(this.statusSnap)
      if (!this.statusSnap.isAirRaid) {
        this.TaihaWarning(this.statusSnap)
        this.SunkWarning(this.statusSnap.hasSunkRisk)
      }

      Scroll() {
        Column() {
          if (this.viewFriendMain && this.viewEnemyMain) {
            this.MatchupBody(
              this.viewFriendMain,
              this.viewFriendEscort,
              this.viewEnemyMain,
              this.viewEnemyEscort,
              this.viewIsAirRaid,
              this.battleRenderKey,
            )
          }
        }
        .width('100%')
      }
      .layoutWeight(1)
      .align(Alignment.TopStart)
      .scrollBar(BarState.Off)
      .edgeEffect(EdgeEffect.None)
    }
  }

  // ── main build ────────────────────────────────────────────────────────────

  build() {
    Column() {
      if (this.resultSnap) {
        // ── Result view ─────────────────────────────────────────────────
        ForEach([this.battleRenderKey], (_key: string) => {
          this.ResultContent()
        }, (key: string): string => key)

      } else if (this.statusSnap) {
        // ── Prediction view ──────────────────────────────────────────────
        ForEach([this.battleRenderKey], (_key: string) => {
          this.StatusContent()
        }, (key: string): string => key)

      } else {
        // ── Empty / loading ──────────────────────────────────────────────
        Column() {
          Text('NO BATTLE DATA')
            .fontSize(PanelDimens.fontMd)
            .fontColor(PanelColors.txtMuted)
        }
        .width('100%')
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(PanelColors.overlayBg)
    .backdropBlur(PanelDimens.overlayBlur)
    .clip(true)
  }
}
