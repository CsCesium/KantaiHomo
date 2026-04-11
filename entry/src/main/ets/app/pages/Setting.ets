import router from '@ohos.router';
import promptAction from '@ohos.promptAction';
import { webview } from '@kit.ArkWeb';
import { kvGetString, kvSet, kvGetBool, kvDelete } from '../../infra/storage/kv';
import { HOME_URL, USER_AGENT } from '../../infra/web/config';
import { APP_STORAGE_SHOW_SIDEBAR, APP_STORAGE_YASEN_DETECT_ENABLED } from '../../ability/Entry';
import { setAlertConfig } from '../../features/alerts';
import type { AlertMode } from '../../features/alerts';

@Entry
@Component
struct Setting {
  // ── Game config ────────────────────────────────────────────────
  @State private homeUrl: string = HOME_URL;
  @State private userAgent: string = USER_AGENT ?? '';

  // ── Account ────────────────────────────────────────────────────
  @State private username: string = '';
  @State private password: string = '';
  @State private showPassword: boolean = false;

  // ── UI preferences ─────────────────────────────────────────────
  /** Two-way binding to AppStorage; writing this immediately updates WebHost. */
  @StorageLink(APP_STORAGE_SHOW_SIDEBAR) private showSidebar: boolean = true;
  /** Two-way binding to AppStorage; writing this immediately updates WebHost injection. */
  @StorageLink(APP_STORAGE_YASEN_DETECT_ENABLED) private yasenAlertEnabled: boolean = true;

  // ── Alert settings ─────────────────────────────────────────────
  @State private battleResultAlertEnabled: boolean = true;
  @State private alertMode: AlertMode = 'both';

  // ── UI state ───────────────────────────────────────────────────
  @State private configDirty: boolean = false;
  @State private accountDirty: boolean = false;

  aboutToAppear(): void {
    void this.loadAll();
  }

  private async loadAll(): Promise<void> {
    const results = await Promise.all([
      kvGetString('config.homeUrl', HOME_URL),
      kvGetString('config.userAgent', USER_AGENT ?? ''),
      kvGetString('account.username', ''),
      kvGetString('account.password', ''),
      kvGetBool('alerts.battle.enabled', true),
      kvGetString('alerts.mode', 'both'),
    ]);
    this.homeUrl = results[0] as string;
    this.userAgent = results[1] as string;
    this.username = results[2] as string;
    this.password = results[3] as string;
    this.battleResultAlertEnabled = results[4] as boolean;
    this.alertMode = (results[5] as string) as AlertMode;
    this.configDirty = false;
    this.accountDirty = false;
  }

  private applyAlertMode(mode: AlertMode): void {
    this.alertMode = mode;
    void kvSet('alerts.mode', mode);
    setAlertConfig({
      enableVibrate: mode === 'vibrate' || mode === 'both',
      enableNotification: mode === 'ring' || mode === 'both',
    });
  }

  private onYasenToggle(v: boolean): void {
    this.yasenAlertEnabled = v;           // writes AppStorage → WebHost re-injects on next load
    void kvSet(APP_STORAGE_YASEN_DETECT_ENABLED, v);
    setAlertConfig({ enableYasenAlert: v });
  }

  private onBattleResultToggle(v: boolean): void {
    this.battleResultAlertEnabled = v;
    void kvSet('alerts.battle.enabled', v);
    setAlertConfig({ enableBattleResultAlert: v });
  }

  private async saveConfig(): Promise<void> {
    const url = this.homeUrl.trim() || HOME_URL;
    const ua = this.userAgent.trim();
    await Promise.all([
      kvSet('config.homeUrl', url),
      kvSet('config.userAgent', ua || (USER_AGENT ?? '')),
    ]);
    this.configDirty = false;
    promptAction.showToast({ message: '配置已保存，重新进入游戏后生效', duration: 2500 });
  }

  private async resetConfig(): Promise<void> {
    this.homeUrl = HOME_URL;
    this.userAgent = USER_AGENT ?? '';
    await Promise.all([
      kvSet('config.homeUrl', HOME_URL),
      kvSet('config.userAgent', USER_AGENT ?? ''),
    ]);
    this.configDirty = false;
    promptAction.showToast({ message: '已重置为默认值', duration: 2000 });
  }

