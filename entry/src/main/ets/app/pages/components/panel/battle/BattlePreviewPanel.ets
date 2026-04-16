import { PanelColors, PanelDimens, hpColor } from '../../../../../features/panel/panelConfig';
import {
  subscribeGameState, getBattleStatus, getBattleResult,
  BattleStatusSnapshot, BattleResultSnapshot, ShipBattleStatus, FleetBattleStatus
} from '../../../../../features/state';
import { FormationNameJP, EngagementNameJP, Formation, Engagement } from '../../../../../domain/models';

// ── pure helpers (no ArkUI APIs) ──────────────────────────────────────────

function rankColor(rank: string): string {
  if (rank === 'S') return '#FFD700';
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
  if (ship.isChuuha) return PanelColors.hpWarn;
  return PanelColors.hpOk;
}

function enemyHpSummary(snap: BattleStatusSnapshot): string {
  const m = snap.enemyMain;
  const e = snap.enemyEscort;
  const nowTotal = m.hpNow.reduce((a: number, b: number) => a + b, 0)
    + (e ? e.hpNow.reduce((a: number, b: number) => a + b, 0) : 0);
  const maxTotal = m.hpMax.reduce((a: number, b: number) => a + b, 0)
    + (e ? e.hpMax.reduce((a: number, b: number) => a + b, 0) : 0);
  const sunk = m.sunkCount + (e ? e.sunkCount : 0);
  const total = m.shipIds.length + (e ? e.shipIds.length : 0);
  return `撃沈${sunk}/${total}  残${nowTotal}/${maxTotal}`;
}

// ── BattlePreviewPanel ────────────────────────────────────────────────────

