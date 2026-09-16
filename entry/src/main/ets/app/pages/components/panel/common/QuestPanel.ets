import { QuestSnapshot, subscribeGameState } from '../../../../../features/state';
import { normalizeQuestText } from '../../../../../domain/models/normalizer/quest';
import { firstFleetSatisfiesQuest, initializeQuestTracking, questProgress, subscribeQuestTracking } from '../../../../../features/quests/service';
import {
  PanelColors,
  PanelDimens,
  questCategoryStyle,
  questResetTypeLabel,
  questProgressLabel,
} from '../../../../../features/panel/panelConfig';
import { promptAction } from '@kit.ArkUI';

const QUEST_STATE_ACTIVE = 2;

function questRowKey(quest: QuestSnapshot): string {
  return `quest-${quest.questId}-${quest.state}-${quest.progress ?? 0}-${quest.updatedAt}-${quest.capturedAt}`;
}

@ComponentV2
export default struct QuestPanel {
  @Param quests: QuestSnapshot[] = [];
  @Param compact: boolean = false;
  @Param includeCompleted: boolean = false;
  @Local revision: number = 0;
  private unsubscribeState: (() => void) | null = null;
  private unsubscribeTracking: (() => void) | null = null;
  private resetTimer: number = -1;

  aboutToAppear(): void {
    this.unsubscribeState = subscribeGameState((changeType) => {
      if (changeType === 'ships' || changeType === 'decks' || changeType === 'all') this.revision++;
    });
    this.unsubscribeTracking = subscribeQuestTracking(() => { this.revision++; });
    void initializeQuestTracking().catch((error: Error) => { console.warn('[QuestPanel]', String(error)); });
    this.resetTimer = setInterval(() => {
      void initializeQuestTracking().catch((error: Error) => { console.warn('[QuestPanel]', String(error)); });
    }, 60000);
  }

  aboutToDisappear(): void {
    this.unsubscribeState?.(); this.unsubscribeState = null;
    this.unsubscribeTracking?.(); this.unsubscribeTracking = null;
    if (this.resetTimer !== -1) clearInterval(this.resetTimer);
    this.resetTimer = -1;
  }

  private formationReady(quest: QuestSnapshot): boolean {
    return quest.state === QUEST_STATE_ACTIVE && firstFleetSatisfiesQuest(quest.questId);
  }

  private progressLabel(quest: QuestSnapshot): string {
    if (quest.state === 3) return questProgressLabel(quest.progress, quest.state);
    return questProgress(quest.questId)?.label ?? questProgressLabel(quest.progress, quest.state);
  }

  private visibleQuests(): QuestSnapshot[] {
    return this.quests.filter((q: QuestSnapshot) => q.state === QUEST_STATE_ACTIVE ||
      (this.includeCompleted && q.state === 3));
  }

  private categoryWidth(): number {
    return this.compact ? 38 : PanelDimens.avatarW;
  }

  private periodWidth(): number {
    return this.compact ? 40 : 72;
  }

  private progressWidth(): number {
    return this.compact ? 66 : 80;
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
    const detailText = normalizeQuestText(quest.detail || '无任务描述');
    const message = [
      `周期：${questResetTypeLabel(quest.type)}`,
      `进度：${questProgressLabel(quest.progress, quest.state)}`,
      ...(this.formationReady(quest) ? ['第一舰队满足编成要求 🆗（仅检查编成）'] : []),
      ...(questProgress(quest.questId) ? [questProgress(quest.questId)?.detail ?? ''] : []),
      '',
      detailText,
    ].join('\n');
    promptAction.showDialog({
      title: normalizeQuestText(quest.title || '任务详情'),
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
        Row({ space: 3 }) {
          Text(normalizeQuestText(quest.title || '未命名任务'))
            .fontSize(this.titleFontSize())
            .fontColor(PanelColors.txtPrimary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .layoutWeight(1)
          if (this.formationReady(quest)) {
            Text('🆗').fontSize(this.titleFontSize())
          }
        }
        .width('100%')

        Text(normalizeQuestText(quest.detail || '无任务描述'))
          .fontSize(PanelDimens.fontSm)
          .fontColor(PanelColors.txtSub)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .justifyContent(FlexAlign.Center)
      .layoutWeight(1)
      .padding({ left: this.compact ? 5 : 8, right: this.compact ? 5 : 8 })

      Text(this.progressLabel(quest))
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
      Text('当前没有已接取任务')
        .fontSize(this.emptyTitleFontSize())
        .fontColor(PanelColors.txtMuted)
        .margin({ top: this.compact ? 16 : 24 })
      Text('打开任务列表或接取任务以更新')
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
        }, (quest: QuestSnapshot) => `${questRowKey(quest)}-${this.revision}`)
      } else {
        this.EmptyQuestState()
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}
