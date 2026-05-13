//only for solve warning
import router from '@ohos.router';
import WebHost from '../../infra/web/WebHost'

@Entry
@Component
struct WebRoot {
  onBackPress(): boolean {
    router.pushUrl({
      url: 'app/pages/Launcher',
      params: { resumeGame: true }
    }).catch(() => {});
    return true;
  }

  build() {
    Column() {
      WebHost()
    }
    .width('100%')
    .height('100%')
  }
}
