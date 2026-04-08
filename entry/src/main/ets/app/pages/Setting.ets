import router from '@ohos.router';
import promptAction from '@ohos.promptAction';
import { webview } from '@kit.ArkWeb';
import { kvGetString, kvSet, kvGetBool, kvDelete } from '../../infra/storage/kv';
import { HOME_URL, USER_AGENT } from '../../infra/web/config';

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

  // ── UI state ───────────────────────────────────────────────────
  @State private configDirty: boolean = false;
  @State private accountDirty: boolean = false;

  aboutToAppear(): void {
    void this.loadAll();
  }

  private async loadAll(): Promise<void> {
    const WebConfig = await Promise.all([
      kvGetString('config.homeUrl', HOME_URL),
      kvGetString('config.userAgent', USER_AGENT ?? ''),
      kvGetString('account.username', ''),
      kvGetString('account.password', ''),
    ]);
    const url = WebConfig[0];
    const ua = WebConfig[1];
    const user = WebConfig[2];
    const pass = WebConfig[3];
    this.homeUrl = url;
    this.userAgent = ua;
    this.username = user;
    this.password = pass;
    this.configDirty = false;
    this.accountDirty = false;
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
