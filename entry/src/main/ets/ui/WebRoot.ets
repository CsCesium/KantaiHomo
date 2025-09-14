//only for solve warning
import WebHost from '../infra/web/WebHost';

@Entry
@Component
struct WebRoot {
  build() {
    Column() {
      WebHost()
    }
    .width('100%')
    .height('100%')
  }
}