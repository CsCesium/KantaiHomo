import router from '@ohos.router';

interface ChangeEntry {
  version: string;
  date: string;
  items: string[];
}

const CHANGELOG: ChangeEntry[] = [
  {
    version: 'current',
    date: '2026',
    items: [
      '新增启动页面，提供游戏入口、设置、更新日志等功能',
      '新增设置页面：支持自定义主页 URL 与 User Agent',
      '新增账号自动填充：保存 DMM 账号密码并在登录页自动填入',
      '新增数据清理：一键清除 Cookies 与缓存',
    ],
  },
  {
    version: '早期版本',
    date: '',
    items: [
      'WebView 嵌入式游戏视图，支持全屏与分屏模式',
      '响应式布局：自适应竖屏、横屏、折叠屏',
      'API 数据拦截与本地持久化（SQLite）',
      '夜战检测，自动弹出确认提示',
      'JavaScript 注入：XHR/Fetch 钩子、FPS 监控',
      '广告屏蔽：过滤追踪与广告请求',
      'Fairy 悬浮窗服务（框架已就绪）',
      '远征、入渠、建造等游戏状态数据存储',
    ],
  },
];

@Entry
@Component
struct Changelog {
  @Builder
  private EntryBlock(entry: ChangeEntry) {
    Column({ space: 8 }) {
      Row({ space: 8 }) {
        Text(entry.version)
          .fontSize(14)
          .fontWeight(FontWeight.Bold)
          .fontColor('#C0AF95')
        if (entry.date) {
          Text(entry.date)
            .fontSize(12)
            .fontColor('#3A5060')
        }
      }
      .alignItems(VerticalAlign.Center)

      Column({ space: 6 }) {
        ForEach(entry.items, (item: string) => {
          Row({ space: 8 }) {
            Text('·')
              .fontSize(16)
              .fontColor('#3A5A6A')
              .width(14)
              .textAlign(TextAlign.Center)
              .flexShrink(0)
            Text(item)
              .fontSize(13)
              .fontColor('#7A9AAA')
              .layoutWeight(1)
          }
          .alignItems(VerticalAlign.Top)
          .width('100%')
        })
      }
      .padding({ left: 4 })
    }
    .padding({ left: 16, right: 16, top: 14, bottom: 14 })
    .backgroundColor('#0C1420')
    .borderRadius(10)
    .border({ width: 1, color: '#15202C' })
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }

  build() {
    Column() {
      // ── Top bar ──────────────────────────────────────────────────
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

        Text('更新日志')
          .fontSize(17)
          .fontWeight(FontWeight.Medium)
          .fontColor('#B0A090')

        Blank()

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
        Column({ space: 0 }) {
          // App header
          Column({ space: 6 }) {
            Text('KantaiHomo')
              .fontSize(24)
              .fontWeight(FontWeight.Bold)
              .fontColor('#C0AF95')
            Text('A viewer for Kantai Collection (HTML5) on HarmonyOS')
              .fontSize(12)
              .fontColor('#2E4A5A')
              .textAlign(TextAlign.Center)
          }
          .padding({ top: 28, bottom: 28 })
          .alignItems(HorizontalAlign.Center)
          .width('100%')

          Divider()
            .strokeWidth(1)
            .color('#101820')
            .margin({ bottom: 16 })

          // Changelog entries
          Column({ space: 12 }) {
            ForEach(CHANGELOG, (entry: ChangeEntry) => {
              this.EntryBlock(entry)
            })
          }
          .width('100%')

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