  private async saveAccount(): Promise<void> {
    await Promise.all([
      kvSet('account.username', this.username),
      kvSet('account.password', this.password),
    ]);
    this.accountDirty = false;
    promptAction.showToast({ message: '账号信息已保存', duration: 2000 });
  }

  private async clearAccount(): Promise<void> {
    this.username = '';
    this.password = '';
    await Promise.all([
      kvDelete('account.username'),
      kvDelete('account.password'),
    ]);
    this.accountDirty = false;
    promptAction.showToast({ message: '已清除账号信息', duration: 2000 });
  }

  private doClearCookies(): void {
    try {
      webview.WebCookieManager.clearAllCookiesSync();
      promptAction.showToast({ message: 'Cookies 已清除', duration: 2000 });
    } catch (e) {
      promptAction.showToast({ message: '清除失败: ' + String(e), duration: 2500 });
    }
  }

  private async doClearCache(): Promise<void> {
    await kvSet('clear.cache.pending', true);
    promptAction.showToast({ message: '缓存将在下次进入游戏时清除', duration: 2500 });
  }

  // ── Builders ───────────────────────────────────────────────────

  @Builder
  private SectionHeader(title: string) {
    Text(title)
      .fontSize(11)
      .fontWeight(FontWeight.Medium)
      .fontColor('#3A5A70')
      .letterSpacing(1.5)
      .padding({ left: 4, top: 20, bottom: 8 })
      .width('100%')
  }

  @Builder
  private FieldLabel(label: string) {
    Text(label)
      .fontSize(13)
      .fontColor('#5A7A8A')
      .padding({ left: 2, bottom: 4 })
      .width('100%')
  }

  @Builder
  private ActionBtn(label: string, color: string, action: () => void) {
    Button(label, { type: ButtonType.Normal })
      .fontSize(14)
      .fontWeight(FontWeight.Medium)
      .fontColor(color)
      .backgroundColor('#0E1820')
      .border({ width: 1, color: color === '#C0313A' ? '#3A1018' : '#1C3348' })
      .borderRadius(8)
      .height(42)
      .onClick(action)
  }

  @Builder
  private ToggleRow(label: string, desc: string, isOn: boolean, onChange: (v: boolean) => void) {
    Row() {
      Column({ space: 3 }) {
        Text(label)
          .fontSize(15)
          .fontColor('#A09080')
        Text(desc)
          .fontSize(12)
          .fontColor('#3A4A55')
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)

      Toggle({ type: ToggleType.Switch, isOn: isOn })
        .selectedColor('#6A9AB5')
        .switchPointColor('#FFFFFF')
        .onChange(onChange)
    }
    .width('100%')
    .padding({ left: 16, right: 16, top: 14, bottom: 14 })
    .backgroundColor('#0C1420')
    .borderRadius(10)
    .border({ width: 1, color: '#15202C' })
    .alignItems(VerticalAlign.Center)
  }

  @Builder
  private ModeBtn(label: string, mode: AlertMode) {
    Button(label, { type: ButtonType.Normal })
      .fontSize(13)
      .fontWeight(FontWeight.Medium)
      .fontColor(this.alertMode === mode ? '#FFFFFF' : '#5A7A8A')
      .backgroundColor(this.alertMode === mode ? '#1A3A50' : '#0A1420')
      .border({ width: 1, color: this.alertMode === mode ? '#2A6A8A' : '#1C2E3A' })
      .borderRadius(8)
      .height(36)
      .layoutWeight(1)
      .onClick(() => { this.applyAlertMode(mode); })
  }

