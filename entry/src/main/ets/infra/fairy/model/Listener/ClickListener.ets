export interface ClickListener {
  /**
   * 点击事件响应
   * @param {GestureEvent} event - 手势事件
   */
  onAction: (event: GestureEvent) => void;
}