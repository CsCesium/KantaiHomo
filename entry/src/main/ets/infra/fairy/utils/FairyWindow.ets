import { CustomTheme, display, promptAction, window } from "@kit.ArkUI";
import {BusinessError} from '@kit.BasicServicesKit'
import { CommonConstants } from "../common/commonConstants";
import { CustomTool } from "../model/CustomTool";
import { ClickListener } from "../model/Listener/ClickListener";
import { DragListener } from "../model/Listener/DragListener";
import { LongClickListener } from "../model/Listener/LongClickListener";
import { ToolTouchInterface } from "../model/ToolTouchInterface";
import { vibrator } from "@kit.SensorServiceKit";
import { ChildTool } from "../model/ChildTool";
import { NumOffset } from "../model/NumOffset";
import { it } from "@ohos/hypium";
import { ToolInterface } from "../model/ToolInterface";

enum Direction {
  LEFT,
  RIGHT
}

enum VerticalAlignment {
  TOP,
  BOTTOM,
  DEFAULT
}

@Component
export struct FairyWindow{
  toolList:CustomTool[]=[];
  maxTools:number=CommonConstants.MAXIMUM_TOOLS;
  layoutSpanDeg:number = CommonConstants.LAYOUT_SPAN_DEG;
  //floatBall UI
  @BuilderParam floatBall:($$:ToolTouchInterface)=>void=this.toolTouch;
  //tool-related parameters
  threshold: number | string = CommonConstants.ADSORPTION_THRESHOLD;
  toolItemHeight: number = CommonConstants.TOOL_ITEM_HEIGHT;
  maximumDistance: number = CommonConstants.MAXIMUM_DISTANCE;
  //floatBall pile priority
  level: number = Number.MAX_VALUE;
  visible: boolean = true;

  //behaviors
  onOpenDashboard: () => void = () => {};
  onRequestHide: () => void = () => {};

  //listeners
  clickListener: ClickListener = { onAction: (event: GestureEvent) => {} };
  longClickListener: LongClickListener = {
    onAction: (event: GestureEvent, isDisable: boolean) => {},
    onActionEnd: (event: GestureEvent, isDisable: boolean) => {},
    onActionCancel: (isDisable: boolean) => {}
  };
  dragListener: DragListener = {
    onActionStart: (event: GestureEvent) => {},
    onActionUpdate: (event: GestureEvent) => {},
    onActionEnd: (event: GestureEvent) => {}
  };

  //States parameters
  @State offsetX: number | undefined = undefined;
  @State offsetY: number | undefined = undefined;

  @State unfoldDirection: Direction = Direction.LEFT;
  @State verticalAlignment: VerticalAlignment = VerticalAlignment.TOP;

  @State cW: number = 0;
  @State cH: number = 0;

  @State avoidSysHeight: number = 0;

  private avoidNavHeight: number = 0;
  private initialH: number = 0;
  private initialW: number = 0;
  private screenH: number = 0;
  private screenW: number = 0;

  private offsetX_: number = 0;
  private offsetY_: number = 0;
  private screenOrientation: number = 0;//0-vertical 1-landscape

  private realThreshold: number = 0;
  private leftMargin: number = 0;
  private topMargin: number = 0;
  private initialX: number = 0;
  private initialY: number = 0;

  @State menuOpen: boolean = false;
  //delay for preventing illegal behavior when twice-tap
  private singleTapTimer: number = -1;


  aboutToAppear() {
    let d:display.Display = display.getDefaultDisplaySync();
    this.initialW = this.screenW = px2vp(d.width);
    this.initialH = this.screenH = px2vp(d.height);

    let mainWindow = window.getLastWindow(this.getUIContext().getHostContext());
    mainWindow.then((mw) => {
      let avoidArea = mw.getWindowAvoidArea(window.AvoidAreaType.TYPE_NAVIGATION_INDICATOR);
      this.avoidNavHeight = px2vp(avoidArea.bottomRect.height);
      avoidArea = mw.getWindowAvoidArea(window.AvoidAreaType.TYPE_SYSTEM);
      this.avoidSysHeight = px2vp(avoidArea.topRect.height);
    })
  }

