import { PanelColors } from '../../../../features/panel/panelConfig';
import type { ScenarioAttack } from '../../../../features/calc';
import { buildShipScenarioData } from '../../../../features/panel/shipScenario';
import type { ShipScenarioAaci, ShipScenarioData } from '../../../../features/panel/shipScenario';

const TAB_DAY = 0;
const TAB_TORPEDO = 1;
const TAB_ASW = 2;
const TAB_NIGHT = 3;
const TAB_AACI = 4;

interface ScenarioTab {
  id: number;
  label: string;
}

const TAB_ITEMS: ScenarioTab[] = [
  { id: TAB_DAY, label: '昼战' },
  { id: TAB_TORPEDO, label: '雷击' },
  { id: TAB_ASW, label: '对潜' },
  { id: TAB_NIGHT, label: '夜战' },
  { id: TAB_AACI, label: '对空CI' },
];

const ACCENT_TAB = '#4a9eda';
const ACCENT_TYPE_DAY = '#e5a04a';
const ACCENT_TYPE_TORPEDO = '#64B5F6'; // rgb(100, 181, 246)
const ACCENT_TYPE_ASW = '#4DD0E1'; // rgb(77, 208, 225)
const ACCENT_TYPE_NIGHT = '#9FA8DA'; // rgb(159, 168, 218)
const ACCENT_TYPE_NIGHT_AERIAL = '#9383EF';
const AACI_TAG_BG = '#66306078';
const AACI_TAG_FG = '#b7f7c8';

/**
 * 战斗场景估算面板 — 双击舰名区域弹出。
 *
 * 按舰娘当前装备判定昼战/雷击/夜战各阶段可能出现的攻击类型，并给出
 * 发动率与攻击力估算（平击 = 实际伤害上限攻击力，爆击 = ×1.5）。
 * 不含支援阶段。
 *
 * 与 EquipDetailPanel 相同：接收 uid，内部自管 @Local 数据，保证在
 * bindPopup 的 @Builder 中可靠重渲染。
 */
@ComponentV2
export struct ShipScenarioPanel {
  @Param uid: number = 0;

  @Local data: ShipScenarioData | null = null;
  @Local activeTab: number = TAB_DAY;

  aboutToAppear(): void {
    this.loadData();
  }

  @Monitor('uid')
  onUidChange(): void {
    this.loadData();
  }

  private loadData(): void {
    this.data = this.uid > 0 ? buildShipScenarioData(this.uid) : null;
    if (!this.hasTabContent(this.activeTab)) {
      this.activeTab = this.firstVisibleTab();
    }
  }

  private attacksForTab(tabId: number): ScenarioAttack[] {
    if (!this.data) return [];
    switch (tabId) {
      case TAB_TORPEDO: return this.data.scenarios.torpedo;
      case TAB_ASW: return this.data.scenarios.asw;
      case TAB_NIGHT: return this.data.scenarios.night;
      case TAB_AACI: return [];
      default: return this.data.scenarios.day;
    }
  }

  private currentAttacks(): ScenarioAttack[] {
    return this.attacksForTab(this.activeTab);
  }

  private currentAacis(): ShipScenarioAaci[] {
    if (!this.data || this.activeTab !== TAB_AACI) return [];
    return this.data.aacis;
  }

  private hasTabContent(tabId: number): boolean {
    if (!this.data) return false;
    if (tabId === TAB_AACI) return this.data.aacis.length > 0;
    return this.attacksForTab(tabId).length > 0;
  }

  private visibleTabs(): ScenarioTab[] {
    const out: ScenarioTab[] = [];
    for (const tab of TAB_ITEMS) {
      if (this.hasTabContent(tab.id)) out.push(tab);
    }
    return out;
  }

  private firstVisibleTab(): number {
    const tabs = this.visibleTabs();
    return tabs.length > 0 ? tabs[0].id : TAB_DAY;
  }

  private isAaciTab(): boolean {
    return this.activeTab === TAB_AACI;
  }

  private formatRate(rate: number): string {
    return `${(rate * 100).toFixed(1)}%`;
  }

  private formatMultiplier(value: number): string {
    return `×${value.toFixed(2)}`;
  }

