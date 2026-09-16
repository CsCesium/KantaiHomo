import { QuestSnapshot, subscribeGameState } from '../../../../../features/state';
import { normalizeQuestText } from '../../../../../domain/models/normalizer/quest';
import { firstFleetSatisfiesQuest, initializeQuestTracking, questProgress, subscribeQuestTracking } from '../../../../../features/quests/service';
import { QuestGoalProgress } from '../../../../../features/quests/types';
import {
  PanelColors,
  PanelDimens,
  questCategoryStyle,
  questResetTypeLabel,
  questProgressLabel,
} from '../../../../../features/panel/panelConfig';

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
  @Local detailVisible: boolean = false;
  @Local detailQuest: QuestSnapshot | null = null;
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
    this.detailVisible = false;
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

  private progressColor(quest: QuestSnapshot): string {
    return quest.state === 3 || questProgress(quest.questId)?.anySatisfied ?
      PanelColors.questSatisfied : PanelColors.stat;
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
    this.detailQuest = quest;
    this.detailVisible = true;
  }

  @Builder private QuestDetailSheet(revision: number): void {
    if (this.detailQuest) {
      this.QuestDetailContent(this.quests.find((quest: QuestSnapshot) => quest.questId === this.detailQuest?.questId) ??
        this.detailQuest, revision)
    }
  }

  @Builder private QuestDetailContent(quest: QuestSnapshot, revision: number): void {
    Column({ space: 16 }) {
      Text(`${this.formationReady(quest) ? '🆗 ' : ''}${normalizeQuestText(quest.title || '任务详情')}`)
        .fontSize(20)
        .fontWeight(FontWeight.Bold)
        .fontColor(PanelColors.txtPrimary)
        .width('100%')
        .padding({ right: 30 })

      Row({ space: 12 }) {
        Text(`周期：${questResetTypeLabel(quest.type)}`)
          .fontSize(14)
          .fontWeight(FontWeight.Bold)
          .fontColor(PanelColors.txtPrimary)
          .padding({ left: 12, right: 12, top: 6, bottom: 6 })
          .backgroundColor(PanelColors.bgInfoOn)
          .borderRadius(8)
        Text(questProgressLabel(quest.progress, quest.state))
          .fontSize(14)
          .fontColor(quest.state === 3 ? PanelColors.questSatisfied : PanelColors.txtSub)
      }
      .width('100%')

      Scroll() {
        Column({ space: 18 }) {
          if (questProgress(quest.questId)) {
            Column({ space: 12 }) {
              Row() {
                Text('任务计数').fontSize(16).fontWeight(FontWeight.Bold).fontColor(PanelColors.txtPrimary)
                Blank()
                Text(questProgress(quest.questId)?.label ?? '')
                  .fontSize(28)
                  .fontWeight(FontWeight.Bold)
                  .fontColor(this.progressColor(quest))
              }
              .width('100%')

              ForEach(questProgress(quest.questId)?.items ?? [], (item: QuestGoalProgress) => {
                Row({ space: 12 }) {
                  Text(item.description)
                    .fontSize(16)
                    .fontWeight(item.satisfied ? FontWeight.Bold : FontWeight.Medium)
                    .fontColor(item.satisfied ? PanelColors.questSatisfied : PanelColors.txtPrimary)
                    .layoutWeight(1)
                  Text(item.label)
                    .fontSize(22)
                    .fontWeight(FontWeight.Bold)
                    .fontColor(item.satisfied ? PanelColors.questSatisfied : PanelColors.stat)
                    .flexShrink(0)
                }
                .width('100%')
                .padding(12)
                .backgroundColor(PanelColors.bg)
                .borderRadius(8)
              }, (item: QuestGoalProgress) => `${item.key}-${item.label}-${revision}`)
            }
            .width('100%')
            .padding(16)
            .backgroundColor(PanelColors.bgInfoOn)
            .borderRadius(12)

            Text(questProgress(quest.questId)?.note ?? '')
              .fontSize(12)
              .fontColor(PanelColors.txtSub)
              .width('100%')
          }

          if (this.formationReady(quest)) {
            Text('第一舰队满足编成要求（仅检查编成）')
              .fontSize(14)
              .fontColor(PanelColors.questSatisfied)
              .width('100%')
          }

          Column({ space: 8 }) {
            Text('任务说明').fontSize(14).fontWeight(FontWeight.Bold).fontColor(PanelColors.txtSub)
            Text(normalizeQuestText(quest.detail || '无任务描述'))
              .fontSize(16)
              .fontColor(PanelColors.txtPrimary)
              .lineHeight(24)
              .width('100%')
          }
          .width('100%')
          .alignItems(HorizontalAlign.Start)
        }
        .width('100%')
      }
      .layoutWeight(1)
      .width('100%')
      .align(Alignment.TopStart)

      Button('关闭')
        .width('100%')
        .fontColor(PanelColors.txtPrimary)
        .backgroundColor(PanelColors.bgInfoOn)
        .onClick(() => { this.detailVisible = false; })
    }
    .height('100%')
    .width('100%')
    .padding({ left: 20, right: 20, top: 28, bottom: 16 })
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
          if (this.formationReady(quest)) {
            Text('🆗').fontSize(this.titleFontSize())
          }
          Text(normalizeQuestText(quest.title || '未命名任务'))
            .fontSize(this.titleFontSize())
            .fontColor(PanelColors.txtPrimary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .layoutWeight(1)
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
        .fontWeight(FontWeight.Bold)
        .fontColor(this.progressColor(quest))
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
    .bindSheet($$this.detailVisible, this.QuestDetailSheet(this.revision), {
      height: '85%',
      backgroundColor: PanelColors.bg,
      showClose: true,
      dragBar: true,
    })
  }
}
