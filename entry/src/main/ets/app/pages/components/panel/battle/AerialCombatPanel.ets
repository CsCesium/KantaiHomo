import { PanelColors, PanelDimens } from '../../../../../features/panel/panelConfig';
import { airStateName, airStateColor } from '../../../../../features/panel/airStateUi';
import { getSlotItemMasterName } from '../../../../../features/state';
import { AerialCombatInfo, AerialStageInfo, LbasWaveInfo } from '../../../../../domain/models';

/**
 * 航空战 / 对空状态详情面板 — 双击战斗预览头部的制空 tag 后在面板居中显示。
 *
 * 展示内容：
 * - 主舰队航空战 S1（制空争夺）/ S2（对空炮火）阶段双方机数
 * - 对空CI发动情况（发动舰、类型、使用装备）
 * - 接触机（双方）
 * - 陆航攻击各波次状态（基地、派出机数、S1/S2、接触）
 */
@ComponentV2
export default struct AerialCombatPanel {
  /** 主舰队航空战（api_kouku / api_kouku2 各一项） */
  @Param phases: AerialCombatInfo[] = [];
  /** 陆航攻击波次 */
  @Param lbasWaves: LbasWaveInfo[] = [];
  /** 友方舰名（主力+护卫顺序），用于解析对空CI发动舰 */
  @Param shipNames: string[] = [];

  private planeName(masterId: number): string {
    if (masterId <= 0) return '无';
    const name = getSlotItemMasterName(masterId);
    return name !== '' ? name : `#${masterId}`;
  }

  private aaciShipLabel(idx: number): string {
    const name = idx >= 0 && idx < this.shipNames.length ? this.shipNames[idx] : '';
    return name !== '' ? `${idx + 1}号舰 ${name}` : `${idx + 1}号舰`;
  }

  private aaciItemNames(ids: number[]): string {
    return ids.map((id: number): string => this.planeName(id)).join(' / ');
  }