/**
 * Battle preview panel — shown instead of the normal fleet panel while a
 * sortie battle is in progress or a battle result is waiting to be seen.
 *
 * Two display modes (switched automatically via GameState):
 *   Prediction  — status snapshot present, result absent:
 *                 predicted HP changes, estimated rank, taiha/sunk warnings.
 *   Result      — result snapshot present:
 *                 actual rank, MVP, drop info, final ship HP.
 *
 * Reverts to the normal panel when PanelHost detects that the battle state
 * has been cleared (sortie ended).
 */
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

  // ── instance builders ──────────────────────────────────────────────────────

  /**
   * Compact 2-line battle ship row.
   *
   *   name (flex)    beforeHP → afterHP  (-dmg)   [badge]
   *   [====HP bar (after ratio)====]
   */
  @Builder BattleShipRow(ship: ShipBattleStatus) {
    Column({ space: 2 }) {
      // Line 1: name | HP transition | damage | status badge
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

        if (ship.hpBefore > ship.hpAfter) {
          Text(`(-${ship.hpBefore - ship.hpAfter})`)
            .fontSize(PanelDimens.fontSm)
            .fontColor(PanelColors.hpCrit)
        }

        Text(shipBadgeText(ship))
          .fontSize(PanelDimens.fontSm)
          .fontColor(shipBadgeColor(ship))
          .fontWeight(FontWeight.Bold)
          .width(28)
          .textAlign(TextAlign.End)
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)

      // Line 2: HP bar showing the after-battle state
      Progress({
        value: ship.hpAfter,
        total: ship.hpMax > 0 ? ship.hpMax : 1,
        type: ProgressType.Linear
      })
        .width('100%')
        .height(PanelDimens.hpBarH)
        .color(hpColor(ship.hpAfter, ship.hpMax))
        .backgroundColor(PanelColors.bgHpTrack)
    }
    .width('100%')
    .padding({ left: 10, right: 10, top: 5, bottom: 5 })
    .borderWidth({ bottom: PanelDimens.borderW })
    .borderColor(PanelColors.rowBorder)
  }

  // ── prediction view builders ───────────────────────────────────────────────

  /** Header: map location, phase, formation, engagement, predicted rank. */
  @Builder PredictHeader(snap: BattleStatusSnapshot) {
    Column({ space: 0 }) {
      // Row 1: map + phase + predicted rank (right)
      Row({ space: 4 }) {
        Text(`${snap.mapAreaId}-${snap.mapInfoNo}`)
          .fontSize(PanelDimens.fontLg)
          .fontWeight(FontWeight.Bold)
          .fontColor(PanelColors.txtPrimary)

        Text(snap.isBoss ? 'Boss' : `${snap.cellId}点`)
          .fontSize(PanelDimens.fontSm)
          .fontColor(snap.isBoss ? '#FFD700' : PanelColors.txtSub)
          .padding({ left: 4, right: 4, top: 2, bottom: 2 })
          .backgroundColor(snap.isBoss ? '#3d2e00' : PanelColors.bgTabInactive)
          .borderRadius(2)

        Text(phaseName(snap.battlePhase))
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.txtSub)

        Blank().layoutWeight(1)

        Text('予測')
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.txtMuted)
        Text(snap.predictedRank)
          .fontSize(18)
          .fontWeight(FontWeight.Bold)
          .fontColor(rankColor(snap.predictedRank))
          .margin({ left: 2 })
      }
      .width('100%')
      .height(30)
      .padding({ left: 10, right: 10 })
      .alignItems(VerticalAlign.Center)

      // Row 2: friend formation vs enemy + engagement
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
        if (snap.engagement) {
          Text(engagementName(snap.engagement))
            .fontSize(PanelDimens.fontSm)
            .fontColor(engagementColor(snap.engagement))
            .fontWeight(FontWeight.Medium)
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
          .fontColor(PanelColors.hpWarn)
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

  /** Enemy HP/sunk summary footer. */
  @Builder EnemySummary(snap: BattleStatusSnapshot) {
    Row({ space: 6 }) {
      Text('敵')
        .fontSize(PanelDimens.fontSm)
        .fontColor(PanelColors.txtFainter)
      Text(enemyHpSummary(snap))
        .fontSize(PanelDimens.fontSm)
        .fontColor(PanelColors.txtMuted)
    }
    .width('100%')
    .height(22)
    .padding({ left: 10, right: 10 })
    .backgroundColor(PanelColors.bgHeader)
    .alignItems(VerticalAlign.Center)
    .borderWidth({ top: PanelDimens.borderW })
    .borderColor(PanelColors.rowBorder)
  }

  // ── result view builders ───────────────────────────────────────────────────

  /** Result header: actual rank, MVP, drop, base exp. */
  @Builder ResultHeader(snap: BattleResultSnapshot) {
    Column({ space: 0 }) {
      // Row 1: map location + actual rank (right)
      Row({ space: 6 }) {
        Text(`${snap.mapAreaId}-${snap.mapInfoNo}`)
          .fontSize(PanelDimens.fontLg)
          .fontWeight(FontWeight.Bold)
          .fontColor(PanelColors.txtPrimary)

        Text(snap.isBoss ? 'Boss' : `${snap.cellId}点`)
          .fontSize(PanelDimens.fontSm)
          .fontColor(snap.isBoss ? '#FFD700' : PanelColors.txtSub)
          .padding({ left: 4, right: 4, top: 2, bottom: 2 })
          .backgroundColor(snap.isBoss ? '#3d2e00' : PanelColors.bgTabInactive)
          .borderRadius(2)

        Blank().layoutWeight(1)

        Text('戦果')
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.txtMuted)
        Text(snap.rank)
          .fontSize(22)
          .fontWeight(FontWeight.Bold)
          .fontColor(rankColor(snap.rank))
          .margin({ left: 2 })
      }
      .width('100%')
      .height(34)
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
          }
          .width('100%')
        }
        .layoutWeight(1)
        .scrollBar(BarState.Off)
        .edgeEffect(EdgeEffect.None)

        this.EnemySummary(this.statusSnap)

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
