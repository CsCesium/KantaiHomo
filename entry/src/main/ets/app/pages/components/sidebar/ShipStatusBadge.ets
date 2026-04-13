import { ShipSpecialEquip, ShipState } from '../../../../features/state/type';

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
const RING_STROKE_WIDTH = 3.5;
const TICK_COLOR = '#ffffff';
const TICK_OUTER_PAD = 2;
const TICK_INNER_PAD = 2;
const SUPPLY_BAR_WIDTH = 4;
const SUPPLY_BAR_GAP = 3;
const SUPPLY_PANEL_WIDTH = SUPPLY_BAR_WIDTH * 2 + SUPPLY_BAR_GAP;
const SUPPLY_LABEL_SIZE = 8;
const STATUS_PANEL_WIDTH = 18;

/**
 * 舰娘状态徽章 — 展示单艘舰娘的圆形头像、HP 环、特殊装备角标和补给指示符。
 *
 * 布局（横向）：
 *   [HP环 + 头像圆 + 装备角标] [油/弹剩余竖条] [Lv/Cond 状态]
 *
 * @param ship        舰娘状态数据
 * @param equip       特殊装备状态（损管/女神）
 * @param totalHeight 该条目可用的总高度（vp），用于计算圆的大小
 * @param totalWidth  侧边栏总宽度（vp）
 */
