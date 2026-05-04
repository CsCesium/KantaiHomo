import { ShipSpecialEquip, ShipState } from '../../../../features/state/type';
import { getShipGraphFilename, getGameServerUrl, isShipEscaped } from '../../../../features/state';
import { getShipBannerUrl } from '../../../../features/game/shipGraph';
import { equipLabel } from '../../../../features/panel/panelConfig';
import { SlotItemIconId } from '../../../../domain/models/struct/slotitem';

/**
 * HP 颜色常量（按损伤等级）
 * 绿色: HP > 50%（小破以上）
 * 黄色: 25% < HP ≤ 50%（中破）
 * 红色: HP ≤ 25%（大破）
 */
const HP_COLOR_GREEN = '#4caf50';
const HP_COLOR_YELLOW = '#ffeb3b';
const HP_COLOR_RED = '#f44336';
const HP_COLOR_BG = '#2a2a2a';
const ESCAPE_LABEL_COLOR = '#42a5f5';
const RING_STROKE_WIDTH = 3.5;
const TICK_COLOR = '#ffffff';
const TICK_OUTER_PAD = 2;
const TICK_INNER_PAD = 2;
const STATUS_PANEL_WIDTH = 24;
const DAMAGE_CONTROL_ICON_ID = SlotItemIconId.DamageControl;
const DAMAGE_BADGE_BG = '#00000088';
const DAMAGE_BADGE_BORDER = '#FFFFFFCC';
const SHIP_BANNER_ASPECT_RATIO = 4;

/**
 * 舰娘状态徽章 — 展示单艘舰娘的圆形头像、HP 环、特殊装备角标和补给指示符。
 *
 * 布局（横向）：
 *   [HP环 + 头像圆 + 损管/女神(按需)] [补给⚠(按需) + Cond emoji+数值]
 *
 * @param ship        舰娘状态数据
 * @param equip       特殊装备状态（损管/女神）
 * @param totalHeight 该条目可用的总高度（vp），用于计算圆的大小
 * @param totalWidth  侧边栏总宽度（vp）
 */
class CondVisual {
  symbol: string
  valueColor: string

  constructor(symbol: string, valueColor: string) {
    this.symbol = symbol
    this.valueColor = valueColor
  }
}

@ComponentV2
export default struct ShipStatusBadge {
  @Param ship: ShipState = {
    uid: 0, masterId: 0, name: '', level: 0,
    hpNow: 0, hpMax: 1, cond: 49,
    fuel: 0, ammo: 0, fuelMax: 0, ammoMax: 0,
    needsResupply: false, slotCount:0, slots: [],onslot: [], exSlot: 0, scoutCur: 0,
    hpPercent: 1, isTaiha: false, isChuuha: false,
  };
  @Param equip: ShipSpecialEquip = { hasDamageControl: false, hasGoddess: false };
  @Param totalHeight: number = 48;
  @Param totalWidth: number = 60;
  @Local private failedAvatarUrl: string = '';

  // Canvas 渲染上下文，在整个组件生命周期内复用
  private context: CanvasRenderingContext2D =
    new CanvasRenderingContext2D(new RenderingContextSettings(true));

  /** 当舰娘状态变化（HP 等）时触发重绘 */
  @Monitor('ship')
  onShipChanged(): void {
    this.drawRing();
  }

  // ── 派生尺寸（@Computed 缓存避免 build 内声明变量） ──

  @Computed
  get ringDiam(): number {
    const available = Math.min(
      this.totalHeight,
      this.totalWidth - STATUS_PANEL_WIDTH - 3
    ) - 4;
    return Math.max(available, 18);
  }

  @Computed
  get avatarDiam(): number {
    return this.ringDiam - RING_STROKE_WIDTH * 2 - 4;
  }

  @Computed
  get avatarBannerWidth(): number {
    return Math.ceil(this.avatarDiam * SHIP_BANNER_ASPECT_RATIO);
  }