  notifyOrientationChange() {
    if (this.offsetX !== undefined && this.offsetY !== undefined) {
      this.screenOrientation = 1 & display.getDefaultDisplaySync().orientation;
      let left = this.offsetX;
      let right = this.screenW - left - this.cW;
      let top = this.offsetY;
      let bottom = this.screenH - top - this.cH;

      this.unfoldDirection = left <= right ? Direction.RIGHT : Direction.LEFT;

      let newScreenW = this.screenOrientation === 0 ? this.initialW : this.initialH;
      let newScreenH = this.screenOrientation === 0 ? this.initialH : this.initialW;

      this.offsetX = left <= right
        ? (left / this.screenW * newScreenW)
        : (newScreenW - (right / this.screenW) * newScreenW - this.cW);

      this.offsetY = top <= bottom
        ? (top / this.screenH * newScreenH)
        : (newScreenH - (bottom / this.screenH) * newScreenH - this.cH);

      this.screenH = newScreenH;
      this.screenW = newScreenW;

      let mainWindow = window.getLastWindow(this.getUIContext().getHostContext());
      mainWindow.then((mw) => {
        let avoidArea = mw.getWindowAvoidArea(window.AvoidAreaType.TYPE_NAVIGATION_INDICATOR);
        this.avoidNavHeight = px2vp(avoidArea.bottomRect.height);
        avoidArea = mw.getWindowAvoidArea(window.AvoidAreaType.TYPE_SYSTEM);
        this.avoidSysHeight = px2vp(avoidArea.topRect.height);
      })
    }
  }

  private getBaseOffset(index: number, count: number): NumOffset {
    const R = this.maximumDistance;

    let startDeg = -90;
    let endDeg = 90;

    switch (this.verticalAlignment) {
      case VerticalAlignment.TOP:
        startDeg = 0; endDeg = 90;
        break;
      case VerticalAlignment.BOTTOM:
        startDeg = -90; endDeg = 0;
        break;
      default:
        break;
    }

    if (count <= 1) {
      const mid = (startDeg + endDeg) / 2;
      const rad = mid * Math.PI / 180;
      return { x: R * Math.cos(rad), y: R * Math.sin(rad) };
    }

    const step = (endDeg - startDeg) / (count - 1);
    const deg = startDeg + index * step;
    const rad = deg * Math.PI / 180;

    return { x: R * Math.cos(rad), y: R * Math.sin(rad) };
  }

  private applyDirection(off: NumOffset): NumOffset {
    return this.unfoldDirection === Direction.RIGHT
      ? { x: off.x, y: off.y }
      : { x: -off.x, y: off.y };
  }

  private getDynamicOffset(index: number, count: number): NumOffset {
    return this.applyDirection(this.getBaseOffset(index, count));
  }

  //gesture-related
  private toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  private doOpenDashboard() {
    this.onOpenDashboard();
  }

  private doHide() {
    vibrator.startVibration({
      type: 'preset',
      effectId: 'haptic.clock.timer',
      count: 1,
    }, { id: 0, usage: 'alarm' }, (error: BusinessError) => {});
    this.menuOpen = false;
    this.onRequestHide();
  }

