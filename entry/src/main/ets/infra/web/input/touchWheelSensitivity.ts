export const TOUCH_WHEEL_SENSITIVITY_DEFAULT_PERCENT: number = 100;
export const TOUCH_WHEEL_SENSITIVITY_MIN_PERCENT: number = 25;
export const TOUCH_WHEEL_SENSITIVITY_MAX_PERCENT: number = 300;
export const TOUCH_WHEEL_SENSITIVITY_STEP_PERCENT: number = 5;

const TOUCH_WHEEL_BASE_SCALE: number = 1.35;

export function normalizeTouchWheelSensitivityPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return TOUCH_WHEEL_SENSITIVITY_DEFAULT_PERCENT;
  }
  const stepped: number =
    Math.round(value / TOUCH_WHEEL_SENSITIVITY_STEP_PERCENT) * TOUCH_WHEEL_SENSITIVITY_STEP_PERCENT;
  return Math.min(
    TOUCH_WHEEL_SENSITIVITY_MAX_PERCENT,
    Math.max(TOUCH_WHEEL_SENSITIVITY_MIN_PERCENT, stepped),
  );
}

export function resolveTouchWheelScale(percent: number): number {
  return TOUCH_WHEEL_BASE_SCALE * normalizeTouchWheelSensitivityPercent(percent) / 100;
}