  @Computed
  get badgeSize(): number {
    return Math.max(Math.floor(this.ringDiam * 0.32), 12);
  }

  @Computed
  get hasEquip(): boolean {
    return this.equip.hasGoddess || this.equip.hasDamageControl;
  }

  @Computed
  get badgeIconPath(): string {
    return equipLabel(DAMAGE_CONTROL_ICON_ID);
  }

  @Computed
  get badgeBgColor(): string {
    return DAMAGE_BADGE_BG;
  }

  @Computed
  get badgeBorderColor(): string {
    return DAMAGE_BADGE_BORDER;
  }

  @Computed
  get nameFontSize(): number {
    return Math.max(Math.floor(this.avatarDiam * 0.22), 7);
  }

  @Computed
  get avatarUrl(): string {
    const filename = getShipGraphFilename(this.ship.masterId);
    const serverBase = getGameServerUrl();
    if (!filename || !serverBase) return '';
    return getShipBannerUrl(this.ship.masterId, filename, serverBase);
  }

  @Computed
  get shouldShowAvatarImage(): boolean {
    return this.avatarUrl.length > 0 && this.failedAvatarUrl !== this.avatarUrl;
  }

  @Computed
  get badgePositionX(): number {
    return this.ringDiam - RING_STROKE_WIDTH - this.badgeSize-2;
  }

  @Computed
  get badgePositionY(): number {
    return this.ringDiam - RING_STROKE_WIDTH - this.badgeSize-2;
  }

  /** HP 颜色 */
  private hpColor(): string {
    const pct = this.ship.hpMax > 0 ? this.ship.hpNow / this.ship.hpMax : 1;
    if (pct > 0.5) return HP_COLOR_GREEN;
    if (pct > 0.25) return HP_COLOR_YELLOW;
    return HP_COLOR_RED;
  }

  @Builder
  private damageControlBadge(): void {
    Image(this.badgeIconPath)
      .width(this.badgeSize)
      .height(this.badgeSize)
      .borderRadius(this.badgeSize / 2)
      .backgroundColor(this.badgeBgColor)
      .border({ width: 1, color: this.badgeBorderColor })
      .objectFit(ImageFit.Contain)
      .padding(1)
  }

  @Builder
  private avatarFallback(): void {
    Text(this.ship.name)
      .width(this.avatarDiam)
      .height(this.avatarDiam)
      .borderRadius(this.avatarDiam / 2)
      .backgroundColor('#1e1e1e')
      .fontColor('#cccccc')
      .fontSize(this.nameFontSize)
      .textAlign(TextAlign.Center)
      .maxLines(2)
      .textOverflow({ overflow: TextOverflow.Clip })
      .padding(2)
  }

  private condVisual(cond: number): CondVisual {
    if (cond > 50) {
      return new CondVisual('😎', '#F6C64A')
    }
    if (cond > 30) {
      return new CondVisual('😊', '#FFFFFF')
    }
    if (cond >= 20) {
      return new CondVisual('🙃', '#FF9F43')
    }
    return new CondVisual('😡', '#FF5A5A')
  }
  /** 绘制 HP 环到 Canvas */
  private drawRing(): void {
    const diam = this.ringDiam;
    const c = this.context;
    c.clearRect(0, 0, diam, diam);

    const r = (diam - RING_STROKE_WIDTH) / 2;
    const cx = diam / 2;
    const cy = diam / 2;
    const hpPct = this.ship.hpMax > 0 ? this.ship.hpNow / this.ship.hpMax : 1;
    const startAngle = -Math.PI / 2;

    // 背景环（灰色满圆）
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.strokeStyle = HP_COLOR_BG;
    c.lineWidth = RING_STROKE_WIDTH;
    c.stroke();

    // HP 弧（从顶部顺时针，比例 = hpPct）
    if (hpPct > 0) {
      const endAngle = startAngle - Math.PI * 2 * Math.min(hpPct, 1);
      c.beginPath();
      c.arc(cx, cy, r, startAngle, endAngle, true);
      c.strokeStyle = this.hpColor();
      c.lineWidth = RING_STROKE_WIDTH;
      c.lineCap = 'butt';
      c.stroke();
    }

    // 阈值刻度线（50% 中破 / 25% 大破）
    const drawTick = (fraction: number): void => {
      const angle = startAngle - Math.PI * 2 * fraction;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const outerR = r + RING_STROKE_WIDTH / 2 + TICK_OUTER_PAD;
      const innerR = r - RING_STROKE_WIDTH / 2 - TICK_INNER_PAD;
      c.beginPath();
      c.moveTo(cx + innerR * cos, cy + innerR * sin);
      c.lineTo(cx + outerR * cos, cy + outerR * sin);
      c.strokeStyle = TICK_COLOR;
      c.lineWidth = 1;
      c.stroke();
    };
    drawTick(0.5);   // 50% 中破线
    drawTick(0.25);  // 25% 大破线
  }

