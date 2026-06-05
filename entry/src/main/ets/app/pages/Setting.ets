import router from '@ohos.router';
import promptAction from '@ohos.promptAction';
import { webview } from '@kit.ArkWeb';
import { kvGetString, kvSet, kvGetBool, kvDelete } from '../../infra/storage/kv';
import { HOME_URL, USER_AGENT } from '../../infra/web/config';
import { APP_STORAGE_SHOW_SIDEBAR, APP_STORAGE_SIDEBAR_SHOW_AVATAR, APP_STORAGE_FLOAT_OVERLAY_AUTO_BATTLE_PREVIEW, APP_STORAGE_YASEN_DETECT_ENABLED, APP_STORAGE_ADVANCE_GUARD_ENABLED, APP_STORAGE_REPAIR_ALERT_ENABLED, APP_STORAGE_INJECT_FPS, APP_STORAGE_INJECT_TOUCH_PATCH, APP_STORAGE_INJECT_TOUCH_HOVER, APP_STORAGE_INJECT_TOUCH_WHEEL, APP_STORAGE_INJECT_TOUCH_WHEEL_SENSITIVITY, APP_STORAGE_INJECT_TICKER_RAF, APP_STORAGE_INJECT_PIXI_PATCH, APP_STORAGE_PANEL_SHOW_KAISYUU, APP_STORAGE_PANEL_SHOW_PROFICIENCY, APP_STORAGE_GAME_SIZE_COMPACT, APP_STORAGE_GAME_SIZE_EXPANDED } from '../../ability/Entry';
import { setAlertConfig } from '../../features/alerts';
import type { AlertMode } from '../../features/alerts';
import { GAME_SIZE_DEFAULT_PERCENT, GAME_SIZE_MAX_PERCENT, GAME_SIZE_MIN_PERCENT, GAME_SIZE_STEP_PERCENT, normalizeGameSizePercent } from '../../infra/web/layout/gameSize';
import {
  TOUCH_WHEEL_SENSITIVITY_DEFAULT_PERCENT,
  TOUCH_WHEEL_SENSITIVITY_MAX_PERCENT,
  TOUCH_WHEEL_SENSITIVITY_MIN_PERCENT,
  TOUCH_WHEEL_SENSITIVITY_STEP_PERCENT,
  normalizeTouchWheelSensitivityPercent
} from '../../infra/web/input/touchWheelSensitivity';
import {
  APP_STORAGE_RESOURCE_CACHE_AUDIO,
  APP_STORAGE_RESOURCE_CACHE_ENABLED,
  clearResourceCache,
  getResourceCacheStats,
} from '../../features/resourceCache';
import type { ResourceCacheStats } from '../../features/resourceCache';

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
  /** Two-way binding to AppStorage; writing this immediately updates sidebar badges. */
  @StorageLink(APP_STORAGE_SIDEBAR_SHOW_AVATAR) private sidebarShowAvatar: boolean = true;
  @StorageLink(APP_STORAGE_FLOAT_OVERLAY_AUTO_BATTLE_PREVIEW) private autoBattlePreviewFloatOverlay: boolean = true;
  @StorageLink(APP_STORAGE_GAME_SIZE_COMPACT) private compactGameSizePercent: number = GAME_SIZE_DEFAULT_PERCENT;
  @StorageLink(APP_STORAGE_GAME_SIZE_EXPANDED) private expandedGameSizePercent: number = GAME_SIZE_DEFAULT_PERCENT;
  @StorageLink(APP_STORAGE_RESOURCE_CACHE_ENABLED) private resourceCacheEnabled: boolean = false;
  @StorageLink(APP_STORAGE_RESOURCE_CACHE_AUDIO) private resourceCacheAudioEnabled: boolean = false;
  /** Two-way binding to AppStorage; writing this immediately updates WebHost injection. */
  @StorageLink(APP_STORAGE_YASEN_DETECT_ENABLED) private yasenAlertEnabled: boolean = true;
  /** Two-way binding to AppStorage; writing this immediately updates WebHost injection. */
  @StorageLink(APP_STORAGE_ADVANCE_GUARD_ENABLED) private advanceGuardEnabled: boolean = true;
  @StorageLink(APP_STORAGE_INJECT_FPS) private injectFpsEnabled: boolean = false;
  @StorageLink(APP_STORAGE_INJECT_TOUCH_PATCH) private injectTouchPatch: boolean = false;
  @StorageLink(APP_STORAGE_INJECT_TOUCH_HOVER) private injectTouchHover: boolean = true;
  @StorageLink(APP_STORAGE_INJECT_TOUCH_WHEEL) private injectTouchWheel: boolean = true;
  @StorageLink(APP_STORAGE_INJECT_TOUCH_WHEEL_SENSITIVITY)
  private touchWheelSensitivityPercent: number = TOUCH_WHEEL_SENSITIVITY_DEFAULT_PERCENT;
  @StorageLink(APP_STORAGE_INJECT_TICKER_RAF) private injectTickerRaf: boolean = false;
  @StorageLink(APP_STORAGE_INJECT_PIXI_PATCH) private injectPixiPatch: boolean = false;
  /** Equipment label badge overlays in main panel. */
  @StorageLink(APP_STORAGE_PANEL_SHOW_KAISYUU) private panelShowKaisyuu: boolean = true;
  @StorageLink(APP_STORAGE_PANEL_SHOW_PROFICIENCY) private panelShowProficiency: boolean = true;

  // ── Alert settings ─────────────────────────────────────────────
  @State private battleResultAlertEnabled: boolean = true;
  @State private repairAlertEnabled: boolean = true;
  @State private alertMode: AlertMode = 'both';

  // ── UI state ───────────────────────────────────────────────────
  @State private configDirty: boolean = false;
  @State private accountDirty: boolean = false;
  @State private resourceCacheFileCount: number = 0;
  @State private resourceCacheSizeText: string = '0 B';
  @State private resourceCacheSessionText: string = '命中 0 / 未命中 0 / 下载 0';
  @State private resourceCachePendingText: string = '等待 0 / 失败 0';
  @State private resourceCacheStatsRefreshing: boolean = false;

  aboutToAppear(): void {
    void this.loadAll();
    void this.refreshResourceCacheStats();
  }

  private async loadAll(): Promise<void> {
    const results = await Promise.all([
      kvGetString('config.homeUrl', HOME_URL),
      kvGetString('config.userAgent', USER_AGENT ?? ''),
      kvGetString('account.username', ''),
      kvGetString('account.password', ''),
      kvGetBool('alerts.battle.enabled', true),
      kvGetBool(APP_STORAGE_REPAIR_ALERT_ENABLED, true),
      kvGetString('alerts.mode', 'both'),
    ]);
    this.homeUrl = results[0] as string;
    this.userAgent = results[1] as string;
    this.username = results[2] as string;
    this.password = results[3] as string;
    this.battleResultAlertEnabled = results[4] as boolean;
    this.repairAlertEnabled = results[5] as boolean;
    this.alertMode = (results[6] as string) as AlertMode;
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

  private onRepairAlertToggle(v: boolean): void {
    this.repairAlertEnabled = v;
    void kvSet(APP_STORAGE_REPAIR_ALERT_ENABLED, v);
    setAlertConfig({ enableRepairAlert: v });
  }

  private onAdvanceGuardToggle(v: boolean): void {
    this.advanceGuardEnabled = v;   // writes AppStorage → WebHost re-injects on next load
    void kvSet(APP_STORAGE_ADVANCE_GUARD_ENABLED, v);
  }

  private onInjectFpsToggle(v: boolean): void {
    this.injectFpsEnabled = v;
    void kvSet(APP_STORAGE_INJECT_FPS, v);
  }

  private onInjectTouchPatchToggle(v: boolean): void {
    this.injectTouchPatch = v;
    void kvSet(APP_STORAGE_INJECT_TOUCH_PATCH, v);
  }

  private onInjectTouchHoverToggle(v: boolean): void {
    this.injectTouchHover = v;
    void kvSet(APP_STORAGE_INJECT_TOUCH_HOVER, v);
  }

  private onInjectTouchWheelToggle(v: boolean): void {
    this.injectTouchWheel = v;
    void kvSet(APP_STORAGE_INJECT_TOUCH_WHEEL, v);
  }

  private onTouchWheelSensitivityChange(value: number): void {
    const next: number = normalizeTouchWheelSensitivityPercent(value);
    this.touchWheelSensitivityPercent = next;
    void kvSet(APP_STORAGE_INJECT_TOUCH_WHEEL_SENSITIVITY, next);
  }

  private onInjectTickerRafToggle(v: boolean): void {
    this.injectTickerRaf = v;
    void kvSet(APP_STORAGE_INJECT_TICKER_RAF, v);
  }

  private onInjectPixiPatchToggle(v: boolean): void {
    this.injectPixiPatch = v;
    void kvSet(APP_STORAGE_INJECT_PIXI_PATCH, v);
  }

  private onPanelShowKaisyuuToggle(v: boolean): void {
    this.panelShowKaisyuu = v;
    void kvSet(APP_STORAGE_PANEL_SHOW_KAISYUU, v);
  }

  private onPanelShowProficiencyToggle(v: boolean): void {
    this.panelShowProficiency = v;
    void kvSet(APP_STORAGE_PANEL_SHOW_PROFICIENCY, v);
  }

  private onSidebarShowAvatarToggle(v: boolean): void {
    this.sidebarShowAvatar = v;
    void kvSet(APP_STORAGE_SIDEBAR_SHOW_AVATAR, v);
  }

  private onAutoBattlePreviewFloatOverlayToggle(v: boolean): void {
    this.autoBattlePreviewFloatOverlay = v;
    void kvSet(APP_STORAGE_FLOAT_OVERLAY_AUTO_BATTLE_PREVIEW, v);
  }

  private setCompactGameSizePercent(value: number): void {
    const next: number = normalizeGameSizePercent(value);
    if (next === this.compactGameSizePercent) {
      return;
    }
    this.compactGameSizePercent = next;
    void kvSet(APP_STORAGE_GAME_SIZE_COMPACT, next);
  }

  private setExpandedGameSizePercent(value: number): void {
    const next: number = normalizeGameSizePercent(value);
    if (next === this.expandedGameSizePercent) {
      return;
    }
    this.expandedGameSizePercent = next;
    void kvSet(APP_STORAGE_GAME_SIZE_EXPANDED, next);
  }

  private onResourceCacheToggle(v: boolean): void {
    this.resourceCacheEnabled = v;
    void kvSet(APP_STORAGE_RESOURCE_CACHE_ENABLED, v);
    void this.refreshResourceCacheStats();
  }

  private onResourceCacheAudioToggle(v: boolean): void {
    this.resourceCacheAudioEnabled = v;
    void kvSet(APP_STORAGE_RESOURCE_CACHE_AUDIO, v);
    void this.refreshResourceCacheStats();
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

  private async doClearResourceCache(): Promise<void> {
    try {
      await clearResourceCache();
      await this.refreshResourceCacheStats();
      promptAction.showToast({ message: '资源缓存已清除', duration: 2000 });
    } catch (e) {
      promptAction.showToast({ message: '清除失败: ' + String(e), duration: 2500 });
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(gb >= 100 ? 0 : 1)} GB`;
  }

  private applyResourceCacheStats(stats: ResourceCacheStats): void {
    this.resourceCacheFileCount = stats.fileCount;
    this.resourceCacheSizeText = this.formatBytes(stats.totalBytes);
    this.resourceCacheSessionText =
      `命中 ${stats.hitCount} / 未命中 ${stats.missCount} / 下载 ${stats.downloadSuccessCount}`;
    this.resourceCachePendingText =
      `等待 ${stats.pendingDownloadCount} / 失败 ${stats.downloadFailCount}`;
  }

  private async refreshResourceCacheStats(): Promise<void> {
    if (this.resourceCacheStatsRefreshing) return;
    this.resourceCacheStatsRefreshing = true;
    try {
      const stats = await getResourceCacheStats();
      this.applyResourceCacheStats(stats);
    } catch (_e) {
      this.resourceCacheFileCount = 0;
      this.resourceCacheSizeText = '统计失败';
      this.resourceCacheSessionText = '命中 0 / 未命中 0 / 下载 0';
      this.resourceCachePendingText = '等待 0 / 失败 0';
    } finally {
      this.resourceCacheStatsRefreshing = false;
    }
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
  private PercentSliderRow(label: string, desc: string, value: number, onChange: (v: number) => void) {
    Column({ space: 10 }) {
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

        Text(`${value}%`)
          .fontSize(16)
          .fontWeight(FontWeight.Medium)
          .fontColor('#90B0C0')
          .width(64)
          .textAlign(TextAlign.End)
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)

      Slider({
        value: value,
        min: TOUCH_WHEEL_SENSITIVITY_MIN_PERCENT,
        max: TOUCH_WHEEL_SENSITIVITY_MAX_PERCENT,
        step: TOUCH_WHEEL_SENSITIVITY_STEP_PERCENT
      })
        .selectedColor('#6A9AB5')
        .trackColor('#1C2E3A')
        .blockColor('#FFFFFF')
        .showTips(true)
        .onChange((v: number) => { onChange(v); })

      Row() {
        Text(`${TOUCH_WHEEL_SENSITIVITY_MIN_PERCENT}%`)
          .fontSize(11)
          .fontColor('#3A4A55')
        Blank()
        Text(`${TOUCH_WHEEL_SENSITIVITY_MAX_PERCENT}%`)
          .fontSize(11)
          .fontColor('#3A4A55')
      }
      .width('100%')
    }
    .width('100%')
    .padding({ left: 16, right: 16, top: 14, bottom: 14 })
    .backgroundColor('#0C1420')
    .borderRadius(10)
    .border({ width: 1, color: '#15202C' })
  }

  @Builder
  private CompactGameSizeRow() {
    Column({ space: 10 }) {
      Row() {
        Column({ space: 3 }) {
          Text('窄屏游戏画面')
            .fontSize(15)
            .fontColor('#A09080')
          Text('用于纯游戏 / 浮动面板布局，画面保持置顶居中')
            .fontSize(12)
            .fontColor('#3A4A55')
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)

        Text(`${this.compactGameSizePercent}%`)
          .fontSize(16)
          .fontWeight(FontWeight.Medium)
          .fontColor('#90B0C0')
          .width(58)
          .textAlign(TextAlign.End)
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)

      Slider({
        value: this.compactGameSizePercent,
        min: GAME_SIZE_MIN_PERCENT,
        max: GAME_SIZE_MAX_PERCENT,
        step: GAME_SIZE_STEP_PERCENT,
      })
        .width('100%')
        .selectedColor('#6A9AB5')
        .trackColor('#1C2E3A')
        .blockColor('#90B0C0')
        .onChange((value: number) => { this.setCompactGameSizePercent(value); })
    }
    .width('100%')
    .padding({ left: 16, right: 16, top: 14, bottom: 14 })
    .backgroundColor('#0C1420')
    .borderRadius(10)
    .border({ width: 1, color: '#15202C' })
  }

  @Builder
  private ExpandedGameSizeRow() {
    Column({ space: 10 }) {
      Row() {
        Column({ space: 3 }) {
          Text('宽屏游戏画面')
            .fontSize(15)
            .fontColor('#A09080')
          Text('用于游戏 + 底部面板布局，缩小后释放下方面板空间')
            .fontSize(12)
            .fontColor('#3A4A55')
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)

        Text(`${this.expandedGameSizePercent}%`)
          .fontSize(16)
          .fontWeight(FontWeight.Medium)
          .fontColor('#90B0C0')
          .width(58)
          .textAlign(TextAlign.End)
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)

      Slider({
        value: this.expandedGameSizePercent,
        min: GAME_SIZE_MIN_PERCENT,
        max: GAME_SIZE_MAX_PERCENT,
        step: GAME_SIZE_STEP_PERCENT,
      })
        .width('100%')
        .selectedColor('#6A9AB5')
        .trackColor('#1C2E3A')
        .blockColor('#90B0C0')
        .onChange((value: number) => { this.setExpandedGameSizePercent(value); })
    }
    .width('100%')
    .padding({ left: 16, right: 16, top: 14, bottom: 14 })
    .backgroundColor('#0C1420')
    .borderRadius(10)
    .border({ width: 1, color: '#15202C' })
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
  private StatLine(label: string, value: string) {
    Row() {
      Text(label)
        .fontSize(13)
        .fontColor('#5A7A8A')
      Blank()
      Text(value)
        .fontSize(13)
        .fontColor('#90B0C0')
    }
    .width('100%')
    .height(24)
    .alignItems(VerticalAlign.Center)
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

          Column({ space: 8 }) {
            this.ToggleRow(
              '舰队状态侧边栏',
              '横屏时在游戏右侧显示舰队 HP / 损管 / 补给状态',
              this.showSidebar,
              (v: boolean) => {
                this.showSidebar = v;            // 写入 AppStorage，WebHost 立即响应
                void kvSet(APP_STORAGE_SHOW_SIDEBAR, v); // 持久化
              }
            )

            this.ToggleRow(
              '是否显示舰娘头像',
              '开启时显示舰娘头像，关闭时回退显示舰娘名称',
              this.sidebarShowAvatar,
              (v: boolean) => { this.onSidebarShowAvatarToggle(v); }
            )

            this.ToggleRow(
              '战斗预测自动浮窗',
              '窄屏横屏出现战斗预测时自动打开浮动面板',
              this.autoBattlePreviewFloatOverlay,
              (v: boolean) => { this.onAutoBattlePreviewFloatOverlayToggle(v); }
            )

            this.CompactGameSizeRow()

            this.ExpandedGameSizeRow()

            this.ToggleRow(
              '装备改修度图标',
              '在主面板装备图标右上角显示改修度（★1–★10）',
              this.panelShowKaisyuu,
              (v: boolean) => { this.onPanelShowKaisyuuToggle(v); }
            )

            this.ToggleRow(
              '航空机熟练度图标',
              '在主面板航空装备图标左下角显示熟练度',
              this.panelShowProficiency,
              (v: boolean) => { this.onPanelShowProficiencyToggle(v); }
            )
          }
          .width('100%')

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

            this.ToggleRow(
              '大破进击警告',
              '进击/撤退选择出现时，若存在无损管大破舰则弹窗提示',
              this.advanceGuardEnabled,
              (v: boolean) => { this.onAdvanceGuardToggle(v); }
            )
          }
          .width('100%')

          // ── SECTION: 日常提醒 ─────────────────────────────────
          this.SectionHeader('日常提醒')

          Column({ space: 8 }) {
            this.ToggleRow(
              '入渠完成提醒',
              '维修渠修理完成时震动 / 铃声提醒',
              this.repairAlertEnabled,
              (v: boolean) => { this.onRepairAlertToggle(v); }
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

          // ── SECTION: 资源缓存 ─────────────────────────────────
          this.SectionHeader('资源缓存')

          Column({ space: 8 }) {
            this.ToggleRow(
              '资源本地缓存',
              '缓存游戏图片资源；命中时从本地返回，失败时自动回源',
              this.resourceCacheEnabled,
              (v: boolean) => { this.onResourceCacheToggle(v); }
            )

            this.ToggleRow(
              '音频资源缓存',
              '实验功能：缓存 BGM / 音效；命中 Range 请求时返回本地分段数据',
              this.resourceCacheAudioEnabled,
              (v: boolean) => { this.onResourceCacheAudioToggle(v); }
            )

            Column({ space: 6 }) {
              this.StatLine('缓存文件', `${this.resourceCacheFileCount}`)
              this.StatLine('占用空间', this.resourceCacheSizeText)
              this.StatLine('本次会话', this.resourceCacheSessionText)
              this.StatLine('后台下载', this.resourceCachePendingText)
              Row() {
                Blank()
                this.ActionBtn(
                  this.resourceCacheStatsRefreshing ? '统计中' : '刷新统计',
                  this.resourceCacheStatsRefreshing ? '#3A5060' : '#6A9AB5',
                  () => { void this.refreshResourceCacheStats(); }
                )
              }
              .width('100%')
              .height(42)
            }
            .width('100%')
            .padding({ left: 16, right: 16, top: 12, bottom: 12 })
            .backgroundColor('#0C1420')
            .borderRadius(10)
            .border({ width: 1, color: '#15202C' })
          }
          .width('100%')

          Text('图片资源默认支持；音频缓存需同时开启资源本地缓存和音频资源缓存')
            .fontSize(11)
            .fontColor('#2A3A45')
            .padding({ left: 4, top: 4 })

          // ── SECTION: WebView 注入 ─────────────────────────────
          this.SectionHeader('WebView 注入')

          Column({ space: 8 }) {
            this.ToggleRow(
              'FPS 显示',
              '在游戏画面左上角叠加实时帧率计数器',
              this.injectFpsEnabled,
              (v: boolean) => { this.onInjectFpsToggle(v); }
            )

            this.ToggleRow(
              '触摸事件补丁',
              '修正部分设备上触摸坐标偏移问题',
              this.injectTouchPatch,
              (v: boolean) => { this.onInjectTouchPatchToggle(v); }
            )

            this.ToggleRow(
              '触摸悬停支持',
              '触摸并滑动时模拟鼠标悬停，用于展开装备分类和改修入口',
              this.injectTouchHover,
              (v: boolean) => { this.onInjectTouchHoverToggle(v); }
            )

            this.ToggleRow(
              '双指滚轮支持',
              '双指上下划动时模拟鼠标滚轮，用于游戏内换页',
              this.injectTouchWheel,
              (v: boolean) => { this.onInjectTouchWheelToggle(v); }
            )

            this.PercentSliderRow(
              '双指滚轮灵敏度',
              '调整双指划动转换为鼠标滚轮的幅度',
              this.touchWheelSensitivityPercent,
              (v: number) => { this.onTouchWheelSensitivityChange(v); }
            )

            this.ToggleRow(
              'Ticker RAF 优化',
              '将 Pixi Ticker 驱动切换为 requestAnimationFrame，降低后台 CPU 占用',
              this.injectTickerRaf,
              (v: boolean) => { this.onInjectTickerRafToggle(v); }
            )

            this.ToggleRow(
              'Pixi 渲染补丁',
              '应用 Pixi.js 渲染兼容性补丁（仅在画面异常时启用）',
              this.injectPixiPatch,
              (v: boolean) => { this.onInjectPixiPatchToggle(v); }
            )
          }
          .width('100%')

          Text('注入功能更改在下次进入游戏页面时生效')
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

            this.DangerActionRow(
              '清除资源缓存',
              '清理本地缓存的游戏图片 / 音频资源，不影响 Cookies',
              '立即清除',
              () => { void this.doClearResourceCache(); }
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
