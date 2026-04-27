import { PanelColors, PanelDimens, hpColor } from '../../../../../features/panel/panelConfig';
import {
  subscribeGameState, getBattleStatus, getBattleResult,
  BattleStatusSnapshot, BattleResultSnapshot, ShipBattleStatus, FleetBattleStatus,
  EnemyBattleStatus
} from '../../../../../features/state';
import { FormationNameJP, EngagementNameJP, Formation, Engagement } from '../../../../../domain/models';

// ── pure helpers (no ArkUI APIs) ──────────────────────────────────────────

function rankColor(rank: string): string {
  if (rank === 'SS' || rank === 'S') return '#FFD700';
  if (rank === 'A') return '#43a047';
  if (rank === 'B') return '#1e88e5';
  if (rank === 'C') return '#fdd835';
  if (rank === 'D') return '#fb8c00';
  return PanelColors.hpCrit;
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
  if (phase === 'night') return '夜戦';
  if (phase === 'day_to_night') return '昼夜';
  return '昼戦';
}

function airStateName(s: number | undefined): string {
  if (s === 1) return '確保';
  if (s === 2) return '優勢';
  if (s === 3) return '均衡';
  if (s === 4) return '劣勢';
  if (s === 5) return '喪失';
  return '';
}

function airStateColor(s: number | undefined): string {
  if (s === 1) return '#43a047';
  if (s === 2) return '#26c6da';
  if (s === 3) return PanelColors.txtSub;
  if (s === 4) return '#fb8c00';
  if (s === 5) return PanelColors.hpCrit;
  return PanelColors.txtMuted;
}

function shipBadgeText(ship: ShipBattleStatus): string {
  if (ship.isSunk) return '沈';
  if (ship.isTaiha) return '大破';
  if (ship.isChuuha) return '中破';
  if (ship.isShouha) return '小破';
  return '';
}

function shipBadgeColor(ship: ShipBattleStatus): string {
  if (ship.isSunk) return PanelColors.txtMuted;
  if (ship.isTaiha) return PanelColors.hpCrit;
  if (ship.isChuuha) return PanelColors.hpMid;
  return PanelColors.hpOk;
}

function enemyBadgeText(hpNow: number, hpMax: number): string {
  if (hpNow <= 0) return '沈';
  const r = hpMax > 0 ? hpNow / hpMax : 1;
  if (r <= 0.25) return '大破';
  if (r <= 0.5) return '中破';
  if (r <= 0.75) return '小破';
  return '';
}

function enemyBadgeColor(hpNow: number, hpMax: number): string {
  if (hpNow <= 0) return PanelColors.txtMuted;
  return hpColor(hpNow, hpMax);
}

// ── BattlePreviewPanel ────────────────────────────────────────────────────

@ComponentV2
export default struct BattlePreviewPanel {
  @Local statusSnap: BattleStatusSnapshot | null = null;
  @Local resultSnap: BattleResultSnapshot | null = null;

  private unsubscribe: (() => void) | null = null;

  aboutToAppear(): void {
    this.statusSnap = getBattleStatus();
    this.resultSnap = getBattleResult();
    this.unsubscribe = subscribeGameState((changeType, _state) => {
      if (changeType === 'battle' || changeType === 'all') {
        this.statusSnap = getBattleStatus();
        this.resultSnap = getBattleResult();
      }
    });
  }

