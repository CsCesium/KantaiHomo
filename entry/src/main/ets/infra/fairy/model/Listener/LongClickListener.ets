export interface LongClickListener {
  /**
   * 长按开始回调
   * @param {GestureEvent} event - 手势事件
   * @param {boolean} isDisable - 是否禁用
   */
  onAction: (event: GestureEvent, isDisable: boolean) => void;
  /**
   * 长按结束回调
   * @param {GestureEvent} event - 手势事件
   * @param {boolean} isDisable - 是否禁用
   */
  onActionEnd: (event: GestureEvent, isDisable: boolean) => void;
  /**
   * 长按取消回调
   * @param {boolean} isDisable - 是否禁用
   */
  onActionCancel: (isDisable: boolean) => void;
}