  private formatPercent(value: number): string {
    return `+${(value * 100).toFixed(0)}%`;
  }

  private isNightAerialAttack(attack: ScenarioAttack): boolean {
    const id = attack.id.toLowerCase();
    return id === 'carrier_night_ci'
      || id.indexOf('zuiun') >= 0
      || id.indexOf('zuiyun') >= 0
      || attack.label.indexOf('瑞云') >= 0
      || attack.label.indexOf('瑞雲') >= 0;
  }

  private attackAccentColor(attack: ScenarioAttack): string {
    if (this.activeTab === TAB_TORPEDO) return ACCENT_TYPE_TORPEDO;
    if (this.activeTab === TAB_ASW) return ACCENT_TYPE_ASW;
    if (this.activeTab === TAB_NIGHT) {
      return this.isNightAerialAttack(attack) ? ACCENT_TYPE_NIGHT_AERIAL : ACCENT_TYPE_NIGHT;
    }
    return ACCENT_TYPE_DAY;
  }

  @Builder private HeaderRow() {
    Row({ space: 6 }) {
      Text('攻击力')
        .fontSize(13)
        .fontWeight(FontWeight.Bold)
        .fontColor(PanelColors.txtPrimary)
      Text('敌方类型 无')
        .fontSize(11)
        .fontColor(PanelColors.txtSub)
      Blank().layoutWeight(1)
      if (this.data) {
        Text(`火力${this.data.firepower} 雷装${this.data.torpedo} 对潜${this.data.asw} 运${this.data.luck}`)
          .fontSize(10)
          .fontColor(PanelColors.txtMuted)
      }
    }
    .width('100%')
    .alignItems(VerticalAlign.Center)
  }

  @Builder private TabBar() {
    Row({ space: 14 }) {
      ForEach(this.visibleTabs(), (tab: ScenarioTab) => {
        Column({ space: 2 }) {
          Text(tab.label)
            .fontSize(12)
            .fontWeight(this.activeTab === tab.id ? FontWeight.Medium : FontWeight.Normal)
            .fontColor(this.activeTab === tab.id ? ACCENT_TAB : PanelColors.txtSub)
          Row()
            .width(24)
            .height(2)
            .borderRadius(1)
            .backgroundColor(this.activeTab === tab.id ? ACCENT_TAB : Color.Transparent)
        }
        .alignItems(HorizontalAlign.Center)
        .onClick(() => { this.activeTab = tab.id; })
      }, (tab: ScenarioTab) => `scn-tab-${tab.id}`)
    }
    .width('100%')
    .padding({ top: 2, bottom: 2 })
    .alignItems(VerticalAlign.Center)
  }

  @Builder private TableHeader() {
    if (this.isAaciTab()) {
      Row() {
        Text('类型')
          .fontSize(10)
          .fontColor(PanelColors.txtSub)
          .layoutWeight(5)
        Text('奖励倍率')
          .fontSize(10)
          .fontColor(PanelColors.txtSub)
          .layoutWeight(3)
          .textAlign(TextAlign.End)
        Text('百分比')
          .fontSize(10)
          .fontColor(PanelColors.txtSub)
          .layoutWeight(3)
          .textAlign(TextAlign.End)
        Text('固定')
          .fontSize(10)
          .fontColor(PanelColors.txtSub)
          .layoutWeight(2)
          .textAlign(TextAlign.End)
      }
      .width('100%')
    } else {
      Row() {
        Text('类型')
          .fontSize(10)
          .fontColor(PanelColors.txtSub)
          .layoutWeight(5)
        Text('发动率')
          .fontSize(10)
          .fontColor(PanelColors.txtSub)
          .layoutWeight(4)
        Text('平击')
          .fontSize(10)
          .fontColor(PanelColors.txtSub)
          .layoutWeight(2)
          .textAlign(TextAlign.End)
        Text('爆击')
          .fontSize(10)
          .fontColor(PanelColors.txtSub)
          .layoutWeight(2)
          .textAlign(TextAlign.End)
      }
      .width('100%')
    }
  }