  aboutToDisappear(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
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
        Progress({
          value: hpAfter > 0 ? hpAfter : 0,
          total: hpMax > 0 ? hpMax : 1,
          type: ProgressType.Linear
        })
          .width('100%')
          .height(PanelDimens.hpBarH)
          .color(hpColor(hpAfter, hpMax))
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
  @Builder BattleShipRow(ship: ShipBattleStatus) {
    Column({ space: 2 }) {
      // Line 1: name | HP transition | status badge
      Row({ space: 3 }) {
        Text(ship.name)
          .fontSize(PanelDimens.fontMd)
          .fontColor(ship.isSunk ? PanelColors.txtMuted : PanelColors.txtPrimary)
          .layoutWeight(1)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .decoration({
            type: ship.isSunk ? TextDecorationType.LineThrough : TextDecorationType.None
          })

        Text(`${ship.hpBefore}→${ship.hpAfter}`)
          .fontSize(PanelDimens.fontSm)
          .fontColor(hpColor(ship.hpAfter, ship.hpMax))

        Text(shipBadgeText(ship))
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
    .padding({ left: 10, right: 10, top: 5, bottom: 5 })
    .borderWidth({ bottom: PanelDimens.borderW })
    .borderColor(PanelColors.rowBorder)
  }

  // ── Enemy ship row ────────────────────────────────────────────────────────

  /**
   * Compact 2-line enemy ship row.
   *
   *   敵N (idx)   beforeHP→afterHP   [badge]
   *   [-dmg]      [====HP bar====]
   */
  @Builder EnemyShipRow(idx: number, hpBefore: number, hpAfter: number, hpMax: number) {
    Column({ space: 2 }) {
      Row({ space: 3 }) {
        Text(`敵${idx + 1}`)
          .fontSize(PanelDimens.fontMd)
          .fontColor(hpAfter <= 0 ? PanelColors.txtMuted : PanelColors.txtSub)
          .layoutWeight(1)
          .decoration({
            type: hpAfter <= 0 ? TextDecorationType.LineThrough : TextDecorationType.None
          })

        Text(`${hpBefore}→${hpAfter > 0 ? hpAfter : 0}`)
          .fontSize(PanelDimens.fontSm)
          .fontColor(hpColor(hpAfter, hpMax))

        Text(enemyBadgeText(hpAfter, hpMax))
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
    .padding({ left: 10, right: 10, top: 5, bottom: 5 })
    .borderWidth({ bottom: PanelDimens.borderW })
    .borderColor(PanelColors.rowBorder)
  }

  // ── prediction view builders ───────────────────────────────────────────────

  /**
   * Header: two rows.
   *
   *   Row 1: [map+cell+phase (left)] [rank+engagement (center)] [air state+CI (right)]
   *   Row 2: [friend formation vs enemy formation]
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

          Text(phaseName(snap.battlePhase))
            .fontSize(PanelDimens.fontSm)
            .fontColor(PanelColors.txtSub)
        }
        .layoutWeight(1)
        .alignItems(VerticalAlign.Center)

        // Center: predicted rank + engagement (航向)
        Row({ space: 6 }) {
          // Text('预测')
          //   .fontSize(PanelDimens.fontSm)
          //   .fontColor(PanelColors.txtMuted)
          Text(snap.predictedRank)
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

        // Right: air state + plane count + AACI
        Row({ space: 4 }) {
          if (snap.airState) {
            Text(airStateName(snap.airState))
              .fontSize(PanelDimens.fontSm)
              .fontColor(airStateColor(snap.airState))
              .fontWeight(FontWeight.Medium)
          }

          if (snap.friendPlaneMax !== undefined && snap.friendPlaneMax > 0) {
            Text(`✈${snap.friendPlaneNow ?? 0}/${snap.friendPlaneMax}`)
              .fontSize(PanelDimens.fontSm)
              .fontColor(PanelColors.txtSub)
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

      // Row 2: formation info
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
  @Builder SunkWarning() {
    Row() {
      Text('⚠ 非旗艦撃沈リスク')
        .fontSize(PanelDimens.fontSm)
        .fontColor(PanelColors.hpCrit)
    }
    .width('100%')
    .height(20)
    .padding({ left: 10, right: 8 })
    .backgroundColor('#1a0808')
    .alignItems(VerticalAlign.Center)
  }

  /** A fleet's ship list (shared between prediction and result views). */
  @Builder FleetShipList(fleet: FleetBattleStatus, label: string) {
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
    }

    ForEach(fleet.ships, (ship: ShipBattleStatus) => {
      this.BattleShipRow(ship)
    }, (ship: ShipBattleStatus) => `bship-${ship.uid}`)
  }

  /** Enemy fleet ship list with HP bars. */
  @Builder EnemyFleetList(enemy: EnemyBattleStatus, label: string) {
    Row() {
      Text(label || '敵方')
        .fontSize(PanelDimens.fontSm)
        .fontColor(PanelColors.txtFainter)
        .padding({ left: 10 })
      Text(`撃沈 ${enemy.sunkCount}/${enemy.shipIds.length}`)
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
          enemy.hpBefore[idx] ?? enemy.hpMax[idx],
          enemy.hpNow[idx] ?? 0,
          enemy.hpMax[idx]
        )
      }
    }, (_: number, idx: number) => `erow-${idx}`)
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
          Text(snap.rank)
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
        Text(snap.dropShipName ? `ドロップ: ${snap.dropShipName}` : 'ドロップ: なし')
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

  // ── main build ────────────────────────────────────────────────────────────

  build() {
    Column() {
      if (this.resultSnap) {
        // ── Result view ─────────────────────────────────────────────────
        this.ResultHeader(this.resultSnap)

        Scroll() {
          Column() {
            this.FleetShipList(
              this.resultSnap.friendMain,
              this.resultSnap.friendEscort ? '主力' : ''
            )
            if (this.resultSnap.friendEscort) {
              this.FleetShipList(this.resultSnap.friendEscort, '護衛')
            }
            this.EnemyFleetList(this.resultSnap.enemyMain, '敵主力')
            if (this.resultSnap.enemyEscort) {
              this.EnemyFleetList(this.resultSnap.enemyEscort, '敵護衛')
            }
          }
          .width('100%')
        }
        .layoutWeight(1)
        .scrollBar(BarState.Off)
        .edgeEffect(EdgeEffect.None)

      } else if (this.statusSnap) {
        // ── Prediction view ──────────────────────────────────────────────
        this.PredictHeader(this.statusSnap)
        this.TaihaWarning(this.statusSnap)
        if (this.statusSnap.hasSunkRisk) {
          this.SunkWarning()
        }

        Scroll() {
          Column() {
            this.FleetShipList(
              this.statusSnap.friendMain,
              this.statusSnap.friendEscort ? '主力' : ''
            )
            if (this.statusSnap.friendEscort) {
              this.FleetShipList(this.statusSnap.friendEscort, '護衛')
            }
            this.EnemyFleetList(this.statusSnap.enemyMain, '敵主力')
            if (this.statusSnap.enemyEscort) {
              this.EnemyFleetList(this.statusSnap.enemyEscort, '敵護衛')
            }
          }
          .width('100%')
        }
        .layoutWeight(1)
        .scrollBar(BarState.Off)
        .edgeEffect(EdgeEffect.None)

      } else {
        // ── Empty / loading ──────────────────────────────────────────────
        Column() {
          Text('戦闘データなし')
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
    .backgroundColor(PanelColors.bg)
    .clip(true)
  }
}
