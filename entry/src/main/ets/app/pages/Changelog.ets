import router from '@ohos.router';

interface ChangeEntry {
  version: string;
  date: string;
  items: string[];
}

const CHANGELOG: ChangeEntry[] = [
  {
    version: '1.1.0',
    date: '2026-06-21',
    items: [
      '新增出击日志信息页：展示近期战斗记录，并支持按时间、海域、点位、战果和掉落舰筛选',
      '新增战斗详情回放：展示阶段概要、逐次攻击、伤害、暴击状态、HP 血条、航空战和基地航空队波次',
      '战斗记录新增 BattleSegment 持久化，新记录可回放逐次交战；旧记录仍可查看概要',
      '单舰战斗场景面板新增对空 CI 标签，展示当前装备可触发的对空 CI、击坠倍率和固定击坠',
      '任务领奖后会从本地任务状态和存储中移除，已完成未领奖任务会继续显示',
      '舰娘和装备信息页改为分批渲染列表，降低大库存场景下的初次加载成本',
      '优化战斗预览航空战详情触发区域、退避舰刷新，以及面板打开时的返回手势处理',
    ],
  },
  {
    version: '1.0.2',
    date: '2026-06-17',
    items: [
      '新增装备改修信息页：展示可改修日期、秘书舰、开发资材、改修资材、消耗装备和更新目标',
      '改修信息支持收藏持久化、收藏优先排序，并支持从游戏上下文加入收藏装备',
      '战斗预览新增航空战详情面板，可查看航空战损耗、接触、对空 CI 和基地航空队波次',
      '新增开发、建造、改修结果 Toast 提示，并在设置页提供独立开关',
      '单舰战斗场景估算新增喷式舰载机昼战 CI',
      '舰娘与装备信息补充更多属性展示，包括装甲、回避、射程、稀有度、航空机消耗和航程等',
      '优化任务状态合并、地图血条排序、退避舰置灰显示和远征检查筛选状态',
    ],
  },
  {
    version: '1.0.1',
    date: '2026-06-12',
    items: [
      '新增远征检查面板：支持海域筛选、条件详情、舰队数值检查、舰种规则、装备要求和大成功判定',
      '新增基地航空队与入渠面板，可在游戏信息面板中查看基地中队、制空、半径和修理状态',
      '新增单舰战斗场景估算：覆盖昼战、特殊攻击、夜战、对潜和装备改修加成',
      '扩展伤害、攻击率、夜战 CI、特殊攻击和夜瑞云相关计算',
      '改进舰队面板：增加舰队状态图标、装备徽标、射程显示、横向滚动和更稳定的状态刷新',
      '新增装备分类静态数据，并为水爆、暴雷等特殊装备图标提供配置化覆盖',
      '重构横竖屏、底部面板、浮动面板和窄屏场景下的响应式布局',
      '修复手动竖屏适配后横竖屏反复切换、面板统计刷新不及时和部分装备图标不匹配的问题',
    ],
  },
  {
    version: '1.0.0',
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