  /** 单阶段机数行：我方(绿) / 敌方(红)，剩余机/初期机 */
  @Builder StageRow(label: string, stage: AerialStageInfo | undefined) {
    if (stage) {
      Row({ space: 8 }) {
        Text(label)
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.txtMuted)
          .width(26)
        Text(`我 ${Math.max(0, stage.friendCount - stage.friendLost)}/${stage.friendCount}`)
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.hpOk)
          .layoutWeight(1)
        Text(`敌 ${Math.max(0, stage.enemyCount - stage.enemyLost)}/${stage.enemyCount}`)
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.hpCrit)
          .layoutWeight(1)
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)
    }
  }

  /** 接触机行：0 表示无接触 */
  @Builder TouchRow(touchFriend: number, touchEnemy: number) {
    Row({ space: 8 }) {
      Text('接触')
        .fontSize(PanelDimens.fontSm)
        .fontColor(PanelColors.txtMuted)
        .width(26)
      Text(`我 ${this.planeName(touchFriend)}`)
        .fontSize(PanelDimens.fontSm)
        .fontColor(touchFriend > 0 ? PanelColors.hpOk : PanelColors.txtMuted)
        .layoutWeight(1)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
      Text(`敌 ${this.planeName(touchEnemy)}`)
        .fontSize(PanelDimens.fontSm)
        .fontColor(touchEnemy > 0 ? PanelColors.hpCrit : PanelColors.txtMuted)
        .layoutWeight(1)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
    }
    .width('100%')
    .alignItems(VerticalAlign.Center)
  }

  /** 主舰队单次航空战块：S1/S2 + 接触 + 对空CI */
  @Builder AerialPhaseBlock(p: AerialCombatInfo, idx: number) {
    Column({ space: 3 }) {
      Row({ space: 6 }) {
        Text(this.phases.length > 1 ? `航空战 第${idx + 1}次` : '航空战')
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.txtSub)
          .fontWeight(FontWeight.Medium)
        if (p.airState) {
          Text(airStateName(p.airState))
            .fontSize(PanelDimens.fontSm)
            .fontColor(airStateColor(p.airState))
            .fontWeight(FontWeight.Medium)
        }
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)

      this.StageRow('S1', p.stage1)
      this.StageRow('S2', p.stage2)
      this.TouchRow(p.touchFriend ?? 0, p.touchEnemy ?? 0)

      if (p.airFire) {
        Column({ space: 1 }) {
          Row({ space: 6 }) {
            Text('对空CI')
              .fontSize(PanelDimens.fontSm)
              .fontColor('#FFD700')
              .fontWeight(FontWeight.Bold)
            Text(this.aaciShipLabel(p.airFire.shipIdx))
              .fontSize(PanelDimens.fontSm)
              .fontColor(PanelColors.txtPrimary)
              .layoutWeight(1)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
            Text(`类型${p.airFire.kind}`)
              .fontSize(PanelDimens.fontSm)
              .fontColor(PanelColors.txtSub)
          }
          .width('100%')
          .alignItems(VerticalAlign.Center)

          if (p.airFire.useItemIds.length > 0) {
            Text(this.aaciItemNames(p.airFire.useItemIds))
              .fontSize(PanelDimens.fontSm)
              .fontColor(PanelColors.txtSub)
              .maxLines(2)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
              .width('100%')
          }
        }
        .width('100%')
        .alignItems(HorizontalAlign.Start)
      } else {
        Row({ space: 6 }) {
          Text('对空CI')
            .fontSize(PanelDimens.fontSm)
            .fontColor(PanelColors.txtMuted)
          Text('未发动')
            .fontSize(PanelDimens.fontSm)
            .fontColor(PanelColors.txtMuted)
        }
        .width('100%')
        .alignItems(VerticalAlign.Center)
      }
    }
    .width('100%')
    .padding(6)
    .backgroundColor(PanelColors.bgSection)
    .borderRadius(4)
    .alignItems(HorizontalAlign.Start)
  }

  /** 陆航单波次块：基地 + 派出机数 + 制空 + S1/S2 + 接触 */
  @Builder LbasWaveBlock(w: LbasWaveInfo, idx: number) {
    Column({ space: 3 }) {
      Row({ space: 6 }) {
        Text(`第${idx + 1}波`)
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.txtPrimary)
          .fontWeight(FontWeight.Medium)
        Text(`基地${w.baseId}`)
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.txtSub)
        if (w.squadronCounts.length > 0) {
          Text(`派出 ${w.squadronCounts.join('/')}机`)
            .fontSize(PanelDimens.fontSm)
            .fontColor(PanelColors.txtMuted)
        }
        Blank().layoutWeight(1)
        if (w.airState) {
          Text(airStateName(w.airState))
            .fontSize(PanelDimens.fontSm)
            .fontColor(airStateColor(w.airState))
            .fontWeight(FontWeight.Medium)
        }
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)

      this.StageRow('S1', w.stage1)
      this.StageRow('S2', w.stage2)
      if ((w.touchFriend ?? 0) > 0 || (w.touchEnemy ?? 0) > 0) {
        this.TouchRow(w.touchFriend ?? 0, w.touchEnemy ?? 0)
      }
    }
    .width('100%')
    .padding(6)
    .backgroundColor(PanelColors.bgSection)
    .borderRadius(4)
    .alignItems(HorizontalAlign.Start)
  }

  build() {
    Scroll() {
      Column({ space: 5 }) {
        Text('航空战 · 对空信息')
          .fontSize(PanelDimens.fontMd)
          .fontWeight(FontWeight.Bold)
          .fontColor(PanelColors.txtPrimary)

        if (this.phases.length === 0 && this.lbasWaves.length === 0) {
          Text('无航空战数据')
            .fontSize(PanelDimens.fontSm)
            .fontColor(PanelColors.txtMuted)
            .margin({ top: 4, bottom: 4 })
        }

        ForEach(this.phases, (p: AerialCombatInfo, idx: number) => {
          this.AerialPhaseBlock(p, idx)
        }, (_p: AerialCombatInfo, idx: number) => `aerial-${idx}`)

        if (this.lbasWaves.length > 0) {
          Text('基地航空队')
            .fontSize(PanelDimens.fontSm)
            .fontColor(PanelColors.txtFainter)
            .margin({ top: 2 })

          ForEach(this.lbasWaves, (w: LbasWaveInfo, idx: number) => {
            this.LbasWaveBlock(w, idx)
          }, (_w: LbasWaveInfo, idx: number) => `lbas-${idx}`)
        }
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)
    }
    .scrollBar(BarState.Off)
    .edgeEffect(EdgeEffect.None)
    .align(Alignment.TopStart)
    .width(260)
    .constraintSize({ maxHeight: '90%' })
    .padding(10)
    .backgroundColor(PanelColors.bg)
    .borderRadius(8)
    .border({ width: 1, color: PanelColors.bgInfoOn })
  }
}
