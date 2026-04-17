import { getSenkaInfo, subscribeGameState } from '../../../features/state';
import { SenkaInfo } from '../../../features/state/type';

@ComponentV2
export default struct BattleStatsWidget {
  @Local private todaySenka: number = 0;
  @Local private monthlySenka: number | null = null;
  @Local private hasData: boolean = false;

  private unsubscribe: (() => void) | null = null;

  aboutToAppear(): void {
    this.refresh();
    this.unsubscribe = subscribeGameState((changeType) => {
      if (changeType === 'admiral' || changeType === 'all') {
        this.refresh();
      }
    });
  }

  aboutToDisappear(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private refresh(): void {
    const info: SenkaInfo | null = getSenkaInfo();
    if (!info) {
      this.hasData = false;
      this.todaySenka = 0;
      this.monthlySenka = null;
      return;
    }
    this.hasData = true;
    this.todaySenka = info.estimatedTodaySenka;
    this.monthlySenka = info.estimatedMonthlySenka;
  }

  build() {
    Column({ space: 1 }) {
      // 今日战果
      Row({ space: 3 }) {
        Text('今日')
          .fontSize(9)
          .fontColor('#aaaaaa')
          .fontWeight(FontWeight.Regular)
        Text(this.hasData ? `+${this.todaySenka}` : '--')
          .fontSize(12)
          .fontColor('#e0e0e0')
          .fontWeight(FontWeight.Medium)
      }
      .alignItems(VerticalAlign.Center)

      // 本月战果
      Row({ space: 3 }) {
        Text('本月')
          .fontSize(9)
          .fontColor('#aaaaaa')
          .fontWeight(FontWeight.Regular)
        if (this.monthlySenka !== null) {
          Text(`≈${this.monthlySenka}`)
            .fontSize(12)
            .fontColor('#80d8ff')
            .fontWeight(FontWeight.Medium)
        } else if (this.hasData) {
          Text('访问战绩取数')
            .fontSize(9)
            .fontColor('#888888')
            .fontWeight(FontWeight.Regular)
        } else {
          Text('--')
            .fontSize(12)
            .fontColor('#666666')
            .fontWeight(FontWeight.Regular)
        }
      }
      .alignItems(VerticalAlign.Center)
    }
    .padding({ left: 6, right: 6, top: 4, bottom: 4 })
    .backgroundColor('#CC151829')
    .borderRadius(4)
    .alignItems(HorizontalAlign.Start)
  }
}