  @Builder
  private statusPanel(): void {
    Column({ space: 3 }) {
      // 补给不足图标（仅在需要补给时显示）
      if (this.ship.needsResupply) {
        Text('⚠')
          .fontSize(10)
          .fontColor('#FF9F43')
          .maxLines(1)
      }
      // Cond：emoji icon + 数值
      Row({ space: 2 }) {
        Text(this.condVisual(this.ship.cond).symbol)
          .fontSize(10)
          .maxLines(1)
        Text(`${this.ship.cond}`)
          .fontSize(8)
          .fontColor(this.condVisual(this.ship.cond).valueColor)
          .maxLines(1)
      }
      .alignItems(VerticalAlign.Center)
    }
    .width(STATUS_PANEL_WIDTH)
    .alignItems(HorizontalAlign.Center)
    .justifyContent(FlexAlign.Center)
  }

  build() {
    Row({ space: 3 }) {
      // 主体：HP 环（Canvas）+ 头像圆
      Stack({ alignContent: Alignment.Center }) {
        // HP 环 Canvas（最底层）
        Canvas(this.context)
          .width(this.ringDiam)
          .height(this.ringDiam)
          .onReady(() => this.drawRing())

        // 头像圆 — 图片不可用时回退到舰名文字。
        if (this.shouldShowAvatarImage) {
          Stack({ alignContent: Alignment.TopStart }) {
            Image(this.avatarUrl)
              .width(this.avatarBannerWidth)
              .height(this.avatarDiam)
              .objectFit(ImageFit.Fill)
              .onError(() => {
                this.failedAvatarUrl = this.avatarUrl;
              })
          }
            .width(this.avatarDiam)
            .height(this.avatarDiam)
            .borderRadius(this.avatarDiam / 2)
            .backgroundColor('#1e1e1e')
            .clip(true)
        } else {
          this.avatarFallback()
        }

        // 损管/女神标记留在头像框内，沿右下角向内贴住 HP 环。
        if (this.hasEquip) {
          Stack() {
            this.damageControlBadge()
          }
            .width(this.badgeSize)
            .height(this.badgeSize)
            .position({ x: this.badgePositionX, y: this.badgePositionY })
        }

        // 退避（goback_port）标签 — 蓝色，盖在头像下沿
        if (isShipEscaped(this.ship.uid)) {
          Text('退避')
            .fontSize(this.nameFontSize + 1)
            .fontColor(ESCAPE_LABEL_COLOR)
            .fontWeight(FontWeight.Bold)
            .backgroundColor('#CC000000')
            .padding({ left: 2, right: 2 })
            .borderRadius(2)
        }
      }
      .width(this.ringDiam)
      .height(this.ringDiam)

      // 补给状态 + Cond
      this.statusPanel()
    }
    .width(this.totalWidth)
    .height(this.totalHeight)
    .justifyContent(FlexAlign.Center)
    .alignItems(VerticalAlign.Center)
  }
}
