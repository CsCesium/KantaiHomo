import { QuestSnapshot } from '../../../../../features/state';
import {
  PanelColors,
  PanelDimens,
  questCategoryStyle,
  questResetTypeLabel,
  questProgressLabel,
} from '../../../../../features/panel/panelConfig';
import { promptAction } from '@kit.ArkUI';

const QUEST_STATE_ACTIVE = 2;
const QUEST_STATE_COMPLETE = 3;

function questRowKey(quest: QuestSnapshot): string {
  return `quest-${quest.questId}-${quest.state}-${quest.progress ?? 0}-${quest.updatedAt}-${quest.capturedAt}`;
}

@ComponentV2
export default struct QuestPanel {
  @Param quests: QuestSnapshot[] = [];
  @Param compact: boolean = false;

  private visibleQuests(): QuestSnapshot[] {
    return this.quests.filter((q: QuestSnapshot) => q.state === QUEST_STATE_ACTIVE || q.state === QUEST_STATE_COMPLETE);
  }

  private categoryWidth(): number {
    return this.compact ? 38 : PanelDimens.avatarW;
  }

  private periodWidth(): number {
    return this.compact ? 40 : 72;
  }

  private progressWidth(): number {
    return this.compact ? 44 : 56;
  }

  private rowHeight(): number {
    return this.compact ? PanelDimens.rowCompH + 8 : PanelDimens.rowH;
  }

  private titleFontSize(): number {
    return this.compact ? PanelDimens.fontSm : PanelDimens.fontMd;
  }

  private progressFontSize(): number {
    return this.compact ? PanelDimens.fontSm : PanelDimens.fontMd;
  }

  private emptyTitleFontSize(): number {
    return this.compact ? PanelDimens.fontSm : PanelDimens.fontMd;
  }

  private showQuestDetail(quest: QuestSnapshot): void {
    const detailText = quest.detail || '无任务描述';
    const message = [
      `周期：${questResetTypeLabel(quest.type)}`,
      `进度：${questProgressLabel(quest.progress, quest.state)}`,
      '',
      detailText,
    ].join('\n');
    promptAction.showDialog({
      title: quest.title || '任务详情',
      message,
      buttons: [
        { text: '关闭', color: '#6A9AB5' },
      ],
    }).catch((_e: Error) => {});
  }

  @Builder private QuestRow(quest: QuestSnapshot): void {
    Row() {
      Column() {
        Text(questCategoryStyle(quest.category).label)
          .fontSize(this.titleFontSize())
          .fontWeight(FontWeight.Bold)
          .fontColor('#ffffff')
      }
      .width(this.categoryWidth())
      .height('100%')
      .backgroundColor(questCategoryStyle(quest.category).color)
      .justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Center)

      Text(questResetTypeLabel(quest.type))
        .fontSize(PanelDimens.fontSm)
        .fontColor(PanelColors.txtSub)
        .width(this.periodWidth())
        .textAlign(TextAlign.Center)

      Column({ space: 2 }) {
        Text(quest.title || '未命名任务')
          .fontSize(this.titleFontSize())
          .fontColor(PanelColors.txtPrimary)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })

        Text(quest.detail || '无任务描述')
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.txtSub)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .justifyContent(FlexAlign.Center)
      .layoutWeight(1)
      .padding({ left: this.compact ? 5 : 8, right: this.compact ? 5 : 8 })

      Text(questProgressLabel(quest.progress, quest.state))
        .fontSize(this.progressFontSize())
        .fontWeight(FontWeight.Medium)
        .fontColor(PanelColors.stat)
        .width(this.progressWidth())
        .textAlign(TextAlign.End)
        .padding({ right: this.compact ? 5 : 8 })
    }
    .width('100%')
    .height(this.rowHeight())
    .backgroundColor(PanelColors.bgSection)
    .borderWidth({ bottom: PanelDimens.borderW })
    .borderColor(PanelColors.rowBorder)
    .alignItems(VerticalAlign.Center)
    .onClick(() => { this.showQuestDetail(quest); })
  }

  @Builder private EmptyQuestState(): void {
    Column() {
      Text('没有任务数据')
        .fontSize(this.emptyTitleFontSize())
        .fontColor(PanelColors.txtMuted)
        .margin({ top: this.compact ? 16 : 24 })
      Text('打开任务列表以获得数据')
        .fontSize(PanelDimens.fontSm)
        .fontColor(PanelColors.txtFainter)
        .margin({ top: 6 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Center)
  }

  build() {
    Column() {
      if (this.visibleQuests().length > 0) {
        ForEach(this.visibleQuests(), (quest: QuestSnapshot) => {
          this.QuestRow(quest)
        }, (quest: QuestSnapshot) => questRowKey(quest))
      } else {
        this.EmptyQuestState()
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}