  @Builder
  private DangerActionRow(label: string, desc: string, btnLabel: string, action: () => void) {
    Row() {
      Column({ space: 3 }) {
        Text(label)
          .fontSize(15)
          .fontColor('#A09080')
        Text(desc)
          .fontSize(12)
          .fontColor('#3A4A55')
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)

      this.ActionBtn(btnLabel, '#C0313A', action)
    }
    .width('100%')
    .padding({ left: 16, right: 16, top: 14, bottom: 14 })
    .backgroundColor('#0C1420')
    .borderRadius(10)
    .border({ width: 1, color: '#15202C' })
    .alignItems(VerticalAlign.Center)
  }

  build() {
    Column() {
      // ── Top bar ────────────────────────────────────────────────
      Row() {
        Button({ type: ButtonType.Normal }) {
          Text('‹ 返回')
            .fontSize(16)
            .fontColor('#6A9AB5')
        }
        .backgroundColor(Color.Transparent)
        .border({ width: 0 })
        .padding({ left: 0 })
        .onClick(() => { router.back(); })

        Blank()

        Text('设置')
          .fontSize(17)
          .fontWeight(FontWeight.Medium)
          .fontColor('#B0A090')

        Blank()

        // Spacer to balance title
        Text('‹ 返回')
          .fontSize(16)
          .fontColor(Color.Transparent)
          .enabled(false)
      }
      .width('100%')
      .height(52)
      .padding({ left: 12, right: 16 })
      .alignItems(VerticalAlign.Center)
      .backgroundColor('#080E18')
      .border({ width: { bottom: 1 }, color: '#121E2A' })

      // ── Scrollable content ─────────────────────────────────────
      Scroll() {
        Column() {
          // ── SECTION: 游戏配置 ─────────────────────────────────
          this.SectionHeader('游戏配置')

          Column({ space: 12 }) {
            Column({ space: 0 }) {
              this.FieldLabel('主页 URL')
              TextInput({ text: this.homeUrl, placeholder: HOME_URL })
                .fontSize(13)
                .fontColor('#90B0C0')
                .caretColor('#6A9AB5')
                .backgroundColor('#0C1822')
                .border({ width: 1, color: this.configDirty ? '#2A4A60' : '#141E2A' })
                .borderRadius(8)
                .height(44)
                .onChange((v) => {
                  this.homeUrl = v;
                  this.configDirty = true;
                })
            }

            Column({ space: 0 }) {
              this.FieldLabel('User Agent')
              TextInput({ text: this.userAgent, placeholder: '留空使用默认 UA' })
                .fontSize(11)
                .fontColor('#90B0C0')
                .caretColor('#6A9AB5')
                .backgroundColor('#0C1822')
                .border({ width: 1, color: this.configDirty ? '#2A4A60' : '#141E2A' })
                .borderRadius(8)
                .height(44)
                .onChange((v) => {
                  this.userAgent = v;
                  this.configDirty = true;
                })
            }

            Row({ space: 10 }) {
              this.ActionBtn('重置默认', '#5A7A8A', () => { void this.resetConfig(); })
              this.ActionBtn('保存配置', this.configDirty ? '#6A9AB5' : '#3A5060', () => { void this.saveConfig(); })
            }
          }
          .padding({ left: 16, right: 16, top: 14, bottom: 14 })
          .backgroundColor('#0C1420')
          .borderRadius(10)
          .border({ width: 1, color: '#15202C' })
          .width('100%')

          Text('配置更改需重新进入游戏后生效')
            .fontSize(11)
            .fontColor('#2A3A45')
            .padding({ left: 4, top: 4 })

          // ── SECTION: 账号 / 自动填充 ──────────────────────────
          this.SectionHeader('账号 / 自动填充')

          Column({ space: 12 }) {
            Column({ space: 0 }) {
              this.FieldLabel('用户名 / 邮箱')
              TextInput({ text: this.username, placeholder: 'DMM 账号' })
                .fontSize(14)
                .fontColor('#90B0C0')
                .caretColor('#6A9AB5')
                .backgroundColor('#0C1822')
                .border({ width: 1, color: this.accountDirty ? '#2A4A60' : '#141E2A' })
                .borderRadius(8)
                .height(44)
                .onChange((v) => {
                  this.username = v;
                  this.accountDirty = true;
                })
            }

            Column({ space: 0 }) {
              Row() {
                this.FieldLabel('密码')
                Blank()
                Text(this.showPassword ? '隐藏' : '显示')
                  .fontSize(12)
                  .fontColor('#3A5A6A')
                  .padding({ right: 4, bottom: 4 })
                  .onClick(() => { this.showPassword = !this.showPassword; })
              }
              .width('100%')

              TextInput({ text: this.password, placeholder: '••••••••' })
                .type(this.showPassword ? InputType.Normal : InputType.Password)
                .fontSize(14)
                .fontColor('#90B0C0')
                .caretColor('#6A9AB5')
                .backgroundColor('#0C1822')
                .border({ width: 1, color: this.accountDirty ? '#2A4A60' : '#141E2A' })
                .borderRadius(8)
                .height(44)
                .onChange((v) => {
                  this.password = v;
                  this.accountDirty = true;
                })
            }

            Row({ space: 10 }) {
              this.ActionBtn('清除账号', '#C0313A', () => { void this.clearAccount(); })
              this.ActionBtn('保存账号', this.accountDirty ? '#6A9AB5' : '#3A5060', () => { void this.saveAccount(); })
            }
          }
          .padding({ left: 16, right: 16, top: 14, bottom: 14 })
          .backgroundColor('#0C1420')
          .borderRadius(10)
          .border({ width: 1, color: '#15202C' })
          .width('100%')

          Text('进入 DMM 登录页面时将自动填充账号与密码')
            .fontSize(11)
            .fontColor('#2A3A45')
            .padding({ left: 4, top: 4 })

          // ── SECTION: 界面 ────────────────────────────────────
          this.SectionHeader('界面')

          this.ToggleRow(
            '舰队状态侧边栏',
            '横屏时在游戏右侧显示舰队 HP / 损管 / 补给状态',
            this.showSidebar,
            (v: boolean) => {
              this.showSidebar = v;            // 写入 AppStorage，WebHost 立即响应
              void kvSet(APP_STORAGE_SHOW_SIDEBAR, v); // 持久化
            }
          )

          // ── SECTION: 战斗提醒 ─────────────────────────────────
          this.SectionHeader('战斗提醒')

          Column({ space: 8 }) {
            this.ToggleRow(
              '夜战选择提醒',
              '夜战选择出现时震动 / 铃声提醒',
              this.yasenAlertEnabled,
              (v: boolean) => { this.onYasenToggle(v); }
            )

            this.ToggleRow(
              '战斗结算提醒',
              '战斗结算时显示结果并震动 / 铃声提醒',
              this.battleResultAlertEnabled,
              (v: boolean) => { this.onBattleResultToggle(v); }
            )
          }
          .width('100%')

          // ── SECTION: 提醒方式 ─────────────────────────────────
          this.SectionHeader('提醒方式')

          Row({ space: 8 }) {
            this.ModeBtn('仅震动', 'vibrate')
            this.ModeBtn('仅铃声', 'ring')
            this.ModeBtn('震动+铃声', 'both')
          }
          .width('100%')
          .padding({ left: 16, right: 16, top: 14, bottom: 14 })
          .backgroundColor('#0C1420')
          .borderRadius(10)
          .border({ width: 1, color: '#15202C' })

          // ── SECTION: 数据清理 ─────────────────────────────────
          this.SectionHeader('数据清理')

          Column({ space: 8 }) {
            this.DangerActionRow(
              '清除 Cookies',
              '注销所有网站会话，下次需重新登录',
              '立即清除',
              () => { this.doClearCookies(); }
            )

            this.DangerActionRow(
              '清除缓存',
              '清理页面缓存文件，下次进入游戏时执行',
              '标记清除',
              () => { void this.doClearCache(); }
            )
          }
          .width('100%')

          // Bottom padding
          Blank().height(40)
        }
        .padding({ left: 16, right: 16 })
        .width('100%')
        .alignItems(HorizontalAlign.Start)
      }
      .scrollBar(BarState.Off)
      .edgeEffect(EdgeEffect.Spring)
      .layoutWeight(1)
      .width('100%')
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#080E18')
    .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM])
  }
}
