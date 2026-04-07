import { FairyBall } from '../utils/FairyBall';

/**
 * Entry page loaded into the fairy SubWindow.
 *
 * The SubWindow is sized to exactly the ball (FAIRY_BALL_VP × FAIRY_BALL_VP),
 * so this page simply fills 100 % and renders the ball.
 * Background must stay transparent so the content below shows through.
 */
@Entry
@Component
struct FairyPage {
  build() {
    Stack({ alignContent: Alignment.Center }) {
      FairyBall()
    }
    .width('100%')
    .height('100%')
    .backgroundColor(Color.Transparent)
  }
}