  build() {
    RelativeContainer(){
      Stack({ alignContent: Alignment.Center }) {
        ForEach(this.toolList,(item:CustomTool,index:number)=>{
          ChildTool({
            builder:item.builder,
            params:item.attributeSet.params,
            animationAttribute:item.attributeSet.animation
          })
            .offset(this.menuOpen ? this.getDynamicOffset(index, this.toolList.length) : { x: 0, y: 0 })
            .opacity(this.menuOpen ? 1 : 0)
            .scale({ x: this.menuOpen ? 1 : 0.2, y: this.menuOpen ? 1 : 0.2 })
            .animation({
              duration: 200,
              curve: Curve.EaseOut,
              delay: index * 30, // ordered
              playMode: PlayMode.Normal
            })
        })

        Column(){
          this.floatBall({isDisable:false});
        }
        .id("button")
        .height(CommonConstants.FULL_PERCENT)
        .width(CommonConstants.FULL_PERCENT)
        .background(Color.Transparent)
        .gesture(
          GestureGroup(GestureMode.Exclusive,
            PanGesture()
              .onActionStart((event:GestureEvent)=> {
              this.offsetX_ = 0;
              this.offsetY_ = 0;
              if(this.menuOpen) this.menuOpen=false;
              this.dragListener.onActionStart(event);
            })
              .onActionUpdate((event:GestureEvent)=> {
                let curX = Math.max((this.offsetX ?? 0) + event.offsetX - this.offsetX_, -this.leftMargin);
                let curY = Math.max((this.offsetY ?? 0) + event.offsetY - this.offsetY_, this.topMargin);

                curX = Math.min(curX, this.screenW - this.cW - this.leftMargin - this.initialX);
                curY = Math.min(curY, this.screenH - this.cH - this.avoidSysHeight - this.avoidNavHeight - this.initialY);

                this.offsetX_ += curX - (this.offsetX ?? 0);
                this.offsetY_ += curY - (this.offsetY ?? 0);
                this.offsetX = curX;
                this.offsetY = curY;

                let left: number = this.offsetX;
                let rightMargin: number = this.screenW - left - this.cW;
                this.unfoldDirection = left <= rightMargin ? Direction.RIGHT : Direction.LEFT;

                if (this.offsetY + this.cH / 2 - this.toolItemHeight / 2 - this.maximumDistance <= this.topMargin) {
                  this.verticalAlignment = VerticalAlignment.TOP;
                } else if (this.offsetY - this.cH / 2 + this.toolItemHeight / 2 + this.maximumDistance >=
                  this.screenH - this.cH - this.avoidSysHeight - this.avoidNavHeight - this.initialY) {
                  this.verticalAlignment = VerticalAlignment.BOTTOM;
                } else {
                  this.verticalAlignment = VerticalAlignment.DEFAULT;
                }
                this.dragListener.onActionUpdate(event);
              })
              .onActionEnd((event:GestureEvent)=> {
                let left: number = (this.offsetX ?? 0);
                this.closeToBorder(left, left + this.cW, 0, this.screenW, this.realThreshold);
                this.dragListener.onActionEnd(event);
              }),
            LongPressGesture({duration:4000})
              .onAction((event: GestureEvent) => {
               this.longClickListener.onAction(event,false);
               this.doHide();
              })
              .onActionEnd((event: GestureEvent) => {
                this.longClickListener.onActionEnd(event,false);
              })
              .onActionCancel((event: GestureEvent) => {
                this.longClickListener.onActionCancel(false);
              }),
            //TODO:Tap
            TapGesture({count:2})
              .onAction((event: GestureEvent) => {
                if(this.singleTapTimer!==-1){
                  clearTimeout(this.singleTapTimer);
                  this.singleTapTimer=-1
                }
                this.toggleMenu();
              }),
            TapGesture({count:1})
              .onAction((event: GestureEvent) => {
                this.clickListener.onAction(event);

                if (this.singleTapTimer !== -1) {
                  clearTimeout(this.singleTapTimer);
                }
                this.singleTapTimer = setTimeout(() => {
                  this.singleTapTimer = -1;
                  this.doOpenDashboard();
                }, 220);
              })
            // TODO: TapGesture Count=1 and Count=2 conflict may occur.use a custom onTouch implementation to handle single/double click.
          )
        )
        .onTouch((event: TouchEvent) => {
          // handle click/double click based on event
          //TODO: handle
        })
      }
    }
    .visibility(this.visible ? Visibility.Visible : Visibility.None)
    .offset({
      x: ((this.offsetX ?? 0) + "vp"),
      y: ((this.offsetY ?? 0) + "vp")
    })
    .onAreaChange((_oldValue: Area, newValue: Area) => {
      this.cW = Number.parseFloat(newValue.width.toString());
      this.cH = Number.parseFloat(newValue.height.toString());

      if (this.offsetX === undefined || this.offsetY === undefined) {
        this.offsetX = this.initialX =
          newValue.position.x === undefined ? 0 : Number.parseFloat(newValue.position.x.toString());
        this.offsetY = this.initialY =
          newValue.position.y === undefined ? 0 : Number.parseFloat(newValue.position.y.toString());
      }

      let left = this.offsetX ?? 0;
      let right = this.screenW - left - this.cW;
      this.unfoldDirection = left <= right ? Direction.RIGHT : Direction.LEFT;

      this.notifyOrientationChange();

      let threshold = this.threshold.toString();
      if (threshold.includes("%")) {
        this.realThreshold = Number.parseFloat(threshold.replace("%", "")) / 100 * this.screenW;
      } else {
        this.realThreshold = Number.parseFloat(threshold);
      }
    })
    .zIndex(this.level)
    .height(CommonConstants.FULL_PERCENT)
    .width(CommonConstants.FULL_PERCENT)
  }

  closeToBorder(left: number, right: number, parentLeft: number, parentRight: number, threshold: number): void {
    let distance: number = 0;
    if ((distance = left - parentLeft) < threshold || (distance = right - parentRight) > -threshold) {
      animateTo({
        duration: CommonConstants.ANIMATION_DURATION,
        iterations: 1,
        playMode: PlayMode.Normal
      }, () => {
        this.offsetX = (this.offsetX ?? 0) - distance;
      })
    }
  }

  @Builder
  toolTouch(_$$: ToolTouchInterface) {
    //TODO:change to defined Icon
    Button() {
      Button()
        .height(CommonConstants.EIGHTY_PERCENT)
        .width(CommonConstants.EIGHTY_PERCENT)
        .backgroundColor(Color.Gray)
        .opacity(0.5)
    }
    .height(CommonConstants.FULL_PERCENT)
    .width(CommonConstants.FULL_PERCENT)
    .backgroundColor(0xD3D3D3)
    .opacity(0.5)
  }
}

@Builder
function tool($$: ToolInterface) {
  //TODO:set Fairy ICON config
  Image($r("app.media.startIcon"))
    .height(CommonConstants.TOOL_ITEM_HEIGHT)
    .width(40)
    .objectFit(ImageFit.Fill)
    .onClick(() => {
      promptAction.showToast({
        message: '点击逻辑自行实现',
        duration: 2000
      })
    })
}