import { SlotItemJoinedRow } from '../../../../infra/storage/types';
import { kaisyuuIcon, airMasteryIcon, equipLabel, PanelColors } from '../../../../features/panel/panelConfig';

interface StatLine {
  label: string;
  value: number;
}

function buildStats(row: SlotItemJoinedRow): StatLine[] {
  const lines: StatLine[] = [];
  const push = (label: string, v: number | null | undefined): void => {
    if (v !== null && v !== undefined && v !== 0) {
      lines.push({ label, value: v });
    }
  };
  push('火力', row.mst_stat_firepower);
  push('雷装', row.mst_stat_torpedo);
  push('爆装', row.mst_stat_bomb);
  push('对空', row.mst_stat_aa);
  push('对潜', row.mst_stat_asw);
  push('索敌', row.mst_stat_los);
  push('命中', row.mst_stat_hit);
  push('回避', row.mst_stat_evasion);
  push('装甲', row.mst_stat_armor);
  push('射程', row.mst_range);
  return lines;
}

/**
 * Popup-style detail panel for an equipment slot.
 * Renders inside a `bindPopup` builder; the parent owns visibility state.
 */
@ComponentV2
export struct EquipDetailPanel {
  @Param row: SlotItemJoinedRow | null = null;

  build() {
    Column({ space: 6 }) {
      if (this.row) {
        // Header: icon + name
        Row({ space: 8 }) {
          Image(equipLabel(this.row.mst_typeIconId ?? 0))
            .width(22)
            .height(22)
            .padding(2)
            .backgroundColor('#252940')
            .borderRadius(3)
          Text(this.row.mst_name ?? '(unknown)')
            .fontSize(13)
            .fontWeight(FontWeight.Medium)
            .fontColor(PanelColors.txtPrimary)
            .layoutWeight(1)
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        .width('100%')
        .alignItems(VerticalAlign.Center)

        // Badges row: kaisyuu / proficiency
        if ((this.row.level ?? 0) > 0 || (this.row.alv ?? 0) > 0) {
          Row({ space: 6 }) {
            if ((this.row.level ?? 0) > 0) {
              Row({ space: 2 }) {
                if (kaisyuuIcon(this.row.level ?? 0) !== null) {
                  Image(kaisyuuIcon(this.row.level ?? 0)!)
                    .width(14)
                    .height(14)
                }
                Text(`★${this.row.level}`)
                  .fontSize(11)
                  .fontColor('#FFD56A')
              }
              .alignItems(VerticalAlign.Center)
            }
            if ((this.row.alv ?? 0) > 0) {
              Row({ space: 2 }) {
                if (airMasteryIcon(this.row.alv ?? 0) !== null) {
                  Image(airMasteryIcon(this.row.alv ?? 0)!)
                    .width(14)
                    .height(14)
                }
                Text(`熟${this.row.alv}`)
                  .fontSize(11)
                  .fontColor('#7DD3FC')
              }
              .alignItems(VerticalAlign.Center)
            }
          }
          .width('100%')
        }

        // Stats grid (2 columns)
        Column({ space: 3 }) {
          ForEach(buildStats(this.row), (stat: StatLine) => {
            Row() {
              Text(stat.label)
                .fontSize(11)
                .fontColor(PanelColors.txtSub)
                .width(40)
              Text(stat.value > 0 ? `+${stat.value}` : `${stat.value}`)
                .fontSize(11)
                .fontColor(stat.value > 0 ? PanelColors.stat : PanelColors.hpCrit)
                .layoutWeight(1)
                .textAlign(TextAlign.End)
            }
            .width('100%')
          }, (stat: StatLine) => `eq-stat-${stat.label}`)
        }
        .width('100%')

        Text('点击关闭')
          .fontSize(9)
          .fontColor(PanelColors.txtFainter)
          .width('100%')
          .textAlign(TextAlign.Center)
          .margin({ top: 4 })
      } else {
        Text('加载中…')
          .fontSize(11)
          .fontColor(PanelColors.txtMuted)
      }
    }
    .width(180)
    .padding(10)
    .backgroundColor('#1a1d2e')
    .borderRadius(8)
    .border({ width: 1, color: '#2e3355' })
  }
}
