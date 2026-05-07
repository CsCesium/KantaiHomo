import { SlotItemJoinedRow } from '../../../../infra/storage/types';
import { getPersistDeps } from '../../../../infra/deps';
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
  push('索敵', row.mst_stat_los);
  push('命中', row.mst_stat_hit);
  push('回避', row.mst_stat_evasion);
  push('装甲', row.mst_stat_armor);
  push('射程', row.mst_range);
  return lines;
}

/**
 * Popup-style detail panel for an equipment slot.
 *
 * 接收装备 uid，内部按需异步加载 master+stat 数据并自管 @Local row。
 * 这样可以避免在 bindPopup 的 @Builder 里读取外部 @Local 时不重绘
 * （@Builder 注册到 popup 后对外部状态变更并不可靠地响应），改由
 * 子 @ComponentV2 自身的 @Local 驱动重渲染，确保从"加载中…"切到
 * 实际数据。
 */
@ComponentV2
export struct EquipDetailPanel {
  @Param uid: number = 0;

  @Local row: SlotItemJoinedRow | null = null;
  /** 标记当前正在加载的 uid，避免快速切换时旧响应覆盖新数据。 */
  private loadingForUid: number = 0;

  aboutToAppear(): void {
    if (this.uid > 0) void this.loadRow();
  }

  @Monitor('uid')
  onUidChange(): void {
    if (this.uid > 0) {
      void this.loadRow();
    } else {
      this.row = null;
      this.loadingForUid = 0;
    }
  }

  private async loadRow(): Promise<void> {
    const targetUid = this.uid;
    this.loadingForUid = targetUid;
    this.row = null;
    try {
      const repo = getPersistDeps()?.repos?.slotitem;
      if (!repo) return;
      const loaded = await repo.getWithMaster(targetUid);
      if (this.loadingForUid === targetUid && this.uid === targetUid) {
        this.row = loaded;
      }
    } catch (_e) { /* ignore */ }
  }

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
