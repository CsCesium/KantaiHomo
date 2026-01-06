export interface DragListener {
  /**
   * 拖拽开始回调
   * @param {GestureEvent} event - 手势事件
   */
  onActionStart: (event: GestureEvent) => void;
  /**
   * 拖拽过程回调
   * @param {GestureEvent} event - 手势事件
   */
  onActionUpdate: (event: GestureEvent) => void;
  /**
   * 拖拽结束回调
   * @param {GestureEvent} event - 手势事件
   */
  onActionEnd: (event: GestureEvent) => void;
}