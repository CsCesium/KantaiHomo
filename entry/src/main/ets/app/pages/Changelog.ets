import router from '@ohos.router';

interface ChangeEntry {
  version: string;
  date: string;
  items: string[];
}

const CHANGELOG: ChangeEntry[] = [
  {
    version: '1.1.3',
    date: '2026-10-15',
    items: [
      '新增立绘魔改：按舰娘形态、资源类型及通常/中破状态导入、预览、替换和删除本地图片',
      '后台提醒改用系统日历，新增授权登记、重要事项模式及日程时长设置',
      '新增明石维修/野埼给粮计时，支持维修 20 分钟、给粮 15/30/45 分钟档位及到点提醒',
      '演习仅登记当天剩余提醒，次日运行应用续登；月度提醒改为未来 11 个周期',
      '新增近代化改修属性上升值与剩余可增加值 Toast，以及港内补给提示',
      '战斗结算显示主力/护卫 MVP 名称与高亮，航空数量改为 S2 攻击机结算后/前数量',
      '扩展对空 CI 与先制对潜判定，新增任务达标数量提示并修复小目标进度校准',
      '改进 API 顺序重试、去重和前后台恢复，修复状态更新丢失及日历调用阻塞',
    ],
  },
  {
    version: '1.1.2',
    date: '2026-09-17',
    items: [
      '新增三折叠与大屏平板三屏布局，支持游戏区/信息区左右互换和独立游戏缩放',
      '信息区新增单列战斗预览，以及双击切换并记忆视图的远征、任务、入渠看板',
      '新增第一舰队任务编成检查与子目标计数，按账号保存、按周期重置，估算进度以 ≈ 标记',
      '任务详情独立展示各项目标次数与周期，达标子项高亮；改进分页与跨设备接取状态同步',
      '新增远征后台提醒开关、登记状态与重试入口，修复重复通知和旧提醒残留',
      '新增演习刷新、月度战果周期结算及月底 EO 勋章提醒，独立开关默认关闭，仅发送系统通知',
      '修复静音偏好重启后恢复和快速切换问题，放行 DMM 购买/收银台所需资源',
      '补充舰娘头像与离线任务数据，完善任务数据来源及许可声明',
    ],
  },
  {
    version: '1.1.1',
    date: '2026-08-04',
    items: [
      '新增 7 舰第三舰队游击部队识别，面板自动选中游击部队并避免误报空闲远征舰队',
      '新增白露改二、时雨改二/改三、村雨改二和春雨改二的 C3H 47 种对空 CI 判定',
      '扩展联合舰队、开幕夜战和夜战转昼战解析，修复主力/护卫索引、初始 HP 与累计伤害',
      '基地空袭预览新增损失类型、基地受损和参战机残机统计，并按当前海域匹配基地航空队',
      '修正舰队与基地航空队制空计算，熟练度内部值不确定时显示制空范围',
      '单舰估算新增航母夜间航空攻击，并按损伤状态修正昼战、雷击、对潜和夜战火力',
      '完善活动海域节点、难度选择与多段血条解析，索敌计算排除已退避舰娘',
      '任务接取/停止后即时更新；联合舰队侧栏支持在港内切换主力与护卫舰队',
    ],
  },
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
