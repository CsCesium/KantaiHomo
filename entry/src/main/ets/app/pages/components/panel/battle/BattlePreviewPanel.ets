import { PanelColors, PanelDimens, hpColor } from '../../../../../features/panel/panelConfig';
import {
  subscribeGameState, getBattleStatus, getBattleResult,
  BattleStatusSnapshot, BattleResultSnapshot, ShipBattleStatus, FleetBattleStatus,
  EnemyBattleStatus, getShipMasterName
} from '../../../../../features/state';
import { FormationNameJP, EngagementNameJP, Formation, Engagement } from '../../../../../domain/models';

// ── pure helpers ──────────────────────────────────────────────────────────────

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
  if (e === 3) return '#43a047';
  if (e === 4) return PanelColors.hpCrit;
  if (e === 2) return PanelColors.hpWarn;
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
  if (ship.isChuuha) return '#f57c00';
  return PanelColors.hpOk;
}

function friendHpBarColor(ship: ShipBattleStatus): string {
  if (ship.isSunk) return 'transparent';
  if (ship.isTaiha) return PanelColors.hpCrit;
  if (ship.isChuuha) return '#f57c00';
  return PanelColors.hpOk;
}

function airStateShort(s: number): string {
  if (s === 1) return '確保';
  if (s === 2) return '優勢';
  if (s === 3) return '劣勢';
  if (s === 4) return '喪失';
  return '均衡';
}

function airStateColor(s: number): string {
  if (s === 1) return '#43a047';
  if (s === 2) return '#7cb342';
  if (s === 3) return PanelColors.hpWarn;
  if (s === 4) return PanelColors.hpCrit;
  return PanelColors.txtSub;
}

function enemyName(masterId: number): string {
  return getShipMasterName(masterId) ?? `#${masterId}`;
}

// ── paired-row model ──────────────────────────────────────────────────────────

interface PairedRow {
  rowIndex: number;
  friendShip?: ShipBattleStatus;
  enemyMasterId?: number;
  enemyHpStart: number;
  enemyHpNow: number;
  enemyHpMax: number;
}

function buildPairedRows(friend: FleetBattleStatus, enemy: EnemyBattleStatus): PairedRow[] {
  const maxLen = Math.max(friend.ships.length, enemy.shipIds.length);
  const rows: PairedRow[] = [];
  for (let i = 0; i < maxLen; i++) {
    const hpMax = i < enemy.hpMax.length ? enemy.hpMax[i] : 0;
    rows.push({
      rowIndex: i,
      friendShip: i < friend.ships.length ? friend.ships[i] : undefined,
      enemyMasterId: i < enemy.shipIds.length ? enemy.shipIds[i] : undefined,
      enemyHpStart: i < (enemy.hpStart?.length ?? 0)
        ? (enemy.hpStart![i] ?? hpMax)
        : hpMax,
      enemyHpNow: i < enemy.hpNow.length ? enemy.hpNow[i] : 0,
      enemyHpMax: hpMax,
    });
  }
  return rows;
}

const EMPTY_ENEMY: EnemyBattleStatus = { shipIds: [], hpStart: [], hpNow: [], hpMax: [], sunkCount: 0 };

