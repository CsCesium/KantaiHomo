//only for solve warning
import router from '@ohos.router';
import WebHost from '../../infra/web/WebHost';
import { notifyWebHostPageVisible } from '../../infra/web/pageVisibility';

@Entry
@Component
struct WebRoot {
  onPageShow(): void {
    notifyWebHostPageVisible();
  }

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