  @Builder private AttackRow(attack: ScenarioAttack) {
    Row() {
      Row() {
        Text(attack.label)
          .fontSize(10)
          .fontColor(this.attackAccentColor(attack))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .padding({ left: 6, right: 6, top: 1, bottom: 1 })
      }
      .borderWidth(1)
      .borderColor(this.attackAccentColor(attack))
      .borderRadius(8)
      .layoutWeight(5)
      .justifyContent(FlexAlign.Center)

      Row({ space: 5 }) {
        Text(`${attack.hits}`)
          .fontSize(11)
          .fontColor(PanelColors.txtMuted)
        Text(this.formatRate(attack.rate))
          .fontSize(11)
          .fontColor(PanelColors.txtPrimary)
      }
      .layoutWeight(4)
      .padding({ left: 8 })
      .justifyContent(FlexAlign.Start)

      Text(`${attack.normal}`)
        .fontSize(11)
        .fontColor(PanelColors.stat)
        .layoutWeight(2)
        .textAlign(TextAlign.End)
      Text(`${attack.critical}`)
        .fontSize(11)
        .fontColor(PanelColors.stat)
        .layoutWeight(2)
        .textAlign(TextAlign.End)
    }
    .width('100%')
    .height(24)
    .alignItems(VerticalAlign.Center)
  }

  @Builder private AaciRow(aaci: ShipScenarioAaci) {
    Row() {
      Column({ space: 1 }) {
        Row({ space: 5 }) {
          Text('対空CI')
            .fontSize(10)
            .fontColor(AACI_TAG_FG)
            .padding({ left: 5, right: 5, top: 1, bottom: 1 })
            .backgroundColor(AACI_TAG_BG)
            .borderRadius(7)
          Text(`#${aaci.typeId}`)
            .fontSize(10)
            .fontColor(AACI_TAG_FG)
        }
        Text(aaci.description)
          .fontSize(8)
          .fontColor(PanelColors.txtMuted)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .layoutWeight(5)
      .alignItems(HorizontalAlign.Start)
      .constraintSize({ minWidth: 0 })

      Text(this.formatMultiplier(aaci.multiplier))
        .fontSize(11)
        .fontColor(PanelColors.txtPrimary)
        .layoutWeight(3)
        .textAlign(TextAlign.End)
      Text(this.formatPercent(aaci.percentShootdown))
        .fontSize(11)
        .fontColor(PanelColors.stat)
        .layoutWeight(3)
        .textAlign(TextAlign.End)
      Text(`+${aaci.fixedShootdown}`)
        .fontSize(11)
        .fontColor(PanelColors.stat)
        .layoutWeight(2)
        .textAlign(TextAlign.End)
    }
    .width('100%')
    .height(36)
    .alignItems(VerticalAlign.Center)
  }

  build() {
    Column({ space: 5 }) {
      if (this.data) {
        this.HeaderRow()
        this.TabBar()
        this.TableHeader()

        if (this.isAaciTab() && this.currentAacis().length > 0) {
          ForEach(this.currentAacis(), (aaci: ShipScenarioAaci) => {
            this.AaciRow(aaci)
          }, (aaci: ShipScenarioAaci) => `aaci-${aaci.typeId}`)
        } else if (!this.isAaciTab() && this.currentAttacks().length > 0) {
          ForEach(this.currentAttacks(), (attack: ScenarioAttack) => {
            this.AttackRow(attack)
          }, (attack: ScenarioAttack) => `scn-${this.activeTab}-${attack.id}`)
        } else {
          Text(this.isAaciTab() ? '当前装备无可用对空CI' : '该阶段无攻击手段')
            .fontSize(11)
            .fontColor(PanelColors.txtMuted)
            .margin({ top: 6, bottom: 6 })
            .alignSelf(ItemAlign.Center)
        }

        Text(this.isAaciTab() ? '对空CI按当前装备检测，列表按发动优先级排序' : '估算值：假定制空权确保、不计敌方装甲与交战形态')
          .fontSize(9)
          .fontColor(PanelColors.txtMuted)
          .margin({ top: 2 })
      } else {
        Text('无数据')
          .fontSize(11)
          .fontColor(PanelColors.txtMuted)
      }
    }
    .width(330)
    .padding(10)
    .backgroundColor('#1a1d2e')
    .borderRadius(8)
    .border({ width: 1, color: '#2e3355' })
    .alignItems(HorizontalAlign.Start)
  }
}
