import router from '@ohos.router';
import { window } from '@kit.ArkUI';
import { getMainWindowCached } from '../../infra/appContext';

@Entry
@Component
struct Launcher {
  private navigate(url: string): void {
    router.pushUrl({ url }).catch(() => {});
  }
  private enterGame(): void {
    const win = getMainWindowCached();
    const orientationPromise = win
      ? win.setPreferredOrientation(window.Orientation.LANDSCAPE)
      : Promise.resolve();
    orientationPromise.catch(() => {}).finally(() => {
      router.replaceUrl({ url: 'app/pages/WebRoot' }).catch(() => {});
    });
  }

  @Builder
  private MenuCard(
    icon: string,
    title: string,
    subtitle: string,
    disabled: boolean,
    action: () => void
  ) {
    Row({ space: 14 }) {
      Text(icon)
        .fontSize(22)
        .width(32)
        .textAlign(TextAlign.Center)
        .fontColor(disabled ? '#253040' : '#6A9AB5')

      Column({ space: 3 }) {
        Text(title)
          .fontSize(16)
          .fontWeight(FontWeight.Medium)
          .fontColor(disabled ? '#253040' : '#C8B99A')
        Text(subtitle)
          .fontSize(12)
          .fontColor(disabled ? '#1A2530' : '#436070')
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)

      if (!disabled) {
        Text('›')
          .fontSize(20)
          .fontColor('#2A4055')
      }
    }
    .width('100%')
    .padding({ left: 18, right: 18, top: 16, bottom: 16 })
    .borderRadius(10)
    .backgroundColor(disabled ? '#090F18' : '#101A26')
    .border({ width: 1, color: disabled ? '#0E1820' : '#192A3A' })
    .opacity(disabled ? 0.4 : 1.0)
    .onClick(disabled ? () => {} : action)
  }

  build() {
    Column() {
      // ── Header ──────────────────────────────────────────────────
      Column({ space: 8 }) {
        Text('艦隊これくしょん')
          .fontSize(11)
          .fontColor('#253A4A')
          .letterSpacing(3)

        Text('KantaiHomo')
          .fontSize(34)
          .fontWeight(FontWeight.Bold)
          .fontColor('#C0AF95')

        Divider()
          .strokeWidth(1)
          .color('#192A3A')
          .width(72)
          .margin({ top: 6, bottom: 2 })

        Text('HarmonyOS Viewer')
          .fontSize(11)
          .fontColor('#1E3345')
      }
      .padding({ top: 72, bottom: 52 })
      .alignItems(HorizontalAlign.Center)
      .width('100%')

      // ── Menu Cards ───────────────────────────────────────────────
      Column({ space: 10 }) {
        this.MenuCard(
          '⚓', '进入游戏','艦これ', false,
          () => this.enterGame()
        )
        this.MenuCard(
          '⚙', '设置', '游戏配置与账号管理', false,
          () => this.navigate('app/pages/Setting')
        )
        this.MenuCard(
          '✦', 'Fairy', '（即将推出）', true,
          () => {}
        )
        this.MenuCard(
          '📋', '更新日志', '版本变更记录', false,
          () => this.navigate('app/pages/Changelog')
        )
      }
      .padding({ left: 20, right: 20 })
      .width('100%')

      Blank()

      // ── Footer ──────────────────────────────────────────────────
      Text('KantaiHomo · HarmonyOS')
        .fontSize(11)
        .fontColor('#162230')
        .padding({ bottom: 32 })
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#070E17')
    .alignItems(HorizontalAlign.Center)
    .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM])
  }
}