// ── BattlePreviewPanel ────────────────────────────────────────────────────────

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

  // ── Custom HP bar with 1/2 and 1/4 threshold markers ─────────────────────

  @Builder HpBar(hpNow: number, hpMax: number, barColor: string) {
    Stack({ alignContent: Alignment.TopStart }) {
      Row()
        .width('100%')
        .height(PanelDimens.hpBarH)
        .backgroundColor(PanelColors.bgHpTrack)

      if (hpMax > 0 && hpNow > 0) {
        Row()
          .width(`${Math.min(100, Math.round(hpNow / hpMax * 100))}%`)
          .height(PanelDimens.hpBarH)
          .backgroundColor(barColor)
      }

      // 50% marker
      Row()
        .width(1)
        .height(PanelDimens.hpBarH + 2)
        .backgroundColor('#60ffffff')
        .position({ x: '50%', y: -1 })

      // 25% marker
      Row()
        .width(1)
        .height(PanelDimens.hpBarH + 2)
        .backgroundColor('#60ffffff')
        .position({ x: '25%', y: -1 })
    }
    .width('100%')
    .height(PanelDimens.hpBarH)
  }

  // ── Friend ship half-row ──────────────────────────────────────────────────

  @Builder FriendShipHalf(ship: ShipBattleStatus) {
    Column({ space: 1 }) {
      Row({ space: 2 }) {
        Text(ship.name)
          .fontSize(PanelDimens.fontMd)
          .fontColor(ship.isSunk ? PanelColors.txtMuted : PanelColors.txtPrimary)
          .layoutWeight(1)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .decoration({ type: ship.isSunk ? TextDecorationType.LineThrough : TextDecorationType.None })

        if (!ship.isSunk) {
          Text(`${ship.hpBefore}→${ship.hpAfter}`)
            .fontSize(PanelDimens.fontSm)
            .fontColor(hpColor(ship.hpAfter, ship.hpMax))
        }

        Text(shipBadgeText(ship))
          .fontSize(PanelDimens.fontSm)
          .fontColor(shipBadgeColor(ship))
          .fontWeight(FontWeight.Bold)
          .width(22)
          .textAlign(TextAlign.End)
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)

      Row({ space: 2 }) {
        if (ship.damageReceived > 0) {
          Text(`-${ship.damageReceived}`)
            .fontSize(PanelDimens.fontSm)
            .fontColor(ship.isTaiha ? PanelColors.hpCrit : ship.isChuuha ? '#f57c00' : PanelColors.txtMuted)
            .width(24)
            .textAlign(TextAlign.End)
        } else {
          Row().width(24)
        }
        this.HpBar(ship.isSunk ? 0 : ship.hpAfter, ship.hpMax, friendHpBarColor(ship))
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)
    }
    .width('100%')
    .padding({ left: 6, right: 4, top: 4, bottom: 4 })
  }

  // ── Enemy ship half-row ───────────────────────────────────────────────────

  @Builder EnemyShipHalf(masterId: number, hpStart: number, hpNow: number, hpMax: number) {
    const dmg = Math.max(0, hpStart - hpNow);
    const isSunk = hpNow <= 0;
    Column({ space: 1 }) {
      Row({ space: 2 }) {
        Text(enemyName(masterId))
          .fontSize(PanelDimens.fontMd)
          .fontColor(isSunk ? PanelColors.txtMuted : PanelColors.txtSub)
          .layoutWeight(1)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .decoration({ type: isSunk ? TextDecorationType.LineThrough : TextDecorationType.None })

        if (!isSunk) {
          Text(`${hpNow}/${hpMax}`)
            .fontSize(PanelDimens.fontSm)
            .fontColor(hpColor(hpNow, hpMax))
        } else {
          Text('沈')
            .fontSize(PanelDimens.fontSm)
            .fontColor(PanelColors.txtMuted)
            .fontWeight(FontWeight.Bold)
        }
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)

      Row({ space: 2 }) {
        if (dmg > 0) {
          Text(`-${dmg}`)
            .fontSize(PanelDimens.fontSm)
            .fontColor(PanelColors.hpCrit)
            .width(24)
            .textAlign(TextAlign.End)
        } else {
          Row().width(24)
        }
        this.HpBar(isSunk ? 0 : hpNow, hpMax, hpColor(hpNow, hpMax))
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)
    }
    .width('100%')
    .padding({ left: 4, right: 6, top: 4, bottom: 4 })
  }

  // ── Paired fleet section (friend | enemy) ─────────────────────────────────

  @Builder PairedFleetSection(friend: FleetBattleStatus, enemy: EnemyBattleStatus, label: string) {
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

    ForEach(buildPairedRows(friend, enemy), (row: PairedRow) => {
      Row() {
        Column() {
          if (row.friendShip) {
            this.FriendShipHalf(row.friendShip)
          } else {
            Row().width('100%').height(46)
          }
        }
        .layoutWeight(1)

        Row()
          .width(0.5)
          .backgroundColor(PanelColors.rowBorder)
          .alignSelf(ItemAlign.Stretch)

        Column() {
          if (row.enemyMasterId !== undefined) {
            this.EnemyShipHalf(row.enemyMasterId, row.enemyHpStart, row.enemyHpNow, row.enemyHpMax)
          } else {
            Row().width('100%').height(46)
          }
        }
        .layoutWeight(1)
      }
      .width('100%')
      .alignItems(VerticalAlign.Top)
      .borderWidth({ bottom: PanelDimens.borderW })
      .borderColor(PanelColors.rowBorder)
    }, (row: PairedRow) => `pair-${row.rowIndex}-${row.friendShip?.uid ?? 0}-${row.enemyMasterId ?? 0}`)
  }

  // ── Prediction header ─────────────────────────────────────────────────────

  @Builder PredictHeader(snap: BattleStatusSnapshot) {
    Column({ space: 0 }) {
      // Row 1: [map+boss+phase (left)] [予測+rank (center)] [✈ aircraft+CI (right)]
      Row() {
        Row({ space: 3 }) {
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

        Row({ space: 2 }) {
          Text('予測')
            .fontSize(PanelDimens.fontSm)
            .fontColor(PanelColors.txtMuted)
          Text(snap.predictedRank)
            .fontSize(20)
            .fontWeight(FontWeight.Bold)
            .fontColor(rankColor(snap.predictedRank))
        }
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
        .alignItems(VerticalAlign.Center)

        Row({ space: 3 }) {
          if (snap.aircraftFriend) {
            Text(`✈ ${snap.aircraftFriend.remaining}/${snap.aircraftFriend.count}`)
              .fontSize(PanelDimens.fontSm)
              .fontColor(PanelColors.stat)
          }
          if (snap.hasAaci) {
            Text('CI')
              .fontSize(PanelDimens.fontSm)
              .fontColor('#FFD700')
              .fontWeight(FontWeight.Bold)
              .padding({ left: 3, right: 3, top: 1, bottom: 1 })
              .backgroundColor('#2d2600')
              .borderRadius(2)
          }
        }
        .layoutWeight(1)
        .justifyContent(FlexAlign.End)
        .alignItems(VerticalAlign.Center)
      }
      .width('100%')
      .height(28)
      .padding({ left: 10, right: 10 })
      .alignItems(VerticalAlign.Center)

      // Row 2: [formations (left)] [engagement (center)] [air state (right)]
      Row() {
        Row({ space: 3 }) {
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
        .layoutWeight(1)
        .alignItems(VerticalAlign.Center)

        Row() {
          if (snap.engagement) {
            Text(engagementName(snap.engagement))
              .fontSize(PanelDimens.fontSm)
              .fontColor(engagementColor(snap.engagement))
              .fontWeight(FontWeight.Medium)
          }
        }
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
        .alignItems(VerticalAlign.Center)

        Row() {
          if (snap.airState !== undefined) {
            Text(airStateShort(snap.airState))
              .fontSize(PanelDimens.fontSm)
              .fontColor(airStateColor(snap.airState))
          }
        }
        .layoutWeight(1)
        .justifyContent(FlexAlign.End)
        .alignItems(VerticalAlign.Center)
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

  // ── Result header ─────────────────────────────────────────────────────────

  @Builder ResultHeader(snap: BattleResultSnapshot) {
    Column({ space: 0 }) {
      // Row 1: [map+boss (left)] [戦果+rank (center)] [exp (right)]
      Row() {
        Row({ space: 3 }) {
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

        Row({ space: 2 }) {
          Text('戦果')
            .fontSize(PanelDimens.fontSm)
            .fontColor(PanelColors.txtMuted)
          Text(snap.rank)
            .fontSize(22)
            .fontWeight(FontWeight.Bold)
            .fontColor(rankColor(snap.rank))
        }
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
        .alignItems(VerticalAlign.Center)

        Row() {
          if (snap.baseExp !== undefined) {
            Text(`+${snap.baseExp}exp`)
              .fontSize(PanelDimens.fontSm)
              .fontColor(PanelColors.stat)
          }
        }
        .layoutWeight(1)
        .justifyContent(FlexAlign.End)
        .alignItems(VerticalAlign.Center)
      }
      .width('100%')
      .height(30)
      .padding({ left: 10, right: 10 })
      .alignItems(VerticalAlign.Center)

      // Row 2: MVP + drop
      Row({ space: 8 }) {
        if (snap.mvp !== undefined) {
          Text(`MVP: ${snap.mvp}番艦`)
            .fontSize(PanelDimens.fontSm)
            .fontColor('#FFD700')
        }
        if (snap.dropShipName) {
          Text(`⬇ ${snap.dropShipName}`)
            .fontSize(PanelDimens.fontSm)
            .fontColor(PanelColors.hpOk)
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

  // ── Warning banners ───────────────────────────────────────────────────────

  @Builder TaihaWarning(snap: BattleStatusSnapshot) {
    if (snap.hasTaihaRisk) {
      Row({ space: 4 }) {
        Text('⚠ 大破:')
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
      .height(20)
      .padding({ left: 10, right: 10 })
      .backgroundColor('#2d0e0e')
      .borderWidth({ bottom: PanelDimens.borderW })
      .borderColor(PanelColors.hpCrit)
      .alignItems(VerticalAlign.Center)
    }
  }

  @Builder SunkWarning() {
    Row() {
      Text('⚠ 非旗艦撃沈リスク')
        .fontSize(PanelDimens.fontSm)
        .fontColor(PanelColors.hpCrit)
    }
    .width('100%')
    .height(18)
    .padding({ left: 10, right: 8 })
    .backgroundColor('#1a0808')
    .alignItems(VerticalAlign.Center)
  }

  // ── Main build ────────────────────────────────────────────────────────────

  build() {
    Column() {
      if (this.resultSnap) {
        this.ResultHeader(this.resultSnap)

        Scroll() {
          Column() {
            this.PairedFleetSection(
              this.resultSnap.friendMain,
              this.resultSnap.enemyMain,
              this.resultSnap.friendEscort ? '主力' : ''
            )
            if (this.resultSnap.friendEscort) {
              this.PairedFleetSection(
                this.resultSnap.friendEscort,
                this.resultSnap.enemyEscort ?? EMPTY_ENEMY,
                '護衛'
              )
            }
          }
          .width('100%')
        }
        .layoutWeight(1)
        .scrollBar(BarState.Off)
        .edgeEffect(EdgeEffect.None)

      } else if (this.statusSnap) {
        this.PredictHeader(this.statusSnap)
        this.TaihaWarning(this.statusSnap)
        if (this.statusSnap.hasSunkRisk) {
          this.SunkWarning()
        }

        Scroll() {
          Column() {
            this.PairedFleetSection(
              this.statusSnap.friendMain,
              this.statusSnap.enemyMain,
              this.statusSnap.friendEscort ? '主力' : ''
            )
            if (this.statusSnap.friendEscort) {
              this.PairedFleetSection(
                this.statusSnap.friendEscort,
                this.statusSnap.enemyEscort ?? EMPTY_ENEMY,
                '護衛'
              )
            }
          }
          .width('100%')
        }
        .layoutWeight(1)
        .scrollBar(BarState.Off)
        .edgeEffect(EdgeEffect.None)

      } else {
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
