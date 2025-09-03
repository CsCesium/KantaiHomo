import {webview} from "@kit.ArkWeb"

@Entry
@Component
export default struct WebHost{
  private controller: webview.WebviewController = new webview.WebviewController();

  private readonly HOME = 'htts://www.google.com';
  aboutToAppear() {
    //develop only, dev log
    try{
      webview.WebviewController.setWebDebuggingAccess(true);
    }catch{
    }

    this.controller
  }
}