@ComponentV2
export default struct ShipStatusBadge {
  @Param ship: ShipState = {
    uid: 0, masterId: 0, name: '', level: 0,
    hpNow: 0, hpMax: 1, cond: 49,
    fuel: 0, ammo: 0, fuelMax: 0, ammoMax: 0,
    needsResupply: false, slots: [], exSlot: 0,
    hpPercent: 1, isTaiha: false, isChuuha: false,
  };
  @Param equip: ShipSpecialEquip = { hasDamageControl: false, hasGoddess: false };
  @Param totalHeight: number = 48;
  @Param totalWidth: number = 48;

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
      this.totalWidth - SUPPLY_PANEL_WIDTH - STATUS_PANEL_WIDTH - 6
    ) - 4;
    return Math.max(available, 18);
  }

  @Computed
  get avatarDiam(): number {
    return this.ringDiam - RING_STROKE_WIDTH * 2 - 4;
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
  get badgeLabel(): string {
    return this.equip.hasGoddess ? '神' : '損';
  }

  @Computed
  get badgeBgColor(): string {
    return this.equip.hasGoddess ? '#c0a000' : '#8b1a1a';
  }

  @Computed
  get nameFontSize(): number {
    return Math.max(Math.floor(this.avatarDiam * 0.22), 7);
  }

  @Computed
  get badgeFontSize(): number {
    return Math.max(Math.floor(this.badgeSize * 0.55), 6);
  }

  @Computed
  get badgeOffsetX(): number {
    return this.ringDiam / 2 - this.badgeSize / 2 - 1;
  }

  @Computed
  get badgeOffsetY(): number {
    return this.ringDiam / 2 - this.badgeSize / 2 - 1;
  }

  @Computed
  get fuelPct(): number {
    return this.ship.fuelMax > 0 ? Math.max(Math.min(this.ship.fuel / this.ship.fuelMax, 1), 0) : 0;
  }

  @Computed
  get ammoPct(): number {
    return this.ship.ammoMax > 0 ? Math.max(Math.min(this.ship.ammo / this.ship.ammoMax, 1), 0) : 0;
  }

  /** HP 颜色 */
  private hpColor(): string {
    const pct = this.ship.hpMax > 0 ? this.ship.hpNow / this.ship.hpMax : 1;
    if (pct > 0.5) return HP_COLOR_GREEN;
    if (pct > 0.25) return HP_COLOR_YELLOW;
    return HP_COLOR_RED;
  }

  private ratioColor(pct: number): string {
    const clampPct = Math.max(Math.min(pct, 1), 0);
    const colorGreen = { r: 76, g: 175, b: 80 };
    const colorYellow = { r: 255, g: 235, b: 59 };
    const colorRed = { r: 244, g: 67, b: 54 };

    if (clampPct < 0.2) {
      return `rgb(${colorRed.r}, ${colorRed.g}, ${colorRed.b})`;
    }

    const from = clampPct >= 0.5 ? colorYellow : colorRed;
    const to = clampPct >= 0.5 ? colorGreen : colorYellow;
    const span = clampPct >= 0.5 ? 0.5 : 0.3;
    const normalized = clampPct >= 0.5 ? (clampPct - 0.5) / span : (clampPct - 0.2) / span;

    const r = Math.round(from.r + (to.r - from.r) * normalized);
    const g = Math.round(from.g + (to.g - from.g) * normalized);
    const b = Math.round(from.b + (to.b - from.b) * normalized);
    return `rgb(${r}, ${g}, ${b})`;
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
  private supplyBar(valuePct: number, label: string): void {
    Column({ space: 2 }) {
      Stack({ alignContent: Alignment.Bottom }) {
        Column() {}
          .width(SUPPLY_BAR_WIDTH)
          .height(this.ringDiam - SUPPLY_LABEL_SIZE - 2)
          .backgroundColor('#303030')
          .borderRadius(2)

        Column() {}
          .width(SUPPLY_BAR_WIDTH)
          .height((this.ringDiam - SUPPLY_LABEL_SIZE - 2) * valuePct)
          .backgroundColor(this.ratioColor(valuePct))
          .borderRadius(2)
      }

      Text(label)
        .width(SUPPLY_BAR_WIDTH + 2)
        .fontSize(7)
        .fontColor('#bdbdbd')
        .textAlign(TextAlign.Center)
    }
  }

  @Builder
  private statusPanel(): void {
    Column({ space: 2 }) {
      Text(`Lv.${this.ship.level}`)
        .fontSize(8)
        .fontColor('#d9d9d9')
        .maxLines(1)
      Text(`Cond.${this.ship.cond}`)
        .fontSize(8)
        .fontColor('#d9d9d9')
        .maxLines(1)
    }
    .width(STATUS_PANEL_WIDTH)
    .alignItems(HorizontalAlign.Start)
    .justifyContent(FlexAlign.Center)
  }

  build() {
    Row({ space: 3 }) {
      // 主体：HP 环（Canvas）+ 头像圆 + 装备角标，重叠在 Stack 内
      Stack({ alignContent: Alignment.Center }) {
        // HP 环 Canvas（最底层）
        Canvas(this.context)
          .width(this.ringDiam)
          .height(this.ringDiam)
          .onReady(() => this.drawRing())

        // 头像圆（名称文字占位符）
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

        // 损管/女神角标（右下角）
        if (this.hasEquip) {
          Text(this.badgeLabel)
            .width(this.badgeSize)
            .height(this.badgeSize)
            .borderRadius(this.badgeSize / 2)
            .backgroundColor(this.badgeBgColor)
            .fontColor($r('sys.color.comp_background_secondary'))
            .fontSize(this.badgeFontSize)
            .textAlign(TextAlign.Center)
            .align(Alignment.BottomEnd)
            .offset({ x: this.badgeOffsetX, y: this.badgeOffsetY })
        }
      }
      .width(this.ringDiam)
      .height(this.ringDiam)

      // 右侧油/弹余量竖条
      Row({ space: SUPPLY_BAR_GAP }) {
        this.supplyBar(this.fuelPct, '油')
        this.supplyBar(this.ammoPct, '弹')
      }
      .width(SUPPLY_PANEL_WIDTH)
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Bottom)

      // 油弹条右侧状态信息
      this.statusPanel()
    }
    .width(this.totalWidth)
    .height(this.totalHeight)
    .justifyContent(FlexAlign.Center)
    .alignItems(VerticalAlign.Center)
  }
}
